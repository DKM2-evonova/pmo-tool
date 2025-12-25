import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthorizationUrl } from '@/lib/google/oauth';
import { loggers } from '@/lib/logger';
import crypto from 'crypto';

const log = loggers.calendar;

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

    // Generate cryptographically secure state token for CSRF protection
    // The token is random and unpredictable, then we encode user info with HMAC signature
    const stateToken = crypto.randomUUID();
    const timestamp = Date.now();

    // Create HMAC signature to prevent tampering
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret';
    const dataToSign = `${stateToken}:${user.id}:${timestamp}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(dataToSign)
      .digest('hex')
      .substring(0, 16); // Use first 16 chars of signature

    // Encode state with signature for verification
    const state = Buffer.from(JSON.stringify({
      token: stateToken,
      userId: user.id,
      timestamp,
      sig: signature,
    })).toString('base64url'); // Use base64url for URL safety

    // Get the authorization URL
    const authUrl = getAuthorizationUrl(state);

    return NextResponse.json({ authUrl });
  } catch (error) {
    log.error('Error initiating Google Calendar auth', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to initiate authorization' },
      { status: 500 }
    );
  }
}
