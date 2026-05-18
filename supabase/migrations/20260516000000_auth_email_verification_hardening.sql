-- Sync profiles.email_verified from auth.users confirmation state
CREATE OR REPLACE FUNCTION public.sync_profile_email_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email_verified = (NEW.email_confirmed_at IS NOT NULL),
      updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_sync ON auth.users;
CREATE TRIGGER on_auth_user_email_sync
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email_verified();

-- Helper for RLS: verified email required for sensitive actions
CREATE OR REPLACE FUNCTION public.is_email_verified(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT email_verified FROM public.profiles WHERE id = _user_id),
    false
  )
$$;

-- Require verified email to place orders
DROP POLICY IF EXISTS orders_buyer_create ON public.orders;
CREATE POLICY orders_buyer_create ON public.orders
  FOR INSERT
  WITH CHECK (
    auth.uid() = buyer_id
    AND public.is_email_verified(auth.uid())
  );

-- Require verified email to start conversations
DROP POLICY IF EXISTS conversations_buyer_create ON public.conversations;
CREATE POLICY conversations_buyer_create ON public.conversations
  FOR INSERT
  WITH CHECK (
    auth.uid() = buyer_id
    AND public.is_email_verified(auth.uid())
  );

-- Require verified email for seller listings
DROP POLICY IF EXISTS listings_seller_insert ON public.listings;
CREATE POLICY listings_seller_insert ON public.listings
  FOR INSERT
  WITH CHECK (
    auth.uid() = seller_id
    AND public.has_role(auth.uid(), 'seller')
    AND public.is_email_verified(auth.uid())
  );
