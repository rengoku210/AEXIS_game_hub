-- ============================================================
-- Seller Subscription System
-- ============================================================

-- 1. Add seller subscription fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seller_plan text NOT NULL DEFAULT 'none'
    CHECK (seller_plan IN ('none', 'free', 'pro', 'elite', 'exclusive')),
  ADD COLUMN IF NOT EXISTS seller_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_subscription_status text NOT NULL DEFAULT 'inactive'
    CHECK (seller_subscription_status IN ('inactive', 'active', 'expired', 'cancelled'));

-- 2. Create seller_subscriptions table
CREATE TABLE IF NOT EXISTS public.seller_subscriptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type         text NOT NULL CHECK (plan_type IN ('free', 'pro', 'elite', 'exclusive')),
  status            text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
  starts_at         timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz,                       -- NULL = free (no expiry) or lifetime
  payment_provider  text,                              -- 'razorpay' | 'manual' | NULL for free
  razorpay_order_id text,
  razorpay_payment_id text,
  amount_inr        integer NOT NULL DEFAULT 0,        -- 0 for free plan
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_subs_user ON public.seller_subscriptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_subs_status ON public.seller_subscriptions(status, expires_at);

ALTER TABLE public.seller_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscriptions
CREATE POLICY seller_sub_self_read ON public.seller_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert/update (via server API)
CREATE POLICY seller_sub_admin_all ON public.seller_subscriptions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER seller_sub_touch BEFORE UPDATE ON public.seller_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Function: activate seller plan atomically
CREATE OR REPLACE FUNCTION public.activate_seller_plan(
  _user_id          uuid,
  _plan_type        text,
  _razorpay_order_id text DEFAULT NULL,
  _razorpay_payment_id text DEFAULT NULL,
  _amount_inr       integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub_id uuid;
  _expires timestamptz;
BEGIN
  -- Free plan never expires; paid plans expire in 30 days (monthly)
  IF _plan_type = 'free' THEN
    _expires := NULL;
  ELSE
    _expires := now() + interval '30 days';
  END IF;

  -- Cancel existing active subscriptions first
  UPDATE public.seller_subscriptions
    SET status = 'cancelled', updated_at = now()
    WHERE user_id = _user_id AND status = 'active';

  -- Insert new subscription
  INSERT INTO public.seller_subscriptions
    (user_id, plan_type, status, starts_at, expires_at, payment_provider,
     razorpay_order_id, razorpay_payment_id, amount_inr)
  VALUES (
    _user_id, _plan_type, 'active', now(), _expires,
    CASE WHEN _plan_type = 'free' THEN NULL ELSE 'razorpay' END,
    _razorpay_order_id, _razorpay_payment_id, _amount_inr
  )
  RETURNING id INTO _sub_id;

  -- Update profile
  UPDATE public.profiles SET
    seller_plan               = _plan_type,
    seller_subscription_status = 'active',
    seller_status             = 'approved',
    seller_verified           = CASE WHEN _plan_type IN ('elite', 'exclusive') THEN true ELSE seller_verified END,
    updated_at                = now()
  WHERE id = _user_id;

  -- Ensure seller role exists
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'seller')
  ON CONFLICT DO NOTHING;

  RETURN _sub_id;
END;
$$;

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_subscriptions;
ALTER TABLE public.seller_subscriptions REPLICA IDENTITY FULL;
