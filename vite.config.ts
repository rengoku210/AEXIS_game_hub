// Use the default Lovable preset so the in-Lovable preview (Cloudflare Worker
// SSR runtime) works out of the box. The preset already wires tanstackStart,
// viteReact, tailwindcss, tsConfigPaths, the cloudflare build plugin,
// componentTagger, VITE_* env injection, the @ path alias, and React/TanStack
// dedupe — do NOT add those manually or the app will break with duplicate
// plugins.
//
// For Vercel / static hosting, the build output under dist/client is served as
// a SPA via the rewrite rule in vercel.json. Razorpay live webhooks require a
// real backend host (e.g. Supabase edge functions) — the in-app
// createServerFn handlers run only on the Lovable preview.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig();
