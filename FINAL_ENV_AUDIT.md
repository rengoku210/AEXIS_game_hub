# Final environment audit

**Date:** 2026-05-16  
**Supabase project (dashboard):** `fqeoracqywgwbvwijwqq` — [Project settings](https://supabase.com/dashboard/project/fqeoracqywgwbvwijwqq)

---

## 1. Source of truth (Supabase MCP)

The following were read from the connected Supabase integration (not guessed):

| Value | Source |
| --- | --- |
| **API URL** | `get_project_url` → `https://fqeoracqywgwbvwijwqq.supabase.co` |
| **Browser / anon key** | `get_publishable_keys` → legacy **anon** JWT (`type: legacy`, `name: anon`). This is what `@supabase/supabase-js` expects in this app. |
| **Modern publishable key** | `sb_publishable_…` returned by MCP — **not** wired into the client (SDK path unchanged). |

No **service role** key was retrieved or written to any `VITE_*` variable or client code.

---

## 2. Files updated

| File | Purpose |
| --- | --- |
| `.env` | Local default stack (correct Supabase project; WP local base). |
| `.env.local` | Local overrides (gitignored via `*.local`). |
| `.env.production` | Values for `vite build` / production parity (WP base from `DEPLOY_PRODUCTION.md`). |
| `.env.staging` | Same Supabase; same WP base as production unless you introduce a staging CMS. |
| `.env.example` | Committed template: real **public** URL + anon key; **empty** service role and Razorpay secrets. |
| `.gitignore` | `!.env.example` so the example file can be tracked while `.env` / `.env.*` stay private. |

**WordPress:** `VITE_WORDPRESS_API_BASE` is set to `https://cms.huxzain.com/wp-json/huxzain/v1` in production/staging/example per `DEPLOY_PRODUCTION.md`. A live HTTP check returned **503** at audit time — if listings depend on WP, confirm that host is up or point the variable at a working REST base.

---

## 3. Code changes (security + naming)

| Area | Change |
| --- | --- |
| `src/integrations/supabase/client.ts` | **Only** `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Removed `VITE_SUPABASE_PUBLISHABLE_KEY` and all `process.env` usage on the browser client. |
| `src/integrations/supabase/auth-middleware.ts` | **Only** `process.env.SUPABASE_URL` and `SUPABASE_ANON_KEY` (server). Removed `SUPABASE_PUBLISHABLE_KEY` fallback. |
| `src/lib/wordpress/client.ts` | Base URL from `import.meta.env.VITE_WORDPRESS_API_BASE` with safe local default. |
| `src/vite-env.d.ts` | Documents `VITE_*` variables; removed deprecated publishable key typing. |
| `DEPLOYMENT.md` | Removed deprecated env rows; added `VITE_WORDPRESS_API_BASE`. |

---

## 4. Build verification (local)

Command: `$env:VERCEL = "1"; npm run build`

- Exit code **0**.
- `dist/client/_shell.html` **exists**.
- Client chunk inspection: main bundle contains **inlined** Supabase project host + anon JWT (Vite replaced `import.meta.env`).
- Search under `dist/client` showed **no** `SERVICE_ROLE`, `supabaseAdmin`, or Razorpay secret markers (spot-check).

---

## 5. Vercel sync & redeploy

**Automated Vercel env update and redeploy were not executed** from this environment:

- `vercel` CLI is not on `PATH`; `npx vercel` is available but the repo has **no** `.vercel/project.json` (not linked).
- Non-interactive env upload requires `vercel link` + authentication (browser or `VERCEL_TOKEN`).

**Required Vercel dashboard values** (Production **and** Preview; then **redeploy**):

- `VITE_SUPABASE_URL` = `https://fqeoracqywgwbvwijwqq.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = same legacy anon JWT as in `.env.example`
- `VITE_WORDPRESS_API_BASE` = your live REST base (e.g. `https://cms.huxzain.com/wp-json/huxzain/v1` if that is correct)

Optional CLI workflow after `npx vercel link`:

```bash
printf '%s' 'https://fqeoracqywgwbvwijwqq.supabase.co' | npx vercel env add VITE_SUPABASE_URL production
# repeat for preview; repeat for VITE_SUPABASE_ANON_KEY with the anon JWT; then:
npx vercel --prod
```

---

## 6. Supabase backend sanity

`list_tables` (public schema) returned **no tables** for this project at audit time — either a fresh project or migrations not applied. Client “marketplace listings” behavior still depends on Supabase schema + RLS; ensure migrations are applied on `fqeoracqywgwbvwijwqq` if you expect SQL-backed listings.

---

## 7. Production URL check

A fetch to the previously shared deployment host returned **401 Unauthorized** from the auditor’s network (not an app runtime check). After Vercel env is updated and redeployed, verify in a browser:

- No console error: “Missing Supabase environment variables”.
- `/marketplace` and a listing deep link load without a hydration error overlay.
- Auth flows exercise `supabase.auth` without configuration errors.

---

## 8. Deployment status summary

| Item | Status |
| --- | --- |
| Env files aligned to dashboard project `fqeoracqywgwbvwijwqq` | **Done** (via MCP). |
| Legacy / broken client env names removed | **Done**. |
| Client bundle leak of service role | **None found** in build output sample. |
| Vercel project env + redeploy | **Manual** — auth/link not available in this run. |
| WordPress production URL health | **503** at audit — confirm or change `VITE_WORDPRESS_API_BASE`. |
| Supabase DB tables | **Empty list** from MCP — confirm migrations. |

---

## 9. Required Vercel env vars (concise)

**Public (build-time):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WORDPRESS_API_BASE` (optional but recommended).

**Server-only (if you later run server/edge, not for static SPA):** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_*` — never `VITE_*`.
