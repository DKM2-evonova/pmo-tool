-- Risks table (RAID log)
CREATE TABLE risks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  probability risk_severity NOT NULL DEFAULT 'Med',
  impact risk_severity NOT NULL DEFAULT 'Med',
  mitigation TEXT,
  status entity_status NOT NULL DEFAULT 'Open',
  owner_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  owner_name TEXT,
  owner_email TEXT,
  embedding vector(1536),
  source_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE risks ENABLE ROW LEVEL SECURITY;

-- Risks policies (project-scoped)
CREATE POLICY "Users can view project risks"
  ON risks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = risks.project_id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Project members can create risks"
  ON risks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = risks.project_id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Project members can update risks"
  ON risks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = risks.project_id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Project members can delete risks"
  ON risks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = risks.project_id
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
CREATE TRIGGER risks_updated_at
  BEFORE UPDATE ON risks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_risks_project ON risks(project_id);
CREATE INDEX idx_risks_status ON risks(status);
CREATE INDEX idx_risks_owner ON risks(owner_user_id);
CREATE INDEX idx_risks_source_meeting ON risks(source_meeting_id);

-- HNSW index for vector similarity search
CREATE INDEX idx_risks_embedding ON risks 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

