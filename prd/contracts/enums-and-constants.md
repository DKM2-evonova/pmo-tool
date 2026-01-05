# Enums and Constants

> **Authoritative Reference**: Do not add new enum values without a PRD change request.

This document defines all enum types and constants used throughout the PMO Tool.

---

## Meeting Enums

### MeetingCategory

The five fixed meeting categories:

| Value | Description |
|-------|-------------|
| `Project` | Standard project meetings producing action items and risks |
| `Governance` | Decision-focused meetings with required outcomes |
| `Discovery` | Exploratory meetings with detailed recaps |
| `Alignment` | Stakeholder meetings with tone analysis |
| `Remediation` | Problem-solving meetings with fishbone diagrams |

### MeetingStatus

Meeting processing lifecycle states:

| Value | Description |
|-------|-------------|
| `Draft` | Initial state, awaiting processing |
| `Processing` | LLM extraction in progress |
| `Review` | Awaiting human review |
| `Published` | Changes committed to database |
| `Failed` | Processing failed (JSON invalid, LLM error) |
| `Deleted` | Soft-deleted meeting |

---

## Entity Enums

### EntityStatus

Status for action items and risks:

| Value | Description |
|-------|-------------|
| `Open` | Not yet started |
| `In Progress` | Work underway |
| `Closed` | Completed or resolved |

### Operation

LLM-proposed operations on entities:

| Value | Description |
|-------|-------------|
| `create` | Create new entity |
| `update` | Modify existing entity |
| `close` | Close/complete existing entity |

---

## Decision Enums

### DecisionCategory

Six categories for decision classification:

| Value | Code | Description |
|-------|------|-------------|
| `process` | PROC | Process & Operating Model |
| `technology` | TECH | Technology & Systems |
| `data` | DATA | Data & Reporting |
| `people` | PPL | People & Change Management |
| `governance` | GOV | Governance & Compliance |
| `strategy` | STRAT | Strategy & Commercial |

### DecisionStatus

Decision lifecycle states:

| Value | Description |
|-------|-------------|
| `proposed` | Awaiting approval |
| `approved` | Decision approved |
| `rejected` | Decision rejected |
| `superseded` | Replaced by another decision |

### DecisionImpactArea

Impact areas for decisions (multi-select):

| Value | Description |
|-------|-------------|
| `scope` | Affects project scope |
| `cost` | Affects cost/budget |
| `time` | Affects time/schedule |
| `risk` | Affects risk profile |
| `customer_experience` | Affects customer experience |

### DecisionSource

Origin of the decision:

| Value | Description |
|-------|-------------|
| `meeting` | Extracted from meeting transcript |
| `manual` | Created manually by user |

---

## Risk Enums

### RiskSeverity

Probability and impact levels:

| Value | Score |
|-------|-------|
| `Low` | 1 |
| `Med` | 2 |
| `High` | 3 |

### Severity Matrix

| Probability × Impact | Score | Severity |
|---------------------|-------|----------|
| Low × Low | 1 | Low |
| Low × Med, Med × Low | 2 | Low |
| Low × High, Med × Med, High × Low | 3-4 | Medium |
| Med × High, High × Med | 6 | High |
| High × High | 9 | High |

---

## Tone Enums

### ToneLevel

Happiness and buy-in levels:

| Value | Description |
|-------|-------------|
| `Low` | Negative or disengaged |
| `Med` | Neutral |
| `High` | Positive or highly engaged |

---

## Role Enums

### GlobalRole

System-wide user roles (`profiles.global_role`):

| Value | Description |
|-------|-------------|
| `admin` | Full system access, can manage all projects |
| `consultant` | Project team member |
| `program_manager` | Oversees multiple projects |

### ProjectRole

Project-specific roles (`project_members.project_role`):

| Value | Description |
|-------|-------------|
| `owner` | Project owner (Admin by default) |
| `member` | Project team member |

---

## Owner Resolution States

Special owner states requiring manual resolution:

| Value | Description |
|-------|-------------|
| `Unknown` | No match found, requires manual assignment |
| `Ambiguous Owner` | Multiple possible matches |
| `Conference Room` | Multiple in-room participants detected |
| `Needs confirmation` | Fuzzy match requires user confirmation |

---

## Configuration Constants

### Duplicate Detection

| Constant | Default | Description |
|----------|---------|-------------|
| `SIMILARITY_THRESHOLD` | 0.85 | Vector similarity threshold for duplicate detection |
| `CONTEXT_SIMILARITY_THRESHOLD` | 0.3 | Broader threshold for context filtering |
| `RECENCY_DAYS` | 14 | Always include items updated within this window |

### Processing Limits

| Constant | Default | Description |
|----------|---------|-------------|
| `MAX_FILE_SIZE_MB` | 50 | Maximum upload file size |
| `MIN_TEXT_LENGTH` | 10 | Minimum characters for valid transcript |
| `CONTEXT_SAMPLE_CHARS` | 8000 | Characters sampled for context embeddings |
| `PASSTHROUGH_THRESHOLD` | 25 | Skip filtering if project has ≤ this many open items |

### Concurrency

| Constant | Default | Description |
|----------|---------|-------------|
| `LOCK_TTL_MINUTES` | 30 | Review lock auto-release timeout |
| `WEBHOOK_EXPIRY_HOURS` | 24 | Google Drive webhook channel expiration |
| `TOKEN_REFRESH_BUFFER_MIN` | 5 | Refresh OAuth tokens this many minutes before expiry |

### Caching

| Constant | Default | Description |
|----------|---------|-------------|
| `EMBEDDING_CACHE_SIZE` | 500 | LRU cache entries for embeddings |
| `EMBEDDING_CACHE_TTL_MIN` | 30 | Embedding cache time-to-live |
| `FUSE_INDEX_CACHE_TTL_MIN` | 1 | Fuzzy search index cache time-to-live |
