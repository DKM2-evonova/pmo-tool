import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStoredTokens, revokeToken, deleteTokens } from '@/lib/google/oauth';
import { loggers } from '@/lib/logger';

const log = loggers.calendar;

/**
 * POST /api/google/calendar/disconnect
 * Disconnects the user's Google Calendar integration
 */
export async function POST() {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get stored tokens to revoke
    const tokens = await getStoredTokens(user.id);

    if (tokens) {
      // Revoke the token with Google (best effort)
      await revokeToken(tokens.access_token);

      // Delete tokens from our database
      await deleteTokens(user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Error disconnecting Google Calendar', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to disconnect calendar' },
      { status: 500 }
    );
  }
}
