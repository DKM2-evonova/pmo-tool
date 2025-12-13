-- Add updates field to risks table for status updates and comments
ALTER TABLE risks ADD COLUMN updates JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the field
COMMENT ON COLUMN risks.updates IS 'Array of status updates with timestamps and comments';

-- Index for potential queries on updates
CREATE INDEX idx_risks_updates ON risks USING gin(updates);