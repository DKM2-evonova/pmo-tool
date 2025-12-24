import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { processWebhookChange } from '@/lib/google/drive-ingestion';
import crypto from 'crypto';

/**
 * Verify the channel token from the webhook
 */
function verifyChannelToken(
  userId: string,
  channelId: string,
  providedToken: string
): boolean {
  const secret = process.env.WEBHOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-secret';
  const expectedToken = crypto
    .createHmac('sha256', secret)
    .update(`${userId}:${channelId}`)
    .digest('hex')
    .substring(0, 32);

  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedToken),
      Buffer.from(expectedToken)
    );
  } catch {
    return false;
  }
}

/**
 * POST /api/google/drive/webhook
 * Receives Google Drive push notifications
 */
export async function POST(request: NextRequest) {
  try {
    // Extract headers from the webhook
    const channelId = request.headers.get('x-goog-channel-id');
    const resourceId = request.headers.get('x-goog-resource-id');
    const resourceState = request.headers.get('x-goog-resource-state');
    const channelToken = request.headers.get('x-goog-channel-token');
    const messageNumber = request.headers.get('x-goog-message-number');

    console.log('Received Drive webhook:', {
      channelId,
      resourceId,
      resourceState,
      messageNumber,
      hasToken: !!channelToken,
    });

    // Validate required headers
    if (!channelId || !resourceId) {
      console.warn('Missing required webhook headers');
      // Return 200 to prevent retries
      return NextResponse.json({ status: 'missing_headers' });
    }

    // Look up the channel in the database
    const supabase = await createServiceClient();
    const { data: channel, error: channelError } = await supabase
      .from('drive_webhook_channels')
      .select(`
        *,
        drive_watched_folders:folder_id (*)
      `)
      .eq('channel_id', channelId)
      .eq('is_active', true)
      .single();

    if (channelError || !channel) {
      console.warn('Unknown or inactive webhook channel:', channelId);
      // Return 200 to stop retries for unknown channels
      return NextResponse.json({ status: 'unknown_channel' });
    }

    // Verify the channel token if provided
    if (channelToken) {
      const isValid = verifyChannelToken(channel.user_id, channelId, channelToken);
      if (!isValid) {
        console.error('Invalid channel token - possible spoofing attempt');
        // Still return 200 to prevent enumeration
        return NextResponse.json({ status: 'invalid_token' });
      }
    }

    // Check if channel has expired
    if (new Date(channel.expiration) < new Date()) {
      console.warn('Webhook channel has expired:', channelId);
      // Mark as inactive
      await supabase
        .from('drive_webhook_channels')
        .update({ is_active: false })
        .eq('id', channel.id);

      return NextResponse.json({ status: 'channel_expired' });
    }

    // Handle different resource states
    if (resourceState === 'sync') {
      // Initial sync confirmation - channel is now active
      console.log('Webhook channel sync confirmed:', channelId);
      return NextResponse.json({ status: 'sync_confirmed' });
    }

    if (resourceState === 'change') {
      // Something changed in the watched resource
      console.log('Processing Drive changes for channel:', channelId);

      // Get the folder from the channel
      const folder = channel.drive_watched_folders as { id: string } | null;
      if (!folder) {
        console.warn('No folder associated with channel:', channelId);
        return NextResponse.json({ status: 'no_folder' });
      }

      // Trigger sync for this folder
      // Note: This is async but we return immediately
      processWebhookChange(channel.user_id, folder.id)
        .then((result) => {
          console.log('Webhook sync completed:', {
            channelId,
            processed: result.processed,
            skipped: result.skipped,
            failed: result.failed,
          });
        })
        .catch((error) => {
          console.error('Webhook sync failed:', channelId, error);
        });

      return NextResponse.json({ status: 'processing' });
    }

    // Other states: add, remove, update, trash, untrash
    console.log('Unhandled resource state:', resourceState);
    return NextResponse.json({ status: 'unhandled_state' });

  } catch (error) {
    console.error('Error processing Drive webhook:', error);
    // Return 200 even on errors to prevent retries
    return NextResponse.json({ status: 'error' });
  }
}

/**
 * GET /api/google/drive/webhook
 * Health check endpoint (useful for testing)
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'Google Drive webhook receiver',
    timestamp: new Date().toISOString(),
  });
}
