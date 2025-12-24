import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStoredTokens, isDriveConfigured } from '@/lib/google/drive-oauth';
import type { DriveConnectionStatus, WatchedFolderInfo } from '@/lib/google/drive-types';

/**
 * GET /api/google/drive/status
 * Returns the current Google Drive connection status including watched folders
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

    // Check if Google Drive integration is configured
    const isConfigured = isDriveConfigured();

    if (!isConfigured) {
      const status: DriveConnectionStatus = {
        configured: false,
        connected: false,
        provider: null,
        watchedFolders: [],
        pendingImportsCount: 0,
      };
      return NextResponse.json(status);
    }

    // Get stored tokens
    const tokens = await getStoredTokens(user.id);

    if (!tokens) {
      const status: DriveConnectionStatus = {
        configured: true,
        connected: false,
        provider: null,
        watchedFolders: [],
        pendingImportsCount: 0,
      };
      return NextResponse.json(status);
    }

    // Get watched folders with their webhook status
    const { data: folders } = await supabase
      .from('drive_watched_folders')
      .select(`
        id,
        folder_id,
        folder_name,
        default_project_id,
        is_active,
        last_sync_at,
        projects:default_project_id (name)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Get active webhook channels for each folder
    const { data: channels } = await supabase
      .from('drive_webhook_channels')
      .select('folder_id, expiration, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true);

    // Create a map of folder_id to channel info
    const channelMap = new Map<string, { expiration: string }>();
    channels?.forEach((channel) => {
      channelMap.set(channel.folder_id, { expiration: channel.expiration });
    });

    // Transform folders to response format
    const watchedFolders: WatchedFolderInfo[] = (folders || []).map((folder) => {
      const channel = channelMap.get(folder.id);
      return {
        id: folder.id,
        folderId: folder.folder_id,
        folderName: folder.folder_name,
        defaultProjectId: folder.default_project_id,
        defaultProjectName: (folder.projects as unknown as { name: string } | null)?.name,
        isActive: folder.is_active,
        lastSyncAt: folder.last_sync_at,
        webhookActive: !!channel && new Date(channel.expiration) > new Date(),
        webhookExpiration: channel?.expiration || null,
      };
    });

    // Get count of pending imports
    const { count: pendingCount } = await supabase
      .from('drive_processed_files')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing']);

    const status: DriveConnectionStatus = {
      configured: true,
      connected: true,
      provider: 'google_drive',
      email: undefined, // Could fetch from userinfo if needed
      connectedAt: tokens.created_at,
      expiresAt: tokens.expires_at || undefined,
      watchedFolders,
      pendingImportsCount: pendingCount || 0,
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error('Error checking Drive status:', error);
    return NextResponse.json(
      { error: 'Failed to check Drive status' },
      { status: 500 }
    );
  }
}
