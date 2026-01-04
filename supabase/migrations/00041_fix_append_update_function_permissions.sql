-- Migration 00041: Fix append update functions for JSONB columns
--
-- Issue: The append_action_item_update and append_risk_update functions
-- from migration 00034 were incorrectly casting results to TEXT before
-- storing in the updates column, which is actually JSONB type.
-- This caused silent failures when users tried to add status updates.
--
-- Fix: Remove the ::text cast and store JSONB directly.

-- Fix append_action_item_update to work with JSONB column
CREATE OR REPLACE FUNCTION append_action_item_update(
  p_action_item_id uuid,
  p_update_id uuid,
  p_content text,
  p_created_by_user_id uuid,
  p_created_by_name text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_updates jsonb;
  v_new_update jsonb;
  v_result jsonb;
BEGIN
  -- Lock the row to prevent concurrent modifications
  SELECT COALESCE(updates, '[]'::jsonb)
  INTO v_current_updates
  FROM action_items
  WHERE id = p_action_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action item not found: %', p_action_item_id;
  END IF;

  -- Build the new update object
  v_new_update := jsonb_build_object(
    'id', p_update_id::text,
    'content', p_content,
    'created_at', now()::text,
    'created_by_user_id', p_created_by_user_id::text,
    'created_by_name', p_created_by_name
  );

  -- Append to the array
  v_result := v_current_updates || jsonb_build_array(v_new_update);

  -- Update the record (JSONB column, not TEXT)
  UPDATE action_items
  SET updates = v_result
  WHERE id = p_action_item_id;

  RETURN v_result;
END;
$$;

-- Fix append_risk_update to work with JSONB column
CREATE OR REPLACE FUNCTION append_risk_update(
  p_risk_id uuid,
  p_update_id uuid,
  p_content text,
  p_created_by_user_id uuid,
  p_created_by_name text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_updates jsonb;
  v_new_update jsonb;
  v_result jsonb;
BEGIN
  SELECT COALESCE(updates, '[]'::jsonb)
  INTO v_current_updates
  FROM risks
  WHERE id = p_risk_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Risk not found: %', p_risk_id;
  END IF;

  v_new_update := jsonb_build_object(
    'id', p_update_id::text,
    'content', p_content,
    'created_at', now()::text,
    'created_by_user_id', p_created_by_user_id::text,
    'created_by_name', p_created_by_name
  );

  v_result := v_current_updates || jsonb_build_array(v_new_update);

  UPDATE risks
  SET updates = v_result
  WHERE id = p_risk_id;

  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION append_action_item_update(uuid, uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION append_action_item_update(uuid, uuid, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION append_risk_update(uuid, uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION append_risk_update(uuid, uuid, text, uuid, text) TO service_role;

COMMENT ON FUNCTION append_action_item_update IS
'Atomically appends a status update to an action item, preventing race conditions.
Fixed in migration 00041 to properly handle JSONB column type.';

COMMENT ON FUNCTION append_risk_update IS
'Atomically appends a status update to a risk, preventing race conditions.
Fixed in migration 00041 to properly handle JSONB column type.';
