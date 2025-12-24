/**
 * Google Drive Integration Types
 */

// Re-export shared OAuth types
export type { OAuthToken, GoogleTokenResponse } from './types';

// ============================================================================
// Google Drive API Types
// ============================================================================

/**
 * Google Drive file metadata from API
 */
export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  createdTime: string;
  parents?: string[];
  size?: string;
  webViewLink?: string;
  iconLink?: string;
  trashed?: boolean;
}

/**
 * Google Drive file list response
 */
export interface GoogleDriveFileList {
  kind: string;
  files: GoogleDriveFile[];
  nextPageToken?: string;
  incompleteSearch?: boolean;
}

/**
 * Google Drive watch channel response
 */
export interface GoogleDriveWatchResponse {
  kind: string;
  id: string; // Channel ID we sent
  resourceId: string; // Resource ID from Google
  resourceUri: string; // The watched resource URI
  expiration: string; // Unix timestamp in milliseconds as string
}

/**
 * Google Drive change item
 */
export interface GoogleDriveChange {
  kind: string;
  type: 'file' | 'drive';
  changeType?: 'file' | 'drive';
  time: string;
  removed: boolean;
  fileId?: string;
  file?: GoogleDriveFile;
  driveId?: string;
}

/**
 * Google Drive changes list response
 */
export interface GoogleDriveChangesResponse {
  kind: string;
  nextPageToken?: string;
  newStartPageToken?: string;
  changes: GoogleDriveChange[];
}

/**
 * Google Drive start page token response
 */
export interface GoogleDriveStartPageTokenResponse {
  kind: string;
  startPageToken: string;
}

// ============================================================================
// Application Types (Simplified/Transformed)
// ============================================================================

/**
 * Simplified Drive file for our application
 */
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  createdTime: string;
  size?: number;
  webViewLink?: string;
  isFolder: boolean;
}

/**
 * Drive file list with pagination
 */
export interface DriveFileList {
  files: DriveFile[];
  nextPageToken?: string;
}

/**
 * Drive connection status
 */
export interface DriveConnectionStatus {
  configured: boolean;
  connected: boolean;
  provider: 'google_drive' | null;
  email?: string;
  connectedAt?: string;
  expiresAt?: string;
  watchedFolders: WatchedFolderInfo[];
  pendingImportsCount: number;
}

/**
 * Watched folder information for UI
 */
export interface WatchedFolderInfo {
  id: string;
  folderId: string;
  folderName: string;
  defaultProjectId: string | null;
  defaultProjectName?: string;
  isActive: boolean;
  lastSyncAt: string | null;
  webhookActive: boolean;
  webhookExpiration: string | null;
}

/**
 * Pending import information for UI
 */
export interface PendingImport {
  id: string;
  fileName: string;
  fileModifiedTime: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  errorMessage?: string;
  skipReason?: string;
  meetingId?: string;
  createdAt: string;
}

// ============================================================================
// Database Row Types
// ============================================================================

/**
 * drive_watched_folders table row
 */
export interface DriveWatchedFolderRow {
  id: string;
  user_id: string;
  folder_id: string;
  folder_name: string;
  default_project_id: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_page_token: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * drive_processed_files table row
 */
export interface DriveProcessedFileRow {
  id: string;
  user_id: string;
  folder_id: string;
  drive_file_id: string;
  file_name: string;
  file_mime_type: string | null;
  file_modified_time: string | null;
  meeting_id: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  error_message: string | null;
  skip_reason: string | null;
  processed_at: string | null;
  created_at: string;
}

/**
 * drive_webhook_channels table row
 */
export interface DriveWebhookChannelRow {
  id: string;
  user_id: string;
  folder_id: string;
  channel_id: string;
  resource_id: string | null;
  resource_uri: string | null;
  expiration: string;
  is_active: boolean;
  created_at: string;
  renewed_at: string | null;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Add folder request body
 */
export interface AddWatchedFolderRequest {
  folderId: string;
  folderName: string;
  defaultProjectId?: string;
}

/**
 * Update folder request body
 */
export interface UpdateWatchedFolderRequest {
  defaultProjectId?: string | null;
  isActive?: boolean;
}

/**
 * Sync result response
 */
export interface SyncResult {
  processed: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * File processing result
 */
export interface FileProcessingResult {
  success: boolean;
  meetingId?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Duplicate check result
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingMeetingId?: string;
  matchType?: 'fingerprint' | 'title_date' | 'semantic';
}

// ============================================================================
// Webhook Types
// ============================================================================

/**
 * Google Drive webhook headers
 */
export interface DriveWebhookHeaders {
  'x-goog-channel-id': string;
  'x-goog-resource-id': string;
  'x-goog-resource-state': 'sync' | 'change' | 'add' | 'remove' | 'update' | 'trash' | 'untrash';
  'x-goog-resource-uri'?: string;
  'x-goog-message-number'?: string;
  'x-goog-channel-expiration'?: string;
  'x-goog-channel-token'?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Supported transcript MIME types from Google Meet
 */
export const TRANSCRIPT_MIME_TYPES = [
  'application/vnd.google-apps.document', // Google Docs transcript
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/pdf',
  'text/plain',
  'application/rtf',
] as const;

/**
 * Google Drive MIME type for folders
 */
export const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

/**
 * Maximum webhook channel lifetime (24 hours in milliseconds)
 */
export const MAX_CHANNEL_LIFETIME_MS = 24 * 60 * 60 * 1000;

/**
 * Channel renewal buffer (1 hour before expiration)
 */
export const CHANNEL_RENEWAL_BUFFER_MS = 60 * 60 * 1000;
