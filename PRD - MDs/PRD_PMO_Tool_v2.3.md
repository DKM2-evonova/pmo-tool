# Product Requirements Document (PRD): PMO Tool

- **Version**: 2.3
- **Date**: December 13, 2025
- **Status**: Approved for Build
- **Version Control**: Hosted on GitHub

## 1. Overview

The PMO Tool is an automation layer that sits on top of an organization's existing work management ecosystem. It converts meeting conversations into structured project data (action items, risks/issues, decisions, recaps, tone) and reusable artifacts, reducing the time Project Consultants and Program/Portfolio Managers spend on 'work about work'.
- Core Loop: Ingest (Transcript) -> Interpret (LLM) -> Action (Structured Data).
- Deployment Model: Single-tenant (standalone deployment per client organization).
- Intelligence Strategy: Context-aware updates. The system passes existing open items into the LLM to favor UPDATE/CLOSE over CREATE and to reduce duplicates.
**Success Metrics**
- Efficiency: reduction in time spent on administrative tasks (measured via user surveys).
- Adoption: daily active usage by Project Consultants.
- Accuracy: 90%+ acceptance rate of LLM-generated logs without manual editing.
- Latency: end-to-end meeting processing complete in < 60 seconds for typical transcripts.
- Predictability: improvements in project delivery signals.

## 2. Roadmap (Agentic Vibe Coding)

- Phase 1: Core data scaffolding and authentication (MVP).
- Phase 2: Ingestion pipeline (Google Meet API + manual transcript uploads) (MVP).
- Phase 3: Context-aware extraction and semantic matching (MVP).
- Phase 4: Review UI and state management (MVP).
- Phase 5: Artifacts and exports (MVP).
- Phase 6: Advanced features (V2): dashboards, historical reporting, and direct cloud-drive integrations.

## 3. Assumptions and Scope

- Ecosystem: Integrations focus on Google Workspace and Microsoft 365, but meeting ingestion supports any platform via manual transcript upload.
- Exports: MVP supports local download only (no direct Drive/OneDrive writes). Users may choose Office-optimized or Google-optimized export templates.
- Tenancy: single tenant. The application is deployed independently for one organization.
- Project Plans: no Gantt charts or full dependency tracking in MVP. Milestones are simple date fields.
- LLM Context: the system is context-aware and injects existing open items during processing.
- Authentication: any email domain is allowed; SSO via Google/Microsoft (if enabled) with Supabase Auth.
- Language: English only.
- Notifications: excluded from MVP (no email/push when items are assigned). V2 feature.

## 4. Technology Stack and Constraints

- Frontend: Next.js + Tailwind (UI), deployed on Google Cloud Run.
- Backend: Supabase (Postgres + RLS) with pgvector for semantic matching.
- Primary LLM: Gemini 3 Pro Preview (recaps, decisions, risk analysis).
- Fallback LLM: OpenAI GPT-4o (used if Gemini fails).
- Utility LLM: Gemini Flash (formatting, JSON validation).
- Circuit breaker (cost control): notify Admin if fallback usage exceeds 15% of total LLM requests in a rolling 24-hour window.

## 5. Integrations

- Google Meet API (MVP): fetch transcript and attendee metadata automatically when available.
- Manual transcript upload (MVP): support VTT, TXT, DOCX, and text-based PDF; user may also paste transcript text.
- Attendees (MVP): user can paste an attendee list when metadata is missing (e.g., non-Meet transcripts).
- Transcript selection (MVP): user selects a transcript/file to ingest (calendar selection is out of scope for MVP).
- Exports (MVP): browser-triggered local downloads (CSV/DOCX/PDF) using Office-optimized or Google-optimized templates.

## 6. Personas

