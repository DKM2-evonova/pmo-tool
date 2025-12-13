-- Meetings table
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT,
  transcript_text TEXT,
  category meeting_category,
  status meeting_status NOT NULL DEFAULT 'Draft',
  date DATE,
  attendees JSONB DEFAULT '[]',
  recap JSONB,
  tone JSONB,
  fishbone JSONB,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Meetings policies (project-scoped)
CREATE POLICY "Users can view project meetings"
  ON meetings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = meetings.project_id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

-- Project members can create meetings
CREATE POLICY "Project members can create meetings"
  ON meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = meetings.project_id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

-- Project members can update meetings
CREATE POLICY "Project members can update meetings"
  ON meetings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = meetings.project_id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

-- Project members can delete draft meetings
CREATE POLICY "Project members can delete draft meetings"
  ON meetings FOR DELETE
  TO authenticated
  USING (
    status = 'Draft'
    AND (
      EXISTS (
        SELECT 1 FROM project_members
        WHERE project_members.project_id = meetings.project_id
        AND project_members.user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.global_role = 'admin'
      )
    )
  );

-- Trigger for updated_at
CREATE TRIGGER meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_meetings_project ON meetings(project_id);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_category ON meetings(category);
CREATE INDEX idx_meetings_date ON meetings(date DESC);

