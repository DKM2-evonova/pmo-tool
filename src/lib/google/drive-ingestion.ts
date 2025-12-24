/**
 * Google Drive Ingestion Service
 * Handles syncing files from Drive and creating meetings
 */

import { createServiceClient } from '@/lib/supabase/server';
import {
  listFilesInFolder,
  downloadFile,
  exportGoogleDoc,
  getChanges,
  getStartPageToken,
  parseMeetingFromFilename,
  isSupportedTranscriptType,
} from './drive-client';
import { getValidAccessTokenService } from './drive-oauth';
import { processFile, FileProcessingResult } from '@/lib/file-processing';
import type {
  SyncResult,
  FileProcessingResult as DriveFileProcessingResult,
  DuplicateCheckResult,
  DriveWatchedFolderRow,
  DriveFile,
} from './drive-types';
import crypto from 'crypto';

/**
 * Generate a content fingerprint for duplicate detection
 */
function generateContentFingerprint(content: string): string {
  // Use first 2000 characters for fingerprint
  const sample = content.substring(0, 2000);
  return crypto.createHash('sha256').update(sample).digest('hex');
}

/**
 * Check if a meeting with similar content already exists
 */
async function checkForDuplicate(
  projectId: string,
  title: string,
  date: string,
  contentFingerprint: string
): Promise<DuplicateCheckResult> {
  const supabase = await createServiceClient();

  // Use the database function we created
  const { data, error } = await supabase.rpc('check_duplicate_meeting', {
    p_project_id: projectId,
    p_title: title,
    p_date: date,
    p_content_fingerprint: contentFingerprint,
  });

  if (error) {
    console.error('Error checking for duplicate:', error);
    // On error, assume not duplicate to avoid blocking
    return { isDuplicate: false };
  }

  if (data && data.length > 0 && data[0].is_duplicate) {
    return {
      isDuplicate: true,
      existingMeetingId: data[0].existing_meeting_id,
      matchType: data[0].match_type,
    };
  }

  return { isDuplicate: false };
}

/**
 * Get the default project for a user
 */
async function getDefaultProject(
  userId: string,
  preferredProjectId?: string | null
): Promise<string | null> {
  const supabase = await createServiceClient();

  // If preferred project is specified and user has access, use it
  if (preferredProjectId) {
    const { data: member } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', userId)
      .eq('project_id', preferredProjectId)
      .single();

    if (member) {
      return preferredProjectId;
    }
  }

  // Otherwise get the user's first project
  const { data: projects } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)
    .limit(1);

  return projects?.[0]?.project_id || null;
}

/**
 * Process a single file from Drive and create a meeting
 */
