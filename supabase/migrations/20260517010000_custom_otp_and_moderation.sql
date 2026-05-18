-- ============================================================
-- 1. Custom email OTP table (Resend-delivered, hashed storage)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_otps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,                          -- normalized lowercase
  purpose       text NOT NULL DEFAULT 'signup',
  otp_hash      text NOT NULL,                          -- SHA-256 hex of the raw code
  expires_at    timestamptz NOT NULL,
  used          boolean NOT NULL DEFAULT false,
  attempt_count integer NOT NULL DEFAULT 0,             -- wrong-guess counter
  last_resent_at timestamptz,                           -- throttle resend
  resend_count  integer NOT NULL DEFAULT 0,             -- hourly resend limiter
  ip_address    text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_email ON public.email_otps(email, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_active ON public.email_otps(email, purpose, used, expires_at DESC);

ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;
-- No direct RLS access from client; all operations go through server API

-- ============================================================
-- 2. Verify OTP function (called from server API, SECURITY DEFINER)
-- ============================================================
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
  _result jsonb;
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
    RETURN jsonb_build_object('ok', false, 'error', 'Verification code has expired. Request a new one.');
  END IF;

  IF _rec.attempt_count >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too many incorrect attempts. Request a new code.');
  END IF;

  IF _rec.otp_hash <> _otp_hash THEN
    UPDATE public.email_otps SET attempt_count = attempt_count + 1 WHERE id = _rec.id;
    RETURN jsonb_build_object('ok', false, 'error', 'Incorrect verification code.');
  END IF;

  -- Mark used
  UPDATE public.email_otps SET used = true WHERE id = _rec.id;

  RETURN jsonb_build_object('ok', true, 'otp_id', _rec.id::text);
END;
$$;

-- ============================================================
-- 3. Cleanup function for expired OTPs (call from cron/Edge Function)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count integer;
BEGIN
  DELETE FROM public.email_otps
  WHERE expires_at < now() - interval '1 hour'
     OR (used = true AND created_at < now() - interval '24 hours');
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- ============================================================
-- 4. Conversation reports (users flagging suspicious chats)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversation_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  reporter_id     uuid NOT NULL,
  report_reason   text NOT NULL,                -- 'scam' | 'harassment' | 'fraud' | 'other'
  report_detail   text,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed')),
  resolved_by     uuid,
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_reports_conv ON public.conversation_reports(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_reports_status ON public.conversation_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_reports_reporter ON public.conversation_reports(reporter_id);

ALTER TABLE public.conversation_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY conv_report_user_insert ON public.conversation_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY conv_report_user_read_own ON public.conversation_reports
  FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY conv_report_admin_all ON public.conversation_reports
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER conv_report_touch BEFORE UPDATE ON public.conversation_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 5. Account / chat locks for scam investigations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.account_locks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  locked_by   uuid NOT NULL,                    -- admin who locked
  reason      text NOT NULL,
  lock_type   text NOT NULL DEFAULT 'chat'
    CHECK (lock_type IN ('chat', 'account', 'listings')),
  locked_until timestamptz,                     -- NULL = indefinite
  unlocked_at timestamptz,
  unlocked_by uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_locks_user ON public.account_locks(user_id);

ALTER TABLE public.account_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_locks_admin_all ON public.account_locks
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
-- Users can read their own lock status
CREATE POLICY account_locks_self_read ON public.account_locks
  FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER account_locks_touch BEFORE UPDATE ON public.account_locks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper function: is user's chat locked?
CREATE OR REPLACE FUNCTION public.is_chat_locked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_locks
    WHERE user_id = _user_id
      AND lock_type IN ('chat', 'account')
      AND unlocked_at IS NULL
      AND (locked_until IS NULL OR locked_until > now())
  )
$$;

-- Block chat creation when locked
DROP POLICY IF EXISTS messages_party_insert ON public.messages;
CREATE POLICY messages_party_insert ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_party(conversation_id, auth.uid())
    AND is_system = false
    AND NOT public.is_chat_locked(auth.uid())
  );

-- ============================================================
-- 6. Add flagged_keywords column to conversations (for admin search)
-- ============================================================
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS flagged_keywords text[] DEFAULT '{}';

-- ============================================================
-- 7. Realtime for moderation tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.account_locks;
ALTER TABLE public.conversation_reports REPLICA IDENTITY FULL;
ALTER TABLE public.account_locks REPLICA IDENTITY FULL;
