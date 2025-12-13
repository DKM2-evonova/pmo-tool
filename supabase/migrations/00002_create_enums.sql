-- Create enum types based on PRD 02_ENUMS_AND_CONSTANTS.md
-- DO NOT add new enum values without a PRD change

-- Meeting Categories (fixed for MVP)
CREATE TYPE meeting_category AS ENUM (
  'Project',
  'Governance',
  'Discovery',
  'Alignment',
  'Remediation'
);

-- Meeting Status (processing lifecycle)
CREATE TYPE meeting_status AS ENUM (
  'Draft',
  'Processing',
  'Review',
  'Published',
  'Failed'
);

-- Entity Status (ActionItem/Risk)
CREATE TYPE entity_status AS ENUM (
  'Open',
  'In Progress',
  'Closed'
);

-- Risk Severity
CREATE TYPE risk_severity AS ENUM (
  'Low',
  'Med',
  'High'
);

-- Tone Level
CREATE TYPE tone_level AS ENUM (
  'Low',
  'Med',
  'High'
);

-- Global Role (profiles.global_role)
CREATE TYPE global_role AS ENUM (
  'admin',
  'consultant',
  'program_manager'
);

-- Project Role (project_members.project_role)
CREATE TYPE project_role AS ENUM (
  'owner',
  'member'
);

-- Entity Type (for evidence and audit)
CREATE TYPE entity_type AS ENUM (
  'action_item',
  'decision',
  'risk'
);

