import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getStoredTokens, revokeToken, deleteTokens } from '@/lib/google/drive-oauth';
import { stopWatchChannel } from '@/lib/google/drive-client';

/**
 * POST /api/google/drive/disconnect
 * Disconnects the user's Google Drive integration
 * Stops all active webhook channels and cleans up data
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

    const serviceClient = await createServiceClient();

    // Get all active webhook channels to stop them
    const { data: channels } = await serviceClient
      .from('drive_webhook_channels')
      .select('channel_id, resource_id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    // Stop each webhook channel (best effort)
    if (channels && channels.length > 0) {
      for (const channel of channels) {
        if (channel.resource_id) {
          try {
            await stopWatchChannel(user.id, channel.channel_id, channel.resource_id);
          } catch (error) {
            console.warn('Failed to stop webhook channel:', channel.channel_id, error);
          }
        }
      }
    }

    // Delete all webhook channels for this user
    await serviceClient
      .from('drive_webhook_channels')
      .delete()
      .eq('user_id', user.id);

    // Delete all processed file records
    await serviceClient
      .from('drive_processed_files')
      .delete()
      .eq('user_id', user.id);

    // Delete all watched folders
    await serviceClient
      .from('drive_watched_folders')
      .delete()
      .eq('user_id', user.id);

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
    console.error('Error disconnecting Google Drive:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Drive' },
      { status: 500 }
    );
  }
}
