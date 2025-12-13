# Evidence, Audit, and Core Data Model (MUST)

## Evidence and traceability (MUST)
- Every extracted item **MUST** include `evidence` entries referencing transcript text (quote) and when available, timestamp + speaker.
- Evidence **MUST** be displayed in Review UI next to each proposed change.
- After Publish, evidence **MUST** be persisted for the associated entity and linked to `source_meeting_id` and `meeting_id`.

## Auditability (MUST)
- Publish **MUST** link all created/updated entities to the source meeting via `source_meeting_id`.
- Changes **SHOULD** write to `audit_logs` including before/after JSON and acting user.

## Core tables (logical schema summary)
- `profiles`: `id`, `email`, `full_name`, `global_role` (admin|consultant|program_manager)
- `projects`: `id`, `name`, `milestones` (jsonb)
- `project_members`: `project_id`, `user_id`, `project_role` (owner|member) — used for RLS
- `meetings`: `id`, `project_id`, `transcript_text`, `category`, `status` (Draft|Processing|Review|Published|Failed), `created_at`, `processed_at`
- `action_items`: `id`, `project_id`, `title`, `description`, `status`, `owner_user_id`, `due_date`, `embedding` (vector), `source_meeting_id`, `created_at`, `updated_at`
- `decisions`: `id`, `project_id`, `title`, `rationale`, `impact`, `decision_maker_user_id`, `outcome`, `embedding` (vector), `source_meeting_id`, `created_at`, `updated_at`
- `risks`: `id`, `project_id`, `title`, `description`, `probability`, `impact`, `mitigation`, `status`, `owner_user_id`, `embedding` (vector), `source_meeting_id`, `created_at`, `updated_at`
- `evidence`: `id`, `entity_type` (action_item|decision|risk), `entity_id`, `meeting_id`, `quote`, `speaker`, `timestamp`, `created_at`
- `proposed_change_sets`: `id`, `meeting_id`, `proposed_items` (jsonb), `locked_by_user_id`, `locked_at`, `lock_version`
- `audit_logs`: `id`, `user_id`, `action_type`, `entity_type`, `entity_id`, `before` (jsonb), `after` (jsonb), `timestamp`
