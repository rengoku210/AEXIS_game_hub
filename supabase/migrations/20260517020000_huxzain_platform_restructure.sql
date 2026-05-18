-- ================================================================
-- HUXZAIN Digital Marketplace — Schema Extension Migration
-- Rebrand from AEXIS + Full Platform Restructure
-- ================================================================

-- ================================================================
-- 1. EXTENDED CATEGORIES SYSTEM (16 Verticals)
-- ================================================================

-- Add parent_id for hierarchical categories + full metadata
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id),
  ADD COLUMN IF NOT EXISTS icon_name text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add index for parent hierarchy
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);

-- Seed the 16 HUXZAIN marketplace categories
-- (Run ONLY if categories table is empty or needs seeding)
INSERT INTO public.categories (slug, name, description, icon_name, sort_order, is_active, metadata)
VALUES
  ('gaming-accounts',       'Gaming Accounts',         'Buy and sell verified gaming accounts across all major titles.', 'Gamepad2',       1, true, '{"subcategories":["MOBA","FPS","Battle Royale","RPG","Sports","MMO"]}'),
  ('in-game-currency',      'In-Game Currency',        'Official and safe in-game currency for top titles.', 'Coins',           2, true, '{"subcategories":["V-Bucks","Robux","Riot Points","Gold","Gems","Coins"]}'),
  ('gift-cards',            'Gift Cards',              'Digital gift cards for Steam, PSN, Xbox, and more.', 'Gift',            3, true, '{"subcategories":["Steam","PSN","Xbox","Amazon","Google Play","iTunes"]}'),
  ('software',              'Software',                'Genuine software licenses and productivity tools.', 'Monitor',         4, true, '{"subcategories":["Licenses","Tools","Productivity","Design","Security"]}'),
  ('digital-subscriptions', 'Digital Subscriptions',  'Streaming, VPN, gaming and SaaS subscriptions.', 'RefreshCw',       5, true, '{"subcategories":["Gaming+","Streaming","VPN","Cloud Storage","SaaS"]}'),
  ('coaching-services',     'Coaching Services',       'Get coached by verified professionals.', 'GraduationCap',   6, true, '{"subcategories":["1-on-1","Group","Analysis","Strategy"]}'),
  ('boosting-services',     'Boosting Services',       'Safe rank and win boosting by elite players.', 'TrendingUp',      7, true, '{"subcategories":["Rank Boost","Win Boost","Account Leveling"]}'),
  ('gaming-services',       'Gaming Services',         'Power leveling, quest help, carry services.', 'Zap',             8, true, '{"subcategories":["Power Leveling","Quest Help","Carry","Recovery"]}'),
  ('digital-freelance',     'Digital Freelance',       'Professional digital services from verified freelancers.', 'Layers',    9, true, '{"subcategories":["Design","Development","Content","Marketing"]}'),
  ('ads-promotions',        'Ads & Promotions',        'Promote your brand or community effectively.', 'Megaphone',      10, true, '{"subcategories":["Social Media Ads","Discord Promos","Influencer"]}'),
  ('marketplace-listings',  'Marketplace Listings',   'Community-driven listings and bundle deals.', 'Star',           11, true, '{"subcategories":["Community Listings","Bundle Deals"]}'),
  ('social-media-services', 'Social Media Services',  'Grow your social presence with verified providers.', 'Users',      12, true, '{"subcategories":["Followers","Engagement","Account Management"]}'),
  ('streaming-services',    'Streaming Services',      'Twitch, YouTube, TikTok growth and management.', 'Video',       13, true, '{"subcategories":["Twitch","YouTube","TikTok","Stream Setup"]}'),
  ('digital-assets',        'Digital Assets',          'Templates, art, music, video, and other digital assets.', 'Palette', 14, true, '{"subcategories":["NFTs","Art","Templates","Music","Videos"]}'),
  ('website-app-services',  'Website/App Services',   'Web development, SEO, maintenance, and hosting.', 'Globe',       15, true, '{"subcategories":["Development","SEO","Maintenance","Hosting"]}'),
  ('expansion',             'Future Expansion',        'Reserved for upcoming marketplace verticals.', 'LayoutGrid',   16, false,'{}')
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon_name = EXCLUDED.icon_name,
      sort_order = EXCLUDED.sort_order,
      metadata = EXCLUDED.metadata;

-- ================================================================
-- 2. EXTENDED LISTINGS TABLE (Pricing + Visibility Controls)
-- ================================================================

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_negotiable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'fixed'
    CHECK (pricing_type IN ('fixed', 'negotiable', 'auction', 'subscription')),
  ADD COLUMN IF NOT EXISTS subscription_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expiry_date timestamptz,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'unlisted', 'private')),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS featured_until timestamptz,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS listing_metadata jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requires_seller_verification boolean NOT NULL DEFAULT false;

-- Index for featured + expiry queries
CREATE INDEX IF NOT EXISTS idx_listings_featured_expiry ON public.listings(is_featured, featured_until)
  WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_listings_visibility ON public.listings(visibility, status);
