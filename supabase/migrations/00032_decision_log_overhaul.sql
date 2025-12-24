-- ============================================================
-- Decision Log Overhaul Migration
-- Adds: Category, Impact Areas, Status Lifecycle, Smart IDs, Superseded workflow
-- ============================================================

-- 1. Create new enum types for decisions
CREATE TYPE decision_category AS ENUM (
  'PROCESS_OP_MODEL',
  'TECHNOLOGY_SYSTEMS',
  'DATA_REPORTING',
  'PEOPLE_CHANGE_MGMT',
  'GOVERNANCE_COMPLIANCE',
  'STRATEGY_COMMERCIAL'
);

CREATE TYPE decision_impact_area AS ENUM (
  'SCOPE',
  'COST_BUDGET',
  'TIME_SCHEDULE',
  'RISK',
  'CUSTOMER_EXP'
);

CREATE TYPE decision_status AS ENUM (
  'PROPOSED',
  'APPROVED',
  'REJECTED',
  'SUPERSEDED'
);

CREATE TYPE decision_source AS ENUM (
  'meeting',
  'manual'
);

-- 2. Create sequence tracking table for smart IDs (per project, per category)
CREATE TABLE decision_sequences (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category decision_category NOT NULL,
  current_sequence INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, category)
);

-- Enable RLS on sequence table
ALTER TABLE decision_sequences ENABLE ROW LEVEL SECURITY;

-- Allow project members to manage decision sequences
CREATE POLICY "Project members can manage decision sequences"
  ON decision_sequences FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = decision_sequences.project_id
      AND project_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

-- 3. Add new columns to decisions table
ALTER TABLE decisions
  ADD COLUMN smart_id TEXT,
  ADD COLUMN category decision_category,
  ADD COLUMN impact_areas decision_impact_area[] DEFAULT '{}',
  ADD COLUMN status decision_status DEFAULT 'PROPOSED',
  ADD COLUMN superseded_by_id UUID REFERENCES decisions(id) ON DELETE SET NULL,
  ADD COLUMN decision_date DATE,
  ADD COLUMN source decision_source DEFAULT 'meeting';

-- 4. Create function to generate next smart ID atomically
CREATE OR REPLACE FUNCTION generate_decision_smart_id(
  p_project_id UUID,
  p_category decision_category
) RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_next_seq INTEGER;
BEGIN
  -- Map category to prefix
  v_prefix := CASE p_category
    WHEN 'PROCESS_OP_MODEL' THEN 'PROC'
    WHEN 'TECHNOLOGY_SYSTEMS' THEN 'TECH'
    WHEN 'DATA_REPORTING' THEN 'DATA'
    WHEN 'PEOPLE_CHANGE_MGMT' THEN 'PPL'
    WHEN 'GOVERNANCE_COMPLIANCE' THEN 'GOV'
    WHEN 'STRATEGY_COMMERCIAL' THEN 'STRAT'
  END;

  -- Atomically increment and get sequence
  INSERT INTO decision_sequences (project_id, category, current_sequence)
  VALUES (p_project_id, p_category, 1)
  ON CONFLICT (project_id, category)
  DO UPDATE SET current_sequence = decision_sequences.current_sequence + 1
  RETURNING current_sequence INTO v_next_seq;

  -- Return formatted smart ID (zero-padded to 3 digits)
  RETURN v_prefix || '-' || LPAD(v_next_seq::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger to auto-generate smart_id on insert
CREATE OR REPLACE FUNCTION trigger_generate_decision_smart_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if smart_id is null and category is set
  IF NEW.smart_id IS NULL AND NEW.category IS NOT NULL THEN
    NEW.smart_id := generate_decision_smart_id(NEW.project_id, NEW.category);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decisions_generate_smart_id
  BEFORE INSERT ON decisions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_decision_smart_id();

-- 6. Create constraint: superseded_by_id required when status = SUPERSEDED
CREATE OR REPLACE FUNCTION check_superseded_constraint()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'SUPERSEDED' AND NEW.superseded_by_id IS NULL THEN
    RAISE EXCEPTION 'superseded_by_id is required when status is SUPERSEDED';
  END IF;
  IF NEW.status != 'SUPERSEDED' AND NEW.superseded_by_id IS NOT NULL THEN
    RAISE EXCEPTION 'superseded_by_id must be NULL when status is not SUPERSEDED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decisions_check_superseded
  BEFORE INSERT OR UPDATE ON decisions
  FOR EACH ROW
  EXECUTE FUNCTION check_superseded_constraint();

-- 7. Add indexes for new columns
CREATE INDEX idx_decisions_smart_id ON decisions(smart_id);
CREATE INDEX idx_decisions_category ON decisions(category);
CREATE INDEX idx_decisions_status ON decisions(status);
CREATE INDEX idx_decisions_superseded_by ON decisions(superseded_by_id);
CREATE INDEX idx_decisions_impact_areas ON decisions USING GIN(impact_areas);
CREATE INDEX idx_decisions_source ON decisions(source);

-- 8. Migrate existing decisions
-- Set default category to PROCESS_OP_MODEL
-- Set status based on whether outcome exists
-- Set decision_date from meeting date or created_at
UPDATE decisions
SET
  category = 'PROCESS_OP_MODEL',
  status = CASE
    WHEN outcome IS NOT NULL THEN 'APPROVED'::decision_status
    ELSE 'PROPOSED'::decision_status
  END,
  decision_date = COALESCE(
    (SELECT date FROM meetings WHERE id = decisions.source_meeting_id),
    created_at::date
  ),
  source = 'meeting'
WHERE category IS NULL;

-- 9. Generate smart IDs for existing decisions (in order of creation)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT id, project_id, category
    FROM decisions
    WHERE smart_id IS NULL AND category IS NOT NULL
    ORDER BY created_at ASC
  ) LOOP
    UPDATE decisions
    SET smart_id = generate_decision_smart_id(r.project_id, r.category)
    WHERE id = r.id;
  END LOOP;
END $$;

-- Note: category remains nullable for backwards compatibility during transition
-- Application code will validate category is required for new decisions
