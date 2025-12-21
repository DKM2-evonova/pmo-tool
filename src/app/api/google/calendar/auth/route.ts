import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthorizationUrl } from '@/lib/google/oauth';

/**
 * GET /api/google/calendar/auth
 * Initiates the Google OAuth flow for Calendar access
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

    // Check if required environment variables are set
    if (!process.env.GOOGLE_CALENDAR_CLIENT_ID || !process.env.GOOGLE_CALENDAR_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Google Calendar integration is not configured' },
        { status: 503 }
      );
    }

    // Generate state parameter for CSRF protection (includes user ID)
    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
    })).toString('base64');

    // Get the authorization URL
    const authUrl = getAuthorizationUrl(state);

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error initiating Google Calendar auth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate authorization' },
      { status: 500 }
    );
  }
}
