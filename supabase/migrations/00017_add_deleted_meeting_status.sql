-- Add 'Deleted' status to meeting_status enum
-- This allows us to mark meetings as deleted without actually removing the record
-- Note: This will fail if 'Deleted' already exists, which is expected behavior

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'Deleted' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'meeting_status')
    ) THEN
        ALTER TYPE meeting_status ADD VALUE 'Deleted';
    END IF;
END $$;
























