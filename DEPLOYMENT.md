# Deployment guide

This project ships with TWO compatible deployment paths.

## 1. Lovable (current, zero-config)

Click the **Publish** button in the Lovable editor. Hosting, SSR, edge functions
and the database are wired automatically. Use this for staging and rapid iteration.

## 2. Vercel (self-hosted production)

The project is structured to be exportable to Vercel without code changes.

### One-time setup

1. Push the repo to GitHub.
2. In Vercel, **Import Project** from your GitHub repo.
3. Framework preset: **Other**. Vercel will use `vercel.json` from the repo.
4. Add the following **Environment Variables** in *Project → Settings → Environment Variables*:

   | Name | Required | Notes |
   | --- | --- | --- |
   | `VITE_SUPABASE_URL` | yes | Public Supabase URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | Public anon/publishable key |
   | `VITE_SUPABASE_PROJECT_ID` | yes | Supabase project ref |
   | `VITE_CLOUDINARY_CLOUD_NAME` | optional | Defaults to bundled value |
   | `VITE_CLOUDINARY_UPLOAD_PRESET` | optional | Defaults to `aexis_unsigned` |
   | `RAZORPAY_KEY_ID` | yes | Razorpay key id (test or live) |
   | `RAZORPAY_KEY_SECRET` | yes | Razorpay key secret |
   | `RAZORPAY_WEBHOOK_SECRET` | yes | Random strong string used to sign webhooks |

5. Configure Razorpay webhook to point at:
   `https://<your-domain>/api/public/razorpay-webhook`

### Cloudinary upload preset

Cloudinary is the file storage layer (images, videos, KYC docs). Uploads use an
**unsigned** preset, so the API secret never ships to the browser.

1. Sign in to the Cloudinary dashboard.
2. Go to *Settings → Upload → Upload presets → Add upload preset*.
3. **Signing Mode = Unsigned**.
4. (Recommended) Folder = `aexis`, **Use filename = false**, **Unique filename = true**.
5. Save the preset name and use it as `VITE_CLOUDINARY_UPLOAD_PRESET`
   (default expected by the code is `aexis_unsigned`).

### Notes for Vercel

- The project is built in **SPA mode** (`vite.config.ts` sets
  `tanstackStart: { spa: { enabled: true } }` and `cloudflare: false`). The
  output is a fully static client bundle in `dist/client/` — any static host
  (Vercel, Netlify, Cloudflare Pages, S3+CloudFront, Nginx) can serve it.
- `vercel.json` points `outputDirectory` at `dist/client` and rewrites all
  non-asset paths to `/_shell.html` so deep links like `/marketplace` and
  `/listing/foo` resolve client-side instead of 404.
- The Cloudflare worker config (`wrangler.jsonc`) is only read by Lovable's
  internal deployment pipeline; Vercel ignores it.

### Server functions (Razorpay live payments)

SPA mode produces a static bundle, so the TanStack Start server functions in
`src/server/razorpay.functions.ts` and the webhook in
`src/routes/api.public.razorpay-webhook.ts` are **not deployed** to Vercel by
this build. The admin UI and order pages will gracefully show "Payment not
configured" because `getRazorpayConfigStatus()` cannot reach the server.

To enable real payments on Vercel, port the three handlers to Supabase Edge
Functions (recommended — they share the same Supabase auth context) and set
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` in the
Supabase project secrets. The client code can then call them via
`supabase.functions.invoke()` instead of `useServerFn()`.

## Switching between hosts

No code changes are needed. Both `wrangler.jsonc` (Lovable) and `vercel.json`
(Vercel) live side-by-side and only the active host reads its own file.