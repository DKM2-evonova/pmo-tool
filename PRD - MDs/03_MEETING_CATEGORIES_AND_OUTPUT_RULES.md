# Meeting Categories and Output Rules (MUST)

## Fixed categories
- The system **MUST** support exactly five categories for MVP:
  `Project`, `Governance`, `Discovery`, `Alignment`, `Remediation`.
- The system **MUST NOT** introduce additional meeting sub-types in MVP.

## Output pack requirements by category
### Project
- **MUST** produce: `recap`
- **MUST** update: `action_items`
- **MUST** update: `risks` (risk/issue log)

### Governance
- **MUST** produce: `recap`
- **MUST** update: `decisions` and each decision **MUST** include an `outcome`
- **MUST** update: `risks` (strategic risks)

### Discovery
- **MUST** produce: detailed `recap`
- **MUST** update: `action_items` and `decisions`

### Alignment
- **MUST** produce: `recap`
- **MUST** produce: `tone` (overall + per participant)

### Remediation
- **MUST** produce: detailed `recap`
- **MUST** produce: `fishbone` artifact
- **MUST** update: `risks` (RAID)

## Evidence requirement (applies to all categories)
- Every extracted item in `action_items`, `decisions`, and `risks` **MUST** include `evidence` entries (1..N).
