-- Fix batch_create_audit_logs function
-- Issues fixed:
-- 1. Column names: before_state/after_state -> before_data/after_data (matching audit_logs table)
-- 2. Removed invalid cast to non-existent audit_action_type enum (action_type is TEXT in the table)

CREATE OR REPLACE FUNCTION batch_create_audit_logs(
  p_audit_records JSONB
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO audit_logs (user_id, action_type, entity_type, entity_id, project_id, before_data, after_data)
  SELECT
    (record->>'user_id')::UUID,
    record->>'action_type',  -- TEXT, not enum
    (record->>'entity_type')::entity_type,
    (record->>'entity_id')::UUID,
    (record->>'project_id')::UUID,
    record->'before_data',   -- Changed from before_state
    record->'after_data'     -- Changed from after_state
  FROM jsonb_array_elements(p_audit_records) AS record;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment documenting the fix
COMMENT ON FUNCTION batch_create_audit_logs(JSONB) IS 'Batch insert audit log records. Fixed in migration 00027 to use correct column names (before_data/after_data) and remove invalid enum cast.';
