# HUXZAIN Authentication Security Audit

**Project:** huxzain-marketplace (HUXZAIN Digital Marketplace)  
**Date:** 2026-05-16  
**Stack:** TanStack Start + Vite + Supabase Auth  
**Status:** Hardened — production-ready after dashboard + migration setup

---

## Executive Summary

The previous auth flow relied on Supabase client calls without consistently validating sessions server-side, had no email verification gate, no Google OAuth callback, and weak password rules. This rebuild implements **real Supabase Auth** end-to-end: password hashing (Supabase-managed), PKCE OAuth, OTP email verification, JWT validation via `getUser()`, and database RLS enforcement for verified users.

**Production readiness:** ~85% — requires Supabase dashboard configuration, full schema migration push, and Google OAuth credentials.

---

## Vulnerabilities Found (Before)

| ID | Severity | Issue | Impact |
|----|----------|-------|--------|
| V1 | **Critical** | Session hydrated via `getSession()` only | Stale or forged localStorage sessions could appear “logged in” without server validation |
| V2 | **High** | No email verification enforcement | Unverified accounts could use the app if confirm-email was disabled or bypassed client-side |
| V3 | **High** | No Google OAuth callback route | OAuth redirect could not complete; incomplete social login |
| V4 | **Medium** | Weak password policy (8 chars, no complexity) | Easier credential guessing |
| V5 | **Medium** | Client-only route guards | Protected pages redirected in UI only; APIs needed independent checks |
| V6 | **Medium** | Payment APIs validated token but not email verification | Unverified buyers could initiate checkout |
| V7 | **Low** | Misleading signup success copy | “You're signed in” shown even when verification was required |
| V8 | **Info** | Remote DB schema empty / unmigrated | Auth tables and RLS not applied on linked Supabase project |

No hardcoded credential bypass, mock auth, or demo login acceptance was found in source code. Failures were architectural (session trust model + missing verification flow), not explicit fake-auth placeholders.

---

## Fixes Applied

### 1. Real account system

- **Signup:** `signUpWithEmail()` → Supabase `auth.signUp` with profile metadata
- **Login:** `signInWithPassword()` with server-side credential check
- **Password hashing:** Delegated to Supabase Auth (bcrypt); never stored in app DB
- **Duplicate prevention:** Supabase enforces unique emails; mapped `user_already_registered` errors
- **Password policy:** Min 10 chars, upper, lower, digit, special (`src/lib/auth/password-policy.ts`)

### 2. Google OAuth

- `signInWithGoogle()` with PKCE (`flowType: 'pkce'`, `detectSessionInUrl: true`)
- Callback route: `src/routes/auth.callback.tsx` — `exchangeCodeForSession` + validated redirect
- Redirect URL: `{origin}/auth/callback`

### 3. Email verification (OTP)

- Post-signup **verify** mode with 6-digit OTP (`verifyOtp` type `signup`)
- Resend with 60s cooldown (`auth.resend` type `signup`)
- Unverified users signed out on login and on session refresh
- Login blocked until `email_confirmed_at` or OAuth-verified identity

### 4. Session security

- `fetchValidatedSession()` uses **`auth.getUser()`** then `getSession()`
- Stale sessions cleared via `signOut()` when validation fails
- Logout: `signOut({ scope: 'global' })`
- `useRequireAuth()` hook for protected client routes
- Server middleware: `getUser(token)` + 403 if email unverified (`auth-middleware.ts`)

### 5. Frontend auth flow

- Rebuilt `src/routes/auth.tsx`: login | signup | verify modes
- Google button, field errors, loading states, mobile-friendly layout
- OTP input via `input-otp` component

### 6. Database validation

- Migration: `supabase/migrations/20260516000000_auth_email_verification_hardening.sql`
  - Trigger syncs `profiles.email_verified` from `auth.users.email_confirmed_at`
  - `is_email_verified()` helper for RLS
  - Policies require verification for: orders (buyer insert), conversations (buyer insert), listings (seller insert)

### 7. API hardening

- `api/razorpay/create` and `api/razorpay/verify`: `getUser()` + `assertVerifiedUser()`
- `lib/payments.ts`: `getAccessToken()` from validated session

---

## Auth Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (SPA)                            │
├─────────────────────────────────────────────────────────────────┤
│  auth.tsx (login/signup/verify)  auth.callback.tsx (OAuth)     │
│         │                              │                         │
│         ▼                              ▼                         │
│  lib/auth/api.ts ──────────► supabase-js (PKCE, localStorage)   │
│         │                              │                         │
│  use-auth.tsx ◄── getUser() validates JWT with Supabase Auth    │
│  useRequireAuth() ── client redirect if unauthenticated          │
└────────────────────────────┬────────────────────────────────────┘
                             │ Bearer access_token
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              TanStack Start server routes / middleware           │
├─────────────────────────────────────────────────────────────────┤
│  requireSupabaseAuth: getUser(token) + email verified           │
│  Razorpay APIs: supabaseAdmin.auth.getUser + verified check     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase (fqeoracqywgwbvwijwqq)               │
├─────────────────────────────────────────────────────────────────┤
│  auth.users (credentials, email_confirmed_at, identities)        │
│  public.profiles (email_verified sync)                           │
│  RLS policies (is_email_verified, has_role)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Session lifecycle

