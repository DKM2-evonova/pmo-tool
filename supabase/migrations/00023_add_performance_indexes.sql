-- Performance Optimization: Add Missing Indexes for RLS Policies and Common Queries
-- This migration adds indexes to optimize the most frequent query patterns

-- ============================================================================
-- 1. INDEX FOR ADMIN ROLE LOOKUPS (Used in every RLS policy)
-- ============================================================================
-- The global_role column is checked in almost every RLS policy via:
-- EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.global_role = 'admin')

CREATE INDEX IF NOT EXISTS idx_profiles_global_role
  ON profiles(global_role)
  WHERE global_role = 'admin';

-- Composite index for faster auth lookup
CREATE INDEX IF NOT EXISTS idx_profiles_id_global_role
  ON profiles(id, global_role);

-- ============================================================================
-- 2. COMPOSITE INDEXES FOR ACTION ITEMS (Most frequently queried entity)
-- ============================================================================
-- Common query pattern: Get open action items for a project
CREATE INDEX IF NOT EXISTS idx_action_items_project_status
  ON action_items(project_id, status);

-- Common query pattern: Dashboard "Due Today" and "Coming Up" queries
CREATE INDEX IF NOT EXISTS idx_action_items_project_status_due_date
  ON action_items(project_id, status, due_date)
  WHERE status != 'Closed';

-- Common query pattern: Filter by owner within a project
CREATE INDEX IF NOT EXISTS idx_action_items_project_owner
  ON action_items(project_id, owner_user_id);

-- Relevance context query: project + updated_at for recency filtering
CREATE INDEX IF NOT EXISTS idx_action_items_project_updated
  ON action_items(project_id, updated_at DESC);

-- ============================================================================
-- 3. COMPOSITE INDEXES FOR DECISIONS
-- ============================================================================
-- Common query pattern: Get decisions for a project
CREATE INDEX IF NOT EXISTS idx_decisions_project_created
  ON decisions(project_id, created_at DESC);

-- Relevance context query
CREATE INDEX IF NOT EXISTS idx_decisions_project_updated
  ON decisions(project_id, updated_at DESC);

-- ============================================================================
-- 4. COMPOSITE INDEXES FOR RISKS
-- ============================================================================
-- Common query pattern: Get open risks for a project
CREATE INDEX IF NOT EXISTS idx_risks_project_status
  ON risks(project_id, status);

-- Risk matrix view: Group by probability/impact
CREATE INDEX IF NOT EXISTS idx_risks_project_severity
  ON risks(project_id, probability, impact)
  WHERE status != 'Closed';

-- Relevance context query
CREATE INDEX IF NOT EXISTS idx_risks_project_updated
  ON risks(project_id, updated_at DESC);

-- ============================================================================
-- 5. COMPOSITE INDEXES FOR MEETINGS
-- ============================================================================
-- Common query pattern: Get meetings for a project filtered by status
CREATE INDEX IF NOT EXISTS idx_meetings_project_status_date
  ON meetings(project_id, status, date DESC);

-- Recent meetings query on dashboard
CREATE INDEX IF NOT EXISTS idx_meetings_project_created
  ON meetings(project_id, created_at DESC);

-- ============================================================================
-- 6. EVIDENCE TABLE OPTIMIZATIONS
-- ============================================================================
-- Partial indexes by entity type for faster lookups
CREATE INDEX IF NOT EXISTS idx_evidence_action_items
  ON evidence(entity_id)
  WHERE entity_type = 'action_item';

CREATE INDEX IF NOT EXISTS idx_evidence_decisions
  ON evidence(entity_id)
  WHERE entity_type = 'decision';

CREATE INDEX IF NOT EXISTS idx_evidence_risks
  ON evidence(entity_id)
  WHERE entity_type = 'risk';

-- ============================================================================
-- 7. LLM METRICS ANALYTICS INDEXES
-- ============================================================================
-- Fallback rate analysis over time
CREATE INDEX IF NOT EXISTS idx_llm_metrics_fallback_time
  ON llm_metrics(is_fallback, created_at DESC);

-- Model performance analysis
CREATE INDEX IF NOT EXISTS idx_llm_metrics_model_success
  ON llm_metrics(model, success, created_at DESC);

-- ============================================================================
-- 8. AUDIT LOGS INDEXES (for compliance queries)
-- ============================================================================
-- Query audit logs by entity
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id, created_at DESC);

-- Query audit logs by user
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time
  ON audit_logs(user_id, created_at DESC);

-- ============================================================================
-- 9. PROJECT CONTACTS OPTIMIZATION
-- ============================================================================
-- Lookup contacts by email (for owner resolution)
CREATE INDEX IF NOT EXISTS idx_project_contacts_email
  ON project_contacts(project_id, LOWER(email));

-- Lookup contacts by name (for fuzzy matching)
CREATE INDEX IF NOT EXISTS idx_project_contacts_name
  ON project_contacts(project_id, LOWER(name));

-- ============================================================================
-- ANALYZE TABLES (Update statistics for query planner)
-- ============================================================================
ANALYZE profiles;
ANALYZE project_members;
ANALYZE projects;
ANALYZE meetings;
ANALYZE action_items;
ANALYZE decisions;
ANALYZE risks;
ANALYZE evidence;
ANALYZE llm_metrics;
ANALYZE audit_logs;
ANALYZE project_contacts;
