/**
 * PMO Tool Enums - Authoritative values from PRD
 * DO NOT add new enum values without a PRD change
 */

// Meeting Categories (fixed for MVP)
export const MeetingCategory = {
  Project: 'Project',
  Governance: 'Governance',
  Discovery: 'Discovery',
  Alignment: 'Alignment',
  Remediation: 'Remediation',
} as const;
export type MeetingCategory = (typeof MeetingCategory)[keyof typeof MeetingCategory];

// Meeting Status (processing lifecycle)
export const MeetingStatus = {
  Draft: 'Draft',
  Processing: 'Processing',
  Review: 'Review',
  Published: 'Published',
  Failed: 'Failed',
  Deleted: 'Deleted',
} as const;
export type MeetingStatus = (typeof MeetingStatus)[keyof typeof MeetingStatus];

// Entity Status (ActionItem/Risk)
export const EntityStatus = {
  Open: 'Open',
  InProgress: 'In Progress',
  Closed: 'Closed',
} as const;
export type EntityStatus = (typeof EntityStatus)[keyof typeof EntityStatus];

// Operation types for LLM output
export const Operation = {
  Create: 'create',
  Update: 'update',
  Close: 'close',
} as const;
export type Operation = (typeof Operation)[keyof typeof Operation];

// Risk Severity levels
export const RiskSeverity = {
  Low: 'Low',
  Med: 'Med',
  High: 'High',
} as const;
export type RiskSeverity = (typeof RiskSeverity)[keyof typeof RiskSeverity];

// Tone indicators
export const ToneLevel = {
  Low: 'Low',
  Med: 'Med',
  High: 'High',
} as const;
export type ToneLevel = (typeof ToneLevel)[keyof typeof ToneLevel];

// Global roles (profiles.global_role)
export const GlobalRole = {
  Admin: 'admin',
  Consultant: 'consultant',
  ProgramManager: 'program_manager',
} as const;
export type GlobalRole = (typeof GlobalRole)[keyof typeof GlobalRole];

// Project roles (project_members.project_role)
export const ProjectRole = {
  Owner: 'owner',
  Member: 'member',
} as const;
export type ProjectRole = (typeof ProjectRole)[keyof typeof ProjectRole];

// Entity types for evidence and audit
export const EntityType = {
  ActionItem: 'action_item',
  Decision: 'decision',
  Risk: 'risk',
} as const;
export type EntityType = (typeof EntityType)[keyof typeof EntityType];

// Owner resolution status
export const OwnerResolutionStatus = {
  Resolved: 'resolved',
  NeedsConfirmation: 'needs_confirmation',
  Ambiguous: 'ambiguous',
  ConferenceRoom: 'conference_room',
  Unknown: 'unknown',
  Placeholder: 'placeholder',
} as const;
export type OwnerResolutionStatus = (typeof OwnerResolutionStatus)[keyof typeof OwnerResolutionStatus];

// Duplicate detection threshold (default)
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.85;

// Lock TTL in minutes
export const LOCK_TTL_MINUTES = 30;

// Fallback usage alert threshold (%)
export const FALLBACK_ALERT_THRESHOLD_PERCENT = 15;

// Milestone Status
export const MilestoneStatus = {
  NotStarted: 'Not Started',
  InProgress: 'In Progress',
  BehindSchedule: 'Behind Schedule',
  Complete: 'Complete',
} as const;
export type MilestoneStatus = (typeof MilestoneStatus)[keyof typeof MilestoneStatus];

// ============================================================
// Decision Log Enums (Hybrid Project Support)
// ============================================================

// Decision Category (single select)
export const DecisionCategory = {
  ProcessOpModel: 'PROCESS_OP_MODEL',
  TechnologySystems: 'TECHNOLOGY_SYSTEMS',
  DataReporting: 'DATA_REPORTING',
  PeopleChangeMgmt: 'PEOPLE_CHANGE_MGMT',
  GovernanceCompliance: 'GOVERNANCE_COMPLIANCE',
  StrategyCommercial: 'STRATEGY_COMMERCIAL',
} as const;
export type DecisionCategory = (typeof DecisionCategory)[keyof typeof DecisionCategory];// Category prefix mapping for Smart IDs
export const DecisionCategoryPrefix: Record<DecisionCategory, string> = {
  [DecisionCategory.ProcessOpModel]: 'PROC',
  [DecisionCategory.TechnologySystems]: 'TECH',
  [DecisionCategory.DataReporting]: 'DATA',
  [DecisionCategory.PeopleChangeMgmt]: 'PPL',
  [DecisionCategory.GovernanceCompliance]: 'GOV',
  [DecisionCategory.StrategyCommercial]: 'STRAT',
};

// Category display labels
export const DecisionCategoryLabel: Record<DecisionCategory, string> = {
  [DecisionCategory.ProcessOpModel]: 'Process & Operating Model',
  [DecisionCategory.TechnologySystems]: 'Technology & Systems',
  [DecisionCategory.DataReporting]: 'Data & Reporting',
  [DecisionCategory.PeopleChangeMgmt]: 'People & Change Management',
  [DecisionCategory.GovernanceCompliance]: 'Governance & Compliance',
  [DecisionCategory.StrategyCommercial]: 'Strategy & Commercial',
};

// Category descriptions for guidance
export const DecisionCategoryDescription: Record<DecisionCategory, string> = {
  [DecisionCategory.ProcessOpModel]: 'Workflows, SOPs, business logic changes',
  [DecisionCategory.TechnologySystems]: 'Infrastructure, tech stack, tools',
  [DecisionCategory.DataReporting]: 'KPIs, database schema, analytics',
  [DecisionCategory.PeopleChangeMgmt]: 'Org structure, training, roles, UX/UI',
  [DecisionCategory.GovernanceCompliance]: 'Legal, security, audit, policies',
  [DecisionCategory.StrategyCommercial]: 'Budget, vendor, scope, MVP decisions',
};

// Decision Impact Area (multi-select)
export const DecisionImpactArea = {
  Scope: 'SCOPE',
  CostBudget: 'COST_BUDGET',
  TimeSchedule: 'TIME_SCHEDULE',
  Risk: 'RISK',
  CustomerExp: 'CUSTOMER_EXP',
} as const;
export type DecisionImpactArea = (typeof DecisionImpactArea)[keyof typeof DecisionImpactArea];

// Impact area display labels
export const DecisionImpactAreaLabel: Record<DecisionImpactArea, string> = {
  [DecisionImpactArea.Scope]: 'Scope',
  [DecisionImpactArea.CostBudget]: 'Cost / Budget',
  [DecisionImpactArea.TimeSchedule]: 'Time / Schedule',
  [DecisionImpactArea.Risk]: 'Risk',
  [DecisionImpactArea.CustomerExp]: 'Customer Experience',
};

// Decision Status Lifecycle
export const DecisionStatus = {
  Proposed: 'PROPOSED',
  Approved: 'APPROVED',
  Rejected: 'REJECTED',
  Superseded: 'SUPERSEDED',
} as const;
export type DecisionStatus = (typeof DecisionStatus)[keyof typeof DecisionStatus];

// Status display labels
export const DecisionStatusLabel: Record<DecisionStatus, string> = {
  [DecisionStatus.Proposed]: 'Proposed',
  [DecisionStatus.Approved]: 'Approved',
  [DecisionStatus.Rejected]: 'Rejected',
  [DecisionStatus.Superseded]: 'Superseded',
};

// Decision Source
export const DecisionSource = {
  Meeting: 'meeting',
  Manual: 'manual',
} as const;
export type DecisionSource = (typeof DecisionSource)[keyof typeof DecisionSource];
