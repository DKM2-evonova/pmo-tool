-- Table Statistics Function for Performance Monitoring
-- Provides approximate row counts and table sizes for monitoring

CREATE OR REPLACE FUNCTION get_table_stats()
RETURNS TABLE (
  table_name TEXT,
  row_estimate BIGINT,
  total_size TEXT,
  index_size TEXT,
  toast_size TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    relname::TEXT AS table_name,
    reltuples::BIGINT AS row_estimate,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
    pg_size_pretty(pg_indexes_size(c.oid)) AS index_size,
    pg_size_pretty(pg_total_relation_size(reltoastrelid)) AS toast_size
  FROM pg_class c
  LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE relkind = 'r'
    AND n.nspname = 'public'
    AND relname IN (
      'profiles',
      'projects',
      'project_members',
      'project_contacts',
      'meetings',
      'action_items',
      'decisions',
      'risks',
      'evidence',
      'proposed_change_sets',
      'audit_logs',
      'llm_metrics'
    )
  ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Index usage statistics (for identifying unused indexes)
CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE (
  table_name TEXT,
  index_name TEXT,
  index_scans BIGINT,
  rows_read BIGINT,
  rows_fetched BIGINT,
  index_size TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    relname::TEXT AS table_name,
    indexrelname::TEXT AS index_name,
    idx_scan AS index_scans,
    idx_tup_read AS rows_read,
    idx_tup_fetch AS rows_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
  FROM pg_stat_user_indexes
  WHERE schemaname = 'public'
  ORDER BY idx_scan DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Slow query identification helper
-- Note: This requires pg_stat_statements extension to be enabled
-- Returns empty if extension is not available
CREATE OR REPLACE FUNCTION get_slow_queries(min_time_ms FLOAT DEFAULT 100)
RETURNS TABLE (
  query TEXT,
  calls BIGINT,
  total_time_ms FLOAT,
  mean_time_ms FLOAT,
  max_time_ms FLOAT
) AS $$
BEGIN
  -- Check if pg_stat_statements is available
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
  ) THEN
    RETURN QUERY
    SELECT
      pss.query::TEXT,
      pss.calls,
      pss.total_exec_time AS total_time_ms,
      pss.mean_exec_time AS mean_time_ms,
      pss.max_exec_time AS max_time_ms
    FROM pg_stat_statements pss
    WHERE pss.mean_exec_time > min_time_ms
    ORDER BY pss.mean_exec_time DESC
    LIMIT 20;
  ELSE
    -- Return empty result if extension not available
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policy performance check
-- Identifies tables with potentially slow RLS policies
CREATE OR REPLACE FUNCTION check_rls_policy_health()
RETURNS TABLE (
  table_name TEXT,
  policy_name TEXT,
  policy_type TEXT,
  permissive TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    schemaname || '.' || tablename AS table_name,
    policyname AS policy_name,
    cmd AS policy_type,
    permissive::TEXT
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Data quality check: Find orphaned evidence records
-- These shouldn't exist due to our cleanup triggers, but good to monitor
CREATE OR REPLACE FUNCTION find_orphaned_evidence()
RETURNS TABLE (
  evidence_id UUID,
  entity_type entity_type,
  entity_id UUID,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.entity_type, e.entity_id, e.created_at
  FROM evidence e
  WHERE
    (e.entity_type = 'action_item' AND NOT EXISTS (
      SELECT 1 FROM action_items WHERE id = e.entity_id
    ))
    OR
    (e.entity_type = 'decision' AND NOT EXISTS (
      SELECT 1 FROM decisions WHERE id = e.entity_id
    ))
    OR
    (e.entity_type = 'risk' AND NOT EXISTS (
      SELECT 1 FROM risks WHERE id = e.entity_id
    ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up orphaned evidence (call if find_orphaned_evidence returns results)
CREATE OR REPLACE FUNCTION cleanup_orphaned_evidence_records()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM evidence e
  WHERE
    (e.entity_type = 'action_item' AND NOT EXISTS (
      SELECT 1 FROM action_items WHERE id = e.entity_id
    ))
    OR
    (e.entity_type = 'decision' AND NOT EXISTS (
      SELECT 1 FROM decisions WHERE id = e.entity_id
    ))
    OR
    (e.entity_type = 'risk' AND NOT EXISTS (
      SELECT 1 FROM risks WHERE id = e.entity_id
    ));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
