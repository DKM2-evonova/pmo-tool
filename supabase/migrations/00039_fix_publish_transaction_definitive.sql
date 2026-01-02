-- Migration: Definitive fix for publish_meeting_transaction function
--
-- ROOT CAUSE ANALYSIS (from code review):
-- 1. audit_logs table has columns: user_id, action_type, entity_type, entity_id, project_id, before_data, after_data
--    BUT migrations 00037/00038 tried to use non-existent columns: action, changes, meeting_id, user_name
-- 2. The updates columns in action_items and risks are JSONB (migrations 00021/00030 were not applied)
--    So we need to cast to JSONB when writing: updates = (v_item->>'updates_json')::jsonb
-- 3. Use the existing create_audit_log() function instead of direct INSERT (it has correct signature)
--
-- This migration:
-- - Drops ALL existing function signatures to avoid conflicts
-- - Uses correct JSONB cast for updates column
-- - Uses create_audit_log() function for audit records
-- - Uses p_evidence_records parameter name (matching API route)

-- Drop all existing versions of the function (different parameter signatures)
DROP FUNCTION IF EXISTS publish_meeting_transaction(uuid, jsonb, jsonb, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS publish_meeting_transaction(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);

-- Create the corrected function
CREATE OR REPLACE FUNCTION publish_meeting_transaction(
  p_meeting_id uuid,
  p_action_items jsonb,
  p_decisions jsonb,
  p_risks jsonb,
  p_evidence_records jsonb,
  p_audit_records jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item jsonb;
  v_new_id uuid;
  v_result jsonb;
  v_action_items_created int := 0;
  v_action_items_updated int := 0;
  v_action_items_closed int := 0;
  v_decisions_created int := 0;
  v_risks_created int := 0;
  v_risks_closed int := 0;
  v_temp_to_real_id jsonb := '{}'::jsonb;
  v_audit_record jsonb;
  v_entity_id uuid;
BEGIN
  -- ============================================
  -- PROCESS ACTION ITEMS
  -- ============================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_action_items)
  LOOP
    IF v_item->>'operation' = 'create' THEN
      INSERT INTO action_items (
        project_id, title, description, status,
        owner_user_id, owner_name, owner_email,
        due_date, embedding, source_meeting_id
      )
      VALUES (
        (v_item->>'project_id')::uuid,
        v_item->>'title',
        v_item->>'description',
        v_item->>'status',
        NULLIF(v_item->>'owner_user_id', '')::uuid,
        v_item->>'owner_name',
        v_item->>'owner_email',
        NULLIF(v_item->>'due_date', '')::date,
        CASE WHEN v_item->'embedding' IS NOT NULL AND v_item->'embedding' != 'null'::jsonb
          THEN (SELECT array_agg(e::float)::vector(1536) FROM jsonb_array_elements_text(v_item->'embedding') e)
          ELSE NULL
        END,
        (v_item->>'source_meeting_id')::uuid
      )
      RETURNING id INTO v_new_id;

      -- Map temp_id to real id for evidence/audit records
      v_temp_to_real_id := v_temp_to_real_id || jsonb_build_object(v_item->>'temp_id', v_new_id::text);
      v_action_items_created := v_action_items_created + 1;

    ELSIF v_item->>'operation' = 'update' AND v_item->>'external_id' IS NOT NULL THEN
      UPDATE action_items
      SET
        title = v_item->>'title',
        description = v_item->>'description',
        status = v_item->>'status',
        owner_user_id = NULLIF(v_item->>'owner_user_id', '')::uuid,
        owner_name = v_item->>'owner_name',
        owner_email = v_item->>'owner_email',
        due_date = NULLIF(v_item->>'due_date', '')::date,
        embedding = CASE WHEN v_item->'embedding' IS NOT NULL AND v_item->'embedding' != 'null'::jsonb
          THEN (SELECT array_agg(e::float)::vector(1536) FROM jsonb_array_elements_text(v_item->'embedding') e)
          ELSE embedding
        END,
        -- CRITICAL: Cast to JSONB because column is JSONB type
        updates = CASE
          WHEN v_item->>'updates_json' IS NOT NULL AND v_item->>'updates_json' != ''
          THEN (v_item->>'updates_json')::jsonb
          ELSE updates
        END
      WHERE id = (v_item->>'external_id')::uuid;

      v_action_items_updated := v_action_items_updated + 1;

    ELSIF v_item->>'operation' = 'close' AND v_item->>'external_id' IS NOT NULL THEN
      UPDATE action_items
      SET
        status = 'Closed',
        -- CRITICAL: Cast to JSONB because column is JSONB type
        updates = CASE
          WHEN v_item->>'updates_json' IS NOT NULL AND v_item->>'updates_json' != ''
          THEN (v_item->>'updates_json')::jsonb
          ELSE updates
        END
      WHERE id = (v_item->>'external_id')::uuid;

      v_action_items_closed := v_action_items_closed + 1;
    END IF;
  END LOOP;

  -- ============================================
  -- PROCESS DECISIONS
  -- ============================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_decisions)
  LOOP
    IF v_item->>'operation' = 'create' THEN
      INSERT INTO decisions (
        project_id, title, rationale, impact, category, impact_areas,
        status, decision_maker_user_id, decision_maker_name, decision_maker_email,
        outcome, decision_date, source, embedding, source_meeting_id
      )
      VALUES (
        (v_item->>'project_id')::uuid,
        v_item->>'title',
        v_item->>'rationale',
        v_item->>'impact',
        v_item->>'category',
        CASE WHEN v_item->'impact_areas' IS NOT NULL AND v_item->'impact_areas' != 'null'::jsonb
          THEN (SELECT array_agg(e::text) FROM jsonb_array_elements_text(v_item->'impact_areas') e)
          ELSE NULL
        END,
        v_item->>'status',
        NULLIF(v_item->>'decision_maker_user_id', '')::uuid,
        v_item->>'decision_maker_name',
        v_item->>'decision_maker_email',
        v_item->>'outcome',
        NULLIF(v_item->>'decision_date', '')::date,
        'meeting',
        CASE WHEN v_item->'embedding' IS NOT NULL AND v_item->'embedding' != 'null'::jsonb
          THEN (SELECT array_agg(e::float)::vector(1536) FROM jsonb_array_elements_text(v_item->'embedding') e)
          ELSE NULL
        END,
        (v_item->>'source_meeting_id')::uuid
      )
      RETURNING id INTO v_new_id;

      -- Map temp_id to real id
      v_temp_to_real_id := v_temp_to_real_id || jsonb_build_object(v_item->>'temp_id', v_new_id::text);
      v_decisions_created := v_decisions_created + 1;
    END IF;
  END LOOP;

  -- ============================================
  -- PROCESS RISKS
  -- ============================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_risks)
  LOOP
    IF v_item->>'operation' = 'create' THEN
      INSERT INTO risks (
        project_id, title, description, probability, impact,
        mitigation, status, owner_user_id, owner_name, owner_email,
        embedding, source_meeting_id
      )
      VALUES (
        (v_item->>'project_id')::uuid,
        v_item->>'title',
        v_item->>'description',
        v_item->>'probability',
        v_item->>'impact',
        v_item->>'mitigation',
        v_item->>'status',
        NULLIF(v_item->>'owner_user_id', '')::uuid,
        v_item->>'owner_name',
        v_item->>'owner_email',
        CASE WHEN v_item->'embedding' IS NOT NULL AND v_item->'embedding' != 'null'::jsonb
          THEN (SELECT array_agg(e::float)::vector(1536) FROM jsonb_array_elements_text(v_item->'embedding') e)
          ELSE NULL
        END,
        (v_item->>'source_meeting_id')::uuid
      )
      RETURNING id INTO v_new_id;

      -- Map temp_id to real id
      v_temp_to_real_id := v_temp_to_real_id || jsonb_build_object(v_item->>'temp_id', v_new_id::text);
      v_risks_created := v_risks_created + 1;

    ELSIF v_item->>'operation' = 'close' AND v_item->>'external_id' IS NOT NULL THEN
      UPDATE risks
      SET
        status = 'Closed',
        -- CRITICAL: Cast to JSONB because column is JSONB type
        updates = CASE
          WHEN v_item->>'updates_json' IS NOT NULL AND v_item->>'updates_json' != ''
          THEN (v_item->>'updates_json')::jsonb
          ELSE updates
        END
      WHERE id = (v_item->>'external_id')::uuid;

      v_risks_closed := v_risks_closed + 1;
    END IF;
  END LOOP;

  -- ============================================
  -- INSERT EVIDENCE RECORDS
  -- Resolve temp_ids to real ids before inserting
  -- ============================================
  INSERT INTO evidence (entity_type, entity_id, meeting_id, quote, speaker, timestamp)
  SELECT
    (e->>'entity_type')::entity_type,
    CASE
      -- If entity_id looks like a temp_id (matches one in our map), use the real id
      WHEN v_temp_to_real_id ? (e->>'entity_id')
      THEN (v_temp_to_real_id->>(e->>'entity_id'))::uuid
      -- Otherwise use the entity_id directly (for update/close operations)
      ELSE (e->>'entity_id')::uuid
    END,
    (e->>'meeting_id')::uuid,
    e->>'quote',
    e->>'speaker',
    e->>'timestamp'
  FROM jsonb_array_elements(p_evidence_records) e
  WHERE e->>'entity_id' IS NOT NULL
    AND e->>'entity_id' != ''
    AND (
      -- Either it's a mapped temp_id
      v_temp_to_real_id ? (e->>'entity_id')
      -- Or it's already a valid UUID (for update/close)
      OR (e->>'entity_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    );

  -- ============================================
  -- INSERT AUDIT RECORDS
  -- Use the existing create_audit_log function which has the correct signature
  -- ============================================
  FOR v_audit_record IN SELECT * FROM jsonb_array_elements(p_audit_records)
  LOOP
    -- Resolve entity_id: check if it's a temp_id that needs mapping
    IF v_temp_to_real_id ? (v_audit_record->>'entity_id') THEN
      v_entity_id := (v_temp_to_real_id->>(v_audit_record->>'entity_id'))::uuid;
    ELSIF v_audit_record->>'entity_id' IS NOT NULL
          AND v_audit_record->>'entity_id' != ''
          AND (v_audit_record->>'entity_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_entity_id := (v_audit_record->>'entity_id')::uuid;
    ELSE
      -- Skip records without valid entity_id
      CONTINUE;
    END IF;

    -- Use the existing create_audit_log function (from migration 00011)
    -- Function signature: create_audit_log(p_user_id, p_action_type, p_entity_type, p_entity_id, p_project_id, p_before, p_after)
    PERFORM create_audit_log(
      (v_audit_record->>'user_id')::uuid,
      v_audit_record->>'action_type',
      (v_audit_record->>'entity_type')::entity_type,
      v_entity_id,
      (v_audit_record->>'project_id')::uuid,
      v_audit_record->'before_data',
      v_audit_record->'after_data'
    );
  END LOOP;

  -- ============================================
  -- UPDATE MEETING STATUS
  -- ============================================
  UPDATE meetings
  SET status = 'Published'
  WHERE id = p_meeting_id;

  -- ============================================
  -- RETURN SUMMARY
  -- ============================================
  v_result := jsonb_build_object(
    'success', true,
    'action_items_created', v_action_items_created,
    'action_items_updated', v_action_items_updated,
    'action_items_closed', v_action_items_closed,
    'decisions_created', v_decisions_created,
    'risks_created', v_risks_created,
    'risks_closed', v_risks_closed
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Re-raise with context for debugging
  RAISE EXCEPTION 'publish_meeting_transaction failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION publish_meeting_transaction(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_meeting_transaction(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) TO service_role;

-- Add documentation
COMMENT ON FUNCTION publish_meeting_transaction IS
'Atomically publishes meeting changes including action items, decisions, risks, evidence, and audit logs.
All operations happen within a single transaction - if any fails, all are rolled back.

Fixed in migration 00039:
- Uses correct JSONB cast for updates column (column is JSONB, not TEXT)
- Uses create_audit_log() function instead of direct INSERT (correct column names)
- Correctly maps temp_ids to real ids for evidence and audit records
- Uses p_evidence_records parameter name (matching API route)';
