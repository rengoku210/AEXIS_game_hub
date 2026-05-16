import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function readBrowserSupabaseConfig(): { url: string; anonKey: string } {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

  if (import.meta.env.DEV) {
    if (!url) {
      console.warn(
        '[supabase] Missing VITE_SUPABASE_URL — browser bundle cannot reach Supabase.',
      );
    }
    if (!anonKey) {
      console.warn('[supabase] Missing VITE_SUPABASE_ANON_KEY.');
    }
  }

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables for the browser. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your host (e.g. Vercel → Environment Variables for Production and Preview), then redeploy. Vite embeds VITE_* values at build time.',
    );
  }

  return { url, anonKey };
}

function createSupabaseClient() {
  const { url, anonKey } = readBrowserSupabaseConfig();

  return createClient<Database>(url, anonKey, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
