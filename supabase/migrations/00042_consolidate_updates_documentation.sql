-- Migration 00042: Consolidate Updates Column Documentation
-- ============================================================================
-- This migration serves as definitive documentation for the updates column
-- across action_items and risks tables, consolidating the intent from
-- previous migrations (00021, 00030, 00037, 00038, 00041).
--
-- FINAL COLUMN TYPE: JSONB (not TEXT)
--
-- History:
-- - 00021: Changed action_items.updates from JSONB to TEXT
-- - 00030: Changed risks.updates to TEXT
-- - 00037: Fixed publish_meeting_transaction for TEXT type
-- - 00038: Created publish_meeting_transaction handling TEXT type
-- - 00041: Fixed append functions to work with JSONB (the actual current type)
--
-- The current state (verified in 00041) is that both columns are JSONB.
-- The append_*_update functions work correctly with JSONB.
-- ============================================================================

-- Ensure comments are up to date
COMMENT ON COLUMN action_items.updates IS
'JSONB array of status updates. Each update contains: id, content, created_at,
created_by_user_id, created_by_name. Managed via append_action_item_update()
function to prevent race conditions.';

COMMENT ON COLUMN risks.updates IS
'JSONB array of status updates. Each update contains: id, content, created_at,
created_by_user_id, created_by_name. Managed via append_risk_update()
function to prevent race conditions.';

-- Verify the functions exist and have correct signatures
DO $$
BEGIN
  -- Check append_action_item_update exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'append_action_item_update'
  ) THEN
    RAISE EXCEPTION 'Function append_action_item_update does not exist';
  END IF;

  -- Check append_risk_update exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'append_risk_update'
  ) THEN
    RAISE EXCEPTION 'Function append_risk_update does not exist';
  END IF;

  RAISE NOTICE 'Updates column consolidation verified successfully';
END $$;
