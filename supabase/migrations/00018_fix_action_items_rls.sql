-- Fix action_items RLS policies to use security definer functions
-- This prevents potential issues with nested RLS checks on project_members

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view project action items" ON action_items;
DROP POLICY IF EXISTS "Project members can create action items" ON action_items;
DROP POLICY IF EXISTS "Project members can update action items" ON action_items;
DROP POLICY IF EXISTS "Project members can delete action items" ON action_items;

-- Recreate SELECT policy using security definer function
CREATE POLICY "Users can view project action items"
  ON action_items FOR SELECT
  TO authenticated
  USING (
    -- Use security definer function to bypass RLS on project_members
    is_project_member(project_id, auth.uid())
    OR
    is_admin(auth.uid())
  );

-- Recreate INSERT policy
CREATE POLICY "Project members can create action items"
  ON action_items FOR INSERT
  TO authenticated
  WITH CHECK (
    is_project_member(project_id, auth.uid())
    OR
    is_admin(auth.uid())
  );

-- Recreate UPDATE policy
CREATE POLICY "Project members can update action items"
  ON action_items FOR UPDATE
  TO authenticated
  USING (
    is_project_member(project_id, auth.uid())
    OR
    is_admin(auth.uid())
  );

-- Recreate DELETE policy
CREATE POLICY "Project members can delete action items"
  ON action_items FOR DELETE
  TO authenticated
  USING (
    is_project_member(project_id, auth.uid())
    OR
    is_admin(auth.uid())
  );




