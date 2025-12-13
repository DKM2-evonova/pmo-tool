-- Audit Logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  entity_type entity_type NOT NULL,
  entity_id UUID NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  before_data JSONB,
  after_data JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs policies
-- Admins can view all logs
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

-- Users can view project-scoped logs for their projects (read-only)
CREATE POLICY "Users can view project audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = audit_logs.project_id
      AND project_members.user_id = auth.uid()
    )
  );

-- Only system can insert audit logs (via service role)
CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_project ON audit_logs(project_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action_type);

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION create_audit_log(
  p_user_id UUID,
  p_action_type TEXT,
  p_entity_type entity_type,
  p_entity_id UUID,
  p_project_id UUID,
  p_before JSONB,
  p_after JSONB
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    user_id, action_type, entity_type, entity_id, project_id, before_data, after_data
  ) VALUES (
    p_user_id, p_action_type, p_entity_type, p_entity_id, p_project_id, p_before, p_after
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

