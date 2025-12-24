-- Migration: Create tables for Google Drive auto-ingestion
-- Enables automatic import of meeting transcripts from Google Drive

-- ============================================================================
-- Table: drive_watched_folders
-- Stores the folders each user is watching for new transcripts
-- ============================================================================
CREATE TABLE IF NOT EXISTS drive_watched_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  folder_id TEXT NOT NULL, -- Google Drive folder ID
  folder_name TEXT NOT NULL, -- Display name (e.g., "Meet Recordings")
  default_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ, -- Last successful sync timestamp
  last_sync_page_token TEXT, -- For incremental sync (Changes API)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, folder_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_drive_watched_folders_user ON drive_watched_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_watched_folders_active ON drive_watched_folders(user_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE drive_watched_folders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own watched folders"
  ON drive_watched_folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watched folders"
  ON drive_watched_folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watched folders"
  ON drive_watched_folders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own watched folders"
  ON drive_watched_folders FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER drive_watched_folders_updated_at
  BEFORE UPDATE ON drive_watched_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- Table: drive_processed_files
-- Tracks files that have been processed to prevent duplicates
-- ============================================================================
CREATE TABLE IF NOT EXISTS drive_processed_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  folder_id UUID REFERENCES drive_watched_folders(id) ON DELETE CASCADE NOT NULL,
  drive_file_id TEXT NOT NULL, -- Google Drive file ID
  file_name TEXT NOT NULL,
  file_mime_type TEXT,
  file_modified_time TIMESTAMPTZ, -- From Drive metadata
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL, -- Resulting meeting
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, skipped
  error_message TEXT,
  skip_reason TEXT, -- Why file was skipped (e.g., "Duplicate of meeting {id}")
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, drive_file_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_drive_processed_files_user_folder ON drive_processed_files(user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_drive_processed_files_drive_id ON drive_processed_files(drive_file_id);
CREATE INDEX IF NOT EXISTS idx_drive_processed_files_status ON drive_processed_files(status);
CREATE INDEX IF NOT EXISTS idx_drive_processed_files_created ON drive_processed_files(created_at DESC);

-- Enable RLS
ALTER TABLE drive_processed_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own processed files"
  ON drive_processed_files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own processed files"
  ON drive_processed_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own processed files"
  ON drive_processed_files FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Table: drive_webhook_channels
-- Tracks active Google Drive watch channels for push notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS drive_webhook_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  folder_id UUID REFERENCES drive_watched_folders(id) ON DELETE CASCADE NOT NULL,
  channel_id TEXT NOT NULL, -- UUID sent to Google as channel ID
  resource_id TEXT, -- Returned by Google after watch setup
  resource_uri TEXT, -- The watched resource URI
  expiration TIMESTAMPTZ NOT NULL, -- When the channel expires (max 24 hours)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  renewed_at TIMESTAMPTZ,
  UNIQUE(channel_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_drive_webhook_channels_channel ON drive_webhook_channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_drive_webhook_channels_expiration ON drive_webhook_channels(expiration) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_drive_webhook_channels_folder ON drive_webhook_channels(folder_id);

-- Enable RLS
ALTER TABLE drive_webhook_channels ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own webhook channels"
  ON drive_webhook_channels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own webhook channels"
  ON drive_webhook_channels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own webhook channels"
  ON drive_webhook_channels FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own webhook channels"
  ON drive_webhook_channels FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Add new columns to meetings table for Drive source tracking
-- ============================================================================
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_file_name TEXT,
  ADD COLUMN IF NOT EXISTS drive_ingested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_auto_ingested BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS content_fingerprint TEXT;

-- Index for finding auto-ingested meetings
CREATE INDEX IF NOT EXISTS idx_meetings_auto_ingested
  ON meetings(is_auto_ingested, created_at DESC)
  WHERE is_auto_ingested = true;

-- Index for content fingerprint duplicate detection
CREATE INDEX IF NOT EXISTS idx_meetings_fingerprint
  ON meetings(project_id, content_fingerprint)
  WHERE content_fingerprint IS NOT NULL;

-- Index for Drive file ID lookups
CREATE INDEX IF NOT EXISTS idx_meetings_drive_file
  ON meetings(drive_file_id)
  WHERE drive_file_id IS NOT NULL;

-- ============================================================================
-- Function: Check for duplicate meetings (used in ingestion)
-- ============================================================================
CREATE OR REPLACE FUNCTION check_duplicate_meeting(
  p_project_id UUID,
  p_title TEXT,
  p_date DATE,
  p_content_fingerprint TEXT
)
RETURNS TABLE (
  is_duplicate BOOLEAN,
  existing_meeting_id UUID,
  match_type TEXT
) AS $$
DECLARE
  v_meeting_id UUID;
BEGIN
  -- Layer 1: Exact content fingerprint match (same content)
  IF p_content_fingerprint IS NOT NULL THEN
    SELECT id INTO v_meeting_id
    FROM meetings
    WHERE project_id = p_project_id
      AND content_fingerprint = p_content_fingerprint
      AND status != 'Deleted'
    LIMIT 1;

    IF v_meeting_id IS NOT NULL THEN
      RETURN QUERY SELECT true, v_meeting_id, 'fingerprint'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Layer 2: Title + Date match (within same day)
  SELECT id INTO v_meeting_id
  FROM meetings
  WHERE project_id = p_project_id
    AND date = p_date
    AND LOWER(TRIM(title)) = LOWER(TRIM(p_title))
    AND status != 'Deleted'
  LIMIT 1;

  IF v_meeting_id IS NOT NULL THEN
    RETURN QUERY SELECT true, v_meeting_id, 'title_date'::TEXT;
    RETURN;
  END IF;

  -- No duplicate found
  RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE drive_watched_folders IS 'Google Drive folders being watched for new meeting transcripts';
COMMENT ON COLUMN drive_watched_folders.folder_id IS 'Google Drive folder ID (from Drive API)';
COMMENT ON COLUMN drive_watched_folders.last_sync_page_token IS 'Page token for incremental sync using Drive Changes API';

COMMENT ON TABLE drive_processed_files IS 'Tracks files processed from Google Drive to prevent duplicates';
COMMENT ON COLUMN drive_processed_files.status IS 'Processing status: pending, processing, completed, failed, skipped';
COMMENT ON COLUMN drive_processed_files.skip_reason IS 'Reason for skipping (e.g., duplicate, unsupported format)';

COMMENT ON TABLE drive_webhook_channels IS 'Active Google Drive push notification channels';
COMMENT ON COLUMN drive_webhook_channels.channel_id IS 'Unique channel ID sent to Google (used for verification)';
COMMENT ON COLUMN drive_webhook_channels.resource_id IS 'Resource ID returned by Google after watch setup';
COMMENT ON COLUMN drive_webhook_channels.expiration IS 'Channel expiration time (max 24 hours from creation)';

COMMENT ON COLUMN meetings.is_auto_ingested IS 'Whether this meeting was automatically imported from Google Drive';
COMMENT ON COLUMN meetings.content_fingerprint IS 'SHA-256 hash of transcript start for duplicate detection';
COMMENT ON COLUMN meetings.drive_file_id IS 'Original Google Drive file ID if auto-ingested';
