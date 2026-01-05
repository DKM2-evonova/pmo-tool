# Product Requirements Document (PRD): PMO Tool

- **Version**: 2.5
- **Date**: January 4, 2026
- **Status**: Approved for Build
- **Version Control**: Hosted on GitHub

---

## 1. Overview

The PMO Tool is an automation layer that sits on top of an organization's existing work management ecosystem. It converts meeting conversations into structured project data (action items, risks/issues, decisions, recaps, tone) and reusable artifacts, reducing the time Project Consultants and Program/Portfolio Managers spend on 'work about work'.

- **Core Loop**: Ingest (Transcript) → Interpret (LLM) → Action (Structured Data)
- **Deployment Model**: Single-tenant (standalone deployment per client organization)
- **Intelligence Strategy**: Context-aware updates. The system passes existing open items into the LLM to favor UPDATE/CLOSE over CREATE and to reduce duplicates.

### Success Metrics

| Metric | Target |
|--------|--------|
| Efficiency | Reduction in time spent on administrative tasks (measured via user surveys) |
| Adoption | Daily active usage by Project Consultants |
| Accuracy | 90%+ acceptance rate of LLM-generated logs without manual editing |
| Latency | End-to-end meeting processing complete in < 60 seconds for typical transcripts |
| Predictability | Improvements in project delivery signals |

---

## 2. Roadmap

- **Phase 1**: Core data scaffolding and authentication (MVP) ✓
- **Phase 2**: Ingestion pipeline (Google Meet API + manual transcript uploads) (MVP) ✓
- **Phase 3**: Context-aware extraction and semantic matching (MVP) ✓
- **Phase 4**: Review UI and state management (MVP) ✓
- **Phase 5**: Artifacts and exports (MVP) ✓
- **Phase 6**: Advanced features (V2): dashboards, historical reporting, and direct cloud-drive integrations ✓
- **Phase 7**: Milestone management with Gantt visualization (V2) ✓
- **Phase 8**: Enhanced decision log with categorization (V2) ✓

---

## 3. Assumptions and Scope

| Assumption | Details |
|------------|---------|
| Ecosystem | Integrations focus on Google Workspace and Microsoft 365, but meeting ingestion supports any platform via manual transcript upload |
| Exports | MVP supports local download only (no direct Drive/OneDrive writes). Users may choose Office-optimized or Google-optimized export templates |
| Tenancy | Single tenant. The application is deployed independently for one organization |
| Project Plans | Milestones support finish-to-start dependencies and Gantt visualization |
| LLM Context | The system is context-aware and injects existing open items during processing |
| Authentication | Any email domain is allowed; SSO via Google/Microsoft (if enabled) with Supabase Auth |
| Language | English only |
| Notifications | Excluded from MVP (no email/push when items are assigned). V2 feature |

---

## 4. Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16 + React 18 + Tailwind CSS (Liquid Glass Design System) |
| Backend | Supabase (Postgres + RLS) with pgvector for semantic matching |
| Deployment | Google Cloud Run |
| Primary LLM | Gemini 3 Pro Preview (recaps, decisions, risk analysis) |
| Fallback LLM | OpenAI GPT-5.2 (used if Gemini fails) |
| Utility LLM | Gemini 2.0 Flash (formatting, JSON validation/repair) |
| Embeddings | OpenAI text-embedding-3-small |

### Cost Circuit Breaker

The system notifies Admin if fallback usage exceeds 15% of total LLM requests in a rolling 24-hour window.

---

## 5. Integrations

### 5.1 Google Calendar Integration

- OAuth connection for importing meeting metadata (title, date, attendees)
- Dashboard widget showing upcoming meetings (next 7 days)
- Per-user token storage with auto-refresh

### 5.2 Google Drive Auto-Ingestion

- Automatic detection and import of meeting transcripts from watched folders
- Dual approach: Push notifications (webhooks) + hourly polling (cron)
- Multi-user deduplication via content fingerprinting (SHA-256)
- Supported formats: Google Docs, DOCX, PDF, TXT, RTF
- Imported meetings created in Draft status for project assignment

### 5.3 Manual Transcript Upload

- Supported formats: VTT, TXT, DOCX, text-based PDF
- User may paste transcript text directly
- User may paste attendee list when metadata is missing

### 5.4 Exports

- Browser-triggered local downloads (CSV/DOCX/PDF/Excel)
- Office-optimized and Google-optimized templates
- Project Status Report: multi-sheet Excel workbook

---

## 6. Personas

