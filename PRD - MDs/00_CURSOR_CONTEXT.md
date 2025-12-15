# PMO Tool — Cursor Context Pack (Authoritative)

This folder contains **authoritative constraints** distilled from the PRD. Its purpose is to prevent re-interpretation and keep implementation decisions consistent across sessions.

## Precedence (conflict resolution)
1) **This Context Pack** (enums/contracts/must-rules)
2) PRD (v2.4, 2025-12-15)
3) Codebase implementation details

## Non-negotiables (summary)
- **Single-tenant deployment** (one standalone deployment per client org).
- **MVP exports are local download only** (no direct Drive/OneDrive writes).
- **Meeting categories are fixed**: Project, Governance, Discovery, Alignment, Remediation.
- **Context-aware updates**: prefer UPDATE/CLOSE over CREATE by injecting existing open items.
- **Evidence required** for all extracted items (traceable to transcript text).
- **Tech stack is fixed** (Next.js/Tailwind on Cloud Run; Supabase Postgres+RLS+pgvector).
- **LLM strategy is fixed** (Primary Gemini 3 Pro Preview, Fallback GPT-4o, Utility Gemini Flash; 15% rolling 24h fallback circuit-breaker alert).

## How to use this pack in Cursor
- Treat each file as a **contract**: follow enums exactly; do not add new values.
- When generating code, keep your outputs consistent with the **LLM JSON contract** and **data model schemas**.
- If you need to add a new behavior not covered here, flag it as a **PRD change request** (don’t silently assume).

## Files
- `01_TECH_STACK_AND_CONSTRAINTS.md`
- `02_ENUMS_AND_CONSTANTS.md`
- `03_MEETING_CATEGORIES_AND_OUTPUT_RULES.md`
- `04_LLM_OUTPUT_CONTRACT_SCHEMA.md`
- `05_OWNER_IDENTITY_RESOLUTION.md`
- `06_CONTEXT_AWARE_MATCHING_AND_EMBEDDINGS.md`
- `07_PROCESSING_FLOW_AND_STATE_MACHINE.md`
- `08_RBAC_PRIVACY_AND_CONCURRENCY.md`
- `09_EVIDENCE_AUDIT_AND_DATA_MODEL.md`
