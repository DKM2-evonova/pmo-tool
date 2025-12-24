import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isDriveConnected } from '@/lib/google/drive-oauth';
import { syncFolder } from '@/lib/google/drive-ingestion';

/**
 * POST /api/google/drive/sync
 * Manually trigger sync for watched folders
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

    // Parse request body for optional folderId
    let folderId: string | undefined;
    try {
      const body = await request.json();
      folderId = body.folderId;
    } catch {
      // No body is fine - will sync all folders
    }

    // Get folders to sync
    let foldersQuery = supabase
      .from('drive_watched_folders')
      .select('id, folder_id, folder_name')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (folderId) {
      foldersQuery = foldersQuery.eq('id', folderId);
    }

    const { data: folders, error: fetchError } = await foldersQuery;

    if (fetchError) {
      console.error('Failed to fetch folders:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch folders' },
        { status: 500 }
      );
    }

    if (!folders || folders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No folders to sync',
        results: [],
      });
    }

    // Sync each folder
    const results = [];
    for (const folder of folders) {
      try {
        const result = await syncFolder(user.id, folder.id);
        results.push({
          folderId: folder.id,
          folderName: folder.folder_name,
          ...result,
        });
      } catch (error) {
        results.push({
          folderId: folder.id,
          folderName: folder.folder_name,
          processed: 0,
          skipped: 0,
          failed: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        });
      }
    }

    // Calculate totals
    const totals = results.reduce(
      (acc, r) => ({
        processed: acc.processed + r.processed,
        skipped: acc.skipped + r.skipped,
        failed: acc.failed + r.failed,
      }),
      { processed: 0, skipped: 0, failed: 0 }
    );

    return NextResponse.json({
      success: true,
      ...totals,
      results,
    });
  } catch (error) {
    console.error('Error syncing folders:', error);
    return NextResponse.json(
      { error: 'Failed to sync folders' },
      { status: 500 }
    );
  }
}
