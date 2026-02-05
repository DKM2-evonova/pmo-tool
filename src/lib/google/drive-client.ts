/**
 * Google Drive API Client
 * Handles all Drive API interactions for transcript ingestion
 */

import { getValidAccessToken, getValidAccessTokenService } from './drive-oauth';
import { loggers } from '@/lib/logger';
import { DRIVE_WEBHOOK_EXPIRATION_MS } from '@/lib/config';
import { withRetry, isTransientError } from '@/lib/retry';
import type {
  GoogleDriveFile,
  GoogleDriveFileList,
  GoogleDriveWatchResponse,
  GoogleDriveChangesResponse,
  GoogleDriveStartPageTokenResponse,
  DriveFile,
  DriveFileList,
  TRANSCRIPT_MIME_TYPES,
  FOLDER_MIME_TYPE,
} from './drive-types';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const log = loggers.drive;

/**
 * Escape a string for use in Google Drive Query Language
 * Drive API uses a SQL-like query language where certain characters must be escaped
 *
 * According to Google Drive API docs, the query value must:
 * - Be surrounded by single quotes
 * - Have single quotes within the value escaped with backslash
 * - Have backslashes escaped with another backslash
 *
 * @see https://developers.google.com/drive/api/guides/search-files
 */
function escapeDriveQueryValue(value: string): string {
  // First escape backslashes, then escape single quotes
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// MIME types we consider as potential transcripts
const SUPPORTED_MIME_TYPES = [
  'application/vnd.google-apps.document', // Google Docs
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/pdf',
  'text/plain',
  'application/rtf',
];

/**
 * Transform Google Drive file to our simplified format
 */
function transformDriveFile(file: GoogleDriveFile): DriveFile {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    createdTime: file.createdTime,
    size: file.size ? parseInt(file.size, 10) : undefined,
    webViewLink: file.webViewLink,
    isFolder: file.mimeType === 'application/vnd.google-apps.folder',
  };
}

/**
 * List folders in the user's Drive (for folder selection)
 */
export async function listFolders(
  userId: string,
  options: {
    searchQuery?: string;
    pageToken?: string;
    maxResults?: number;
  } = {}
): Promise<DriveFileList> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('No valid access token available. Please reconnect your Drive.');
  }

  const { searchQuery, pageToken, maxResults = 50 } = options;

  // Build query to find folders
  let query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  if (searchQuery) {
    // Properly escape the search query to prevent query injection
    query += ` and name contains '${escapeDriveQueryValue(searchQuery)}'`;
  }

  const params = new URLSearchParams({
    q: query,
    fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,createdTime,webViewLink)',
    pageSize: maxResults.toString(),
    orderBy: 'name',
    ...(pageToken && { pageToken }),
  });

  const data = await withRetry(
    async () => {
      const response = await fetch(`${DRIVE_API_BASE}/files?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const error = await response.text();
        const err = new Error(`Failed to list folders: ${error}`);
        (err as Error & { status: number }).status = response.status;
        throw err;
      }

      return response.json() as Promise<GoogleDriveFileList>;
    },
    { context: 'Drive API: list folders', isRetryable: isTransientError }
  );

  return {
    files: (data.files || []).map(transformDriveFile),
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Find the "Meet Recordings" folder automatically
 */
export async function findMeetRecordingsFolder(userId: string): Promise<DriveFile | null> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('No valid access token available. Please reconnect your Drive.');
  }

  // Search for folder with exact name "Meet Recordings"
  const query = "mimeType = 'application/vnd.google-apps.folder' and name = 'Meet Recordings' and trashed = false";

  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,name,mimeType,modifiedTime,createdTime,webViewLink)',
    pageSize: '1',
  });

  const response = await fetch(`${DRIVE_API_BASE}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to search for Meet Recordings folder: ${error}`);
  }

  const data: GoogleDriveFileList = await response.json();

  if (data.files && data.files.length > 0) {
    return transformDriveFile(data.files[0]);
  }

  return null;
}

/**
 * List files in a specific folder
 */
export async function listFilesInFolder(
  userId: string,
  folderId: string,
  options: {
    pageToken?: string;
    maxResults?: number;
    modifiedAfter?: string; // ISO date string
    useServiceClient?: boolean;
  } = {}
): Promise<DriveFileList> {
  const accessToken = options.useServiceClient
    ? await getValidAccessTokenService(userId)
    : await getValidAccessToken(userId);

  if (!accessToken) {
    throw new Error('No valid access token available. Please reconnect your Drive.');
  }

  const { pageToken, maxResults = 100, modifiedAfter } = options;

  // Build query to find files in folder
  let query = `'${folderId}' in parents and trashed = false`;

  // Filter to only transcript-like files
  const mimeTypeFilters = SUPPORTED_MIME_TYPES.map((m) => `mimeType = '${m}'`).join(' or ');
  query += ` and (${mimeTypeFilters})`;

  // Filter by modification time if provided
  if (modifiedAfter) {
    query += ` and modifiedTime > '${modifiedAfter}'`;
  }

  const params = new URLSearchParams({
    q: query,
    fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,createdTime,size,webViewLink)',
    pageSize: maxResults.toString(),
    orderBy: 'modifiedTime desc',
    ...(pageToken && { pageToken }),
  });

  const data = await withRetry(
    async () => {
      const response = await fetch(`${DRIVE_API_BASE}/files?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const error = await response.text();
        const err = new Error(`Failed to list files in folder: ${error}`);
        (err as Error & { status: number }).status = response.status;
        throw err;
      }

      return response.json() as Promise<GoogleDriveFileList>;
    },
    { context: 'Drive API: list files in folder', isRetryable: isTransientError }
  );

  return {
    files: (data.files || []).map(transformDriveFile),
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Get a single file's metadata
 */
export async function getFile(
  userId: string,
  fileId: string,
  useServiceClient: boolean = false
): Promise<DriveFile | null> {
  const accessToken = useServiceClient
    ? await getValidAccessTokenService(userId)
    : await getValidAccessToken(userId);

  if (!accessToken) {
    throw new Error('No valid access token available. Please reconnect your Drive.');
  }

  const params = new URLSearchParams({
    fields: 'id,name,mimeType,modifiedTime,createdTime,size,webViewLink',
  });

  const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const error = await response.text();
    throw new Error(`Failed to get file: ${error}`);
  }

  const file: GoogleDriveFile = await response.json();
  return transformDriveFile(file);
}

