import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { syncFolder } from '@/lib/google/drive-ingestion';
import { setupWatchChannel, stopWatchChannel, getStartPageToken } from '@/lib/google/drive-client';
import { getValidAccessTokenService } from '@/lib/google/drive-oauth';
import crypto from 'crypto';

/**
 * Generate a channel token for webhook verification
 */
function generateChannelToken(userId: string, channelId: string): string {
  const secret = process.env.WEBHOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`${userId}:${channelId}`)
    .digest('hex')
    .substring(0, 32);
}

/**
 * GET /api/cron/drive-sync
 * Hourly cron job for:
 * 1. Renewing expiring webhook channels
 * 2. Polling all active watched folders (backup to webhooks)
 * 3. Cleaning up expired channels
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, require the cron secret
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('Unauthorized cron access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceClient();
    const results = {
      channelsRenewed: 0,
      channelsExpired: 0,
      channelRenewalErrors: [] as string[],
      foldersSynced: 0,
      totalProcessed: 0,
      totalSkipped: 0,
      totalFailed: 0,
      syncErrors: [] as string[],
    };

    // 1. Renew expiring webhook channels (within 1 hour of expiration)
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { data: expiringChannels } = await supabase
      .from('drive_webhook_channels')
      .select(`
        *,
        drive_watched_folders:folder_id (id, user_id, folder_id)
      `)
      .eq('is_active', true)
      .lt('expiration', oneHourFromNow);

    for (const channel of expiringChannels || []) {
      try {
        const folder = channel.drive_watched_folders as { id: string; user_id: string; folder_id: string } | null;
        if (!folder) continue;

        // Check if user still has valid access token
        const accessToken = await getValidAccessTokenService(folder.user_id);
        if (!accessToken) {
          // User's token is invalid, mark channel as inactive
          await supabase
            .from('drive_webhook_channels')
            .update({ is_active: false })
            .eq('id', channel.id);
          results.channelsExpired++;
          continue;
        }

        // Stop the old channel (best effort)
        if (channel.resource_id) {
          try {
            await stopWatchChannel(folder.user_id, channel.channel_id, channel.resource_id);
          } catch {
            // Ignore errors stopping old channel
          }
        }

        // Create a new channel
        const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/api/google/drive/webhook`
          : null;

        if (!webhookUrl) {
          throw new Error('NEXT_PUBLIC_APP_URL not configured');
        }

        const newChannelId = crypto.randomUUID();
        const channelToken = generateChannelToken(folder.user_id, newChannelId);

        const watchResponse = await setupWatchChannel(
          folder.user_id,
          folder.folder_id,
          webhookUrl,
          newChannelId,
          channelToken
        );

        // Update the channel record
        await supabase
          .from('drive_webhook_channels')
          .update({
            channel_id: newChannelId,
            resource_id: watchResponse.resourceId,
            resource_uri: watchResponse.resourceUri,
            expiration: new Date(parseInt(watchResponse.expiration)).toISOString(),
            renewed_at: new Date().toISOString(),
          })
          .eq('id', channel.id);

        results.channelsRenewed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.channelRenewalErrors.push(`Channel ${channel.id}: ${errorMessage}`);

        // Mark channel as inactive on failure
        await supabase
          .from('drive_webhook_channels')
          .update({ is_active: false })
          .eq('id', channel.id);
        results.channelsExpired++;
      }
    }

    // 2. Clean up expired channels
    const now = new Date().toISOString();
    const { data: expiredChannels } = await supabase
      .from('drive_webhook_channels')
      .select('id')
      .eq('is_active', true)
      .lt('expiration', now);

    if (expiredChannels && expiredChannels.length > 0) {
      await supabase
        .from('drive_webhook_channels')
        .update({ is_active: false })
        .in('id', expiredChannels.map((c) => c.id));
      results.channelsExpired += expiredChannels.length;
    }

    // 3. Poll all active watched folders (backup to webhooks)
    const { data: activeFolders } = await supabase
      .from('drive_watched_folders')
      .select('id, user_id, folder_name')
      .eq('is_active', true);

    for (const folder of activeFolders || []) {
      try {
        // Check if user still has valid access token
        const accessToken = await getValidAccessTokenService(folder.user_id);
        if (!accessToken) {
          results.syncErrors.push(`${folder.folder_name}: No valid access token`);
          continue;
        }

        const syncResult = await syncFolder(folder.user_id, folder.id);

        results.foldersSynced++;
        results.totalProcessed += syncResult.processed;
        results.totalSkipped += syncResult.skipped;
        results.totalFailed += syncResult.failed;

        if (syncResult.errors.length > 0) {
          results.syncErrors.push(
            ...syncResult.errors.map((e) => `${folder.folder_name}: ${e}`)
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.syncErrors.push(`${folder.folder_name}: ${errorMessage}`);
      }
    }

    console.log('Drive sync cron completed:', results);

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in Drive sync cron:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