| Persona | Role Summary | Primary Goals | Key Workflows |
| --- | --- | --- | --- |
| Project Consultant | Runs initiatives day-to-day. | Convert meetings into actions; maintain execution hygiene. | Upload transcripts; review proposed changes; publish updates; manage action items. |
| Program/Portfolio Manager | Oversees multiple projects. | Portfolio visibility; consistent reporting. | Consume rollups; review risks/issues; publish meeting updates for assigned projects. |
| Tool Admin | Configures standards and access. | Standardize artifacts; manage permissions. | Create/manage projects; manage membership/RBAC; manage settings; view audit logs; respond to alerts. |

## 7. Meeting Categories and Output Packs

- Project Meetings: recap; update risk/issue log; update action item log.
- Governance: recap; decision log (outcome required); strategic risks.
- Discovery: detailed recap; update action/decision logs.
- Alignment: recap; meeting tone.
- Remediation: detailed recap; fishbone artifact; update RAID.
Note: The five categories above are fixed for MVP (no additional meeting sub-types).

## 8. Key Product Decisions and Logic

8.1 Owner identity resolution
Goal: assign owners consistently using the best available signal and fall back to user verification when uncertain.
- 1) Direct match: map email from Meet API or pasted attendee list to a profile.user_id.
- 2) Email inference (best effort): if a transcript contains a clear person name and the meeting metadata includes invites, attempt name-to-email association using invite display names.
- 3) Conference-room heuristic: if a transcript identifies a single speaker responding as a room device and only one attendee is present, infer the attendee as the owner; if multiple in-room participants are detected, set owner to 'Conference Room' (requires manual assignment).
- 4) Fuzzy match: attempt fuzzy match of person name against the project roster; any fuzzy match must be surfaced as 'Needs confirmation' in Review UI.
- 5) Ambiguous: if multiple matches exist, show as 'Ambiguous Owner' and require manual selection before Publish.
- 6) Fallback: assign to 'Unknown' and require manual resolution in Review UI for publishable items.
8.2 Context-aware processing and semantic matching
- Pre-fetch: load ALL open action items, risks/issues, and decisions for the selected project prior to LLM processing.
- Context injection: pass open items to the LLM to favor UPDATE/CLOSE over CREATE.
- Closure inference: model may propose CLOSE when language indicates completion (e.g., 'done', 'completed', 'shipped'), but evidence is still required.
- Token-limit handling: if injecting all items exceeds context length, process in batches (multi-pass) and merge results deterministically.
- Semantic duplicate detection: generate embeddings for newly proposed items and flag as 'Potential Duplicate' if similarity > 0.85 (threshold adjustable).
- Embedding lifecycle: embeddings are generated or regenerated on Publish; any update to description requires embedding refresh.
8.3 Evidence and traceability
All LLM-extracted items must include evidence to support reviewer trust and auditability.
- Each proposed item includes 1..N evidence snippets referencing transcript text (quote) and, when available, timestamp and speaker.
- Evidence is displayed in the Review UI next to each proposed change.
- After Publish, evidence is persisted for the associated entity (action item / risk / decision) and linked to source_meeting_id.
8.4 LLM output contract (canonical JSON)
The LLM must return JSON conforming to a versioned schema. The backend validates the payload and rejects/repairs invalid structures using the utility model.
```json
{
 "schema_version": "pmo_tool.v1",
 "meeting": {
   "category": "Project|Governance|Discovery|Alignment|Remediation",
   "title": "string",
   "date": "YYYY-MM-DD",
   "attendees": [{"name": "string", "email": "string|null"}]
 },
 "recap": {"summary": "string", "highlights": ["string"]},
 "tone": {
   "overall": "string",
   "participants": [{"name": "string", "tone": "string", "happiness": "Low|Med|High", "buy_in": "Low|Med|High"}]
 },
 "action_items": [
   {
     "operation": "create|update|close",
     "external_id": "string|null",
     "title": "string",
     "description": "string",
     "status": "Open|In Progress|Closed",
     "owner": {"name": "string", "email": "string|null"},
     "due_date": "YYYY-MM-DD|null",
     "evidence": [{"quote": "string", "speaker": "string|null", "timestamp": "HH:MM:SS|null"}]
   }
```

],
"decisions": [
```json
{
     "operation": "create|update",
     "title": "string",
     "rationale": "string",
     "impact": "string",
     "decision_maker": {"name": "string", "email": "string|null"},
     "outcome": "string",
     "evidence": [{"quote": "string", "speaker": "string|null", "timestamp": "HH:MM:SS|null"}]
   }
```

],
"risks": [
```json
{
     "operation": "create|update|close",
     "title": "string",
     "description": "string",
     "probability": "Low|Med|High",
     "impact": "Low|Med|High",
     "mitigation": "string",
     "owner": {"name": "string", "email": "string|null"},
     "status": "Open|In Progress|Closed",
     "evidence": [{"quote": "string", "speaker": "string|null", "timestamp": "HH:MM:SS|null"}]
   }
```

],
"fishbone": {
"enabled": true,
"outline": {
"problem_statement": "string",
"categories": [{"name": "string", "causes": ["string"]}]
},
"rendered": {"format": "svg", "payload": "string"}
}
}
8.5 Concurrency control
- Proposed changes are stored as a proposed_change_set per meeting.
- Only one user may enter Review/Edit mode for a given change set at a time (optimistic lock).
- Lock TTL: 30 minutes (auto-release on inactivity). Admin may force-unlock.
- If locked, other users see: 'Locked by [User Name] currently reviewing.'
8.6 Privacy, project scoping, and RBAC
Visibility is strictly project-scoped via row-level security. A user only sees projects they are assigned to, except Admin who can manage all projects within the tenant.

