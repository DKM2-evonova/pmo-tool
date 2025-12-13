/**
 * Database types matching Supabase schema
 */

import type {
  MeetingCategory,
  MeetingStatus,
  EntityStatus,
  GlobalRole,
  ProjectRole,
  RiskSeverity,
  EntityType,
  ToneLevel,
} from './enums';

// Base entity with common fields
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

// User profile
export interface Profile extends BaseEntity {
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  global_role: GlobalRole;
}

// Project
export interface Project extends BaseEntity {
  name: string;
  description: string | null;
  milestones: Milestone[] | null;
}

export interface Milestone {
  id: string;
  name: string;
  target_date: string | null;
  completed: boolean;
}

// Project membership
export interface ProjectMember {
  project_id: string;
  user_id: string;
  project_role: ProjectRole;
  created_at: string;
}

export interface ProjectMemberWithProfile extends ProjectMember {
  profile: Profile;
}

// Meeting
export interface Meeting extends BaseEntity {
  project_id: string;
  title: string | null;
  transcript_text: string | null;
  category: MeetingCategory | null;
  status: MeetingStatus;
  date: string | null;
  attendees: MeetingAttendee[] | null;
  recap: MeetingRecap | null;
  tone: MeetingTone | null;
  fishbone: FishboneData | null;
  processed_at: string | null;
  error_message: string | null;
}

export interface MeetingAttendee {
  name: string;
  email: string | null;
}

export interface MeetingRecap {
  summary: string;
  highlights: string[];
}

export interface MeetingTone {
  overall: string;
  participants: ParticipantTone[];
}

export interface ParticipantTone {
  name: string;
  tone: string;
  happiness: ToneLevel;
  buy_in: ToneLevel;
}

export interface FishboneData {
  enabled: boolean;
  outline: FishboneOutline | null;
  rendered: FishboneRendered | null;
}

export interface FishboneOutline {
  problem_statement: string;
  categories: FishboneCategory[];
}

export interface FishboneCategory {
  name: string;
  causes: string[];
}

export interface FishboneRendered {
  format: 'svg';
  payload: string;
}

// Action Item Update
export interface ActionItemUpdate {
  id: string;
  content: string;
  created_at: string;
  created_by_user_id: string;
  created_by_name: string;
}

// Risk Update
export interface RiskUpdate {
  id: string;
  content: string;
  created_at: string;
  created_by_user_id: string;
  created_by_name: string;
}

// Action Item
export interface ActionItem extends BaseEntity {
  project_id: string;
  title: string;
  description: string | null;
  status: EntityStatus;
  owner_user_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  due_date: string | null;
  embedding: number[] | null;
  source_meeting_id: string | null;
  updates: ActionItemUpdate[];
}

export interface ActionItemWithOwner extends ActionItem {
  owner?: Profile | null;
  project?: { id: string; name: string } | null;
  source_meeting?: Meeting | null;
}

// Decision
export interface Decision extends BaseEntity {
  project_id: string;
  title: string;
  rationale: string | null;
  impact: string | null;
  decision_maker_user_id: string | null;
  decision_maker_name: string | null;
  decision_maker_email: string | null;
  outcome: string | null;
  embedding: number[] | null;
  source_meeting_id: string | null;
}

export interface DecisionWithMaker extends Decision {
  decision_maker?: Profile | null;
  source_meeting?: Meeting | null;
}

// Risk
export interface Risk extends BaseEntity {
  project_id: string;
  title: string;
  description: string | null;
  probability: RiskSeverity;
  impact: RiskSeverity;
  mitigation: string | null;
  status: EntityStatus;
  owner_user_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  embedding: number[] | null;
  source_meeting_id: string | null;
  updates: RiskUpdate[];
}

export interface RiskWithOwner extends Risk {
  owner?: Profile | null;
  source_meeting?: Meeting | null;
}

// Evidence
export interface Evidence {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  meeting_id: string;
  quote: string;
  speaker: string | null;
  timestamp: string | null;
  created_at: string;
}

// Proposed Change Set
export interface ProposedChangeSet extends BaseEntity {
  meeting_id: string;
  proposed_items: ProposedItems;
  locked_by_user_id: string | null;
  locked_at: string | null;
  lock_version: number;
}

export interface ProposedItems {
  action_items: ProposedActionItem[];
  decisions: ProposedDecision[];
  risks: ProposedRisk[];
}

export interface ProposedActionItem {
  temp_id: string;
  operation: 'create' | 'update' | 'close';
  external_id: string | null;
  title: string;
  description: string;
  status: EntityStatus;
  owner: ProposedOwner;
  owner_resolution_status: string;
  due_date: string | null;
  evidence: ProposedEvidence[];
  accepted: boolean;
  duplicate_of: string | null;
  similarity_score: number | null;
}

export interface ProposedDecision {
  temp_id: string;
  operation: 'create' | 'update';
  title: string;
  rationale: string;
  impact: string;
  decision_maker: ProposedOwner;
  decision_maker_resolution_status: string;
  outcome: string;
  evidence: ProposedEvidence[];
  accepted: boolean;
  duplicate_of: string | null;
  similarity_score: number | null;
}

export interface ProposedRisk {
  temp_id: string;
  operation: 'create' | 'update' | 'close';
  external_id: string | null;
  title: string;
  description: string;
  probability: RiskSeverity;
  impact: RiskSeverity;
  mitigation: string;
  owner: ProposedOwner;
  owner_resolution_status: string;
  status: EntityStatus;
  evidence: ProposedEvidence[];
  accepted: boolean;
  duplicate_of: string | null;
  similarity_score: number | null;
}

export interface ProposedOwner {
  name: string;
  email: string | null;
  resolved_user_id: string | null;
}

export interface ProposedEvidence {
  quote: string;
  speaker: string | null;
  timestamp: string | null;
}

// Audit Log
export interface AuditLog {
  id: string;
  user_id: string;
  action_type: string;
  entity_type: EntityType;
  entity_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: string;
}

export interface AuditLogWithUser extends AuditLog {
  user: Profile;
}

// LLM Metrics (for circuit breaker)
export interface LLMMetric {
  id: string;
  timestamp: string;
  model: string;
  is_fallback: boolean;
  success: boolean;
  latency_ms: number;
  meeting_id: string | null;
}

