-- Decisions table
CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  rationale TEXT,
  impact TEXT,
  decision_maker_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decision_maker_name TEXT,
  decision_maker_email TEXT,
  outcome TEXT,
  embedding vector(1536),
  source_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

-- Decisions policies (project-scoped)
CREATE POLICY "Users can view project decisions"
  ON decisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = decisions.project_id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Project members can create decisions"
  ON decisions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = decisions.project_id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Project members can update decisions"
  ON decisions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = decisions.project_id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Project members can delete decisions"
  ON decisions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = decisions.project_id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER decisions_updated_at
  BEFORE UPDATE ON decisions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_decisions_project ON decisions(project_id);
CREATE INDEX idx_decisions_maker ON decisions(decision_maker_user_id);
CREATE INDEX idx_decisions_source_meeting ON decisions(source_meeting_id);

-- HNSW index for vector similarity search
CREATE INDEX idx_decisions_embedding ON decisions 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

