import type { User } from "@supabase/supabase-js";

/** True when Supabase has confirmed the user's email (or OAuth provider verified it). */
export function isEmailVerified(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.email_confirmed_at) return true;

  const identities = user.identities ?? [];
  return identities.some((identity) => {
    if (identity.provider === "google") return true;
    const verified = identity.identity_data?.email_verified;
    return verified === true || verified === "true";
  });
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function authRedirectUrl(path = "/auth/callback"): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  return path;
}
