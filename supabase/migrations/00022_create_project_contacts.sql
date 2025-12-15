-- Project contacts table
-- People associated with projects who don't have login accounts
-- They can be recognized during meeting processing instead of appearing as "unknown"

CREATE TABLE project_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: same email can't appear twice for same project (when email is provided)
CREATE UNIQUE INDEX idx_project_contacts_project_email
  ON project_contacts(project_id, email)
  WHERE email IS NOT NULL;

-- Performance indexes
CREATE INDEX idx_project_contacts_project ON project_contacts(project_id);
CREATE INDEX idx_project_contacts_email ON project_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX idx_project_contacts_name ON project_contacts USING gin (name gin_trgm_ops);

-- Enable RLS
ALTER TABLE project_contacts ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is a program manager
CREATE OR REPLACE FUNCTION is_program_manager(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
    AND global_role = 'program_manager'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies

-- SELECT: Members can view contacts for their projects, admins can view all
CREATE POLICY "Users can view project contacts"
  ON project_contacts FOR SELECT
  TO authenticated
  USING (
    is_project_member(project_id, auth.uid())
    OR is_admin(auth.uid())
  );

-- INSERT: Admins can insert for any project, program managers for their projects
CREATE POLICY "Admins and program managers can create project contacts"
  ON project_contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin(auth.uid())
    OR (
      is_program_manager(auth.uid())
      AND is_project_member(project_id, auth.uid())
    )
  );

-- UPDATE: Same as INSERT
CREATE POLICY "Admins and program managers can update project contacts"
  ON project_contacts FOR UPDATE
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR (
      is_program_manager(auth.uid())
      AND is_project_member(project_id, auth.uid())
    )
  );

-- DELETE: Same as INSERT
CREATE POLICY "Admins and program managers can delete project contacts"
  ON project_contacts FOR DELETE
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR (
      is_program_manager(auth.uid())
      AND is_project_member(project_id, auth.uid())
    )
  );

-- Trigger for updated_at
CREATE TRIGGER project_contacts_updated_at
  BEFORE UPDATE ON project_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
