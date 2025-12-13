-- Combined Migration Script for PMO Tool
-- Run this in the Supabase SQL Editor to create all tables

-- ============================================
-- 00001: Enable required extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- 00002: Create enum types
-- ============================================
CREATE TYPE meeting_category AS ENUM (
  'Project',
  'Governance',
  'Discovery',
  'Alignment',
  'Remediation'
);

CREATE TYPE meeting_status AS ENUM (
  'Draft',
  'Processing',
  'Review',
  'Published',
  'Failed'
);

CREATE TYPE entity_status AS ENUM (
  'Open',
  'In Progress',
  'Closed'
);

CREATE TYPE risk_severity AS ENUM (
  'Low',
  'Med',
  'High'
);

CREATE TYPE tone_level AS ENUM (
  'Low',
  'Med',
  'High'
);

CREATE TYPE global_role AS ENUM (
  'admin',
  'consultant',
  'program_manager'
);

CREATE TYPE project_role AS ENUM (
  'owner',
  'member'
);

CREATE TYPE entity_type AS ENUM (
  'action_item',
  'decision',
  'risk'
);

-- ============================================
-- 00003: Create profiles table
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  global_role global_role NOT NULL DEFAULT 'consultant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND global_role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, global_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    'consultant'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Helper functions for RLS policies (security definer to avoid recursion)
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

-- ============================================
-- 00004: Create projects table
-- ============================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  milestones JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_role project_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assigned projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Admins can create projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

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
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Users can view project members"
  ON project_members FOR SELECT
  TO authenticated
  USING (
    -- Use security definer function to avoid infinite recursion
    is_project_member(project_id, auth.uid())
    OR
    is_admin(auth.uid())
  );

CREATE POLICY "Admins can manage project members"
  ON project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Admins can update project members"
  ON project_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Admins can delete project members"
  ON project_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_members_project ON project_members(project_id);

-- ============================================
-- 00005: Create meetings table
-- ============================================
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

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

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

CREATE TRIGGER meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_meetings_project ON meetings(project_id);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_category ON meetings(category);
CREATE INDEX idx_meetings_date ON meetings(date DESC);

-- ============================================
-- 00006: Create action_items table
-- ============================================
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

ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

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

CREATE TRIGGER action_items_updated_at
  BEFORE UPDATE ON action_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_action_items_project ON action_items(project_id);
CREATE INDEX idx_action_items_status ON action_items(status);
CREATE INDEX idx_action_items_owner ON action_items(owner_user_id);
CREATE INDEX idx_action_items_due_date ON action_items(due_date);
CREATE INDEX idx_action_items_source_meeting ON action_items(source_meeting_id);

CREATE INDEX idx_action_items_embedding ON action_items 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================
-- 00007: Create decisions table
-- ============================================
CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  rationale TEXT,
  impact TEXT,
  decision_maker_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decision_maker_name TEXT,
  decision_maker_email TEXT,
  outcome TEXT,
  embedding vector(1536),
  source_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project decisions"
  ON decisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = decisions.project_id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Project members can create decisions"
  ON decisions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = decisions.project_id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Project members can update decisions"
  ON decisions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = decisions.project_id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "Project members can delete decisions"
  ON decisions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = decisions.project_id
      AND project_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE TRIGGER decisions_updated_at
  BEFORE UPDATE ON decisions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_decisions_project ON decisions(project_id);
CREATE INDEX idx_decisions_maker ON decisions(decision_maker_user_id);
CREATE INDEX idx_decisions_source_meeting ON decisions(source_meeting_id);

CREATE INDEX idx_decisions_embedding ON decisions 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================
-- 00008: Create risks table
-- ============================================
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

ALTER TABLE risks ENABLE ROW LEVEL SECURITY;

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

CREATE TRIGGER risks_updated_at
  BEFORE UPDATE ON risks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_risks_project ON risks(project_id);
CREATE INDEX idx_risks_status ON risks(status);
CREATE INDEX idx_risks_owner ON risks(owner_user_id);
CREATE INDEX idx_risks_source_meeting ON risks(source_meeting_id);

CREATE INDEX idx_risks_embedding ON risks 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================
-- 00009: Create evidence table
-- ============================================
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

ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evidence for accessible entities"
  ON evidence FOR SELECT
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

CREATE INDEX idx_evidence_entity ON evidence(entity_type, entity_id);
CREATE INDEX idx_evidence_meeting ON evidence(meeting_id);

-- ============================================
-- 00010: Create proposed_change_sets table
-- ============================================
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

ALTER TABLE proposed_change_sets ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Users can update change sets they have locked"
  ON proposed_change_sets FOR UPDATE
  TO authenticated
  USING (
    (
      locked_by_user_id = auth.uid()
      OR
      locked_by_user_id IS NULL
      OR
      locked_at < NOW() - INTERVAL '30 minutes'
      OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.global_role = 'admin'
      )
    )
    AND
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

CREATE TRIGGER proposed_change_sets_updated_at
  BEFORE UPDATE ON proposed_change_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE UNIQUE INDEX idx_proposed_change_sets_meeting ON proposed_change_sets(meeting_id);
