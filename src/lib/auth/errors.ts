import type { AuthError } from "@supabase/supabase-js";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
  email_not_confirmed: "Verify your email before signing in. Check your inbox for the code.",
  user_already_registered: "An account with this email already exists. Sign in instead.",
  signup_disabled: "New signups are temporarily disabled.",
  over_email_send_rate_limit: "Too many emails sent. Wait a few minutes and try again.",
  over_request_rate_limit: "Too many attempts. Please wait and try again.",
  otp_expired: "This verification code has expired. Request a new one.",
  otp_disabled: "Email verification is not enabled for this project.",
  same_password: "Choose a different password than your current one.",
};

export function mapAuthError(error: AuthError | null | undefined): string {
  if (!error) return "Authentication failed. Please try again.";
  if (error.message === "Invalid login credentials") {
    return AUTH_ERROR_MESSAGES.invalid_credentials;
  }
  const mapped = AUTH_ERROR_MESSAGES[error.code ?? ""];
  if (mapped) return mapped;
  return error.message || "Authentication failed. Please try again.";
}
