import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST() {
  try {
    const serviceSupabase = createServiceClient();

    // Try to execute raw SQL to refresh schema
    const { error } = await serviceSupabase.rpc('exec_sql', {
      sql: "NOTIFY pgrst, 'reload schema'"
    });

    if (error) {
      console.log('RPC failed, trying direct notification...');
      // Fallback: try direct approach
      try {
        await serviceSupabase.from('_supabase').select('*').limit(1);
      } catch (e) {
        // Ignore error, just trigger schema reload
      }
    }

    return NextResponse.json({ success: true, message: 'Schema reload attempted' });
  } catch (error) {
    console.error('Failed to refresh schema:', error);
    return NextResponse.json({ error: 'Failed to refresh schema' }, { status: 500 });
  }
}