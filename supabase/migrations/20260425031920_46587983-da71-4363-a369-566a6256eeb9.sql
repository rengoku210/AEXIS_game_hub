-- ============================================================
-- 1. Extend order_status enum (additive — preserves existing data)
-- ============================================================
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'payment_pending';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'admin_review';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'credential_released';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'rented';

-- ============================================================
-- 2. Conversations + messages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  listing_id uuid,
  order_id uuid,
  subject text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  buyer_unread integer NOT NULL DEFAULT 0,
  seller_unread integer NOT NULL DEFAULT 0,
  is_flagged boolean NOT NULL DEFAULT false,
  flagged_reason text,
  flagged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_distinct_parties CHECK (buyer_id <> seller_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON public.conversations(buyer_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_seller ON public.conversations(seller_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_order ON public.conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_conversations_listing ON public.conversations(listing_id);

-- Unique conversation per (buyer, seller, listing) for inquiries
-- and per (buyer, seller, order) for order chats
CREATE UNIQUE INDEX IF NOT EXISTS uniq_conv_listing ON public.conversations(buyer_id, seller_id, listing_id) WHERE order_id IS NULL AND listing_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_conv_order ON public.conversations(buyer_id, seller_id, order_id) WHERE order_id IS NOT NULL;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_party_read ON public.conversations
  FOR SELECT USING (
    auth.uid() = buyer_id OR auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY conversations_buyer_create ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY conversations_party_update ON public.conversations
  FOR UPDATE USING (
    auth.uid() = buyer_id OR auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY conversations_admin_all ON public.conversations
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER conversations_touch BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  attachment_url text,
  is_system boolean NOT NULL DEFAULT false,
  read_by_buyer boolean NOT NULL DEFAULT false,
  read_by_seller boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper: is current user a party in this conversation?
CREATE OR REPLACE FUNCTION public.is_conversation_party(_conv_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = _conv_id AND (buyer_id = _user_id OR seller_id = _user_id)
  )
$$;

CREATE POLICY messages_party_read ON public.messages
  FOR SELECT USING (
    public.is_conversation_party(conversation_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY messages_party_insert ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_party(conversation_id, auth.uid())
    AND is_system = false
  );
CREATE POLICY messages_party_update ON public.messages
  FOR UPDATE USING (
    public.is_conversation_party(conversation_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY messages_admin_all ON public.messages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- After-insert trigger: bump conversation last_message_at + unread
CREATE OR REPLACE FUNCTION public.on_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv RECORD;
BEGIN
  SELECT buyer_id, seller_id INTO conv FROM public.conversations WHERE id = NEW.conversation_id;
  IF NEW.sender_id = conv.buyer_id THEN
    UPDATE public.conversations
      SET last_message_at = NEW.created_at,
          last_message_preview = LEFT(NEW.body, 140),
          seller_unread = seller_unread + 1,
          updated_at = now()
      WHERE id = NEW.conversation_id;
  ELSIF NEW.sender_id = conv.seller_id THEN
    UPDATE public.conversations
      SET last_message_at = NEW.created_at,
          last_message_preview = LEFT(NEW.body, 140),
          buyer_unread = buyer_unread + 1,
          updated_at = now()
      WHERE id = NEW.conversation_id;
  ELSE
    -- system / admin message: just bump timestamp + preview
    UPDATE public.conversations
      SET last_message_at = NEW.created_at,
          last_message_preview = LEFT(NEW.body, 140),
          updated_at = now()
      WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_after_insert AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.on_message_insert();

-- ============================================================
-- 3. Admin audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin ON public.admin_audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.admin_audit_log(entity_type, entity_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_admin_read ON public.admin_audit_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY audit_admin_insert ON public.admin_audit_log
  FOR INSERT WITH CHECK (auth.uid() = admin_id AND public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 4. Credential handoffs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.credential_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  seller_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  -- Encrypted payload (client-side encrypted before upload). Stored as text so
  -- we don't rely on pgcrypto here. For the demo we keep raw text but mark it
  -- as sensitive — only released after admin review.
  payload_encrypted text,
  payload_hint text, -- e.g. "Riot account login + email recovery"
  attachment_url text, -- private bucket URL
  status text NOT NULL DEFAULT 'pending_review', -- pending_review | released | rejected
  submitted_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  released_by uuid,
  rejected_at timestamptz,
  rejected_by uuid,
  rejection_reason text,
  buyer_acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handoff_seller ON public.credential_handoffs(seller_id);
CREATE INDEX IF NOT EXISTS idx_handoff_buyer ON public.credential_handoffs(buyer_id);
CREATE INDEX IF NOT EXISTS idx_handoff_status ON public.credential_handoffs(status);

ALTER TABLE public.credential_handoffs ENABLE ROW LEVEL SECURITY;

-- Seller: can insert + read + update their own (only while pending_review)
CREATE POLICY handoff_seller_insert ON public.credential_handoffs
  FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY handoff_seller_read ON public.credential_handoffs
  FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY handoff_seller_update ON public.credential_handoffs
  FOR UPDATE USING (auth.uid() = seller_id AND status = 'pending_review');

-- Buyer: can read ONLY after admin releases
CREATE POLICY handoff_buyer_read_released ON public.credential_handoffs
  FOR SELECT USING (auth.uid() = buyer_id AND released_at IS NOT NULL);
CREATE POLICY handoff_buyer_ack ON public.credential_handoffs
  FOR UPDATE USING (auth.uid() = buyer_id AND released_at IS NOT NULL);

-- Admin: full access
CREATE POLICY handoff_admin_all ON public.credential_handoffs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER handoff_touch BEFORE UPDATE ON public.credential_handoffs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 5. Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.credential_handoffs;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.credential_handoffs REPLICA IDENTITY FULL;

-- ============================================================
-- 6. Storage bucket for credential attachments (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('secure-credentials', 'secure-credentials', false)
ON CONFLICT (id) DO NOTHING;

-- Seller can upload to their own folder
CREATE POLICY "secure_creds_seller_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'secure-credentials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "secure_creds_seller_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'secure-credentials'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "secure_creds_admin_all" ON storage.objects
  FOR ALL USING (
    bucket_id = 'secure-credentials' AND public.has_role(auth.uid(), 'admin')
  );