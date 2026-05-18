# Production Deployment Guide

## 1. WordPress CMS Hosting
HUXZAIN uses a headless architecture for WordPress.
- **Hosting:** Deploy your WordPress plugin to a reliable hosting provider (e.g., Kinsta, WP Engine, or a dedicated VPS).
- **Setup:**
  1. Install a clean WordPress instance.
  2. Upload `huxzain-marketplace` to `/wp-content/plugins/`.
  3. Activate the plugin.
  4. Ensure Permalinks are set to "Post name".
  5. Install security plugins (Wordfence, Limit Login Attempts).
  6. **CORS:** Ensure your WordPress server allows requests from your frontend domains.
- **Media Optimization:** Use an image optimization plugin (e.g., Smush, Imagify) to compress uploaded covers.

## 2. React Frontend Deployment (Vercel)
Vercel is highly recommended for `vite` + `tanstack/react-router` apps.
- **Connection:** Link your GitHub repo to Vercel.
- **Build Settings:**
  - Framework Preset: `Vite`
  - Build Command: `npm run build`
  - Output Directory: `dist`
- **Environment Variables:**
  In your Vercel project settings, define:
  ```env
  VITE_SUPABASE_URL=https://prod-id.supabase.co
  VITE_SUPABASE_ANON_KEY=your_prod_key
  VITE_RAZORPAY_KEY_ID=rzp_live_xxx
  VITE_WP_URL=https://cms.huxzain.com/wp-json/huxzain/v1
  VITE_APP_URL=https://huxzain.com
  ```

## 3. DNS / Domain Configuration
- Point `cms.huxzain.com` to your WordPress server's IP.
- Point `huxzain.com` (or `@`) to Vercel via A Records or CNAME as provided by Vercel.

## 4. Supabase Setup
- Go to Supabase Dashboard.
- Ensure Row Level Security (RLS) is fully enabled for all tables (`orders`, `listings`, `categories`, `profiles`, `chat_messages`).
- Set up authentication providers.

## 5. Razorpay Configuration
- Change the webhook endpoint in Razorpay from your local ngrok to `https://huxzain.com/api/public/razorpay-webhook`.
- Verify the Webhook Secret matches in your Vercel Edge function environment variables (`RAZORPAY_WEBHOOK_SECRET`).

## 6. Rollback Process
If a deployment fails:
1. **Frontend:** In Vercel, go to "Deployments", find the previous successful build, click the three dots, and click **Promote to Production** (instant rollback).
2. **WordPress:** Restore the latest backup from your hosting provider, or use the `npm run restore` CLI command if handling manual VPS backups.
