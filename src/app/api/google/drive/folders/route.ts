import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listFolders, getStartPageToken, setupWatchChannel } from '@/lib/google/drive-client';
import { isDriveConnected } from '@/lib/google/drive-oauth';
import { loggers } from '@/lib/logger';
import type { AddWatchedFolderRequest } from '@/lib/google/drive-types';
import crypto from 'crypto';

const log = loggers.drive;

/**
 * GET /api/google/drive/folders
 * List available folders from user's Drive for selection
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if Drive is connected
    const isConnected = await isDriveConnected(user.id);
    if (!isConnected) {
      return NextResponse.json(
        { error: 'Google Drive not connected' },
        { status: 400 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const searchQuery = searchParams.get('search') || undefined;
    const pageToken = searchParams.get('pageToken') || undefined;

    // List folders from Drive
    const result = await listFolders(user.id, { searchQuery, pageToken });

    return NextResponse.json(result);
  } catch (error) {
    log.error('Error listing folders', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to list folders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/google/drive/folders
 * Add a folder to watch for new transcripts
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if Drive is connected
    const isConnected = await isDriveConnected(user.id);
    if (!isConnected) {
      return NextResponse.json(
        { error: 'Google Drive not connected' },
        { status: 400 }
      );
    }

    // Parse request body
    const body: AddWatchedFolderRequest = await request.json();
    const { folderId, folderName, defaultProjectId } = body;

    if (!folderId || !folderName) {
      return NextResponse.json(
        { error: 'folderId and folderName are required' },
        { status: 400 }
      );
    }

    // Check if folder is already being watched
    const { data: existing } = await supabase
      .from('drive_watched_folders')
      .select('id')
      .eq('user_id', user.id)
      .eq('folder_id', folderId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Folder is already being watched' },
        { status: 409 }
      );
    }

    // Validate defaultProjectId if provided
    if (defaultProjectId) {
      const { data: project } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id)
        .eq('project_id', defaultProjectId)
        .single();

      if (!project) {
        return NextResponse.json(
          { error: 'You do not have access to the specified project' },
          { status: 403 }
        );
      }
    }

    // Get the start page token for incremental sync
    const startPageToken = await getStartPageToken(user.id);

    // Create the watched folder record
    const { data: folder, error: insertError } = await supabase
      .from('drive_watched_folders')
      .insert({
        user_id: user.id,
        folder_id: folderId,
        folder_name: folderName,
        default_project_id: defaultProjectId || null,
        is_active: true,
        last_sync_page_token: startPageToken,
      })
      .select()
      .single();

    if (insertError) {
      log.error('Failed to create watched folder', { error: insertError.message });
      return NextResponse.json(
        { error: 'Failed to add folder' },
        { status: 500 }
      );
    }

    // Try to set up webhook channel (optional, will fall back to polling)
    let webhookSetup = false;
    const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/google/drive/webhook`
      : null;

    if (webhookUrl) {
      try {
        const channelId = crypto.randomUUID();
        const channelToken = generateChannelToken(user.id, channelId);

        const watchResponse = await setupWatchChannel(
          user.id,
          folderId,
          webhookUrl,
          channelId,
          channelToken
        );

        // Store the webhook channel
        await supabase
          .from('drive_webhook_channels')
          .insert({
            user_id: user.id,
            folder_id: folder.id,
            channel_id: channelId,
            resource_id: watchResponse.resourceId,
            resource_uri: watchResponse.resourceUri,
            expiration: new Date(parseInt(watchResponse.expiration)).toISOString(),
            is_active: true,
          });

        webhookSetup = true;
      } catch (error) {
        // Webhook setup failed, but folder is still added - will use polling
        log.warn('Failed to set up webhook, will use polling', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return NextResponse.json({
      success: true,
      folder: {
        id: folder.id,
        folderId: folder.folder_id,
        folderName: folder.folder_name,
        defaultProjectId: folder.default_project_id,
        isActive: folder.is_active,
        webhookActive: webhookSetup,
      },
    });
  } catch (error) {
    log.error('Error adding watched folder', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to add folder' },
      { status: 500 }
    );
  }
}

/**
 * Generate a channel token for webhook verification
 * @throws Error if WEBHOOK_SECRET is not configured
 */
function generateChannelToken(userId: string, channelId: string): string {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('WEBHOOK_SECRET environment variable is required for webhook token generation');
  }
  return crypto
    .createHmac('sha256', secret)
    .update(`${userId}:${channelId}`)
    .digest('hex')
    .substring(0, 32);
}
