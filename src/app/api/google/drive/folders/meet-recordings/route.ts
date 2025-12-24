import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findMeetRecordingsFolder } from '@/lib/google/drive-client';
import { isDriveConnected } from '@/lib/google/drive-oauth';

/**
 * GET /api/google/drive/folders/meet-recordings
 * Auto-detect the "Meet Recordings" folder in the user's Drive
 */
export async function GET() {
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

    // Find the Meet Recordings folder
    const folder = await findMeetRecordingsFolder(user.id);

    if (!folder) {
      return NextResponse.json({
        found: false,
        folder: null,
        message: 'No "Meet Recordings" folder found. This folder is automatically created by Google Meet when you record meetings.',
      });
    }

    // Check if this folder is already being watched
    const { data: existing } = await supabase
      .from('drive_watched_folders')
      .select('id')
      .eq('user_id', user.id)
      .eq('folder_id', folder.id)
      .single();

    return NextResponse.json({
      found: true,
      folder: {
        id: folder.id,
        name: folder.name,
        webViewLink: folder.webViewLink,
      },
      alreadyWatched: !!existing,
    });
  } catch (error) {
    console.error('Error finding Meet Recordings folder:', error);
    return NextResponse.json(
      { error: 'Failed to search for folder' },
      { status: 500 }
    );
  }
}