| Persona | Role Summary | Primary Goals | Key Workflows |
|---------|--------------|---------------|---------------|
| Project Consultant | Runs initiatives day-to-day | Convert meetings into actions; maintain execution hygiene | Upload transcripts; review proposed changes; publish updates; manage action items |
| Program/Portfolio Manager | Oversees multiple projects | Portfolio visibility; consistent reporting | Consume rollups; review risks/issues; publish meeting updates for assigned projects |
| Tool Admin | Configures standards and access | Standardize artifacts; manage permissions | Create/manage projects; manage membership/RBAC; manage settings; view audit logs; respond to alerts |

---

## 7. Meeting Categories and Output Packs

The system supports exactly five meeting categories:

| Category | Required Outputs |
|----------|-----------------|
| **Project** | Recap, Action Items, Risks/Issues |
| **Governance** | Recap, Decisions (outcome required), Strategic Risks |
| **Discovery** | Detailed Recap, Action Items, Decisions |
| **Alignment** | Recap, Tone Analysis (overall + per participant) |
| **Remediation** | Detailed Recap, Fishbone Diagram, RAID |

All extracted items must include evidence entries (1..N) referencing transcript text.

---

## 8. Key Features

### 8.1 Action Item Management

- **Kanban Board**: Visual task management with columns for Open, In Progress, Closed
- **Update Detection**: LLM actively detects status changes, scope updates, due date changes, and owner reassignments from meeting transcripts
- **Change Summary**: Each update includes a summary of what changed
- **Dashboard**: Due today/past due items and 5-business-day lookahead

### 8.2 Decision Log

The Decision Log is designed to handle 100+ decisions across hybrid projects:

| Feature | Details |
|---------|---------|
| Smart IDs | Auto-generated category-prefixed identifiers (e.g., TECH-001, PROC-042, GOV-015) |
| 6 Categories | Process & Operating Model (PROC), Technology & Systems (TECH), Data & Reporting (DATA), People & Change Management (PPL), Governance & Compliance (GOV), Strategy & Commercial (STRAT) |
| 5 Impact Areas | Scope, Cost/Budget, Time/Schedule, Risk, Customer Experience (multi-select) |
| Status Lifecycle | Proposed → Approved / Rejected / Superseded |
| Superseded Workflow | Link replacement decisions with visual strikethrough and navigation |
| Manual Entry | Create decisions directly without a meeting source |
| Faceted Filtering | Sidebar with category, impact, and status checkboxes with real-time counts |
| Saved Views | Pre-configured filter presets (Technical, Business Process, Governance, Active, Pending) |
| LLM Auto-Classification | AI automatically assigns category and impact areas during meeting processing |

### 8.3 Risk Register

- Probability/impact assessment with severity matrix
- Status tracking with update history and comments
- Visual dashboard showing risk distribution by severity
- Filtering by severity (High/Medium/Low) and status

### 8.4 Milestone Management

| Feature | Details |
|---------|---------|
| Relational Storage | Milestones stored in dedicated table (not JSONB) with RLS policies |
| Dependencies | Finish-to-start predecessor relationships between milestones |
| Spreadsheet Editing | Bulk edit milestones inline with drag-to-reorder |
| Excel Import/Export | Download template, edit in Excel/Sheets, re-upload |
| Gantt Chart | SVG-based timeline visualization with dependency arrows and today line |
| View Switcher | Toggle between List, Edit, and Timeline views |
| Circular Prevention | Database trigger prevents invalid dependency chains |

### 8.5 Review Workflow

- **Lock Mechanism**: Prevents concurrent reviews of the same meeting (30-min TTL)
- **Edit Functionality**: Modify descriptions, titles, and other fields of proposed items
- **Reject Items**: Remove items that are already resolved or not relevant
- **Owner Resolution**: Assign or resolve owners for action items and risks
- **Evidence Review**: All items include transcript citations for validation

### 8.6 Project Contacts

External stakeholders (non-login users) who can be assigned as owners:
- Stored per project in `project_contacts` table
- Included in owner resolution pipeline and selection dropdowns

---

## 9. Owner Identity Resolution

Goal: Assign owners consistently using the best available signal and fall back to user verification when uncertain.

### Resolution Pipeline (apply in order)

1. **Direct email match (Users)**: Map email from Meet API or attendee list to `profiles.id`
2. **Direct email match (Contacts)**: Check `project_contacts` for email match
3. **Email inference (best effort)**: Match names to emails from meeting invites
4. **Conference-room heuristic**: Infer owner from room device responses
5. **Fuzzy match**: Match person name against project roster (requires confirmation)
6. **Ambiguous**: Multiple matches require manual selection
7. **Fallback**: Assign to 'Unknown' for manual resolution

### Publish Gate

Items with owner = Unknown, Ambiguous Owner, or Conference Room cannot be published until the reviewer resolves the owner.

---

## 10. Context-Aware Processing

### Pre-Processing

