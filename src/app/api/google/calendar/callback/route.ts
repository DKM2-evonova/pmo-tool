import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exchangeCodeForTokens, storeTokens } from '@/lib/google/oauth';
import { getUserEmail } from '@/lib/google/calendar-client';
import { loggers } from '@/lib/logger';
import crypto from 'crypto';

const log = loggers.calendar;

/**
 * Verifies the HMAC signature of the OAuth state parameter
 */
function verifyStateSignature(
  token: string,
  userId: string,
  timestamp: number,
  providedSignature: string
): boolean {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    log.error('SUPABASE_SERVICE_ROLE_KEY is not configured');
    return false;
  }
  const dataToSign = `${token}:${userId}:${timestamp}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('hex')
    .substring(0, 16);

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * GET /api/google/calendar/callback
 * Handles the OAuth callback from Google
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle user denial or error
    if (error) {
      log.warn('Google Calendar OAuth error', { error });
      return NextResponse.redirect(
        new URL('/settings?error=calendar_auth_denied', request.url)
      );
    }

    // Verify we have an authorization code
    if (!code) {
      return NextResponse.redirect(
        new URL('/settings?error=calendar_auth_failed', request.url)
      );
    }

    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(
        new URL('/login?error=session_expired', request.url)
      );
    }

    // Verify state parameter (CSRF protection with HMAC signature)
    if (!state) {
      log.error('Missing state parameter in OAuth callback');
      return NextResponse.redirect(
        new URL('/settings?error=calendar_auth_failed', request.url)
      );
    }

    try {
      // Try base64url first (new format), fall back to base64 (old format)
      let stateData;
      try {
        stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
      } catch {
        stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      }

      // Verify the state is for this user
      if (stateData.userId !== user.id) {
        log.error('State user ID mismatch in OAuth callback', { userId: user.id });
        return NextResponse.redirect(
          new URL('/settings?error=calendar_auth_failed', request.url)
        );
      }

      // Verify state is not too old (5 minutes)
      if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
        log.error('OAuth state expired', { userId: user.id });
        return NextResponse.redirect(
          new URL('/settings?error=calendar_auth_expired', request.url)
        );
      }

      // Verify HMAC signature if present (new format)
      if (stateData.sig && stateData.token) {
        const isValid = verifyStateSignature(
          stateData.token,
          stateData.userId,
          stateData.timestamp,
          stateData.sig
        );
        if (!isValid) {
          log.error('Invalid state signature - possible CSRF attack', { userId: user.id });
          return NextResponse.redirect(
            new URL('/settings?error=calendar_auth_failed', request.url)
          );
        }
      }
    } catch {
      log.error('Invalid state parameter in OAuth callback');
      return NextResponse.redirect(
        new URL('/settings?error=calendar_auth_failed', request.url)
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get the Google account email for display
    const googleEmail = await getUserEmail(tokens.access_token);
    log.info('Google Calendar connected', { userId: user.id, googleEmail });

    // Store tokens in database
    await storeTokens(user.id, tokens);

    // Redirect to settings with success message
    return NextResponse.redirect(
      new URL('/settings?success=calendar_connected', request.url)
    );
  } catch (error) {
    log.error('Error handling Google Calendar callback', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.redirect(
      new URL('/settings?error=calendar_auth_failed', request.url)
    );
  }
}
