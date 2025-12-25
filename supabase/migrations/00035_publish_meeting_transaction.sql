-- Migration: Transactional publish meeting changes
-- Ensures all meeting publish operations happen atomically

-- Type for action item operations
CREATE TYPE action_item_operation AS (
  operation text,
  external_id uuid,
  project_id uuid,
  title text,
  description text,
  status text,
  owner_user_id uuid,
  owner_name text,
  owner_email text,
  due_date date,
  embedding vector(1536),
  source_meeting_id uuid,
  updates_json text
);

-- Type for decision operations
CREATE TYPE decision_operation AS (
  operation text,
  project_id uuid,
  title text,
  rationale text,
  impact text,
  category text,
  impact_areas text[],
  status text,
  decision_maker_user_id uuid,
  decision_maker_name text,
  decision_maker_email text,
  outcome text,
  decision_date date,
  embedding vector(1536),
  source_meeting_id uuid
);

-- Type for risk operations
CREATE TYPE risk_operation AS (
  operation text,
  external_id uuid,
  project_id uuid,
  title text,
  description text,
  probability text,
  impact text,
  mitigation text,
  status text,
  owner_user_id uuid,
  owner_name text,
  owner_email text,
  embedding vector(1536),
  source_meeting_id uuid,
  updates_json text
);

-- Type for evidence records (used by both publish and existing batch insert)
-- Note: Using existing batch_insert_evidence function for evidence

-- Main transactional publish function
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
  v_existing record;
  v_result jsonb := '{"action_items_created": 0, "action_items_updated": 0, "action_items_closed": 0, "decisions_created": 0, "risks_created": 0, "risks_closed": 0}'::jsonb;
  v_action_items_created int := 0;
  v_action_items_updated int := 0;
  v_action_items_closed int := 0;
  v_decisions_created int := 0;
  v_risks_created int := 0;
  v_risks_closed int := 0;
  v_evidence_record jsonb;
  v_audit_record jsonb;
BEGIN
  -- Process action items
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

      -- Update evidence records with new ID
      p_evidence_records := (
        SELECT jsonb_agg(
          CASE
            WHEN e->>'temp_id' = v_item->>'temp_id' AND e->>'entity_type' = 'action_item'
            THEN jsonb_set(e, '{entity_id}', to_jsonb(v_new_id::text))
            ELSE e
          END
        )
        FROM jsonb_array_elements(p_evidence_records) e
      );

      -- Update audit records with new ID
      p_audit_records := (
        SELECT jsonb_agg(
          CASE
            WHEN a->>'temp_id' = v_item->>'temp_id' AND a->>'entity_type' = 'action_item'
            THEN jsonb_set(a, '{entity_id}', to_jsonb(v_new_id::text))
            ELSE a
          END
        )
        FROM jsonb_array_elements(p_audit_records) a
      );

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
        updates = v_item->>'updates_json'
      WHERE id = (v_item->>'external_id')::uuid;

      v_action_items_updated := v_action_items_updated + 1;

    ELSIF v_item->>'operation' = 'close' AND v_item->>'external_id' IS NOT NULL THEN
      UPDATE action_items
      SET
        status = 'Closed',
        updates = v_item->>'updates_json'
      WHERE id = (v_item->>'external_id')::uuid;

      v_action_items_closed := v_action_items_closed + 1;
    END IF;
  END LOOP;

  -- Process decisions
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

      -- Update evidence records with new ID
      p_evidence_records := (
        SELECT jsonb_agg(
          CASE
            WHEN e->>'temp_id' = v_item->>'temp_id' AND e->>'entity_type' = 'decision'
            THEN jsonb_set(e, '{entity_id}', to_jsonb(v_new_id::text))
            ELSE e
          END
        )
        FROM jsonb_array_elements(p_evidence_records) e
      );

      -- Update audit records with new ID
      p_audit_records := (
        SELECT jsonb_agg(
          CASE
            WHEN a->>'temp_id' = v_item->>'temp_id' AND a->>'entity_type' = 'decision'
            THEN jsonb_set(a, '{entity_id}', to_jsonb(v_new_id::text))
            ELSE a
          END
        )
        FROM jsonb_array_elements(p_audit_records) a
      );

      v_decisions_created := v_decisions_created + 1;
    END IF;
  END LOOP;

  -- Process risks
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

      -- Update evidence records with new ID
      p_evidence_records := (
        SELECT jsonb_agg(
          CASE
            WHEN e->>'temp_id' = v_item->>'temp_id' AND e->>'entity_type' = 'risk'
            THEN jsonb_set(e, '{entity_id}', to_jsonb(v_new_id::text))
            ELSE e
          END
        )
        FROM jsonb_array_elements(p_evidence_records) e
      );

      -- Update audit records with new ID
      p_audit_records := (
        SELECT jsonb_agg(
          CASE
            WHEN a->>'temp_id' = v_item->>'temp_id' AND a->>'entity_type' = 'risk'
            THEN jsonb_set(a, '{entity_id}', to_jsonb(v_new_id::text))
            ELSE a
          END
        )
        FROM jsonb_array_elements(p_audit_records) a
      );

      v_risks_created := v_risks_created + 1;

    ELSIF v_item->>'operation' = 'close' AND v_item->>'external_id' IS NOT NULL THEN
      UPDATE risks
      SET
        status = 'Closed',
        updates = v_item->>'updates_json'
      WHERE id = (v_item->>'external_id')::uuid;

      v_risks_closed := v_risks_closed + 1;
    END IF;
  END LOOP;

  -- Insert evidence records (filter out any with null entity_id)
  INSERT INTO evidence (entity_type, entity_id, meeting_id, quote, speaker, timestamp)
  SELECT
    (e->>'entity_type')::text,
    (e->>'entity_id')::uuid,
    (e->>'meeting_id')::uuid,
    e->>'quote',
    e->>'speaker',
    e->>'timestamp'
  FROM jsonb_array_elements(p_evidence_records) e
  WHERE e->>'entity_id' IS NOT NULL AND e->>'entity_id' != '';

  -- Insert audit records
  FOR v_audit_record IN SELECT * FROM jsonb_array_elements(p_audit_records)
  LOOP
    IF v_audit_record->>'entity_id' IS NOT NULL AND v_audit_record->>'entity_id' != '' THEN
      PERFORM create_audit_log(
        (v_audit_record->>'user_id')::uuid,
        v_audit_record->>'action_type',
        v_audit_record->>'entity_type',
        (v_audit_record->>'entity_id')::uuid,
        (v_audit_record->>'project_id')::uuid,
        v_audit_record->'before_data',
        v_audit_record->'after_data'
      );
    END IF;
  END LOOP;

  -- Update meeting status to Published
  UPDATE meetings
  SET status = 'Published'
  WHERE id = p_meeting_id;

  -- Return summary
  v_result := jsonb_build_object(
    'action_items_created', v_action_items_created,
    'action_items_updated', v_action_items_updated,
    'action_items_closed', v_action_items_closed,
    'decisions_created', v_decisions_created,
    'risks_created', v_risks_created,
    'risks_closed', v_risks_closed
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION publish_meeting_transaction TO authenticated;

COMMENT ON FUNCTION publish_meeting_transaction IS
'Atomically publishes meeting changes including action items, decisions, risks, evidence, and audit logs. All operations happen within a single transaction - if any fails, all are rolled back.';
