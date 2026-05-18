# Deployment guide

This project ships with TWO compatible deployment paths.

## 1. Lovable (current, zero-config)

Click the **Publish** button in the Lovable editor. Hosting, SSR, edge functions
and the database are wired automatically. Use this for staging and rapid iteration.

## 2. Vercel (self-hosted production)

The project is structured to be exportable to Vercel without code changes.

### Critical: Vite and `VITE_*` variables

The browser bundle reads Supabase settings **only** from `import.meta.env`, i.e. variables
whose names start with `VITE_`. Vite replaces those at **build** time. On Vercel you must:

1. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Project → Settings → Environment Variables**.
2. Select **Production** and **Preview** (and **Development** if you use `vercel dev`).
3. Trigger a **new deployment** after changing them so the client bundle is rebuilt.

Setting only `SUPABASE_URL` / server-side names is **not** enough for the SPA — the
hydrated app will crash with missing Supabase env errors.

### One-time setup

1. Push the repo to GitHub.
2. In Vercel, **Import Project** from your GitHub repo.
3. Framework preset: **Other**. Vercel will use `vercel.json` from the repo.
4. Add **Environment Variables** (see tables below).

### Environment variables

**Client / build-time (public — safe to ship in the JS bundle)**

| Name | Required on Vercel SPA | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | Project URL, e.g. `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | yes | **Anon / public** key from Supabase API settings |
| `VITE_WORDPRESS_API_BASE` | optional | Headless WordPress base URL (defaults to local dev URL in code) |
| `VITE_RAZORPAY_KEY_ID` | optional | Public key id for Checkout (e.g. `rzp_test_…`) |
| `VITE_CLOUDINARY_CLOUD_NAME` | optional | Defaults exist in code when unset |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | optional | Defaults to `huxzain_unsigned` when unset |

**Server-only (never `VITE_` — never import server code that reads these into route components)**

| Name | Required | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | yes* | Same URL as above; for server routes / middleware when a server runtime exists |
| `SUPABASE_ANON_KEY` | yes* | Same as anon key; for auth middleware validating JWTs |
| `SUPABASE_SERVICE_ROLE_KEY` | for admin APIs | **Secret** — bypasses RLS; use only in server handlers |
| `RAZORPAY_KEY_ID` | for payments | Often duplicated from Vite for server-only routes |
| `RAZORPAY_KEY_SECRET` | for payments | **Secret** |
| `RAZORPAY_WEBHOOK_SECRET` | for webhooks | **Secret** |

\*On a **pure static** Vercel deploy (`outputDirectory: dist/client`), server
middleware and `api.*` routes from TanStack Start are not executed on Vercel unless
you add a runtime (e.g. Edge Functions). Set these anyway if you use `vercel dev`,
a SSR deployment path, or future Edge ports.

### Razorpay webhook

Configure Razorpay to POST to:

`https://<your-domain>/api/public/razorpay-webhook`

For static SPA-only hosting, that path is rewritten to `/_shell.html` and **will not**
execute server code — use Supabase Edge Functions or another backend for production webhooks
(see below).

### Cloudinary upload preset

Cloudinary is the file storage layer (images, videos, KYC docs). Uploads use an
**unsigned** preset, so the API secret never ships to the browser.

1. Sign in to the Cloudinary dashboard.
2. Go to *Settings → Upload → Upload presets → Add upload preset*.
3. **Signing Mode = Unsigned**.
4. (Recommended) Folder = `huxzain`, **Use filename = false**, **Unique filename = true**.
5. Save the preset name and use it as `VITE_CLOUDINARY_UPLOAD_PRESET`
   (default expected by the code is `huxzain_unsigned`).

### Notes for Vercel

- The project is built in **SPA mode** (`vite.config.ts` sets
  `tanstackStart: { spa: { enabled: true } }` and disables the Cloudflare worker path on Vercel).
  Output is a static client bundle in `dist/client/`.
- `vercel.json` sets `outputDirectory` to `dist/client` and rewrites non-asset paths to
  `/_shell.html` so deep links resolve client-side.
- The Cloudflare worker config (`wrangler.jsonc`) is only used by Lovable’s pipeline;
  Vercel ignores it.

### Server functions (Razorpay live payments)

SPA mode produces a static bundle, so TanStack Start server handlers under `src/routes/api.*`
are **not** deployed as serverless functions by this `vercel.json` setup. To run them on
Vercel, add the appropriate Serverless / Edge configuration, or port handlers to **Supabase
Edge Functions** and store `RAZORPAY_*` and `SUPABASE_SERVICE_ROLE_KEY` in Supabase secrets.

---

## Deployment verification checklist

Use this after each production deploy (or env change + rebuild):

- [ ] **Env vars in bundle**: Open DevTools → Sources or search the main JS chunk for your
      project ref in `VITE_SUPABASE_URL` (value should appear as a string literal if inlined correctly).
      Alternatively: Network tab → first document request returns `/_shell.html`; app boots without a red error overlay.
- [ ] **Supabase**: No console error about missing `VITE_SUPABASE_*`; `/admin/diagnostics` shows Supabase OK (requires auth as configured).
- [ ] **Hydration**: No React hydration error in console on hard refresh of `/` and `/marketplace`.
- [ ] **Marketplace listings**: Home / marketplace views load listing cards (or empty state), not infinite spinners from thrown config errors.
- [ ] **SPA deep links**: Open `https://<deployment>/listing/<slug>` (or category URL) in a new tab — page renders via client router (no 404 HTML from host).
- [ ] **Rewrites**: Request a non-file path (e.g. `/foo/bar`) — response should be `/_shell.html` (status 200), not a platform 404.

---

## Switching between hosts

No code changes are needed. Both `wrangler.jsonc` (Lovable) and `vercel.json`
(Vercel) live side-by-side and only the active host reads its own file.

Copy `.env.example` to `.env` locally and fill values — never commit `.env`.
