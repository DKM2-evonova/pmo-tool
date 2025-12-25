/**
 * Google Drive OAuth utilities
 * Handles OAuth token management for Drive integration
 */

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { loggers } from '@/lib/logger';
import { TOKEN_REFRESH_BUFFER_MS } from '@/lib/config';
import type { OAuthToken, GoogleTokenResponse } from './types';

const log = loggers.drive;

// OAuth configuration for Drive
const GOOGLE_DRIVE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_DRIVE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI || 'http://localhost:3000/api/google/drive/callback',
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  revokeUrl: 'https://oauth2.googleapis.com/revoke',
  scopes: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
};

const PROVIDER = 'google_drive';

/**
 * Check if Drive OAuth is configured
 */
export function isDriveConfigured(): boolean {
  return !!(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
    process.env.GOOGLE_DRIVE_CLIENT_SECRET
  );
}

/**
 * Generate the Google OAuth authorization URL for Drive
 */
export function getAuthorizationUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_DRIVE_OAUTH_CONFIG.clientId,
    redirect_uri: GOOGLE_DRIVE_OAUTH_CONFIG.redirectUri,
    response_type: 'code',
    scope: GOOGLE_DRIVE_OAUTH_CONFIG.scopes.join(' '),
    access_type: 'offline', // Required to get refresh_token
    prompt: 'consent', // Force consent to ensure refresh_token
    ...(state && { state }),
  });

  return `${GOOGLE_DRIVE_OAUTH_CONFIG.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_DRIVE_OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_DRIVE_OAUTH_CONFIG.clientId,
      client_secret: GOOGLE_DRIVE_OAUTH_CONFIG.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: GOOGLE_DRIVE_OAUTH_CONFIG.redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  return response.json();
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_DRIVE_OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_DRIVE_OAUTH_CONFIG.clientId,
      client_secret: GOOGLE_DRIVE_OAUTH_CONFIG.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  return response.json();
}

/**
 * Revoke a token (for disconnect)
 */
export async function revokeToken(token: string): Promise<void> {
  const response = await fetch(`${GOOGLE_DRIVE_OAUTH_CONFIG.revokeUrl}?token=${token}`, {
    method: 'POST',
  });

  // Google returns 200 on success, but we don't throw on failure
  // since we want to clean up our database regardless
  if (!response.ok) {
    log.warn('Failed to revoke Drive token with Google, continuing with local cleanup');
  }
}

/**
 * Store OAuth tokens in the database
 */
export async function storeTokens(
  userId: string,
  tokens: GoogleTokenResponse
): Promise<void> {
  const supabase = await createServiceClient();

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  const { error } = await supabase
    .from('user_oauth_tokens')
    .upsert({
      user_id: userId,
      provider: PROVIDER,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_type: tokens.token_type,
      expires_at: expiresAt,
      scopes: tokens.scope.split(' '),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,provider',
    });

  if (error) {
    throw new Error(`Failed to store Drive tokens: ${error.message}`);
  }
}

/**
 * Get stored tokens for a user
 */
export async function getStoredTokens(userId: string): Promise<OAuthToken | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', PROVIDER)
    .single();

  if (error || !data) {
    return null;
  }

  return data as OAuthToken;
}

/**
 * Get stored tokens using service client (for background jobs)
 */
export async function getStoredTokensService(userId: string): Promise<OAuthToken | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('user_oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', PROVIDER)
    .single();

  if (error || !data) {
    return null;
  }

  return data as OAuthToken;
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const tokens = await getStoredTokens(userId);

  if (!tokens) {
    return null;
  }

  // Check if token is expired (with buffer)
  const expiresAt = tokens.expires_at ? new Date(tokens.expires_at) : null;
  const isExpired = expiresAt && expiresAt.getTime() < Date.now() + TOKEN_REFRESH_BUFFER_MS;

  if (!isExpired) {
    return tokens.access_token;
  }

  // Token is expired, try to refresh
  if (!tokens.refresh_token) {
    // No refresh token, user needs to re-authorize
    return null;
  }

  try {
    const newTokens = await refreshAccessToken(tokens.refresh_token);
    await storeTokens(userId, {
      ...newTokens,
      refresh_token: newTokens.refresh_token || tokens.refresh_token,
    });
    return newTokens.access_token;
  } catch (error) {
    log.error('Failed to refresh Drive token', { error: error instanceof Error ? error.message : 'Unknown error', userId });
    return null;
  }
}

/**
 * Get a valid access token using service client (for background jobs)
 */
export async function getValidAccessTokenService(userId: string): Promise<string | null> {
  const tokens = await getStoredTokensService(userId);

  if (!tokens) {
    return null;
  }

  // Check if token is expired (with buffer)
  const expiresAt = tokens.expires_at ? new Date(tokens.expires_at) : null;
  const isExpired = expiresAt && expiresAt.getTime() < Date.now() + TOKEN_REFRESH_BUFFER_MS;

  if (!isExpired) {
    return tokens.access_token;
  }

  // Token is expired, try to refresh
  if (!tokens.refresh_token) {
    return null;
  }

  try {
    const newTokens = await refreshAccessToken(tokens.refresh_token);
    await storeTokens(userId, {
      ...newTokens,
      refresh_token: newTokens.refresh_token || tokens.refresh_token,
    });
    return newTokens.access_token;
  } catch (error) {
    log.error('Failed to refresh Drive token', { error: error instanceof Error ? error.message : 'Unknown error', userId });
    return null;
  }
}

/**
 * Delete stored tokens for a user
 */
export async function deleteTokens(userId: string): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from('user_oauth_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('provider', PROVIDER);

  if (error) {
    throw new Error(`Failed to delete Drive tokens: ${error.message}`);
  }
}

/**
 * Check if a user has connected their Drive
 */
export async function isDriveConnected(userId: string): Promise<boolean> {
  const tokens = await getStoredTokens(userId);
  return tokens !== null;
}

/**
 * Get user's email from Google
 */
export async function getUserEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.email || null;
  } catch (error) {
    log.error('Failed to get user email', { error: error instanceof Error ? error.message : 'Unknown error' });
    return null;
  }
}