| Capability | Admin | Project Consultant | Program/Portfolio Manager |
| --- | --- | --- | --- |
| Create projects / delete projects | Yes | No | No |
| Manage members / RBAC / force unlock | Yes | No | No |
| Ingest transcript / run processing | Yes | Yes | Yes |
| Review proposed changes | Yes | Yes | Yes |
| Publish meeting updates | Yes | Yes | Yes |
| View audit logs / monitoring alerts | Yes | Read-only (project-scoped) | Read-only (project-scoped) |

1. Select Project: user selects the target Project from a dropdown of assigned projects.
2. Ingest: user connects via Google Meet API OR uploads a transcript file (VTT/TXT/DOCX/text-based PDF) and optionally pastes attendee list.
3. Select Category: user selects 1 of 5 meeting categories.
4. Context Load: backend fetches all open items for the project (action items, risks/issues, decisions).
5. LLM Processing: primary model generates a JSON payload per the canonical schema; utility model validates/repairs JSON; fallback model is used on primary failure.
6. Vector Check: backend runs embedding + similarity checks for potential duplicates.
7. Review UI (Staging Area): user validates proposed changes, with evidence displayed. User may accept, reject, edit fields, merge duplicates, or convert operations (e.g., update -> create) as needed.
8. Publish: Admin, Project Consultant, or Program/Portfolio Manager commits the change set; updates are applied to live DB tables; embeddings are generated/refreshed; meeting status set to Published; all entities link to source_meeting_id for auditability.

## 10. Use Cases and User Stories

