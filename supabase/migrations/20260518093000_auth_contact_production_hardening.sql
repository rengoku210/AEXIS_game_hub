-- HUXZAIN production auth/contact hardening

ALTER TABLE public.email_otps
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'signup';

DROP INDEX IF EXISTS public.uniq_otp_email_active;
CREATE INDEX IF NOT EXISTS idx_otp_email ON public.email_otps(email, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_active ON public.email_otps(email, purpose, used, expires_at DESC);

CREATE OR REPLACE FUNCTION public.verify_custom_otp(
  _email     text,
  _otp_hash  text,
  _purpose   text DEFAULT 'signup',
  _now       timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec public.email_otps;
BEGIN
  SELECT * INTO _rec
  FROM public.email_otps
  WHERE email = lower(trim(_email))
    AND purpose = _purpose
    AND used = false
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No active verification code found.');
  END IF;

  IF _rec.expires_at < _now THEN
    UPDATE public.email_otps SET used = true WHERE id = _rec.id;
    RETURN jsonb_build_object('ok', false, 'error', 'Verification code has expired. Request a new one.');
  END IF;

  IF _rec.attempt_count >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too many incorrect attempts. Request a new code.');
  END IF;

  IF _rec.otp_hash <> _otp_hash THEN
    UPDATE public.email_otps SET attempt_count = attempt_count + 1 WHERE id = _rec.id;
    RETURN jsonb_build_object('ok', false, 'error', 'Incorrect verification code.');
  END IF;

  UPDATE public.email_otps SET used = true WHERE id = _rec.id;
  RETURN jsonb_build_object('ok', true, 'otp_id', _rec.id::text);
END;
$$;

CREATE TABLE IF NOT EXISTS public.contact_inquiries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text NOT NULL,
  subject     text NOT NULL,
  category    text NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'payment', 'dispute', 'technical', 'account', 'listing', 'fraud')),
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewing', 'replied', 'closed', 'spam')),
  ip_address  text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_email ON public.contact_inquiries(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status ON public.contact_inquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_ip ON public.contact_inquiries(ip_address, created_at DESC);

ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_inquiries_admin_all ON public.contact_inquiries;
CREATE POLICY contact_inquiries_admin_all ON public.contact_inquiries
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS contact_inquiries_touch ON public.contact_inquiries;
CREATE TRIGGER contact_inquiries_touch BEFORE UPDATE ON public.contact_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
