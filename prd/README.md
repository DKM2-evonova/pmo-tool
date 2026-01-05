# Product Requirements Documents

This folder contains the authoritative product requirements and technical specifications for the PMO Tool.

---

## Document Hierarchy

When resolving conflicts, follow this precedence:

1. **Contracts** (enums, schemas, specifications) - Authoritative technical constraints
2. **PRD v2.5** - Current product requirements
3. **Codebase implementation** - Working code

---

## Current Version

| Document | Version | Date | Status |
|----------|---------|------|--------|
| [PRD_PMO_Tool_v2.5.md](PRD_PMO_Tool_v2.5.md) | 2.5 | Jan 4, 2026 | Current |
| [PRD_PMO_Tool_v2.4.md](PRD_PMO_Tool_v2.4.md) | 2.4 | Dec 15, 2025 | Archived |

---

## Technical Contracts

Authoritative specifications that must be followed exactly:

| Document | Description |
|----------|-------------|
| [contracts/llm-output-schema.md](contracts/llm-output-schema.md) | Canonical JSON schema for LLM output |
| [contracts/enums-and-constants.md](contracts/enums-and-constants.md) | All enum types and configuration constants |
| [contracts/technical-specifications.md](contracts/technical-specifications.md) | Tech stack, processing flow, RBAC, data model |

---

## Non-Negotiables

These constraints cannot be changed without a PRD revision:

- **Single-tenant deployment** (one standalone deployment per client org)
- **Meeting categories are fixed**: Project, Governance, Discovery, Alignment, Remediation
- **Evidence required** for all extracted items (traceable to transcript text)
- **Tech stack is fixed** (Next.js/Tailwind on Cloud Run; Supabase Postgres+RLS+pgvector)
- **LLM strategy is fixed** (Primary Gemini, Fallback GPT, Utility Gemini Flash)
- **Exports are local download only** (no Drive/OneDrive write-back in MVP)

---

## Version History

| Version | Date | Key Changes |
|---------|------|-------------|
| 2.5 | Jan 4, 2026 | Milestones overhaul (Gantt, dependencies), Decision Log 6 categories, Google Drive auto-ingestion, Action item update detection |
| 2.4 | Dec 15, 2025 | Initial approved build specification |

---

## How to Use

### For Developers

- Reference contracts when implementing features
- Do not add new enum values without PRD change request
- Follow the LLM output schema exactly
- Respect RBAC constraints in all API routes

### For AI Assistants

- Treat contract files as authoritative constraints
- Do not silently assume new behaviors not covered here
- Flag any deviation as a PRD change request

---

## Legacy Files

The following numbered files have been consolidated into the contracts folder and will be removed in a future cleanup:

- `00_CURSOR_CONTEXT.md` → See this README
- `01_TECH_STACK_AND_CONSTRAINTS.md` → See `contracts/technical-specifications.md`
- `02_ENUMS_AND_CONSTANTS.md` → See `contracts/enums-and-constants.md`
- `03_MEETING_CATEGORIES_AND_OUTPUT_RULES.md` → See `contracts/technical-specifications.md`
- `04_LLM_OUTPUT_CONTRACT_SCHEMA.md` → See `contracts/llm-output-schema.md`
- `05_OWNER_IDENTITY_RESOLUTION.md` → See `contracts/technical-specifications.md`
- `06_CONTEXT_AWARE_MATCHING_AND_EMBEDDINGS.md` → See `contracts/technical-specifications.md`
- `07_PROCESSING_FLOW_AND_STATE_MACHINE.md` → See `contracts/technical-specifications.md`
- `08_RBAC_PRIVACY_AND_CONCURRENCY.md` → See `contracts/technical-specifications.md`
- `09_EVIDENCE_AUDIT_AND_DATA_MODEL.md` → See `contracts/technical-specifications.md`
