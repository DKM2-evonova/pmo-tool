-- Migration: Add missing UPDATE and DELETE policies to evidence table
-- This completes the RLS policy set for the evidence table

-- Allow project members and admins to update evidence
CREATE POLICY "Project members can update evidence"
  ON evidence FOR UPDATE
  TO authenticated
  USING (
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
  )
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

-- Allow project members and admins to delete evidence
CREATE POLICY "Project members can delete evidence"
  ON evidence FOR DELETE
  TO authenticated
  USING (
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
