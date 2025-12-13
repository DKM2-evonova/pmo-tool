-- Proposed Change Sets (staging area before publish)
CREATE TABLE proposed_change_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  proposed_items JSONB NOT NULL DEFAULT '{"action_items": [], "decisions": [], "risks": []}',
  locked_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ,
  lock_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE proposed_change_sets ENABLE ROW LEVEL SECURITY;

-- Proposed change sets policies (project-scoped via meeting)
CREATE POLICY "Users can view change sets for accessible meetings"
  ON proposed_change_sets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings m
      JOIN project_members pm ON pm.project_id = m.project_id
      WHERE m.id = proposed_change_sets.meeting_id
      AND pm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Project members can create change sets"
  ON proposed_change_sets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings m
      JOIN project_members pm ON pm.project_id = m.project_id
      WHERE m.id = proposed_change_sets.meeting_id
      AND pm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

-- Users can update if they hold the lock or if unlocked
CREATE POLICY "Users can update change sets they have locked"
  ON proposed_change_sets FOR UPDATE
  TO authenticated
  USING (
    (
      -- User holds the lock
      locked_by_user_id = auth.uid()
      OR
      -- Not locked (available)
      locked_by_user_id IS NULL
      OR
      -- Lock expired (30 minutes)
      locked_at < NOW() - INTERVAL '30 minutes'
      OR
      -- Admin can force update
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.global_role = 'admin'
      )
    )
    AND
    -- Must have project access
    (
      EXISTS (
        SELECT 1 FROM meetings m
        JOIN project_members pm ON pm.project_id = m.project_id
        WHERE m.id = proposed_change_sets.meeting_id
        AND pm.user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.global_role = 'admin'
      )
    )
  );

CREATE POLICY "Admins can delete change sets"
  ON proposed_change_sets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER proposed_change_sets_updated_at
  BEFORE UPDATE ON proposed_change_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Unique constraint: one change set per meeting
CREATE UNIQUE INDEX idx_proposed_change_sets_meeting ON proposed_change_sets(meeting_id);

-- Index for lock lookups
CREATE INDEX idx_proposed_change_sets_locked_by ON proposed_change_sets(locked_by_user_id);

-- Function to acquire lock
CREATE OR REPLACE FUNCTION acquire_change_set_lock(
  p_change_set_id UUID,
  p_user_id UUID,
  p_expected_version INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_lock UUID;
  v_lock_time TIMESTAMPTZ;
  v_current_version INTEGER;
BEGIN
  SELECT locked_by_user_id, locked_at, lock_version
  INTO v_current_lock, v_lock_time, v_current_version
  FROM proposed_change_sets
  WHERE id = p_change_set_id
  FOR UPDATE;
  
  -- Check if lock is available
  IF v_current_lock IS NULL 
     OR v_current_lock = p_user_id 
     OR v_lock_time < NOW() - INTERVAL '30 minutes' THEN
    
    -- Check version for optimistic locking
    IF v_current_version != p_expected_version THEN
      RETURN FALSE;
    END IF;
    
    UPDATE proposed_change_sets
    SET locked_by_user_id = p_user_id,
        locked_at = NOW(),
        lock_version = lock_version + 1
    WHERE id = p_change_set_id;
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release lock
CREATE OR REPLACE FUNCTION release_change_set_lock(
  p_change_set_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE proposed_change_sets
  SET locked_by_user_id = NULL,
      locked_at = NULL
  WHERE id = p_change_set_id
  AND (locked_by_user_id = p_user_id OR locked_by_user_id IS NULL);
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to force unlock (admin only)
CREATE OR REPLACE FUNCTION force_unlock_change_set(p_change_set_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE proposed_change_sets
  SET locked_by_user_id = NULL,
      locked_at = NULL
  WHERE id = p_change_set_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

