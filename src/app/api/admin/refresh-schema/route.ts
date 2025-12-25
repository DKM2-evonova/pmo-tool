import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';

const log = loggers.api;

export async function POST() {
  try {
    // Authentication check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin authorization check
    const { data: profile } = await supabase
      .from('profiles')
      .select('global_role')
      .eq('id', user.id)
      .single();

    if (profile?.global_role !== 'admin') {
      log.warn('Non-admin attempted to refresh schema', { userId: user.id });
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const serviceSupabase = createServiceClient();

    // Try to execute raw SQL to refresh schema
    const { error } = await serviceSupabase.rpc('exec_sql', {
      sql: "NOTIFY pgrst, 'reload schema'"
    });

    if (error) {
      log.debug('RPC exec_sql failed, trying fallback', { error: error.message });
      // Fallback: try direct approach
      try {
        await serviceSupabase.from('_supabase').select('*').limit(1);
      } catch (e) {
        // Ignore error, just trigger schema reload
      }
    }

    log.info('Schema refresh attempted', { userId: user.id });
    return NextResponse.json({ success: true, message: 'Schema reload attempted' });
  } catch (error) {
    log.error('Failed to refresh schema', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Failed to refresh schema' }, { status: 500 });
  }
}
