/**
 * Download a file's content as binary
 */
export async function downloadFile(
  userId: string,
  fileId: string,
  useServiceClient: boolean = false
): Promise<ArrayBuffer> {
  const accessToken = useServiceClient
    ? await getValidAccessTokenService(userId)
    : await getValidAccessToken(userId);

  if (!accessToken) {
    throw new Error('No valid access token available. Please reconnect your Drive.');
  }

  return withRetry(
    async () => {
      const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const error = await response.text();
        const err = new Error(`Failed to download file: ${error}`);
        (err as Error & { status: number }).status = response.status;
        throw err;
      }

      return response.arrayBuffer();
    },
    { context: 'Drive API: download file', isRetryable: isTransientError }
  );
}

/**
 * Export a Google Doc to a specific format
 */
export async function exportGoogleDoc(
  userId: string,
  fileId: string,
  exportMimeType: string = 'text/plain',
  useServiceClient: boolean = false
): Promise<string> {
  const accessToken = useServiceClient
    ? await getValidAccessTokenService(userId)
    : await getValidAccessToken(userId);

  if (!accessToken) {
    throw new Error('No valid access token available. Please reconnect your Drive.');
  }

  const params = new URLSearchParams({
    mimeType: exportMimeType,
  });

  const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}/export?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to export Google Doc: ${error}`);
  }

  return response.text();
}

/**
 * Get the start page token for watching changes
 */
export async function getStartPageToken(
  userId: string,
  useServiceClient: boolean = false
): Promise<string> {
  const accessToken = useServiceClient
    ? await getValidAccessTokenService(userId)
    : await getValidAccessToken(userId);

  if (!accessToken) {
    throw new Error('No valid access token available. Please reconnect your Drive.');
  }

  const response = await fetch(`${DRIVE_API_BASE}/changes/startPageToken`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get start page token: ${error}`);
  }

  const data: GoogleDriveStartPageTokenResponse = await response.json();
  return data.startPageToken;
}

/**
 * Get changes since a page token
 */
export async function getChanges(
  userId: string,
  pageToken: string,
  useServiceClient: boolean = false
): Promise<GoogleDriveChangesResponse> {
  const accessToken = useServiceClient
    ? await getValidAccessTokenService(userId)
    : await getValidAccessToken(userId);

  if (!accessToken) {
    throw new Error('No valid access token available. Please reconnect your Drive.');
  }

  const params = new URLSearchParams({
    pageToken,
    fields: 'nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,modifiedTime,parents,trashed))',
    pageSize: '100',
    includeRemoved: 'false',
  });

  const response = await fetch(`${DRIVE_API_BASE}/changes?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get changes: ${error}`);
  }

  return response.json();
}

