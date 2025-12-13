-- Evidence table (links extracted items to transcript quotes)
CREATE TABLE evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type entity_type NOT NULL,
  entity_id UUID NOT NULL,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  quote TEXT NOT NULL,
  speaker TEXT,
  timestamp TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

-- Evidence policies (project-scoped via entity)
CREATE POLICY "Users can view evidence for accessible entities"
  ON evidence FOR SELECT
  TO authenticated
  USING (
    -- Check if user has access to the meeting's project
    EXISTS (
      SELECT 1 FROM meetings m
      JOIN project_members pm ON pm.project_id = m.project_id
      WHERE m.id = evidence.meeting_id
      AND pm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Project members can create evidence"
  ON evidence FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings m
      JOIN project_members pm ON pm.project_id = m.project_id
      WHERE m.id = evidence.meeting_id
      AND pm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

-- Indexes
CREATE INDEX idx_evidence_entity ON evidence(entity_type, entity_id);
CREATE INDEX idx_evidence_meeting ON evidence(meeting_id);

