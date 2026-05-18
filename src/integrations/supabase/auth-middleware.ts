import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function readServerAnonConfig(): { url: string; anonKey: string } {
  const url = process.env.SUPABASE_URL?.trim() ?? '';
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim() ?? '';

  if (!url || !anonKey) {
    throw new Response(
      'Missing Supabase server environment variables. Set SUPABASE_URL and SUPABASE_ANON_KEY (public anon key, never the service role key) for any runtime that executes this middleware.',
      { status: 500 },
    );
  }

  return { url, anonKey };
}

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const { url, anonKey } = readServerAnonConfig();

    const request = getRequest();

    if (!request?.headers) {
      throw new Response('Unauthorized: No request headers available', { status: 401 });
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      throw new Response('Unauthorized: No authorization header provided', { status: 401 });
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new Response('Unauthorized: Only Bearer tokens are supported', { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw new Response('Unauthorized: No token provided', { status: 401 });
    }

    const supabase = createClient<Database>(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Response('Unauthorized: Invalid token', { status: 401 });
    }

    const user = userData.user;
    const emailConfirmed =
      !!user.email_confirmed_at ||
      (user.app_metadata?.provider === 'google') ||
      (user.identities?.some((i) => i.provider === 'google') ?? false);

    if (!emailConfirmed) {
      throw new Response('Forbidden: Email not verified', { status: 403 });
    }

    return next({
      context: {
        supabase,
        userId: user.id,
        user,
      },
    });
  },
);
