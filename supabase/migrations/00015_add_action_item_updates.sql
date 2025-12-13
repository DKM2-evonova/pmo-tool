-- Add updates field to action_items table for status updates and comments
ALTER TABLE action_items ADD COLUMN updates JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the field
COMMENT ON COLUMN action_items.updates IS 'Array of status updates with timestamps and comments';

-- Index for potential queries on updates
CREATE INDEX idx_action_items_updates ON action_items USING gin(updates);