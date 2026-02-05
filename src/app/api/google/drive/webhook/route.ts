import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { processWebhookChange } from '@/lib/google/drive-ingestion';
import { loggers } from '@/lib/logger';
import crypto from 'crypto';

const log = loggers.drive;

// Timeout for webhook processing (Google requires response within 10 seconds)
// We use 8 seconds to give buffer for response
const WEBHOOK_PROCESSING_TIMEOUT_MS = 8000;

/**
 * Wraps an async operation with a timeout
 * Returns the result if completed in time, or a timeout indicator
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<{ result: T; timedOut: false } | { result: null; timedOut: true }> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<{ result: null; timedOut: true }>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({ result: null, timedOut: true });
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([
      promise.then((r) => ({ result: r, timedOut: false as const })),
      timeoutPromise,
    ]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Verify the channel token from the webhook
 */
function verifyChannelToken(
  userId: string,
  channelId: string,
  providedToken: string
): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    log.error('WEBHOOK_SECRET environment variable is not set');
    return false;
  }
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

    log.debug('Received Drive webhook', {
      channelId,
      resourceId,
      resourceState,
      messageNumber,
      hasToken: !!channelToken,
    });

    // Validate required headers
    if (!channelId || !resourceId) {
      log.warn('Missing required webhook headers');
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
      log.warn('Unknown or inactive webhook channel', { channelId });
      // Return 200 to stop retries for unknown channels
      return NextResponse.json({ status: 'unknown_channel' });
    }

    // Verify the channel token if provided
    if (channelToken) {
      const isValid = verifyChannelToken(channel.user_id, channelId, channelToken);
      if (!isValid) {
        log.error('Invalid channel token - possible spoofing attempt', { channelId });
        // Still return 200 to prevent enumeration
        return NextResponse.json({ status: 'invalid_token' });
      }
    }

    // Check if channel has expired
    if (new Date(channel.expiration) < new Date()) {
      log.warn('Webhook channel has expired', { channelId });
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
      log.info('Webhook channel sync confirmed', { channelId });
      return NextResponse.json({ status: 'sync_confirmed' });
    }

    if (resourceState === 'change') {
      // Something changed in the watched resource
      log.info('Processing Drive changes for channel', { channelId });

      // Get the folder from the channel
      const folder = channel.drive_watched_folders as { id: string } | null;
      if (!folder) {
        log.warn('No folder associated with channel', { channelId });
        return NextResponse.json({ status: 'no_folder' });
      }

      // Mark as processing before starting
      await supabase
        .from('drive_webhook_channels')
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: 'processing',
        })
        .eq('id', channel.id);

      // Process with timeout to ensure we respond to Google in time
      // If processing takes too long, we return and let it continue in background
      // The cron job will handle any incomplete syncs
      try {
        const processResult = await withTimeout(
          processWebhookChange(channel.user_id, folder.id),
          WEBHOOK_PROCESSING_TIMEOUT_MS
        );

        if (processResult.timedOut) {
          // Processing is still running in background, but we need to respond
          log.warn('Webhook processing timed out, continuing in background', {
            channelId,
            folderId: folder.id,
            timeoutMs: WEBHOOK_PROCESSING_TIMEOUT_MS,
          });

          // Note: The processing promise is still running and will update the DB when done
          // We track this as 'processing' status - the cron job can retry if needed
          return NextResponse.json({ status: 'processing_timeout' });
        }

        const result = processResult.result;
        log.info('Webhook sync completed', {
          channelId,
          folderId: folder.id,
          processed: result.processed,
          skipped: result.skipped,
          failed: result.failed,
          errors: result.errors.length > 0 ? result.errors : undefined,
        });

        // Update channel with sync result
        await supabase
          .from('drive_webhook_channels')
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: result.failed > 0 ? 'partial' : 'success',
            last_sync_processed: result.processed,
            last_sync_failed: result.failed,
            last_sync_error: null,
          })
          .eq('id', channel.id);

        return NextResponse.json({
          status: 'completed',
          processed: result.processed,
          skipped: result.skipped,
          failed: result.failed,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log.error('Webhook sync failed', {
          channelId,
          folderId: folder.id,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Track the failure in the database for potential retry by cron
        await supabase
          .from('drive_webhook_channels')
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: 'failed',
            last_sync_error: errorMessage,
          })
          .eq('id', channel.id);

        // Still return 200 to prevent Google from retrying (we'll retry via cron)
        return NextResponse.json({ status: 'failed', error: errorMessage });
      }
    }

    // Other states: add, remove, update, trash, untrash
    log.debug('Unhandled resource state', { resourceState });
    return NextResponse.json({ status: 'unhandled_state' });

  } catch (error) {
    log.error('Error processing Drive webhook', { error: error instanceof Error ? error.message : 'Unknown error' });
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
