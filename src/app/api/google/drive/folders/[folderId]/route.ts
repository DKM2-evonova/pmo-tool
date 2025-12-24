import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { stopWatchChannel } from '@/lib/google/drive-client';
import type { UpdateWatchedFolderRequest } from '@/lib/google/drive-types';

interface RouteParams {
  params: Promise<{ folderId: string }>;
}

/**
 * GET /api/google/drive/folders/[folderId]
 * Get details of a specific watched folder
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { folderId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the folder with related data
    const { data: folder, error: fetchError } = await supabase
      .from('drive_watched_folders')
      .select(`
        *,
        projects:default_project_id (id, name)
      `)
      .eq('id', folderId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Get webhook channel status
    const { data: channel } = await supabase
      .from('drive_webhook_channels')
      .select('expiration, is_active')
      .eq('folder_id', folderId)
      .eq('is_active', true)
      .single();

    // Get recent processed files
    const { data: recentFiles } = await supabase
      .from('drive_processed_files')
      .select('id, file_name, status, error_message, skip_reason, meeting_id, created_at')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      folder: {
        id: folder.id,
        folderId: folder.folder_id,
        folderName: folder.folder_name,
        defaultProjectId: folder.default_project_id,
        defaultProjectName: (folder.projects as { name: string } | null)?.name,
        isActive: folder.is_active,
        lastSyncAt: folder.last_sync_at,
        webhookActive: !!channel && new Date(channel.expiration) > new Date(),
        webhookExpiration: channel?.expiration || null,
      },
      recentFiles: recentFiles || [],
    });
  } catch (error) {
    console.error('Error fetching folder:', error);
    return NextResponse.json(
      { error: 'Failed to fetch folder' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/google/drive/folders/[folderId]
 * Update folder settings (default project, active status)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { folderId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify folder belongs to user
    const { data: existing } = await supabase
      .from('drive_watched_folders')
      .select('id')
      .eq('id', folderId)
      .eq('user_id', user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Parse request body
    const body: UpdateWatchedFolderRequest = await request.json();
    const updates: Record<string, unknown> = {};

    // Handle defaultProjectId update
    if ('defaultProjectId' in body) {
      if (body.defaultProjectId) {
        // Validate user has access to the project
        const { data: project } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', user.id)
          .eq('project_id', body.defaultProjectId)
          .single();

        if (!project) {
          return NextResponse.json(
            { error: 'You do not have access to the specified project' },
            { status: 403 }
          );
        }
      }
      updates.default_project_id = body.defaultProjectId || null;
    }

    // Handle isActive update
    if ('isActive' in body) {
      updates.is_active = body.isActive;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    // Update the folder
    const { data: folder, error: updateError } = await supabase
      .from('drive_watched_folders')
      .update(updates)
      .eq('id', folderId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update folder:', updateError);
      return NextResponse.json(
        { error: 'Failed to update folder' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      folder: {
        id: folder.id,
        folderId: folder.folder_id,
        folderName: folder.folder_name,
        defaultProjectId: folder.default_project_id,
        isActive: folder.is_active,
      },
    });
  } catch (error) {
    console.error('Error updating folder:', error);
    return NextResponse.json(
      { error: 'Failed to update folder' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/google/drive/folders/[folderId]
 * Remove a folder from the watch list
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { folderId } = await params;
    const supabase = await createClient();
    const serviceClient = await createServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify folder belongs to user
    const { data: folder } = await supabase
      .from('drive_watched_folders')
      .select('id')
      .eq('id', folderId)
      .eq('user_id', user.id)
      .single();

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Get and stop any active webhook channels
    const { data: channels } = await serviceClient
      .from('drive_webhook_channels')
      .select('channel_id, resource_id')
      .eq('folder_id', folderId)
      .eq('is_active', true);

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

    // Delete webhook channels for this folder
    await serviceClient
      .from('drive_webhook_channels')
      .delete()
      .eq('folder_id', folderId);

    // Delete processed files for this folder
    await serviceClient
      .from('drive_processed_files')
      .delete()
      .eq('folder_id', folderId);

    // Delete the watched folder
    await serviceClient
      .from('drive_watched_folders')
      .delete()
      .eq('id', folderId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json(
      { error: 'Failed to delete folder' },
      { status: 500 }
    );
  }
}