CREATE INDEX IF NOT EXISTS idx_listings_tags ON public.listings USING gin(tags);

-- ================================================================
-- 3. DISPUTES SYSTEM
-- ================================================================

CREATE TABLE IF NOT EXISTS public.disputes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  raised_by        uuid NOT NULL REFERENCES auth.users(id),
  raised_against   uuid NOT NULL REFERENCES auth.users(id),
  reason           text NOT NULL,
  description      text,
  evidence_urls    text[] DEFAULT '{}',
  status           text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'resolved_buyer', 'resolved_seller', 'closed')),
  resolution_note  text,
  resolved_by      uuid REFERENCES auth.users(id),
  resolved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_order ON public.disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_raised_by ON public.disputes(raised_by);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes(status, created_at DESC);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY disputes_buyer_seller_read ON public.disputes
  FOR SELECT USING (
    auth.uid() = raised_by OR auth.uid() = raised_against
  );
CREATE POLICY disputes_buyer_insert ON public.disputes
  FOR INSERT WITH CHECK (auth.uid() = raised_by);
CREATE POLICY disputes_admin_all ON public.disputes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER disputes_touch BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Link disputes to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS dispute_id uuid REFERENCES public.disputes(id);

-- ================================================================
-- 4. SELLER BALANCE & PAYOUT SYSTEM
-- ================================================================

CREATE TABLE IF NOT EXISTS public.seller_balances (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id             uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  available_inr         numeric(12,2) NOT NULL DEFAULT 0,
  pending_inr           numeric(12,2) NOT NULL DEFAULT 0,
  lifetime_earned_inr   numeric(12,2) NOT NULL DEFAULT 0,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY seller_balance_self_read ON public.seller_balances
  FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY seller_balance_admin_all ON public.seller_balances
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Bank accounts (encrypted storage, admin-verified)
CREATE TABLE IF NOT EXISTS public.seller_bank_accounts (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_holder_name      text NOT NULL,
  account_number_last4     text NOT NULL, -- store only last 4 digits
  ifsc_code                text NOT NULL,
  bank_name                text NOT NULL,
  upi_id                   text,
  is_primary               boolean NOT NULL DEFAULT false,
  is_verified              boolean NOT NULL DEFAULT false,
  verified_by              uuid REFERENCES auth.users(id),
  verified_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_accounts_self ON public.seller_bank_accounts
  FOR ALL USING (auth.uid() = seller_id);
CREATE POLICY bank_accounts_admin ON public.seller_bank_accounts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Payout requests
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id        uuid NOT NULL REFERENCES auth.users(id),
  bank_account_id  uuid REFERENCES public.seller_bank_accounts(id),
  amount_inr       numeric(12,2) NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'processing', 'paid', 'rejected')),
  admin_note       text,
  processed_by     uuid REFERENCES auth.users(id),
  processed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_seller ON public.payout_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON public.payout_requests(status, created_at DESC);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY payout_self_read ON public.payout_requests
  FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY payout_self_insert ON public.payout_requests
  FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY payout_admin_all ON public.payout_requests
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER payout_requests_touch BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ================================================================
-- 5. FRAUD DETECTION LOGS
-- ================================================================

