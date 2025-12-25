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
  MilestoneStatus,
  DecisionCategory,
  DecisionImpactArea,
  DecisionStatus,
  DecisionSource,
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
  status: MilestoneStatus;
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

// Project Contact (person associated with project without login account)
export interface ProjectContact {
  id: string;
  project_id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// Unified team member type for displaying both users and contacts together
export interface UnifiedTeamMember {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  type: 'user' | 'contact';
  project_role?: ProjectRole; // Only for users
  created_at: string;
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
  source_file_path: string | null;
  source_file_name: string | null;
  source_file_type: string | null;
}

export interface MeetingAttendee {
  name: string;
  email: string | null;
}

export interface MeetingRecap {
  summary: string;
  highlights: string[];
  key_topics: KeyTopic[];
  action_items_summary: ActionItemSummary[];
  outstanding_topics: OutstandingTopic[];
  // Updates to existing action items detected in this meeting
  action_item_updates?: ActionItemUpdateRecap[];
}

// Summary of action item updates for recap display
export interface ActionItemUpdateRecap {
  external_id: string;
  title: string;
  operation: 'update' | 'close';
  change_summary: string;
  evidence_quote: string;
  previous_status?: string;
  new_status?: string;
}

export interface KeyTopic {
  topic: string;
  discussion: string;
  participants: string[];
  outcome: string | null;
}

export interface ActionItemSummary {
  title: string;
  owner: string;
  due_date: string | null;
  status: EntityStatus;
}

export interface OutstandingTopic {
  topic: string;
  context: string;
  blockers: string[];
  suggested_next_steps: string[];
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
  // Optional fields for AI-generated updates
  source?: 'user' | 'ai_meeting_processing';
  meeting_id?: string;
  meeting_title?: string;
  evidence_quote?: string;
}

// Risk Update
export interface RiskUpdate {
  id: string;
  content: string;
  created_at: string;
  created_by_user_id: string;
  created_by_name: string;
  // Optional fields for AI-generated updates
  source?: 'user' | 'ai_meeting_processing';
  meeting_id?: string;
  meeting_title?: string;
  evidence_quote?: string;
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
  smart_id: string | null;
  title: string;
  rationale: string | null;
  impact: string | null;
  category: DecisionCategory | null;
  impact_areas: DecisionImpactArea[];
  status: DecisionStatus;
  decision_maker_user_id: string | null;
  decision_maker_name: string | null;
  decision_maker_email: string | null;
  outcome: string | null;
  decision_date: string | null;
  superseded_by_id: string | null;
  source: DecisionSource;
  embedding: number[] | null;
  source_meeting_id: string | null;
}

export interface DecisionWithMaker extends Decision {
  decision_maker?: Profile | null;
  source_meeting?: Meeting | null;
  project?: { id: string; name: string } | null;
  superseded_by?: Decision | null;
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
  // Brief explanation of what changed for update/close operations
  change_summary?: string | null;
}

export interface ProposedDecision {
  temp_id: string;
  operation: 'create' | 'update';
  external_id?: string | null;
  title: string;
  rationale: string;
  impact: string;
  category: DecisionCategory;
  impact_areas: DecisionImpactArea[];
  status: DecisionStatus;
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
  resolved_contact_id: string | null;
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