1. User signs in → Supabase issues JWT + refresh token (stored in localStorage).
2. `AuthProvider` calls `getUser()` on load and on auth state changes.
3. Invalid or unverified user → global sign-out, UI treats as logged out.
4. API calls send `Authorization: Bearer <access_token>`; server calls `getUser(token)`.

---

## Files Changed / Added

| Path | Role |
|------|------|
| `src/lib/auth/api.ts` | Auth operations + validated session |
| `src/lib/auth/guards.ts` | Email verified checks |
| `src/lib/auth/password-policy.ts` | Zod password/email/OTP schemas |
| `src/lib/auth/errors.ts` | Safe error mapping |
| `src/lib/auth/server-verify.ts` | Server verified-user guard |
| `src/hooks/use-auth.tsx` | Auth context (getUser-based) |
| `src/hooks/use-require-auth.ts` | Route guard hook |
| `src/routes/auth.tsx` | Auth UI |
| `src/routes/auth.callback.tsx` | OAuth callback |
| `src/routes/account.tsx` | Protected account (restored) |
| `src/integrations/supabase/client.ts` | PKCE + detectSessionInUrl |
| `src/integrations/supabase/auth-middleware.ts` | Server JWT + verify check |
| `src/lib/payments.ts` | Validated token for payments |
| `src/routes/api.razorpay.*.ts` | Verified user on payment APIs |
| `supabase/migrations/20260516000000_auth_email_verification_hardening.sql` | RLS + sync trigger |

---

## Remaining Risks

| Risk | Mitigation |
|------|------------|
| Supabase **Confirm email** / **OTP** not enabled in dashboard | Enable in Auth → Providers → Email |
| Google OAuth not configured | Add Google provider + redirect URLs in Supabase |
| Schema not pushed to remote (`public` tables empty) | Run `supabase db push` against `fqeoracqywgwbvwijwqq` |
| `SUPABASE_SERVICE_ROLE_KEY` unset | Required for Razorpay server routes; set in server env only |
| Client route guards bypassable by determined users | RLS + API `getUser()` are the real enforcement layer |
| SPA stores tokens in localStorage | XSS could exfiltrate tokens; keep CSP strict, audit dependencies |
| Seller self-approval on `/sell` without admin/KYC | Separate product issue; not part of core auth |
| JWT not revoked immediately on password change | Use short JWT expiry in Supabase settings for sensitive ops |

---

## Production Checklist

- [ ] Run all migrations: `supabase link --project-ref fqeoracqywgwbvwijwqq && supabase db push`
- [ ] Auth → Email: enable **Confirm email** and **Email OTP**
- [ ] Auth → Google: enable provider, add OAuth client ID/secret
- [ ] Auth → URL config: Site URL + `https://yourdomain.com/auth/callback` (and localhost for dev)
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` on server (Vercel/Lovable secrets)
- [ ] Configure SMTP or Supabase custom SMTP for verification emails
- [ ] Test: wrong password fails, unverified blocked, OTP flow works, Google login works, logout clears session

---

## Test Verification Matrix

| Test | Expected |
|------|----------|
| Wrong password | Error: “Incorrect email or password” — no session |
| Non-existent email | Same generic error (no user enumeration in UI) |
| Signup weak password | Client validation error before API call |
| Signup valid | Redirect to verify mode; email with OTP |
| Login before verify | Blocked; redirected to verify |
| OTP wrong/expired | Error; no session |
| OTP correct | Session created; access account |
| Google OAuth | Redirect to callback → account |
| Logout | Header shows Login; `/account` redirects to auth |
| Protected API without token | 401 Unauthorized |
| Protected API unverified user | 403 Email verification required |

---

## Production Readiness Status

| Area | Status |
|------|--------|
| Credential validation (Supabase Auth) | ✅ Implemented |
| Password strength | ✅ Implemented |
| Email verification | ✅ Implemented (requires dashboard OTP) |
| Google OAuth | ✅ Implemented (requires provider config) |
| Session validation (getUser) | ✅ Implemented |
| Server API protection | ✅ Implemented |
| Database RLS (verified users) | ⚠️ Migration file ready; must push to remote |
| Security audit documentation | ✅ This document |

**Overall:** Ready for staging after Supabase dashboard setup and `db push`. Not ready for production payments until service role key and full schema are live.
