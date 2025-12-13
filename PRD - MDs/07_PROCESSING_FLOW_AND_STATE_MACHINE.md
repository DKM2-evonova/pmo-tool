# Processing Flow and State Machine (MUST)

## Processing flow (system-level)
1) **Select Project**: user selects a project from assigned projects.
2) **Ingest**: user connects via Google Meet API OR uploads transcript (VTT/TXT/DOCX/text-based PDF) and may paste attendee list.
3) **Select Category**: user selects 1 of 5 meeting categories.
4) **Context Load**: backend fetches all open project items (action items, risks/issues, decisions).
5) **LLM Processing**: primary model generates canonical JSON; utility model validates/repairs; fallback used on primary failure.
6) **Vector Check**: embeddings + similarity checks for duplicates.
7) **Review UI (Staging Area)**: accept/reject/edit/merge/convert operations.
8) **Publish**: authorized user commits; updates applied to live tables; embeddings refreshed; meeting set to Published; entities link to `source_meeting_id`.

## Meeting status transitions (MUST)
- `Draft` -> `Processing` when ingestion begins
- `Processing` -> `Review` on successful canonical JSON + validation
- `Processing` -> `Failed` if JSON invalid and repair fails (or unrecoverable error)
- `Review` -> `Published` on publish commit
- `Review` -> `Failed` if unrecoverable publish/apply error occurs

## Proposed change sets (MUST)
- Proposed changes **MUST** be stored as a `proposed_change_set` per meeting before publish.
