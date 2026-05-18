import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell } from "@/components/layout/SiteShell";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { z } from "zod";
import {
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  verifyEmailOtp,
  resendVerificationEmail,
  sendPasswordResetOtp,
  resetPasswordWithOtp,
} from "@/lib/auth/api";
import {
  displayNameSchema,
  emailSchema,
  otpSchema,
  passwordSchema,
} from "@/lib/auth/password-policy";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2 } from "lucide-react";

type AuthMode = "login" | "signup" | "verify" | "forgot" | "reset";

interface AuthSearch {
  mode?: AuthMode;
  redirect?: string;
  email?: string;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): AuthSearch => {
    const mode =
      s.mode === "signup" || s.mode === "verify" || s.mode === "forgot" || s.mode === "reset"
        ? s.mode
        : "login";
    return {
      mode,
      redirect: typeof s.redirect === "string" ? s.redirect : undefined,
      email: typeof s.email === "string" ? s.email : undefined,
    };
  },
  head: () => ({ meta: [{ title: "Sign in — HUXZAIN" }] }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(72),
});

const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});

const resetSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  password: passwordSchema,
});

const RESEND_COOLDOWN_SEC = 30;

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<AuthMode>(search.mode ?? "login");
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (search.mode) setMode(search.mode);
    if (search.email) setEmail(search.email);
  }, [search.mode, search.email]);

  useEffect(() => {
    if (!authLoading && user) {
      navigate({ to: search.redirect ?? "/account" });
    }
  }, [user, authLoading, navigate, search.redirect]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const goToVerify = (verifiedEmail: string) => {
    setMode("verify");
    setEmail(verifiedEmail);
    setOtp("");
    setResendCooldown(RESEND_COOLDOWN_SEC);
    navigate({
      to: "/auth",
      search: { mode: "verify", email: verifiedEmail, redirect: search.redirect },
      replace: true,
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setFieldErrors({ [issue.path[0]?.toString() ?? "form"]: issue.message });
      return;
    }

    setLoading(true);
    const result = await signInWithEmail(parsed.data);
    setLoading(false);

    if (!result.ok) {
      if (result.needsVerification && result.email) {
        toast.message("Email verification required", {
          description: "Enter the code we sent to your inbox.",
        });
        goToVerify(result.email);
        return;
      }
      toast.error(result.error);
      return;
    }

    toast.success("Welcome back.");
    navigate({ to: search.redirect ?? "/account" });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    const parsed = signupSchema.safeParse({ email, password, displayName });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "form";
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    const result = await signUpWithEmail({
      email: parsed.data.email,
      password: parsed.data.password,
      displayName: parsed.data.displayName,
    });
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    if (result.data.needsVerification) {
      toast.success("Account created. Check your email for a verification code.");
      goToVerify(result.data.email);
      return;
    }

    toast.success("Account created.");
    navigate({ to: search.redirect ?? "/account" });
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    const emailParsed = emailSchema.safeParse(email);
    const otpParsed = otpSchema.safeParse(otp);
    if (!emailParsed.success) {
      setFieldErrors({ email: emailParsed.error.issues[0]?.message ?? "Invalid email" });
      return;
    }
    if (!otpParsed.success) {
      setFieldErrors({ otp: otpParsed.error.issues[0]?.message ?? "Invalid code" });
      return;
    }

    setLoading(true);
    const result = await verifyEmailOtp({
      email: emailParsed.data,
      token: otpParsed.data,
    });
    setLoading(false);

    if (!result.ok) {
      if (result.error === "__VERIFIED_NEEDS_LOGIN__") {
        toast.success("Email verified! Please sign in with your password.");
        navigate({
          to: "/auth",
          search: { mode: "login", email: emailParsed.data, redirect: search.redirect },
          replace: true,
        });
        return;
      }
      toast.error(result.error);
      return;
    }

    toast.success("Email verified. You're signed in.");
    navigate({ to: search.redirect ?? "/account" });
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    const emailParsed = emailSchema.safeParse(email);
    if (!emailParsed.success) {
      toast.error("Enter a valid email to resend the code.");
      return;
    }

    setLoading(true);
    const result = mode === "reset"
      ? await sendPasswordResetOtp(emailParsed.data)
      : await resendVerificationEmail(emailParsed.data);
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(mode === "reset" ? "Reset code sent." : "Verification code sent.");
    setResendCooldown(RESEND_COOLDOWN_SEC);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    const emailParsed = emailSchema.safeParse(email);
    if (!emailParsed.success) {
      setFieldErrors({ email: emailParsed.error.issues[0]?.message ?? "Invalid email" });
      return;
    }

    setLoading(true);
    const result = await sendPasswordResetOtp(emailParsed.data);
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Reset code sent. Check your email.");
    setMode("reset");
    setOtp("");
    setResendCooldown(RESEND_COOLDOWN_SEC);
    navigate({
      to: "/auth",
      search: { mode: "reset", email: emailParsed.data, redirect: search.redirect },
      replace: true,
    });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    const parsed = resetSchema.safeParse({ email, otp, password: newPassword });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "form";
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    const result = await resetPasswordWithOtp({
      email: parsed.data.email,
      token: parsed.data.otp,
      newPassword: parsed.data.password,
    });
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Password reset. Please sign in.");
    setPassword("");
    setNewPassword("");
    setOtp("");
    setMode("login");
    navigate({
      to: "/auth",
      search: { mode: "login", email: parsed.data.email, redirect: search.redirect },
      replace: true,
    });
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const result = await signInWithGoogle();
    setGoogleLoading(false);
    if (!result.ok) {
      toast.error(result.error);
    }
  };

  const title =
    mode === "verify"
      ? "Verify your email"
      : mode === "reset"
        ? "Reset password"
        : mode === "forgot"
          ? "Forgot password"
          : mode === "signup"
            ? "Join the network"
            : "Welcome back";
  const subtitle =
    mode === "verify"
      ? "Enter the 6-digit code sent to your inbox"
      : mode === "reset"
        ? "Enter your reset code"
        : mode === "forgot"
          ? "Recover account"
      : mode === "signup"
        ? "Create Account"
        : "Authenticate";

  if (authLoading) {
    return (
      <SiteShell>
        <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-crimson" />
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mb-3">
              — {subtitle}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
          </div>

          {mode !== "verify" && mode !== "forgot" && mode !== "reset" && (
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="mt-8 w-full flex items-center justify-center gap-3 glass-strong rounded-2xl py-3.5 text-sm font-semibold border border-border hover:border-crimson/40 disabled:opacity-50 transition-colors"
            >
              {googleLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              Continue with Google
            </button>
          )}

          {mode !== "verify" && mode !== "forgot" && mode !== "reset" && (
            <p className="my-6 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              or use email
            </p>
          )}

          {mode === "forgot" ? (
            <form onSubmit={handleForgot} className="glass-strong rounded-2xl p-8 space-y-5">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-crimson/50 transition-colors"
                />
                {fieldErrors.email && (
                  <p className="mt-1.5 text-xs text-destructive">{fieldErrors.email}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-crimson text-foreground py-3.5 rounded-lg font-semibold text-sm uppercase tracking-wider hover:bg-crimson-glow disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? "Sending..." : "Send reset code"}
              </button>
              <p className="text-center text-xs text-muted-foreground pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    navigate({ to: "/auth", search: { mode: "login", email, redirect: search.redirect } });
                  }}
                  className="text-crimson hover:text-crimson-glow font-semibold"
                >
                  Back to sign in
                </button>
              </p>
            </form>
          ) : mode === "reset" ? (
            <form onSubmit={handleResetPassword} className="glass-strong rounded-2xl p-8 space-y-5">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  readOnly={!!search.email}
                  className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-crimson/50 transition-colors"
                />
                {fieldErrors.email && (
                  <p className="mt-1.5 text-xs text-destructive">{fieldErrors.email}</p>
                )}
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 block">
                  Reset code
                </label>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {fieldErrors.otp && (
                  <p className="mt-2 text-center text-xs text-destructive">{fieldErrors.otp}</p>
                )}
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">
                  New password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={10}
                  autoComplete="new-password"
                  className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-crimson/50 transition-colors"
                />
                {fieldErrors.password && (
                  <p className="mt-1.5 text-xs text-destructive">{fieldErrors.password}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  At least 10 characters with upper, lower, number, and special character.
                </p>
              </div>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-crimson text-foreground py-3.5 rounded-lg font-semibold text-sm uppercase tracking-wider hover:bg-crimson-glow disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? "Resetting..." : "Reset password"}
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={loading || resendCooldown > 0}
                className="w-full text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend reset code"}
              </button>
            </form>
          ) : mode === "verify" ? (
            <form onSubmit={handleVerify} className="glass-strong rounded-2xl p-8 space-y-5">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  readOnly={!!search.email}
                  className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-crimson/50 transition-colors"
                />
                {fieldErrors.email && (
                  <p className="mt-1.5 text-xs text-destructive">{fieldErrors.email}</p>
                )}
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 block">
                  Verification code
                </label>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {fieldErrors.otp && (
                  <p className="mt-2 text-center text-xs text-destructive">{fieldErrors.otp}</p>
                )}
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Codes expire after <strong>5 minutes</strong>.
                </p>
              </div>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-crimson text-foreground py-3.5 rounded-lg font-semibold text-sm uppercase tracking-wider hover:bg-crimson-glow disabled:opacity-50 transition-colors"
              >
                {loading ? "Verifying…" : "Verify & sign in"}
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={loading || resendCooldown > 0}
                className="w-full text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : "Resend verification code"}
              </button>
              <p className="text-center text-xs text-muted-foreground pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    navigate({ to: "/auth", search: { mode: "login", redirect: search.redirect } });
                  }}
                  className="text-crimson hover:text-crimson-glow font-semibold"
                >
                  Back to sign in
                </button>
              </p>
            </form>
          ) : (
            <form
              onSubmit={mode === "signup" ? handleSignup : handleLogin}
              className="glass-strong rounded-2xl p-8 space-y-5"
            >
              {mode === "signup" && (
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">
                    Display name
                  </label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    maxLength={60}
                    autoComplete="name"
                    className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-crimson/50 transition-colors"
                  />
                  {fieldErrors.displayName && (
                    <p className="mt-1.5 text-xs text-destructive">{fieldErrors.displayName}</p>
                  )}
                </div>
              )}
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-crimson/50 transition-colors"
                />
                {fieldErrors.email && (
                  <p className="mt-1.5 text-xs text-destructive">{fieldErrors.email}</p>
                )}
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === "signup" ? 10 : 1}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-crimson/50 transition-colors"
                />
                {fieldErrors.password && (
                  <p className="mt-1.5 text-xs text-destructive">{fieldErrors.password}</p>
                )}
                {mode === "signup" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    At least 10 characters with upper, lower, number, and special character.
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full bg-crimson text-foreground py-3.5 rounded-lg font-semibold text-sm uppercase tracking-wider hover:bg-crimson-glow disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading
                  ? "Processing…"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
              </button>
              <p className="text-center text-xs text-muted-foreground pt-2">
                {mode === "signup" ? "Already a member? " : "New to HUXZAIN? "}
                <button
                  type="button"
                  onClick={() => {
                    const next = mode === "signup" ? "login" : "signup";
                    setMode(next);
                    setFieldErrors({});
                    navigate({
                      to: "/auth",
                      search: { mode: next, redirect: search.redirect },
                    });
                  }}
                  className="text-crimson hover:text-crimson-glow font-semibold"
                >
                  {mode === "signup" ? "Sign in" : "Create account"}
                </button>
              </p>
              {mode === "login" && (
                <p className="text-center text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setFieldErrors({});
                      navigate({
                        to: "/auth",
                        search: { mode: "forgot", email, redirect: search.redirect },
                      });
                    }}
                    className="text-crimson hover:text-crimson-glow font-semibold"
                  >
                    Forgot password?
                  </button>
                </p>
              )}
            </form>
          )}

          <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            By continuing you accept the{" "}
            <Link to="/legal/terms" className="text-foreground hover:underline">
              Terms
            </Link>{" "}
            &{" "}
            <Link to="/legal/privacy" className="text-foreground hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
