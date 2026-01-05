# Technical Specifications

This document consolidates the authoritative technical constraints and specifications for the PMO Tool.

---

## 1. Technology Stack

### Deployment

| Component | Technology | Constraint |
|-----------|------------|------------|
| Deployment Model | Single-tenant | One standalone deployment per client organization |
| Hosting | Google Cloud Run | Containerized deployment |
| Cron Jobs | Vercel | Hourly polling for Drive sync |

### Frontend

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 |
| UI Library | React 18 |
| Styling | Tailwind CSS + Liquid Glass Design System |

### Backend

| Component | Technology |
|-----------|------------|
| Database | Supabase (Postgres) |
| Security | Row-Level Security (RLS) |
| Vector Search | pgvector with HNSW index |
| Authentication | Supabase Auth (Google/Microsoft OAuth) |

### LLM Strategy

| Role | Model | Purpose |
|------|-------|---------|
| Primary | Gemini 3 Pro Preview | Recaps, decisions, risk analysis |
| Fallback | OpenAI GPT-5.2 | Used if Gemini fails |
| Utility | Gemini 2.0 Flash | JSON validation/repair |
| Embeddings | OpenAI text-embedding-3-small | Semantic matching |

**Cost Control**: Circuit breaker alerts Admin if fallback usage exceeds 15% in rolling 24-hour window.

---

## 2. Meeting Categories and Output Rules

### Output Requirements by Category

| Category | Recap | Action Items | Decisions | Risks | Tone | Fishbone |
|----------|:-----:|:------------:|:---------:|:-----:|:----:|:--------:|
| Project | ✓ | ✓ | | ✓ | | |
| Governance | ✓ | | ✓ (with outcome) | ✓ | | |
| Discovery | ✓ (detailed) | ✓ | ✓ | | | |
| Alignment | ✓ | | | | ✓ | |
| Remediation | ✓ (detailed) | | | ✓ | | ✓ |

### Evidence Requirement

Every extracted item in `action_items`, `decisions`, and `risks` **MUST** include evidence entries (1..N) with:
- `quote`: Direct transcript citation
- `speaker`: Name if identifiable (nullable)
- `timestamp`: HH:MM:SS format if available (nullable)

---

## 3. Owner Identity Resolution

### Resolution Pipeline

Apply in order until owner is resolved:

| Step | Source | Action |
|------|--------|--------|
| 1 | Direct email match (Users) | Map email to `profiles.id` → assign `owner_user_id` |
| 2 | Direct email match (Contacts) | Map email to `project_contacts.id` → assign `owner_contact_id` |
| 3 | Email inference | Match names to emails from meeting invites (best effort) |
| 4 | Conference-room heuristic | Infer from room device if single attendee; otherwise mark `Conference Room` |
| 5 | Fuzzy match | Match name against project roster → mark `Needs confirmation` |
| 6 | Ambiguous | Multiple matches → mark `Ambiguous Owner` |
| 7 | Fallback | No matches → assign `Unknown` |

### Publish Gate

Items with unresolved owners (`Unknown`, `Ambiguous Owner`, `Conference Room`) **cannot be published** until manually resolved.

---

## 4. Context-Aware Processing

### Pre-Processing Context Injection

Before LLM processing:
1. Load ALL open `action_items`, `risks`, and `decisions` for the project
2. Pass open items into LLM context to favor `update|close` over `create`

### Smart Context Filtering

For projects with >25 open items:
1. Generate embedding from transcript sample (first 8,000 chars)
2. Filter to semantically relevant items (similarity > 0.3)
3. Always include items updated within last 14 days
4. Projects with ≤25 items bypass filtering (passthrough mode)

### Duplicate Detection

| Stage | Threshold | Action |
|-------|-----------|--------|
| Post-processing | > 0.85 | Flag as `Potential Duplicate` in Review UI |
| Publish | On commit | Generate/regenerate embeddings |
| Description update | On publish | Refresh embedding |

### Token Limit Handling

If context exceeds LLM token limit:
1. Process in batches (multi-pass)
2. Merge results deterministically

---

## 5. Processing Flow

### State Machine

```
┌─────────┐     ┌────────────┐     ┌────────┐     ┌───────────┐
│  Draft  │────▶│ Processing │────▶│ Review │────▶│ Published │
└─────────┘     └────────────┘     └────────┘     └───────────┘
                      │                  │
                      ▼                  ▼
                ┌────────┐         ┌────────┐
                │ Failed │◀────────│ Failed │
                └────────┘         └────────┘
```