- Load ALL open action items, risks/issues, and decisions for the selected project
- Pass open items to the LLM context to favor UPDATE/CLOSE over CREATE

### Smart Context Filtering

For projects with >25 open items:
- Use vector embeddings to filter context to semantically relevant items
- Similarity threshold: 0.3 (broader matches)
- Always include items updated within last 14 days
- Sample first 8,000 characters of transcripts for embedding generation

### Semantic Duplicate Detection

- Generate embeddings for newly proposed items
- Flag as 'Potential Duplicate' if similarity > 0.85 (configurable)
- Embeddings generated/regenerated on Publish

---

## 11. Processing Flow

1. **Select Project**: User selects from assigned projects
2. **Ingest**: Connect via Google Meet API OR upload transcript OR auto-import from Drive
3. **Select Category**: User selects 1 of 5 meeting categories
4. **Context Load**: Backend fetches all open project items
5. **LLM Processing**: Primary model generates JSON; utility model validates/repairs; fallback used on primary failure
6. **Vector Check**: Embeddings + similarity checks for duplicates
7. **Review UI**: Accept/reject/edit/merge/convert operations
8. **Publish**: Commit changes; update live tables; refresh embeddings; set status to Published

### Meeting Status Transitions

```
Draft → Processing → Review → Published
                ↘ Failed ↙
```

---

## 12. RBAC and Privacy

Visibility is strictly project-scoped via Supabase Row-Level Security.

| Capability | Admin | Consultant | Program Manager |
|------------|-------|------------|-----------------|
| Create/delete projects | ✓ | | |
| Manage members/RBAC | ✓ | | |
| Manage project contacts | ✓ (all) | | ✓ (own projects) |
| Force unlock reviews | ✓ | | |
| Ingest/process transcripts | ✓ | ✓ | ✓ |
| Review proposed changes | ✓ | ✓ | ✓ |
| Publish meeting updates | ✓ | ✓ | ✓ |
| View audit logs | ✓ | Read-only | Read-only |
| View project contacts | ✓ | ✓ | ✓ |

---

## 13. Data Architecture

### Core Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (id, email, full_name, global_role) |
| `projects` | Project definitions |
| `project_members` | Project membership for RLS (project_id, user_id, project_role) |
| `project_contacts` | Non-login stakeholders per project |
| `milestones` | Project milestones with dependencies |
| `meetings` | Meeting records with transcripts and status |
| `action_items` | Action items with embeddings and update history |
| `decisions` | Decision log with Smart IDs, categories, and impact areas |
| `risks` | Risk/issue register with severity assessment |
| `evidence` | Transcript evidence for traceability |
| `proposed_change_sets` | Staging area for reviews (with lock) |
| `audit_logs` | Change audit trail |
| `llm_metrics` | LLM usage tracking |

### Google Drive Tables

| Table | Purpose |
|-------|---------|
| `drive_watched_folders` | Folders being monitored per user |
| `drive_processed_files` | Track processed files to prevent duplicates |
| `drive_webhook_channels` | Active webhook channels (24h expiration) |

### Vector Configuration

- Extension: pgvector
- Index: HNSW on embedding columns
- Tables with embeddings: action_items, decisions, risks

---

## 14. LLM Output Contract

The LLM must return valid JSON conforming to schema version `pmo_tool.v1`.

See [contracts/llm-output-schema.md](contracts/llm-output-schema.md) for the complete JSON schema specification.

---

## 15. UI/UX Design

### Liquid Glass Design System

Premium glassmorphism aesthetic with:
- Frosted glass containers with backdrop blur
- Elevated cards with hover effects
- Layered shadows (shadow-glass, shadow-card-elevated, glow effects)
- Smooth animations (scale, fade, float, shimmer)
- Glowing status indicators with pulse animations

### Layout

- Responsive 2-column layout (sidebar + main content)
- Review UI shows evidence inline
- Quick actions for accept/reject/edit
- Duplicate highlights in review

---

## 16. Monitoring and Observability

| Metric | Target | Alert |
|--------|--------|-------|
| Interactive latency (UI/API) | p95 < 2s | On spikes |
| Processing latency (pipeline) | < 60s typical | On elevated failures |
| Fallback usage | < 15% | Circuit breaker alert |

---

## 17. Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.5 | Jan 4, 2026 | Added milestones overhaul, decision log enhancements, Google Drive auto-ingestion, action item update detection |
| 2.4 | Dec 15, 2025 | Initial approved build specification |

---

## Appendices

- [Technical Specifications](contracts/) - Enums, data model, LLM schema
- [Integration Guides](../docs/integrations/) - Google Calendar, Google Drive setup
- [Deployment Guide](../docs/deployment.md) - Cloud Run, Vercel configuration
