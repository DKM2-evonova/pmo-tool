-- ============================================================
-- Milestones Table Migration
-- Migrates from JSONB array in projects table to proper relational table
-- Adds: Dependencies (Finish-to-Start), Sort Order, Description
-- ============================================================

-- 1. Create milestone_status enum
CREATE TYPE milestone_status AS ENUM (
  'Not Started',
  'In Progress',
  'Behind Schedule',
  'Complete'
);

-- 2. Create milestones table
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status milestone_status NOT NULL DEFAULT 'Not Started',
  sort_order INTEGER NOT NULL DEFAULT 0,
  predecessor_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies (following project pattern)

-- View: Project members and admins can view milestones
CREATE POLICY "Users can view project milestones"
  ON milestones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = milestones.project_id
      AND project_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

-- Insert: Project members and admins can create milestones
CREATE POLICY "Project members can insert milestones"
  ON milestones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = milestones.project_id
      AND project_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

-- Update: Project members and admins can update milestones
CREATE POLICY "Project members can update milestones"
  ON milestones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = milestones.project_id
      AND project_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

-- Delete: Project members and admins can delete milestones
CREATE POLICY "Project members can delete milestones"
  ON milestones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = milestones.project_id
      AND project_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

-- 5. Indexes for performance
CREATE INDEX idx_milestones_project_id ON milestones(project_id);
CREATE INDEX idx_milestones_predecessor ON milestones(predecessor_id) WHERE predecessor_id IS NOT NULL;
CREATE INDEX idx_milestones_project_sort ON milestones(project_id, sort_order);
CREATE INDEX idx_milestones_target_date ON milestones(target_date) WHERE target_date IS NOT NULL;
CREATE INDEX idx_milestones_status ON milestones(status);

-- 6. Updated_at trigger (uses existing update_updated_at function)
CREATE TRIGGER milestones_updated_at
  BEFORE UPDATE ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 7. Dependency validation trigger (prevent circular dependencies)
CREATE OR REPLACE FUNCTION check_milestone_dependency()
RETURNS TRIGGER AS $$
DECLARE
  v_current_id UUID;
  v_depth INTEGER := 0;
  v_max_depth INTEGER := 100;
BEGIN
  -- Skip validation if no predecessor
  IF NEW.predecessor_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Cannot depend on itself
  IF NEW.id = NEW.predecessor_id THEN
    RAISE EXCEPTION 'A milestone cannot depend on itself';
  END IF;

  -- Predecessor must be in the same project
  IF NOT EXISTS (
    SELECT 1 FROM milestones
    WHERE id = NEW.predecessor_id
    AND project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Predecessor milestone must belong to the same project';
  END IF;

  -- Check for circular dependencies by walking the chain
  v_current_id := NEW.predecessor_id;
  WHILE v_current_id IS NOT NULL AND v_depth < v_max_depth LOOP
    -- If we encounter the new milestone's ID, we have a cycle
    IF v_current_id = NEW.id THEN
      RAISE EXCEPTION 'Circular dependency detected: this would create a dependency cycle';
    END IF;

    -- Move to the next predecessor in the chain
    SELECT predecessor_id INTO v_current_id
    FROM milestones
    WHERE id = v_current_id;

    v_depth := v_depth + 1;
  END LOOP;

  -- If we've exceeded max depth, something is wrong
  IF v_depth >= v_max_depth THEN
    RAISE EXCEPTION 'Dependency chain too deep (max %)', v_max_depth;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER milestones_check_dependency
  BEFORE INSERT OR UPDATE ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION check_milestone_dependency();

-- 8. Function to get all predecessors for a milestone (for Gantt chart)
CREATE OR REPLACE FUNCTION get_milestone_predecessors(p_milestone_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  target_date DATE,
  status milestone_status,
  chain_depth INTEGER
) AS $$
WITH RECURSIVE chain AS (
  -- Start with the milestone's immediate predecessor
  SELECT
    m.id,
    m.name,
    m.target_date,
    m.status,
    1 AS chain_depth
  FROM milestones m
  WHERE m.id = (SELECT predecessor_id FROM milestones WHERE id = p_milestone_id)

  UNION ALL

  -- Walk up the chain
  SELECT
    m.id,
    m.name,
    m.target_date,
    m.status,
    c.chain_depth + 1
  FROM milestones m
  JOIN chain c ON m.id = (SELECT predecessor_id FROM milestones WHERE id = c.id)
  WHERE c.chain_depth < 100
)
SELECT * FROM chain;
$$ LANGUAGE sql STABLE;

-- 9. Function to get all successors for a milestone (for impact analysis)
CREATE OR REPLACE FUNCTION get_milestone_successors(p_milestone_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  target_date DATE,
  status milestone_status,
  chain_depth INTEGER
) AS $$
WITH RECURSIVE chain AS (
  -- Start with milestones that depend on this one
  SELECT
    m.id,
    m.name,
    m.target_date,
    m.status,
    1 AS chain_depth
  FROM milestones m
  WHERE m.predecessor_id = p_milestone_id

  UNION ALL

  -- Walk down the chain
  SELECT
    m.id,
    m.name,
    m.target_date,
    m.status,
    c.chain_depth + 1
  FROM milestones m
  JOIN chain c ON m.predecessor_id = c.id
  WHERE c.chain_depth < 100
)
SELECT * FROM chain;
$$ LANGUAGE sql STABLE;

-- 10. Migrate existing JSONB data to new table
-- This handles the existing milestones stored in projects.milestones JSONB column
INSERT INTO milestones (id, project_id, name, target_date, status, sort_order, created_at, updated_at)
SELECT
  -- Use existing ID if valid UUID, otherwise generate new one
  CASE
    WHEN m->>'id' IS NOT NULL AND m->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (m->>'id')::UUID
    ELSE uuid_generate_v4()
  END AS id,
  p.id AS project_id,
  m->>'name' AS name,
  -- Parse target_date, handle various formats
  CASE
    WHEN m->>'target_date' IS NOT NULL AND m->>'target_date' != '' AND m->>'target_date' != 'null'
    THEN (m->>'target_date')::DATE
    ELSE NULL
  END AS target_date,
  -- Map status, handle legacy 'completed' boolean field
  CASE
    WHEN (m->>'completed')::BOOLEAN = true THEN 'Complete'::milestone_status
    WHEN m->>'status' IN ('Not Started', 'In Progress', 'Behind Schedule', 'Complete')
    THEN (m->>'status')::milestone_status
    ELSE 'Not Started'::milestone_status
  END AS status,
  -- Assign sort_order based on target_date (nulls last)
  (ROW_NUMBER() OVER (
    PARTITION BY p.id
    ORDER BY
      CASE
        WHEN m->>'target_date' IS NOT NULL AND m->>'target_date' != '' AND m->>'target_date' != 'null'
        THEN (m->>'target_date')::DATE
        ELSE '9999-12-31'::DATE
      END
  ) - 1)::INTEGER AS sort_order,
  p.created_at,
  p.updated_at
FROM projects p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.milestones, '[]'::JSONB)) AS m
WHERE m->>'name' IS NOT NULL
  AND m->>'name' != ''
  AND TRIM(m->>'name') != '';

-- 11. Add comment explaining the migration status
COMMENT ON TABLE milestones IS 'Milestones table - migrated from projects.milestones JSONB. The JSONB column is kept for backward compatibility during transition.';

-- Note: The projects.milestones JSONB column is intentionally NOT dropped.
-- After verifying the migration and updating all application code,
-- run this to remove it:
-- ALTER TABLE projects DROP COLUMN milestones;
