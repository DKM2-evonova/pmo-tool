-- Batch Operations and Data Integrity Improvements
-- This migration adds functions for batch operations and improves data quality

-- ============================================================================
-- 1. BATCH EVIDENCE INSERTION FUNCTION
-- ============================================================================
-- Instead of N individual inserts, insert all evidence records in one call
-- This dramatically improves publish performance

CREATE OR REPLACE FUNCTION batch_insert_evidence(
  p_evidence_records JSONB
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO evidence (entity_type, entity_id, meeting_id, quote, speaker, timestamp)
  SELECT
    (record->>'entity_type')::entity_type,
    (record->>'entity_id')::UUID,
    (record->>'meeting_id')::UUID,
    record->>'quote',
    record->>'speaker',
    record->>'timestamp'
  FROM jsonb_array_elements(p_evidence_records) AS record;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. BATCH AUDIT LOG INSERTION FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION batch_create_audit_logs(
  p_audit_records JSONB
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO audit_logs (user_id, action_type, entity_type, entity_id, project_id, before_state, after_state)
  SELECT
    (record->>'user_id')::UUID,
    (record->>'action_type')::audit_action_type,
    (record->>'entity_type')::entity_type,
    (record->>'entity_id')::UUID,
    (record->>'project_id')::UUID,
    record->'before_state',
    record->'after_state'
  FROM jsonb_array_elements(p_audit_records) AS record;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. EVIDENCE CLEANUP TRIGGER
-- ============================================================================
-- Automatically delete orphaned evidence when parent entity is deleted
-- This ensures data integrity without manual cleanup

CREATE OR REPLACE FUNCTION cleanup_orphaned_evidence()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM evidence
  WHERE entity_type = TG_ARGV[0]::entity_type
    AND entity_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add triggers to each entity table
DROP TRIGGER IF EXISTS action_items_cleanup_evidence ON action_items;
CREATE TRIGGER action_items_cleanup_evidence
  AFTER DELETE ON action_items
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_orphaned_evidence('action_item');

DROP TRIGGER IF EXISTS decisions_cleanup_evidence ON decisions;
CREATE TRIGGER decisions_cleanup_evidence
  AFTER DELETE ON decisions
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_orphaned_evidence('decision');

DROP TRIGGER IF EXISTS risks_cleanup_evidence ON risks;
CREATE TRIGGER risks_cleanup_evidence
  AFTER DELETE ON risks
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_orphaned_evidence('risk');

-- ============================================================================
-- 4. DATA QUALITY: Validate Entity References in Evidence
-- ============================================================================
-- This function validates that evidence records reference valid entities

CREATE OR REPLACE FUNCTION validate_evidence_entity()
RETURNS TRIGGER AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Check if the referenced entity exists
  CASE NEW.entity_type
    WHEN 'action_item' THEN
      SELECT EXISTS(SELECT 1 FROM action_items WHERE id = NEW.entity_id) INTO v_exists;
    WHEN 'decision' THEN
      SELECT EXISTS(SELECT 1 FROM decisions WHERE id = NEW.entity_id) INTO v_exists;
    WHEN 'risk' THEN
      SELECT EXISTS(SELECT 1 FROM risks WHERE id = NEW.entity_id) INTO v_exists;
    ELSE
      v_exists := FALSE;
  END CASE;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'Invalid entity reference: % with ID % does not exist',
      NEW.entity_type, NEW.entity_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS evidence_validate_entity ON evidence;
CREATE TRIGGER evidence_validate_entity
  BEFORE INSERT ON evidence
  FOR EACH ROW
  EXECUTE FUNCTION validate_evidence_entity();

-- ============================================================================
-- 5. PROJECT STATISTICS MATERIALIZED VIEW
-- ============================================================================
-- Pre-computed statistics for dashboard and reports
-- Refreshed periodically rather than computed on every request

CREATE MATERIALIZED VIEW IF NOT EXISTS project_statistics AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  COUNT(DISTINCT m.id) AS total_meetings,
  COUNT(DISTINCT CASE WHEN m.status = 'Published' THEN m.id END) AS published_meetings,
  COUNT(DISTINCT ai.id) AS total_action_items,
  COUNT(DISTINCT CASE WHEN ai.status = 'Open' THEN ai.id END) AS open_action_items,
  COUNT(DISTINCT CASE WHEN ai.status = 'In Progress' THEN ai.id END) AS in_progress_action_items,
  COUNT(DISTINCT CASE WHEN ai.status = 'Closed' THEN ai.id END) AS closed_action_items,
  COUNT(DISTINCT CASE WHEN ai.due_date < CURRENT_DATE AND ai.status != 'Closed' THEN ai.id END) AS overdue_action_items,
  COUNT(DISTINCT d.id) AS total_decisions,
  COUNT(DISTINCT r.id) AS total_risks,
  COUNT(DISTINCT CASE WHEN r.status != 'Closed' AND r.probability = 'High' AND r.impact = 'High' THEN r.id END) AS critical_risks,
  MAX(m.date) AS last_meeting_date,
  p.updated_at AS project_updated_at,
  NOW() AS computed_at
FROM projects p
LEFT JOIN meetings m ON m.project_id = p.id AND m.status != 'Deleted'
LEFT JOIN action_items ai ON ai.project_id = p.id
LEFT JOIN decisions d ON d.project_id = p.id
LEFT JOIN risks r ON r.project_id = p.id
GROUP BY p.id, p.name, p.updated_at;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_statistics_project_id
  ON project_statistics(project_id);

-- Function to refresh statistics (call periodically or after significant changes)
CREATE OR REPLACE FUNCTION refresh_project_statistics()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY project_statistics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. QUERY PERFORMANCE HELPER: Get Admin Status Efficiently
-- ============================================================================
-- Cached check for admin status to avoid repeated subqueries

CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND global_role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 7. OPTIMIZED DASHBOARD QUERIES
-- ============================================================================
-- Function to get dashboard data in a single call

CREATE OR REPLACE FUNCTION get_dashboard_data(p_user_id UUID)
RETURNS TABLE (
  due_today_count BIGINT,
  overdue_count BIGINT,
  coming_up_count BIGINT,
  recent_meetings_count BIGINT,
  open_risks_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_projects AS (
    SELECT project_id FROM project_members WHERE user_id = p_user_id
    UNION
    SELECT id FROM projects WHERE EXISTS (
      SELECT 1 FROM profiles WHERE id = p_user_id AND global_role = 'admin'
    )
  )
  SELECT
    COUNT(DISTINCT CASE
      WHEN ai.due_date = CURRENT_DATE AND ai.status != 'Closed'
      THEN ai.id
    END)::BIGINT AS due_today_count,
    COUNT(DISTINCT CASE
      WHEN ai.due_date < CURRENT_DATE AND ai.status != 'Closed'
      THEN ai.id
    END)::BIGINT AS overdue_count,
    COUNT(DISTINCT CASE
      WHEN ai.due_date > CURRENT_DATE
        AND ai.due_date <= CURRENT_DATE + INTERVAL '5 days'
        AND ai.status != 'Closed'
      THEN ai.id
    END)::BIGINT AS coming_up_count,
    COUNT(DISTINCT CASE
      WHEN m.date >= CURRENT_DATE - INTERVAL '7 days'
        AND m.status = 'Published'
      THEN m.id
    END)::BIGINT AS recent_meetings_count,
    COUNT(DISTINCT CASE
      WHEN r.status != 'Closed'
      THEN r.id
    END)::BIGINT AS open_risks_count
  FROM user_projects up
  LEFT JOIN action_items ai ON ai.project_id = up.project_id
  LEFT JOIN meetings m ON m.project_id = up.project_id
  LEFT JOIN risks r ON r.project_id = up.project_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 8. EMBEDDING QUALITY CHECK
-- ============================================================================
-- Function to identify items missing embeddings (for batch re-processing)

CREATE OR REPLACE FUNCTION get_items_missing_embeddings(p_project_id UUID DEFAULT NULL)
RETURNS TABLE (
  entity_type TEXT,
  entity_id UUID,
  title TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'action_item'::TEXT, ai.id, ai.title, ai.created_at
  FROM action_items ai
  WHERE ai.embedding IS NULL
    AND (p_project_id IS NULL OR ai.project_id = p_project_id)

  UNION ALL

  SELECT 'decision'::TEXT, d.id, d.title, d.created_at
  FROM decisions d
  WHERE d.embedding IS NULL
    AND (p_project_id IS NULL OR d.project_id = p_project_id)

  UNION ALL

  SELECT 'risk'::TEXT, r.id, r.title, r.created_at
  FROM risks r
  WHERE r.embedding IS NULL
    AND (p_project_id IS NULL OR r.project_id = p_project_id)

  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
