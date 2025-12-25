import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStoredTokens } from '@/lib/google/oauth';
import { loggers } from '@/lib/logger';

const log = loggers.calendar;

/**
 * GET /api/google/calendar/status
 * Returns the current Google Calendar connection status
 */
export async function GET() {
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

    // Check if Google Calendar integration is configured
    const isConfigured = !!(
      process.env.GOOGLE_CALENDAR_CLIENT_ID &&
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET
    );

    if (!isConfigured) {
      return NextResponse.json({
        configured: false,
        connected: false,
        provider: null,
        connectedAt: null,
      });
    }

    // Get stored tokens
    const tokens = await getStoredTokens(user.id);

    if (!tokens) {
      return NextResponse.json({
        configured: true,
        connected: false,
        provider: null,
        connectedAt: null,
      });
    }

    return NextResponse.json({
      configured: true,
      connected: true,
      provider: tokens.provider,
      connectedAt: tokens.created_at,
      expiresAt: tokens.expires_at,
    });
  } catch (error) {
    log.error('Error checking calendar status', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to check calendar status' },
      { status: 500 }
    );
  }
}
