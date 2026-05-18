import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { mapAuthError } from "./errors";
import { authRedirectUrl, isEmailVerified, normalizeEmail } from "./guards";

export type AuthResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; needsVerification?: boolean; email?: string };

export type OtpPurpose = "signup" | "login" | "forgot_password" | "seller_verification" | "security";

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthResult<{ needsVerification: boolean; email: string }>> {
  const email = normalizeEmail(input.email);

  // 1. Create the Supabase account (unconfirmed)
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: { display_name: input.displayName.trim() },
      // Don't redirect — we handle verification ourselves
      emailRedirectTo: undefined,
    },
  });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }

  if (!data.user) {
    return { ok: false, error: "Could not create account. Please try again." };
  }

  // Sign out immediately so the unverified session doesn't persist
  if (data.session) {
    await supabase.auth.signOut();
  }

  // 2. Send OTP via Resend
  const otpRes = await fetch("/api/otp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, purpose: "signup" satisfies OtpPurpose }),
  });
  const otpJson = await otpRes.json() as { error?: string; ok?: boolean };

  if (!otpRes.ok) {
    return { ok: false, error: otpJson.error ?? "Failed to send verification email." };
  }

  return { ok: true, data: { needsVerification: true, email } };
}

export async function signInWithEmail(input: {
  email: string;
  password: string;
}): Promise<AuthResult<{ user: User; session: Session }>> {
  const email = normalizeEmail(input.email);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error) {
    const needsVerification =
      error.code === "email_not_confirmed" ||
      error.message.toLowerCase().includes("email not confirmed");
    if (needsVerification) {
      return { ok: false, error: mapAuthError(error), needsVerification: true, email };
    }
    return { ok: false, error: mapAuthError(error) };
  }

  if (!data.user || !data.session) {
    return { ok: false, error: "Sign in failed. Check your credentials and try again." };
  }

  if (!isEmailVerified(data.user)) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error: "Verify your email before signing in.",
      needsVerification: true,
      email,
    };
  }

  return { ok: true, data: { user: data.user, session: data.session } };
}

export async function verifyEmailOtp(input: {
  email: string;
  token: string;
  purpose?: OtpPurpose;
  newPassword?: string;
}): Promise<AuthResult<{ user: User; session: Session }>> {
  const email = normalizeEmail(input.email);
  const otp = input.token.trim();

  // 1. Verify via our custom server-side endpoint
  const res = await fetch("/api/otp/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      otp,
      purpose: input.purpose ?? "signup",
      newPassword: input.newPassword,
    }),
  });
  const json = await res.json() as {
    ok?: boolean; error?: string; requiresLogin?: boolean; actionLink?: string;
  };

  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error ?? "Verification failed. Try again." };
  }

  // 2a. If server provided a magic-link, exchange it for a session
  if (json.actionLink) {
    try {
      const url = new URL(json.actionLink);
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type") as "magiclink" | null;
      if (tokenHash && type) {
        const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (!error && data.user && data.session) {
          return { ok: true, data: { user: data.user, session: data.session } };
        }
      }
    } catch {
      // fall through to manual sign-in prompt
    }
  }

  // 2b. Require manual sign-in (email is now confirmed)
  return {
    ok: false,
    error: "__VERIFIED_NEEDS_LOGIN__",  // special sentinel — caller will redirect to login
  };
}

export async function resendVerificationEmail(email: string): Promise<AuthResult> {
  const normalized = normalizeEmail(email);
  const res = await fetch("/api/otp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalized, purpose: "signup" satisfies OtpPurpose }),
  });
  const json = await res.json() as { error?: string; cooldown?: number };
  if (!res.ok) {
    return { ok: false, error: json.error ?? "Failed to resend verification email." };
  }
  return { ok: true, data: undefined };
}

export async function sendPasswordResetOtp(email: string): Promise<AuthResult> {
  const normalized = normalizeEmail(email);
  const res = await fetch("/api/otp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalized, purpose: "forgot_password" satisfies OtpPurpose }),
  });
  const json = await res.json() as { error?: string };
  if (!res.ok) {
    return { ok: false, error: json.error ?? "Failed to send reset code." };
  }
  return { ok: true, data: undefined };
}

export async function resetPasswordWithOtp(input: {
  email: string;
  token: string;
  newPassword: string;
}): Promise<AuthResult> {
  const result = await verifyEmailOtp({
    email: input.email,
    token: input.token,
    purpose: "forgot_password",
    newPassword: input.newPassword,
  });

  if (!result.ok && result.error !== "__VERIFIED_NEEDS_LOGIN__") {
    return result;
  }

  return { ok: true, data: undefined };
}

export async function signInWithGoogle(): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authRedirectUrl(),
      queryParams: { prompt: "select_account" },
    },
  });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }
  return { ok: true, data: undefined };
}

export async function signOutEverywhere(): Promise<void> {
  await supabase.auth.signOut({ scope: "global" });
}

/** Validates JWT with Supabase Auth server — never trust localStorage alone. */
export async function fetchValidatedSession(): Promise<{
  user: User | null;
  session: Session | null;
}> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    const stale = await supabase.auth.getSession();
    if (stale.data.session) {
      await supabase.auth.signOut();
    }
    return { user: null, session: null };
  }

  if (!isEmailVerified(user)) {
    await supabase.auth.signOut();
    return { user: null, session: null };
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return { user: null, session: null };
  }

  return { user, session };
}

export async function getAccessToken(): Promise<string | null> {
  const { session } = await fetchValidatedSession();
  return session?.access_token ?? null;
}
