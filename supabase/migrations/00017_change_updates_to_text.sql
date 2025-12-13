-- Drop the GIN index before changing column type
DROP INDEX IF EXISTS idx_action_items_updates;

-- Change updates field from JSONB to TEXT to store JSON string
ALTER TABLE action_items ALTER COLUMN updates TYPE TEXT;

-- Update the comment
COMMENT ON COLUMN action_items.updates IS 'JSON string of status updates array';