10.1 Epic A - Access, Projects and GitHub (MVP)
- US-A1: Repo setup on GitHub with CI/CD to Cloud Run.
- US-A2: Sign in with Supabase Auth (Google/Microsoft).
- US-A3: Create Project and Members: As an Admin, I can create a project and assign members; users only see projects they are assigned to.
10.2 Epic B - Ingestion (Context-Aware) (MVP)
- US-B1: Select Project and Transcript: As a user, I select a target project, then select a transcript source (Meet API or uploaded file) to ingest.
- US-B2: Upload with Attendee Input: As a user, I can upload a transcript and paste an attendee list when metadata is missing.
- US-B3: Category Selection: As a user, I select 1 of 5 categories.
- US-B4: Context-Aware Extraction: System fetches open project items; LLM outputs schema-valid JSON with evidence.
10.3 Epic C - Review and Publish (MVP)
- US-C1: Staging Area: UI displays proposed changes grouped by entity type and operation (create/update/close).
- US-C2: Semantic Duplicate Detection: warning if vector similarity > 0.85, with suggested match candidates.
- US-C3: Publish and Link: commit changes; all entities retain a foreign key to source_meeting_id and persist evidence for auditability.
- US-C4: Concurrency Lock: prevent multiple users from editing the same staging area simultaneously; support Admin force-unlock.
10.4 Epic D - Action Items and Kanban (MVP)
- US-D1: Action Item Log: auto-updated from meetings and editable by users with access.
- US-D2: Kanban Board: columns map to statuses Open, In Progress, Closed.
- US-D3: Manual Task Creation: as a user, I can manually create a task (not from a meeting) and the system generates its embedding and audit trail.
10.5 Epic E - Decisions and Risks/Issues (V1)
- US-E1: Decision Log: rationale, impact, decision maker, outcome, and evidence.
- US-E2: RAID Log: probability, impact, mitigation, status, and evidence.
10.6 Epic F - Reporting (V1)
- US-F1: Generate recaps and tone analysis for a meeting.
- US-F2: Fishbone artifact outputs both a structured outline and a rendered diagram (SVG) for remediation meetings.
- US-F3: Local exports (CSV/DOCX/PDF) with Office-optimized or Google-optimized templates.
**10.7 Epic H - Error Handling**
- US-H1: LLM Fallback: failover to GPT-4o if Gemini fails; notify Admin if fallback usage exceeds 15% over rolling 24 hours.
- US-H2: Invalid JSON: utility model attempts repair; if still invalid, mark meeting status Failed with actionable error message.

## 11. UI/UX Styling Guide

- Aesthetic: clean enterprise; minimalist, high contrast.
- Layout: responsive 2-column (sidebar + main content).
- Review UI: show evidence inline; quick actions for accept/reject/edit; highlight duplicates.
- Kanban cards: clean card with status indicator and owner.

## 12. Data Architecture (Supabase)

12.1 Core tables (logical model)
- profiles: id, email, full_name, global_role (admin|consultant|program_manager).
- projects: id, name, milestones (jsonb).
- project_members: project_id, user_id, project_role (owner|member). Used for RLS policies (Admin is owner by default).
- meetings: id, project_id, transcript_text, category, status (Draft|Processing|Review|Published|Failed), created_at, processed_at.
- action_items: id, project_id, title, description, status (Open|In Progress|Closed), owner_user_id, due_date, embedding (vector), source_meeting_id (FK nullable), created_at, updated_at.
- decisions: id, project_id, title, rationale, impact, decision_maker_user_id, outcome, embedding (vector), source_meeting_id (FK), created_at, updated_at.
- risks: id, project_id, title, description, probability, impact, mitigation, status, owner_user_id, embedding (vector), source_meeting_id (FK), created_at, updated_at.
- evidence: id, entity_type (action_item|decision|risk), entity_id, meeting_id, quote, speaker, timestamp, created_at.
- proposed_change_sets: id, meeting_id, proposed_items (jsonb), locked_by_user_id (FK), locked_at (timestamp), lock_version (int).
- audit_logs: id, user_id, action_type, entity_type, entity_id, before (jsonb), after (jsonb), timestamp.
12.2 Vector configuration
- Enable pgvector extension.
- Create HNSW index on embedding columns for action_items, decisions, and risks.
- Embedding model: configurable; choose a single model per deployment and persist vectors at a consistent dimension.

## 13. Monitoring and Observability

Monitoring distinguishes interactive latency from end-to-end meeting processing latency.
- Interactive latency (UI/API): p95 < 2s for standard UI/API requests (alerts on spikes).
- Processing latency (pipeline): end-to-end meeting processing target < 60s for typical transcripts (tracked separately).
- Error rate: alert on elevated processing failures.
- Cost control: notify Admin if fallback model usage > 15% of total requests over rolling 24 hours.
