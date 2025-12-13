# Enums and Constants (Authoritative)

> **Do not add new enum values** without a PRD change.

## MeetingCategory
- `Project`
- `Governance`
- `Discovery`
- `Alignment`
- `Remediation`

## MeetingStatus (processing lifecycle)
- `Draft`
- `Processing`
- `Review`
- `Published`
- `Failed`

## EntityStatus (ActionItem/Risk)
- `Open`
- `In Progress`
- `Closed`

## Operation
- `create`
- `update`
- `close`

## RiskSeverity
- `Low`
- `Med`
- `High`

## ToneHappiness / ToneBuyIn
- `Low`
- `Med`
- `High`

## GlobalRole (profiles.global_role)
- `admin`
- `consultant`
- `program_manager`

## ProjectRole (project_members.project_role)
- `owner`
- `member`

## Duplicate Detection
- Similarity threshold default: `> 0.85` => flag as `Potential Duplicate` (threshold is adjustable).
