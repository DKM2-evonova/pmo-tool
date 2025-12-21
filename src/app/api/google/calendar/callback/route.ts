import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exchangeCodeForTokens, storeTokens } from '@/lib/google/oauth';
import { getUserEmail } from '@/lib/google/calendar-client';

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
      console.warn('Google OAuth error:', error);
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

    // Verify state parameter (CSRF protection)
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());

        // Verify the state is for this user
        if (stateData.userId !== user.id) {
          console.error('State user ID mismatch');
          return NextResponse.redirect(
            new URL('/settings?error=calendar_auth_failed', request.url)
          );
        }

        // Verify state is not too old (5 minutes)
        if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
          console.error('State expired');
          return NextResponse.redirect(
            new URL('/settings?error=calendar_auth_expired', request.url)
          );
        }
      } catch {
        console.error('Invalid state parameter');
        return NextResponse.redirect(
          new URL('/settings?error=calendar_auth_failed', request.url)
        );
      }
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get the Google account email for display
    const googleEmail = await getUserEmail(tokens.access_token);
    console.log(`Google Calendar connected for user ${user.id} (${googleEmail})`);

    // Store tokens in database
    await storeTokens(user.id, tokens);

    // Redirect to settings with success message
    return NextResponse.redirect(
      new URL('/settings?success=calendar_connected', request.url)
    );
  } catch (error) {
    console.error('Error handling Google Calendar callback:', error);
    return NextResponse.redirect(
      new URL('/settings?error=calendar_auth_failed', request.url)
    );
  }
}
