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

