-- Change risks.updates from JSONB to TEXT for consistency with action_items.updates
-- Both tables now store updates as JSON strings that are parsed in application code

-- Drop the GIN index before changing column type
DROP INDEX IF EXISTS idx_risks_updates;

-- Convert existing JSONB data to TEXT (JSON string)
-- JSONB values will be cast to text representation
ALTER TABLE risks ALTER COLUMN updates TYPE TEXT USING updates::text;

-- Update the comment to reflect the new type
COMMENT ON COLUMN risks.updates IS 'JSON string of status updates array (parsed in application code)';

-- Set default to empty array as JSON string
ALTER TABLE risks ALTER COLUMN updates SET DEFAULT '[]';