### State Transitions

| From | To | Trigger |
|------|----|---------|
| Draft | Processing | User initiates processing |
| Processing | Review | Valid JSON + validation passes |
| Processing | Failed | JSON invalid and repair fails |
| Review | Published | User commits changes |
| Review | Failed | Unrecoverable publish error |

### Processing Steps

1. **Select Project**: User selects from assigned projects
2. **Ingest**: Upload transcript OR auto-import from Drive OR Google Meet API
3. **Select Category**: User selects 1 of 5 categories
4. **Context Load**: Backend fetches all open project items
5. **LLM Processing**: Primary → Utility (validate) → Fallback (on failure)
6. **Vector Check**: Generate embeddings, check for duplicates
7. **Review UI**: Accept/reject/edit/merge operations
8. **Publish**: Commit changes, refresh embeddings, update status

---

## 6. RBAC and Privacy

### Privacy Model

- Visibility is **strictly project-scoped** via Supabase RLS
- Users only see projects they are assigned to
- Admin can access all projects within the tenant

### Capability Matrix

| Capability | Admin | Consultant | Program Manager |
|------------|:-----:|:----------:|:---------------:|
| Create/delete projects | ✓ | | |
| Manage members/RBAC | ✓ | | |
| Manage project contacts | ✓ | | ✓ (own projects) |
| Force unlock reviews | ✓ | | |
| Ingest/process transcripts | ✓ | ✓ | ✓ |
| Review proposed changes | ✓ | ✓ | ✓ |
| Publish meeting updates | ✓ | ✓ | ✓ |
| View audit logs | ✓ | Read-only | Read-only |
| View monitoring alerts | ✓ | | |

### Concurrency Control

| Setting | Value | Description |
|---------|-------|-------------|
| Lock type | Optimistic | One user per change set |
| Lock TTL | 30 minutes | Auto-release on inactivity |
| Lock message | "Locked by [User Name] currently reviewing." | Shown to others |
| Force unlock | Admin only | Override stuck locks |

---

## 7. Data Model

### Core Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `profiles` | id, email, full_name, global_role | User accounts |
| `projects` | id, name, created_at | Project definitions |
| `project_members` | project_id, user_id, project_role | RLS membership |
| `project_contacts` | id, project_id, name, email | External stakeholders |
| `milestones` | id, project_id, title, target_date, depends_on | Project milestones with dependencies |
| `meetings` | id, project_id, transcript_text, category, status | Meeting records |
| `action_items` | id, project_id, title, status, owner_user_id, owner_contact_id, embedding | Tasks |
| `decisions` | id, project_id, smart_id, title, category, status, embedding | Decision log |
| `risks` | id, project_id, title, probability, impact, status, embedding | Risk register |
| `evidence` | id, entity_type, entity_id, meeting_id, quote | Transcript citations |
| `proposed_change_sets` | id, meeting_id, proposed_items, locked_by_user_id | Review staging |
| `audit_logs` | id, user_id, action_type, entity_type, before, after | Change history |
| `llm_metrics` | id, model, latency_ms, success | LLM usage tracking |

### Google Drive Tables

| Table | Purpose |
|-------|---------|
| `drive_watched_folders` | Folders monitored per user |
| `drive_processed_files` | Deduplication tracking |
| `drive_webhook_channels` | Active webhook subscriptions |

### OAuth Tables

| Table | Purpose |
|-------|---------|
| `user_oauth_tokens` | Google Calendar/Drive tokens per user |

### Vector Configuration

- **Extension**: pgvector
- **Index Type**: HNSW (Hierarchical Navigable Small World)
- **Indexed Tables**: action_items, decisions, risks
- **Embedding Model**: OpenAI text-embedding-3-small

---

## 8. Evidence and Audit

### Evidence Traceability

All LLM-extracted items must include evidence:
- 1..N evidence snippets per item
- References transcript text with quote, speaker, timestamp
- Displayed in Review UI for validation
- Persisted after Publish with `meeting_id` and `entity_id` links

### Audit Logging

Changes tracked in `audit_logs`:
- `user_id`: Who made the change
- `action_type`: CREATE, UPDATE, DELETE
- `entity_type`: action_item, decision, risk, meeting
- `entity_id`: Affected record ID
- `before`: JSON snapshot before change
- `after`: JSON snapshot after change
- `timestamp`: When change occurred
