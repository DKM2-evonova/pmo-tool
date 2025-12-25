-- Migration: Fix race condition in action item status updates
-- This adds an atomic append function for action item updates

-- Function to atomically append a status update to an action item
-- Returns the updated list of updates
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
  SELECT
    CASE
      WHEN updates IS NULL THEN '[]'::jsonb
      WHEN updates = '' THEN '[]'::jsonb
      ELSE updates::jsonb
    END INTO v_current_updates
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

  -- Update the record
  UPDATE action_items
  SET updates = v_result::text
  WHERE id = p_action_item_id;

  RETURN v_result;
END;
$$;

-- Similar function for risk updates
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
  -- Lock the row to prevent concurrent modifications
  SELECT
    CASE
      WHEN updates IS NULL THEN '[]'::jsonb
      WHEN updates = '' THEN '[]'::jsonb
      ELSE updates::jsonb
    END INTO v_current_updates
  FROM risks
  WHERE id = p_risk_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Risk not found: %', p_risk_id;
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

  -- Update the record
  UPDATE risks
  SET updates = v_result::text
  WHERE id = p_risk_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION append_action_item_update IS
'Atomically appends a status update to an action item, preventing race conditions.';

COMMENT ON FUNCTION append_risk_update IS
'Atomically appends a status update to a risk, preventing race conditions.';
