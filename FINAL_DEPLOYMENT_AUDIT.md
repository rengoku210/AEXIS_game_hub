# Final deployment audit — TanStack Start + Vite + Supabase + Vercel

**Date:** 2026-05-16  
**Audited path:** `elite-gamedev-hub-main` (Vercel static SPA output: `dist/client`)

---

## Root cause

1. **Wrong public key name for the browser bundle**  
   The bundled client used `VITE_SUPABASE_PUBLISHABLE_KEY` (and docs matched that name). Production `.env` / Vercel variables were set as **`VITE_SUPABASE_ANON_KEY`**, which is the name Supabase and most teams use. Vite only exposes variables that exist at build time with the exact `VITE_*` names referenced in source, so the anon key resolved to empty at runtime.

2. **Ineffective `process.env` fallback in client code**  
   `src/integrations/supabase/client.ts` fell back to `process.env.SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`. In the **browser**, those are not populated by Vite for a static client build, so the fallback never fixed missing `VITE_*` values.

3. **Build-time vs runtime on Vercel**  
   `VITE_*` values are **inlined when `npm run build` runs**. Adding or fixing them in the Vercel dashboard without a **new deployment** leaves the old bundle unchanged and the app still crashes after hydration.

---

## Fixes applied

| Area | Change |
| --- | --- |
| `src/integrations/supabase/client.ts` | Uses **only** `import.meta.env`: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, with **legacy** support for `VITE_SUPABASE_PUBLISHABLE_KEY`. Removed all `process.env` usage from the browser client. |
| `src/integrations/supabase/auth-middleware.ts` | Server middleware reads `SUPABASE_URL` + `SUPABASE_ANON_KEY`, with alias `SUPABASE_PUBLISHABLE_KEY`. Clear 500 `Response` if missing. **Never** uses the service role key here. |
| `src/vite-env.d.ts` | Documents allowed `VITE_*` keys for TypeScript / IDE. |
| `.env.example` | Documents browser vs server-only variables; no secrets in `VITE_*`. |
| `DEPLOYMENT.md` | Vite/Vercel env behavior, variable tables, **deployment verification checklist**, Razorpay/webhook caveats for static hosting. |
| `vercel.json` | **Reviewed** — no change required; rewrites and `outputDirectory` remain correct for SPA shell routing. |

**Files checked (no risky client changes needed):** `__root.tsx` (no direct env use), `vite.config.ts` (only `process.env.VERCEL` in Node config — correct), `package.json` (scripts unchanged).

**Security audit (env):**

- `process.env` remains only in **server-scoped** modules: `client.server.ts`, `auth-middleware.ts`, `api.*` Razorpay routes, `api.public.razorpay-webhook.ts`  
- Grep on `dist/client` found **no** `SERVICE_ROLE`, `supabaseAdmin`, or `RAZORPAY_KEY_SECRET` string leaks in the client output from this build environment.

---

## Build verification (local)

Command: `VERCEL=1` → `npm run build` (PowerShell: `$env:VERCEL='1'; npm run build`)

- Build **succeeded**.
- `dist/client/_shell.html` **exists** (required for `vercel.json` rewrites).
- Client chunks under `dist/client/assets/` contain no obvious server-secret markers (spot-check via search).

---

## Deployment status

| Item | Status |
| --- | --- |
| SPA shell + rewrites | **OK** (per your prior fixes + current `vercel.json`) |
| Static assets | **OK** (build output structure normal) |
| Supabase in browser | **Fixed in code** — requires correct **Vercel env + redeploy** |
| TanStack Start hydration | **Compatible** for SPA mode once Supabase client initializes (no missing-env throw on first proxy access) |
| Server routes on Vercel (`api.*`) | **Not exercised** by static `outputDirectory` deploy — still a product/architecture limitation unless Edge/serverless is added |

---

## Required Vercel environment variables

**Minimum for the live site to stop crashing after hydration:**

| Variable | Environment scope on Vercel |
| --- | --- |
| `VITE_SUPABASE_URL` | Production **and** Preview (and Development if used) |
| `VITE_SUPABASE_ANON_KEY` | Production **and** Preview (and Development if used) |

**After setting or changing these:** trigger a **new deployment** so the bundle is rebuilt.

**Server-only (for any future SSR, `vercel dev`, or ported APIs — not embedded in the static client):**

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (or legacy `SUPABASE_PUBLISHABLE_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (never `VITE_*`)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (never `VITE_*` except optional `VITE_RAZORPAY_KEY_ID` for public checkout id)

---

## Remaining risks

1. **Static hosting vs API routes** — Razorpay create/verify/webhook server files will not run on Vercel with the current `framework: null` + static `outputDirectory` pattern; webhooks need Edge Functions or another backend.
2. **Env drift** — Preview deployments need the same `VITE_*` keys as Production if you exercise Supabase there.
3. **Row Level Security** — anon key in the browser is correct; data exposure still depends on Supabase RLS policies (out of scope for this audit).

---

## Deployment verification checklist (short)

Use the expanded version in `DEPLOYMENT.md`.

- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set for the target environment; redeploy completed.
- [ ] Browser console: no “Missing Supabase environment variables” on first load.
- [ ] Hard refresh `/` and a nested route: no hydration errors.
- [ ] Marketplace / listing data loads (or clean empty states / RLS errors only).
- [ ] Deep link in a new tab (e.g. `/marketplace`) returns shell + client route (rewrite works).
- [ ] Optional: `/admin/diagnostics` confirms Supabase query path (may require auth).

---

## References in repo

- Public client: `src/integrations/supabase/client.ts`
- Service role (server only): `src/integrations/supabase/client.server.ts`
- Auth middleware (server): `src/integrations/supabase/auth-middleware.ts`
- Example env: `.env.example`
- Host-specific notes: `DEPLOYMENT.md`