/**
 * Set up a watch channel for a folder
 */
export async function setupWatchChannel(
  userId: string,
  folderId: string,
  webhookUrl: string,
  channelId: string,
  channelToken: string,
  expirationMs: number = DRIVE_WEBHOOK_EXPIRATION_MS
): Promise<GoogleDriveWatchResponse> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error('No valid access token available. Please reconnect your Drive.');
  }

  // Note: Drive API watch is on changes, not on specific folders
  // We watch the user's entire Drive and filter by folder in webhook handler
  const expiration = Date.now() + expirationMs;

  const response = await fetch(`${DRIVE_API_BASE}/changes/watch?pageToken=`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: channelId,
      type: 'web_hook',
      address: webhookUrl,
      token: channelToken,
      expiration: expiration.toString(),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to set up watch channel: ${error}`);
  }

  return response.json();
}

/**
 * Stop a watch channel
 */
export async function stopWatchChannel(
  userId: string,
  channelId: string,
  resourceId: string
): Promise<void> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    // Can't stop channel without token, but that's okay - it will expire
    log.warn('Cannot stop watch channel: no valid access token', { channelId });
    return;
  }

  const response = await fetch(`${DRIVE_API_BASE}/channels/stop`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: channelId,
      resourceId: resourceId,
    }),
  });

  if (!response.ok) {
    // Don't throw - channel might already be stopped or expired
    const errorText = await response.text();
    log.warn('Failed to stop watch channel', { channelId, error: errorText });
  }
}

/**
 * Check if a file is a supported transcript type
 */
export function isSupportedTranscriptType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.includes(mimeType);
}

/**
 * Check if a file appears to be from Google Meet
 * Heuristic: filename matches patterns like "Meeting Name - YYYY-MM-DD"
 */
export function looksLikeMeetTranscript(fileName: string): boolean {
  // Common patterns:
  // "Meeting Name - 2024-01-15 14.30.00 GMT"
  // "Weekly Standup - January 15, 2024"
  // Files in "Meet Recordings" folder are likely transcripts

  // Check for date-like patterns in filename
  const datePatterns = [
    /\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
    /\d{2}\.\d{2}\.\d{2}/, // HH.MM.SS (time in filename)
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}/i,
  ];

  return datePatterns.some((pattern) => pattern.test(fileName));
}

/**
 * Parse meeting info from a Google Meet transcript filename
 * @param fileName - The filename to parse
 * @param fallbackDate - Optional fallback date (ISO string) to use if no date found in filename.
 *                       If not provided, defaults to today's date.
 */
export function parseMeetingFromFilename(
  fileName: string,
  fallbackDate?: string
): { title: string; date: string } {
  // Remove extension
  const name = fileName.replace(/\.[^.]+$/, '');

  // Try to extract date pattern YYYY-MM-DD
  const isoDateMatch = name.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoDateMatch) {
    const date = isoDateMatch[1];
    // Title is everything before the date pattern
    const titlePart = name.substring(0, name.indexOf(isoDateMatch[1]));
    const title = titlePart.replace(/\s*[-–—]\s*$/, '').trim();
    return {
      title: title || 'Imported Meeting',
      date,
    };
  }

  // Try natural date format: "January 15, 2024"
  const naturalDateMatch = name.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i
  );
  if (naturalDateMatch) {
    const monthNames: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04',
      may: '05', june: '06', july: '07', august: '08',
      september: '09', october: '10', november: '11', december: '12',
    };
    const month = monthNames[naturalDateMatch[1].toLowerCase()];
    const day = naturalDateMatch[2].padStart(2, '0');
    const year = naturalDateMatch[3];
    const date = `${year}-${month}-${day}`;

    const titlePart = name.substring(0, name.indexOf(naturalDateMatch[0]));
    const title = titlePart.replace(/\s*[-–—]\s*$/, '').trim();
    return {
      title: title || 'Imported Meeting',
      date,
    };
  }

  // Fallback: use provided fallback date (e.g., file's modified time) or today's date
  const defaultDate = fallbackDate
    ? fallbackDate.split('T')[0]  // Extract date part from ISO string
    : new Date().toISOString().split('T')[0];

  return {
    title: name.trim() || 'Imported Meeting',
    date: defaultDate,
  };
}
