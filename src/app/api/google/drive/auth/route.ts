import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthorizationUrl, isDriveConfigured } from '@/lib/google/drive-oauth';
import { loggers } from '@/lib/logger';
import crypto from 'crypto';

const log = loggers.drive;

/**
 * GET /api/google/drive/auth
 * Initiates the Google OAuth flow for Drive access
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
    if (!isDriveConfigured()) {
      return NextResponse.json(
        { error: 'Google Drive integration is not configured' },
        { status: 503 }
      );
    }

    // Generate cryptographically secure state token for CSRF protection
    const stateToken = crypto.randomUUID();
    const timestamp = Date.now();

    // Create HMAC signature to prevent tampering
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret';
    const dataToSign = `${stateToken}:${user.id}:${timestamp}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(dataToSign)
      .digest('hex')
      .substring(0, 16);

    // Encode state with signature for verification
    const state = Buffer.from(JSON.stringify({
      token: stateToken,
      userId: user.id,
      timestamp,
      sig: signature,
    })).toString('base64url');

    // Get the authorization URL
    const authUrl = getAuthorizationUrl(state);

    return NextResponse.json({ authUrl });
  } catch (error) {
    log.error('Error initiating Google Drive auth', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to initiate authorization' },
      { status: 500 }
    );
  }
}
