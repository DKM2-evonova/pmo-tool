# Technology Stack and Constraints (MUST)

## Deployment / Tenancy
- The application **MUST** be deployed as **single-tenant** (one standalone deployment per client organization).
- The MVP **MUST NOT** include multi-tenant shared hosting assumptions or cross-tenant data access.

## Frontend
- The UI **MUST** be built with **Next.js + Tailwind**.
- The UI **MUST** be deployed on **Google Cloud Run**.

## Backend / Database
- The backend **MUST** use **Supabase (Postgres)**.
- The backend **MUST** enforce **Row-Level Security (RLS)** for project-scoped access.
- Semantic matching **MUST** use **pgvector**.

## LLM Strategy (fixed)
- **Primary LLM**: Gemini 3 Pro Preview (recaps/decisions/risk analysis).
- **Fallback LLM**: OpenAI GPT-4o (used if Gemini fails).
- **Utility LLM**: Gemini Flash (formatting/JSON validation/repair).

## Cost Circuit Breaker (MUST)
- The system **MUST** notify Admin if **fallback usage exceeds 15%** of total LLM requests in a **rolling 24-hour window**.

## Scope Constraints (MVP)
- Exports **MUST** be **local download only** (no Drive/OneDrive write-back).
- The system **MUST** support transcript ingestion via:
  - Google Meet API (when available)
  - Manual uploads: VTT, TXT, DOCX, **text-based PDF**
  - Paste transcript text
- Transcript selection **MUST** be explicit (user selects transcript/file). Calendar selection is out of scope for MVP.
- Authentication **MUST** allow any email domain; SSO via Google/Microsoft (if enabled) with Supabase Auth.
- Language **MUST** be English-only.
- Notifications (email/push on assignments) **MUST NOT** be included in MVP.
- Project plans **MUST NOT** include Gantt / full dependency tracking in MVP; milestones are simple date fields.
