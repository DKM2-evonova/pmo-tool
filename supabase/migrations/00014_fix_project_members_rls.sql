-- Fix infinite recursion in project_members RLS policy
-- The original policy queried project_members to check access to project_members,
-- causing infinite recursion.

-- Create a security definer function to check project membership without triggering RLS
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
    AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
    AND global_role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view project members" ON project_members;

-- Create a fixed policy using the security definer function
CREATE POLICY "Users can view project members"
  ON project_members FOR SELECT
  TO authenticated
  USING (
    -- User is a member of this project (checked via security definer to avoid recursion)
    is_project_member(project_id, auth.uid())
    OR
    -- User is an admin
    is_admin(auth.uid())
  );

-- Also fix policies on other tables that might have similar issues
-- These policies reference project_members but from different tables, so they're OK
-- However, let's update them to use the helper function for consistency and performance

-- Fix projects SELECT policy
DROP POLICY IF EXISTS "Users can view assigned projects" ON projects;
CREATE POLICY "Users can view assigned projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    is_project_member(id, auth.uid())
    OR
    is_admin(auth.uid())
  );

-- Fix projects UPDATE policy
DROP POLICY IF EXISTS "Admins and owners can update projects" ON projects;
CREATE POLICY "Admins and owners can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
      AND project_members.user_id = auth.uid()
      AND project_members.project_role = 'owner'
    )
    OR
    is_admin(auth.uid())
  );
