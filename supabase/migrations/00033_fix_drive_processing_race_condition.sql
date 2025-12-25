-- Migration: Fix race condition in Drive file processing
-- This adds an atomic claim function to prevent duplicate processing

-- Function to atomically claim a file for processing
-- Returns true if this request should process the file, false if another request already claimed it
CREATE OR REPLACE FUNCTION claim_drive_file_for_processing(
  p_user_id uuid,
  p_folder_id uuid,
  p_drive_file_id text,
  p_file_name text,
  p_file_mime_type text,
  p_file_modified_time timestamptz
)
RETURNS TABLE (
  claimed boolean,
  existing_status text,
  existing_meeting_id uuid,
  skip_reason text,
  processed_file_id uuid
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_record record;
  v_new_id uuid;
BEGIN
  -- First, try to get existing record with lock
  SELECT id, status, meeting_id, skip_reason
  INTO v_existing_record
  FROM drive_processed_files
  WHERE user_id = p_user_id AND drive_file_id = p_drive_file_id
  FOR UPDATE SKIP LOCKED;

  -- If record exists and is locked by another transaction, return not claimed
  IF v_existing_record IS NULL THEN
    -- Check if record exists but is locked
    PERFORM 1 FROM drive_processed_files
    WHERE user_id = p_user_id AND drive_file_id = p_drive_file_id;

    IF FOUND THEN
      -- Record exists but is locked by another transaction
      RETURN QUERY SELECT false, 'locked'::text, NULL::uuid, 'Being processed by another request'::text, NULL::uuid;
      RETURN;
    END IF;

    -- No existing record, create new one with processing status
    v_new_id := gen_random_uuid();

    INSERT INTO drive_processed_files (
      id, user_id, folder_id, drive_file_id, file_name,
      file_mime_type, file_modified_time, status
    )
    VALUES (
      v_new_id, p_user_id, p_folder_id, p_drive_file_id, p_file_name,
      p_file_mime_type, p_file_modified_time, 'processing'
    )
    ON CONFLICT (user_id, drive_file_id) DO NOTHING;

    -- Check if we successfully inserted
    IF NOT FOUND THEN
      -- Another transaction just inserted it
      RETURN QUERY SELECT false, 'processing'::text, NULL::uuid, 'Just claimed by another request'::text, NULL::uuid;
      RETURN;
    END IF;

    -- We claimed it successfully
    RETURN QUERY SELECT true, 'new'::text, NULL::uuid, NULL::text, v_new_id;
    RETURN;
  END IF;

  -- Record exists and we have the lock
  IF v_existing_record.status = 'completed' THEN
    RETURN QUERY SELECT false, 'completed'::text, v_existing_record.meeting_id, NULL::text, v_existing_record.id;
    RETURN;
  END IF;

  IF v_existing_record.status = 'skipped' THEN
    RETURN QUERY SELECT false, 'skipped'::text, v_existing_record.meeting_id, v_existing_record.skip_reason, v_existing_record.id;
    RETURN;
  END IF;

  IF v_existing_record.status = 'processing' THEN
    -- Another request is currently processing, don't interfere
    RETURN QUERY SELECT false, 'processing'::text, NULL::uuid, 'Already being processed'::text, v_existing_record.id;
    RETURN;
  END IF;

  -- Status is 'failed' or other - we can retry
  UPDATE drive_processed_files
  SET status = 'processing', error_message = NULL
  WHERE id = v_existing_record.id;

  RETURN QUERY SELECT true, v_existing_record.status, NULL::uuid, NULL::text, v_existing_record.id;
END;
$$;

-- Add index to speed up the claim operation
CREATE INDEX IF NOT EXISTS idx_drive_processed_files_claim
ON drive_processed_files(user_id, drive_file_id, status);

COMMENT ON FUNCTION claim_drive_file_for_processing IS
'Atomically claims a Drive file for processing, preventing race conditions.
Returns claimed=true if this request should process the file.';
