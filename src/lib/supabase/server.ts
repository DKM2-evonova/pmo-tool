import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Environment variables with build-time placeholders
// These are only used during static analysis/build - runtime will use actual values
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Service key should never have a placeholder - always require it at runtime
function getServiceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    // In production, always throw
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in production');
    }
    // In development, also throw but with a more helpful message
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Please set this environment variable in your .env.local file. ' +
      'You can find it in your Supabase project settings under API.'
    );
  }
  return key;
}

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase client with service role key that bypasses RLS.
 * Uses createClient from @supabase/supabase-js (not createServerClient from @supabase/ssr)
 * to ensure the service role key is properly used and not overridden by user sessions.
 */
export function createServiceClient() {
  return createSupabaseClient(supabaseUrl, getServiceKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