CREATE TABLE IF NOT EXISTS public.fraud_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id),
  event_type    text NOT NULL, -- 'suspicious_login'|'rapid_orders'|'off_platform_deal'|'chargeback'
  severity      text NOT NULL DEFAULT 'low'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details       jsonb DEFAULT '{}',
  ip_address    text,
  user_agent    text,
  reviewed      boolean NOT NULL DEFAULT false,
  reviewed_by   uuid REFERENCES auth.users(id),
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_logs_user ON public.fraud_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_severity ON public.fraud_logs(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_unreviewed ON public.fraud_logs(reviewed, created_at DESC)
  WHERE reviewed = false;

ALTER TABLE public.fraud_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY fraud_logs_admin_all ON public.fraud_logs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ================================================================
-- 6. ADMIN AUDIT LOGS (Every admin action tracked)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     uuid NOT NULL REFERENCES auth.users(id),
  action       text NOT NULL,   -- 'ban_user'|'approve_listing'|'resolve_dispute'|'approve_payout'|etc.
  target_type  text NOT NULL,   -- 'user'|'listing'|'order'|'dispute'|'payout'|'report'
  target_id    uuid,
  before_state jsonb,           -- snapshot before action
  after_state  jsonb,           -- snapshot after action
  details      jsonb DEFAULT '{}',
  ip_address   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON public.admin_audit_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.admin_audit_logs(target_type, target_id);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_admin_read ON public.admin_audit_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY audit_logs_admin_insert ON public.admin_audit_logs
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ================================================================
-- 7. ACCOUNT STRIKES SYSTEM
-- ================================================================

CREATE TABLE IF NOT EXISTS public.account_strikes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issued_by    text NOT NULL,  -- admin UUID or 'system'
  reason       text NOT NULL,
  strike_type  text NOT NULL DEFAULT 'warning'
    CHECK (strike_type IN ('warning', 'strike', 'ban')),
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strikes_user ON public.account_strikes(user_id, created_at DESC);

ALTER TABLE public.account_strikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY strikes_admin_all ON public.account_strikes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY strikes_self_read ON public.account_strikes
  FOR SELECT USING (auth.uid() = user_id);

-- Function to auto-ban after 3 strikes
CREATE OR REPLACE FUNCTION public.check_auto_ban(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _strike_count integer;
BEGIN
  SELECT COUNT(*) INTO _strike_count
  FROM public.account_strikes
  WHERE user_id = _user_id
    AND strike_type = 'strike'
    AND (expires_at IS NULL OR expires_at > now());

  IF _strike_count >= 3 THEN
    UPDATE public.profiles
    SET seller_status = 'banned', is_seller = false
    WHERE id = _user_id;
  END IF;
END;
$$;

-- ================================================================
-- 8. SUPPORT TICKETS
-- ================================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id),
  subject        text NOT NULL,
  description    text NOT NULL,
  category       text NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'payment', 'dispute', 'technical', 'account', 'listing', 'fraud')),
  priority       text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status         text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  assigned_to    uuid REFERENCES auth.users(id),  -- admin/moderator
  related_order_id uuid REFERENCES public.orders(id),
  related_listing_id uuid REFERENCES public.listings(id),
  resolved_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES auth.users(id),
  body        text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,  -- internal admin note
  attachments text[] DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON public.support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.support_tickets(status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_msgs_ticket ON public.support_ticket_messages(ticket_id, created_at ASC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY tickets_self ON public.support_tickets
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY tickets_admin ON public.support_tickets
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY ticket_msgs_self ON public.support_ticket_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR
    EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND user_id = auth.uid())
  );
CREATE POLICY ticket_msgs_insert ON public.support_ticket_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY ticket_msgs_admin ON public.support_ticket_messages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER support_tickets_touch BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ================================================================
-- 9. LISTING APPROVAL FUNCTION (Admin action with audit log)
-- ================================================================

CREATE OR REPLACE FUNCTION public.admin_approve_listing(
  _listing_id   uuid,
  _admin_id     uuid,
  _approved     boolean,
  _rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_status text;
  _listing_before jsonb;
BEGIN
  IF NOT public.has_role(_admin_id, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  SELECT to_jsonb(listings.*) INTO _listing_before FROM public.listings WHERE id = _listing_id;

  _new_status := CASE WHEN _approved THEN 'active' ELSE 'rejected' END;

  UPDATE public.listings
  SET status = _new_status,
      approved_by = CASE WHEN _approved THEN _admin_id ELSE NULL END,
      approved_at = CASE WHEN _approved THEN now() ELSE NULL END,
      rejection_reason = CASE WHEN NOT _approved THEN _rejection_reason ELSE NULL END
  WHERE id = _listing_id;

  -- Audit log
  INSERT INTO public.admin_audit_logs(admin_id, action, target_type, target_id, before_state, after_state, details)
  VALUES (
    _admin_id,
    CASE WHEN _approved THEN 'approve_listing' ELSE 'reject_listing' END,
    'listing',
    _listing_id,
    _listing_before,
    jsonb_build_object('status', _new_status),
    jsonb_build_object('rejection_reason', _rejection_reason)
  );

  RETURN jsonb_build_object('ok', true, 'status', _new_status);
END;
$$;

-- ================================================================
-- 10. REALTIME PUBLICATIONS
-- ================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.disputes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payout_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fraud_logs;

ALTER TABLE public.disputes REPLICA IDENTITY FULL;
ALTER TABLE public.payout_requests REPLICA IDENTITY FULL;
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.fraud_logs REPLICA IDENTITY FULL;

-- ================================================================
-- 11. UPDATE profiles for HUXZAIN reputation system
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reputation_score numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS strike_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_rating_avg numeric(3,2),
  ADD COLUMN IF NOT EXISTS seller_rating_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS total_sales integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_purchases integer NOT NULL DEFAULT 0;

-- Function: update seller reputation after completed order
CREATE OR REPLACE FUNCTION public.update_seller_reputation(_seller_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _avg numeric;
  _count integer;
  _sales integer;
BEGIN
  SELECT AVG(rating_avg), COUNT(*) INTO _avg, _count
  FROM public.listings
  WHERE seller_id = _seller_id AND rating_count > 0;

  SELECT COUNT(*) INTO _sales
  FROM public.orders
  WHERE seller_id = _seller_id AND status = 'completed';

  UPDATE public.profiles
  SET seller_rating_avg = _avg,
      seller_rating_count = _count,
      total_sales = _sales,
      reputation_score = LEAST(100, _avg * 20 + LEAST(50, _sales * 0.5))
  WHERE id = _seller_id;
END;
$$;
