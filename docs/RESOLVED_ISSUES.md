# Resolved Issues Archive

This document archives historical debugging sessions and code review fixes that have been resolved. Kept for reference in case similar issues reoccur.

---

## December 2024 - Action Item Detail Page Issues (RESOLVED)

### Root Cause
1. **RLS Policy Conflicts** - Row-Level Security policies blocked access to detail pages
2. **Missing Database Migrations** - The `updates` column didn't exist in remote Supabase
3. **Client-Side Updates Blocked** - Direct database updates from client blocked by RLS

### Solution
- Switched to service client (bypasses RLS) for fetching action item data
- Applied migration: `ALTER TABLE action_items ADD COLUMN IF NOT EXISTS updates JSONB DEFAULT '[]'::jsonb;`
- Created API routes (`/api/action-items/[id]/update`) using service client
- Moved all action item updates to server-side API routes

### Key Files
- [action-items/[id]/page.tsx](../src/app/(dashboard)/action-items/[id]/page.tsx) - Service client implementation
- [action-items/[id]/update/route.ts](../src/app/api/action-items/[id]/update/route.ts) - Update API route

### Quick Diagnosis (if issues reoccur)
1. Check browser console for RLS errors
2. Verify database has `updates` column: `SELECT updates FROM action_items LIMIT 1;`
3. Test with service client vs regular client
4. Refresh schema: `NOTIFY pgrst, 'reload schema';`

---

## December 14-15, 2024 - Code Review Fixes (RESOLVED)

### Critical Issues Fixed

| Issue | Location | Fix |
|-------|----------|-----|
| Debug route missing admin auth | `api/debug/action-items/route.ts` | Added admin role check |
| Missing auth on update routes | `api/action-items/[id]/update`, `api/risks/[id]/update` | Added project membership verification |
| Deprecated `.substr()` | Update routes | Replaced with `.slice()` |
| Debug seed route unprotected | `api/debug/seed/route.ts` | Added auth + admin check |

### High Priority Issues Fixed

| Issue | Fix |
|-------|-----|
| Unused auth error in middleware | Added error handling + redirect |
| Excessive `any[]` types | Added `StatusUpdate`, `UpdateActionItemData`, `UpdateRiskData` interfaces |
| N+1 query in detail pages | Replaced loop-based fetching with single join query |
| Console logging in production | Implemented structured logger (`src/lib/logger.ts`) |

### Race Condition & Lock Fixes

| Issue | Fix |
|-------|-----|
| Race condition in publish route | Lock now acquired atomically using `acquire_change_set_lock` RPC |
| Null pointer in lock check | Added null check for `locked_at` before creating Date |
| Hardcoded lock timeout | Moved to `LOCK_TIMEOUT_MINUTES` env variable |
| Missing auth in process route | Added authentication + project membership verification |

### Deferred Items (Future Work)
- Input validation with Zod (large refactor)
- Rate limiting (requires Upstash Redis)
- Transaction handling in publish route (requires Supabase DB functions)

---

## Lessons Learned

### Service Client vs Regular Client
- `createServerClient` from `@supabase/ssr` is for user sessions and may override service role keys
- Use `createClient` from `@supabase/supabase-js` for true service role (RLS bypass) access

### RLS Best Practices
- Complex RLS policies can create unexpected access issues with foreign key relationships
- Consider using service client for read operations, then manually verify access

### Migration Management
- Remote Supabase databases require manual migration application when not using CLI linking
- Always verify schema changes are applied: check for required columns before deploying
