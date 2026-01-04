-- Fix type mismatch in publish_meeting_transaction function
-- The updates columns are TEXT type (not JSONB) per migrations 00021 and 00030
-- Remove the ::jsonb cast since columns expect TEXT

CREATE OR REPLACE FUNCTION publish_meeting_transaction(
  p_meeting_id uuid,
  p_action_items jsonb,
  p_decisions jsonb,
  p_risks jsonb,
  p_evidence_records jsonb,
  p_audit_records jsonb,
  p_meeting_updates jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item jsonb;
  v_action_items_created int := 0;
  v_action_items_updated int := 0;
  v_action_items_closed int := 0;
  v_decisions_created int := 0;
  v_risks_created int := 0;
  v_risks_closed int := 0;
  v_evidence_created int := 0;
  v_audit_logs_created int := 0;
  v_new_id uuid;
  v_temp_to_real_id_map jsonb := '{}'::jsonb;
  v_row_count int;
BEGIN
  -- Process action items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_action_items)
  LOOP
    IF v_item->>'operation' = 'create' THEN
      INSERT INTO action_items (
        project_id, title, description, status, owner_user_id, owner_name,
        owner_email, due_date, embedding, source_meeting_id
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
        p_meeting_id
      )
      RETURNING id INTO v_new_id;

      v_temp_to_real_id_map := v_temp_to_real_id_map || jsonb_build_object(v_item->>'temp_id', v_new_id);
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
        v_item->>'source',
        CASE WHEN v_item->'embedding' IS NOT NULL AND v_item->'embedding' != 'null'::jsonb
          THEN (SELECT array_agg(e::float)::vector(1536) FROM jsonb_array_elements_text(v_item->'embedding') e)
          ELSE NULL
        END,
        p_meeting_id
      )
      RETURNING id INTO v_new_id;

      v_temp_to_real_id_map := v_temp_to_real_id_map || jsonb_build_object(v_item->>'temp_id', v_new_id);
      v_decisions_created := v_decisions_created + 1;
    END IF;
  END LOOP;

  -- Process risks
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_risks)
  LOOP
    IF v_item->>'operation' = 'create' THEN
      INSERT INTO risks (
        project_id, title, description, category, probability, impact,
        status, mitigation, owner_user_id, owner_name, owner_email,
        embedding, source_meeting_id
      )
      VALUES (
        (v_item->>'project_id')::uuid,
        v_item->>'title',
        v_item->>'description',
        v_item->>'category',
        v_item->>'probability',
        v_item->>'impact',
        v_item->>'status',
        v_item->>'mitigation',
        NULLIF(v_item->>'owner_user_id', '')::uuid,
        v_item->>'owner_name',
        v_item->>'owner_email',
        CASE WHEN v_item->'embedding' IS NOT NULL AND v_item->'embedding' != 'null'::jsonb
          THEN (SELECT array_agg(e::float)::vector(1536) FROM jsonb_array_elements_text(v_item->'embedding') e)
          ELSE NULL
        END,
        p_meeting_id
      )
      RETURNING id INTO v_new_id;

      v_temp_to_real_id_map := v_temp_to_real_id_map || jsonb_build_object(v_item->>'temp_id', v_new_id);

      -- Insert audit log for risk creation
      INSERT INTO audit_logs (entity_type, entity_id, action, changes, meeting_id, user_id, user_name)
      SELECT
        'risk',
        v_new_id,
        'create',
        a->'changes',
        (a->>'meeting_id')::uuid,
        NULLIF(a->>'user_id', '')::uuid,
        a->>'user_name'
      FROM jsonb_array_elements(p_audit_records) a
      WHERE a->>'temp_id' = v_item->>'temp_id'
        AND a->>'entity_type' = 'risk'
        AND a->>'action' = 'create'
      LIMIT 1;

      -- Count based on whether we actually inserted (using a subquery to check)
      v_audit_logs_created := v_audit_logs_created + (
        SELECT COUNT(*)::int FROM (
          SELECT 1 FROM jsonb_array_elements(p_audit_records) a
          WHERE a->>'temp_id' = v_item->>'temp_id'
            AND a->>'entity_type' = 'risk'
            AND a->>'action' = 'create'
          LIMIT 1
        ) sub
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
  WHERE e->>'entity_id' IS NOT NULL
    AND e->>'entity_id' != ''
    AND (e->>'entity_id')::uuid IS NOT NULL;

  GET DIAGNOSTICS v_evidence_created = ROW_COUNT;

  -- Insert audit logs (for action items and decisions only - risks handled above)
  -- Map temp_ids to real ids for audit log entity_id
  INSERT INTO audit_logs (entity_type, entity_id, action, changes, meeting_id, user_id, user_name)
  SELECT
    a->>'entity_type',
    CASE
      WHEN a->>'entity_id' IS NOT NULL AND a->>'entity_id' != '' THEN (a->>'entity_id')::uuid
      WHEN v_temp_to_real_id_map ? (a->>'temp_id') THEN (v_temp_to_real_id_map->>(a->>'temp_id'))::uuid
      ELSE NULL
    END,
    a->>'action',
    a->'changes',
    (a->>'meeting_id')::uuid,
    NULLIF(a->>'user_id', '')::uuid,
    a->>'user_name'
  FROM jsonb_array_elements(p_audit_records) a
  WHERE a->>'entity_type' != 'risk'  -- Skip risk audits, handled above
    AND (
      (a->>'entity_id' IS NOT NULL AND a->>'entity_id' != '')
      OR v_temp_to_real_id_map ? (a->>'temp_id')
    );

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_audit_logs_created := v_audit_logs_created + v_row_count;

  -- Update meeting with any additional fields from p_meeting_updates
  IF p_meeting_updates IS NOT NULL AND p_meeting_updates != '{}'::jsonb THEN
    UPDATE meetings
    SET
      status = COALESCE(p_meeting_updates->>'status', status),
      recap_summary = COALESCE(p_meeting_updates->>'recap_summary', recap_summary),
      recap_key_points = CASE
        WHEN p_meeting_updates->'recap_key_points' IS NOT NULL
        THEN (SELECT array_agg(e::text) FROM jsonb_array_elements_text(p_meeting_updates->'recap_key_points') e)
        ELSE recap_key_points
      END,
      recap_next_steps = CASE
        WHEN p_meeting_updates->'recap_next_steps' IS NOT NULL
        THEN (SELECT array_agg(e::text) FROM jsonb_array_elements_text(p_meeting_updates->'recap_next_steps') e)
        ELSE recap_next_steps
      END
    WHERE id = p_meeting_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'action_items_created', v_action_items_created,
    'action_items_updated', v_action_items_updated,
    'action_items_closed', v_action_items_closed,
    'decisions_created', v_decisions_created,
    'risks_created', v_risks_created,
    'risks_closed', v_risks_closed,
    'evidence_created', v_evidence_created,
    'audit_logs_created', v_audit_logs_created,
    'temp_to_real_id_map', v_temp_to_real_id_map
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Transaction failed: %', SQLERRM;
END;
$$;
