-- Action Items table
CREATE TABLE action_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status entity_status NOT NULL DEFAULT 'Open',
  owner_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  owner_name TEXT,
  owner_email TEXT,
  due_date DATE,
  embedding vector(1536),
  source_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

-- Action Items policies (project-scoped)
CREATE POLICY "Users can view project action items"
  ON action_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = action_items.project_id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Project members can create action items"
  ON action_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = action_items.project_id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Project members can update action items"
  ON action_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = action_items.project_id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Project members can delete action items"
  ON action_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = action_items.project_id
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
CREATE TRIGGER action_items_updated_at
  BEFORE UPDATE ON action_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_action_items_project ON action_items(project_id);
CREATE INDEX idx_action_items_status ON action_items(status);
CREATE INDEX idx_action_items_owner ON action_items(owner_user_id);
CREATE INDEX idx_action_items_due_date ON action_items(due_date);
CREATE INDEX idx_action_items_source_meeting ON action_items(source_meeting_id);

-- HNSW index for vector similarity search
CREATE INDEX idx_action_items_embedding ON action_items 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

