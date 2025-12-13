import { createBrowserClient } from '@supabase/ssr';

// Use placeholder values during SSR/build when env vars are not available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

