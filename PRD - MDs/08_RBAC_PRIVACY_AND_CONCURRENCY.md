# RBAC, Privacy, and Concurrency (MUST)

## Privacy / scope (MUST)
- Visibility is **strictly project-scoped** via Supabase RLS.
- A user **MUST** only see projects they are assigned to, except **Admin** who can manage all projects in the tenant.

## Capabilities (MUST)
- Create/delete projects: **Admin only**
- Manage members / RBAC / force unlock: **Admin only**
- Ingest transcript / run processing: **Admin, Project Consultant, Program/Portfolio Manager**
- Review proposed changes: **Admin, Project Consultant, Program/Portfolio Manager**
- Publish meeting updates: **Admin, Project Consultant, Program/Portfolio Manager**
- View audit logs / monitoring alerts: **Admin**; others are **read-only** and **project-scoped**

## Concurrency lock (MUST)
- Only one user may enter Review/Edit mode for a given proposed change set at a time (optimistic lock).
- Lock TTL **MUST** be **30 minutes**, auto-release on inactivity.
- Admin **MUST** be able to force-unlock.
- If locked, other users **MUST** see: `Locked by [User Name] currently reviewing.`