CREATE INDEX idx_proposed_change_sets_locked_by ON proposed_change_sets(locked_by_user_id);

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
  
  IF v_current_lock IS NULL 
     OR v_current_lock = p_user_id 
     OR v_lock_time < NOW() - INTERVAL '30 minutes' THEN
    
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

-- ============================================
-- 00011: Create audit_logs table
-- ============================================
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

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_project ON audit_logs(project_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action_type);

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

-- ============================================
-- 00012: Create llm_metrics table
-- ============================================
CREATE TABLE llm_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model TEXT NOT NULL,
  is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  success BOOLEAN NOT NULL,
  latency_ms INTEGER NOT NULL,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  error_message TEXT
);

ALTER TABLE llm_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view LLM metrics"
  ON llm_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.global_role = 'admin'
    )
  );

CREATE POLICY "System can insert LLM metrics"
  ON llm_metrics FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_llm_metrics_timestamp ON llm_metrics(timestamp DESC);
CREATE INDEX idx_llm_metrics_model ON llm_metrics(model);
CREATE INDEX idx_llm_metrics_fallback ON llm_metrics(is_fallback) WHERE is_fallback = TRUE;

CREATE OR REPLACE FUNCTION get_fallback_rate_24h()
RETURNS TABLE(
  total_requests BIGINT,
  fallback_requests BIGINT,
  fallback_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_requests,
    COUNT(*) FILTER (WHERE is_fallback = TRUE)::BIGINT AS fallback_requests,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE is_fallback = TRUE)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0
    END AS fallback_percentage
  FROM llm_metrics
  WHERE timestamp > NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_llm_request(
  p_model TEXT,
  p_is_fallback BOOLEAN,
  p_success BOOLEAN,
  p_latency_ms INTEGER,
  p_meeting_id UUID DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_metric_id UUID;
BEGIN
  INSERT INTO llm_metrics (
    model, is_fallback, success, latency_ms, meeting_id, error_message
  ) VALUES (
    p_model, p_is_fallback, p_success, p_latency_ms, p_meeting_id, p_error_message
  ) RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 00013: Create similarity functions
-- ============================================
CREATE OR REPLACE FUNCTION match_action_items(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_project_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    action_items.id,
    action_items.title,
    1 - (action_items.embedding <=> query_embedding) as similarity
  FROM action_items
  WHERE action_items.project_id = p_project_id
    AND action_items.embedding IS NOT NULL
    AND 1 - (action_items.embedding <=> query_embedding) > match_threshold
  ORDER BY action_items.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_decisions(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_project_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    decisions.id,
    decisions.title,
    1 - (decisions.embedding <=> query_embedding) as similarity
  FROM decisions
  WHERE decisions.project_id = p_project_id
    AND decisions.embedding IS NOT NULL
    AND 1 - (decisions.embedding <=> query_embedding) > match_threshold
  ORDER BY decisions.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_risks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_project_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    risks.id,
    risks.title,
    1 - (risks.embedding <=> query_embedding) as similarity
  FROM risks
  WHERE risks.project_id = p_project_id
    AND risks.embedding IS NOT NULL
    AND 1 - (risks.embedding <=> query_embedding) > match_threshold
  ORDER BY risks.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION search_similar_items(
  query_embedding vector(1536),
  p_project_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  entity_type text,
  id uuid,
  title text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT * FROM (
    SELECT
      'action_item'::text as entity_type,
      action_items.id,
      action_items.title,
      1 - (action_items.embedding <=> query_embedding) as similarity
    FROM action_items
    WHERE action_items.project_id = p_project_id
      AND action_items.embedding IS NOT NULL
      AND 1 - (action_items.embedding <=> query_embedding) > match_threshold
    
    UNION ALL
    
    SELECT
      'decision'::text as entity_type,
      decisions.id,
      decisions.title,
      1 - (decisions.embedding <=> query_embedding) as similarity
    FROM decisions
    WHERE decisions.project_id = p_project_id
      AND decisions.embedding IS NOT NULL
      AND 1 - (decisions.embedding <=> query_embedding) > match_threshold
    
    UNION ALL
    
    SELECT
      'risk'::text as entity_type,
      risks.id,
      risks.title,
      1 - (risks.embedding <=> query_embedding) as similarity
    FROM risks
    WHERE risks.project_id = p_project_id
      AND risks.embedding IS NOT NULL
      AND 1 - (risks.embedding <=> query_embedding) > match_threshold
  ) combined
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- ============================================
-- BOOTSTRAP: Create profile for existing user and make admin
-- ============================================
-- This will create a profile entry for your user if they already exist in auth.users
-- and promote them to admin

-- First, let's insert/update the profile with admin role
INSERT INTO profiles (id, email, global_role)
SELECT id, email, 'admin'::global_role
FROM auth.users
WHERE email = 'dan.martz@evonovaassociates.com'
ON CONFLICT (id) DO UPDATE SET global_role = 'admin';