async function processTranscriptFile(
  userId: string,
  folderId: string,
  file: DriveFile,
  defaultProjectId: string | null
): Promise<DriveFileProcessingResult> {
  const supabase = await createServiceClient();

  // Check if already processed
  const { data: existing } = await supabase
    .from('drive_processed_files')
    .select('id, status, meeting_id, skip_reason')
    .eq('user_id', userId)
    .eq('drive_file_id', file.id)
    .single();

  if (existing?.status === 'completed') {
    return { success: true, meetingId: existing.meeting_id || undefined };
  }

  if (existing?.status === 'skipped') {
    return { success: true, skipped: true, skipReason: existing.skip_reason || 'Previously skipped' };
  }

  // Create or update processed file record
  const processedFileId = existing?.id || crypto.randomUUID();

  // Upsert the record
  await supabase
    .from('drive_processed_files')
    .upsert({
      id: processedFileId,
      user_id: userId,
      folder_id: folderId,
      drive_file_id: file.id,
      file_name: file.name,
      file_mime_type: file.mimeType,
      file_modified_time: file.modifiedTime,
      status: 'processing',
    }, {
      onConflict: 'user_id,drive_file_id',
    });

  try {
    // Download/export file content
    let textContent: string;

    if (file.mimeType === 'application/vnd.google-apps.document') {
      // Export Google Doc as plain text
      textContent = await exportGoogleDoc(userId, file.id, 'text/plain', true);
    } else {
      // Download binary file and process
      const buffer = await downloadFile(userId, file.id, true);

      // Create a File object for the file processing library
      const blob = new Blob([buffer], { type: file.mimeType });
      const fileObj = new File([blob], file.name, { type: file.mimeType });

      const result: FileProcessingResult = await processFile(fileObj);

      if (!result.success || !result.text) {
        throw new Error(result.error || 'Failed to extract text from file');
      }
      textContent = result.text;
    }

    // Validate we got meaningful content
    if (!textContent || textContent.trim().length < 50) {
      // Skip files with very little content
      await supabase
        .from('drive_processed_files')
        .update({
          status: 'skipped',
          skip_reason: 'File contains insufficient text content',
        })
        .eq('id', processedFileId);

      return { success: true, skipped: true, skipReason: 'Insufficient content' };
    }

    // Get the project to use
    const projectId = await getDefaultProject(userId, defaultProjectId);
    if (!projectId) {
      throw new Error('No project available for meeting assignment. Please create a project first.');
    }

    // Parse meeting title and date from filename
    const { title, date } = parseMeetingFromFilename(file.name);

    // Generate content fingerprint for duplicate detection
    const contentFingerprint = generateContentFingerprint(textContent);

    // Check for duplicates
    const duplicateCheck = await checkForDuplicate(
      projectId,
      title,
      date,
      contentFingerprint
    );

    if (duplicateCheck.isDuplicate) {
      await supabase
        .from('drive_processed_files')
        .update({
          status: 'skipped',
          skip_reason: `Duplicate of meeting ${duplicateCheck.existingMeetingId} (matched by ${duplicateCheck.matchType})`,
          meeting_id: duplicateCheck.existingMeetingId,
        })
        .eq('id', processedFileId);

      return {
        success: true,
        skipped: true,
        skipReason: `Duplicate of existing meeting`,
        meetingId: duplicateCheck.existingMeetingId,
      };
    }

    // Create meeting in Draft status
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert({
        project_id: projectId,
        title: title,
        date: date,
        transcript_text: textContent,
        status: 'Draft',
        is_auto_ingested: true,
        drive_file_id: file.id,
        drive_file_name: file.name,
        drive_ingested_at: new Date().toISOString(),
        content_fingerprint: contentFingerprint,
      })
      .select('id')
      .single();

    if (meetingError) {
      throw new Error(`Failed to create meeting: ${meetingError.message}`);
    }

    // Update processed file record
    await supabase
      .from('drive_processed_files')
      .update({
        status: 'completed',
        meeting_id: meeting.id,
        processed_at: new Date().toISOString(),
      })
      .eq('id', processedFileId);

    return { success: true, meetingId: meeting.id };

  } catch (error) {
    // Mark as failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await supabase
      .from('drive_processed_files')
      .update({
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', processedFileId);

    return { success: false, error: errorMessage };
  }
}

/**
 * Sync a watched folder for new files
 */
export async function syncFolder(
  userId: string,
  watchedFolderId: string
): Promise<SyncResult> {
  const supabase = await createServiceClient();

  // Get folder config
  const { data: folder, error: folderError } = await supabase
    .from('drive_watched_folders')
    .select('*')
    .eq('id', watchedFolderId)
    .eq('user_id', userId)
    .single();

  if (folderError || !folder) {
    return {
      processed: 0,
      skipped: 0,
      failed: 0,
      errors: ['Folder not found or inactive'],
    };
  }

  if (!folder.is_active) {
    return {
      processed: 0,
      skipped: 0,
      failed: 0,
      errors: ['Folder is not active'],
    };
  }

  // Verify we have a valid access token
  const accessToken = await getValidAccessTokenService(userId);
  if (!accessToken) {
    return {
      processed: 0,
      skipped: 0,
      failed: 0,
      errors: ['No valid access token. Please reconnect Google Drive.'],
    };
  }

  const result: SyncResult = {
    processed: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Get files modified since last sync (or all if first sync)
    const modifiedAfter = folder.last_sync_at || undefined;

    const fileList = await listFilesInFolder(userId, folder.folder_id, {
      modifiedAfter,
      useServiceClient: true,
    });

    // Process each file
    for (const file of fileList.files) {
      // Skip if not a supported transcript type
      if (!isSupportedTranscriptType(file.mimeType)) {
        continue;
      }

      const fileResult = await processTranscriptFile(
        userId,
        folder.id,
        file,
        folder.default_project_id
      );

      if (fileResult.success) {
        if (fileResult.skipped) {
          result.skipped++;
        } else {
          result.processed++;
        }
      } else {
        result.failed++;
        if (fileResult.error) {
          result.errors.push(`${file.name}: ${fileResult.error}`);
        }
      }
    }

    // Update last sync time and page token
    const newPageToken = await getStartPageToken(userId, true);

    await supabase
      .from('drive_watched_folders')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_page_token: newPageToken,
      })
      .eq('id', folder.id);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(errorMessage);
  }

  return result;
}

/**
 * Sync all active folders for a user
 */
export async function syncAllFolders(userId: string): Promise<SyncResult> {
  const supabase = await createServiceClient();

  const { data: folders } = await supabase
    .from('drive_watched_folders')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true);

  const result: SyncResult = {
    processed: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const folder of folders || []) {
    const folderResult = await syncFolder(userId, folder.id);
    result.processed += folderResult.processed;
    result.skipped += folderResult.skipped;
    result.failed += folderResult.failed;
    result.errors.push(...folderResult.errors);
  }

  return result;
}

/**
 * Process a webhook notification for changes
 */
export async function processWebhookChange(
  userId: string,
  folderId: string
): Promise<SyncResult> {
  // For now, just trigger a sync of the folder
  // In the future, we could use the Changes API for more efficiency
  return syncFolder(userId, folderId);
}
