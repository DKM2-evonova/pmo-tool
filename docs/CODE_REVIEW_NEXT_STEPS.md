# Code Review Next Steps

**Review Date:** January 4, 2026
**Reviewer:** Claude Code

This document summarizes the remaining improvements identified during the holistic code review that were not yet addressed. Use this as a reference for future work.

---

## Completed Improvements (This Session)

| Commit | Type | Description |
|--------|------|-------------|
| `f0424bc` | fix | Use atomic RPC for risk status updates to prevent race conditions |
| `c4aff11` | refactor | Remove unused code and consolidate duplicate type definitions |
| `0957272` | feat | Add Google Meet transcript auto-import and improve LLM settings |
| `a062c7a` | refactor | Extract parseUpdatesArray into shared utility |
| `aefb9c3` | feat | Make LLM model names configurable via environment variables |

---

## Remaining Items (Backlog)

### Priority 1: Technical Debt

#### 1. Audit `.single()` Calls for Error Handling
**Files affected:** 27 API routes use `.single()` queries
**Issue:** Some `.single()` calls may not have proper error handling for cases where the record doesn't exist or multiple records are returned.
**Action:** Audit each usage and ensure proper error responses (404 for not found, 500 for unexpected multiples).

**Files to review:**
```
src/app/api/action-items/[id]/update/route.ts
src/app/api/decisions/[id]/route.ts
src/app/api/meetings/[meetingId]/route.ts
src/app/api/projects/[projectId]/route.ts
src/app/api/risks/[id]/update/route.ts
(+ 22 more)
```

#### 2. Add Error Boundaries Around Async UI Components
**Files affected:**
- `src/components/meetings/meeting-ingestion.tsx`
- `src/components/google/calendar-event-picker.tsx`

**Issue:** Calendar picker and meeting ingestion components fetch data asynchronously but don't have error boundaries to gracefully handle failures.
**Action:** Wrap these components in React Error Boundaries or add try-catch with user-friendly error states.

#### 3. Consolidate Database Migrations for Updates Column
**Migrations affected:**
- `00021_change_updates_to_text.sql`
- `00030_change_risk_updates_to_text.sql`
- `00037_fix_publish_updates_type.sql`
- `00038_fix_updates_type_to_text.sql`
- `00041_fix_append_update_function_permissions.sql`

**Issue:** Multiple migrations have changed the `updates` column type back and forth between TEXT and JSONB, creating confusion.
**Action:** Create a definitive migration that:
1. Documents the final intended column type
2. Ensures all `append_*_update` functions work correctly
3. Cleans up any legacy data format issues

---

### Priority 2: Code Quality

#### 4. Standardize Error Response Format
**Issue:** API routes have inconsistent error response formats. Some return `{ error: string }`, others return `{ message: string }`, and some include additional fields.
**Action:** Create a standard error response helper and use it consistently across all routes.

Example standard format:
```typescript
interface APIErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}
```

#### 5. Add Input Validation Library
**Issue:** Input validation is done manually in each route with repetitive code.
**Action:** Consider adding Zod for schema validation to reduce boilerplate and improve type safety.

#### 6. Review Unused `currentUserId` Prop
**Files affected:**
- `src/app/(dashboard)/action-items/[id]/action-item-detail.tsx`
- `src/app/(dashboard)/risks/[id]/risk-detail.tsx`

**Issue:** The `currentUserId` prop is passed to these components but may not be used.
**Action:** Verify if this prop is needed; if not, remove it from the interface and parent components.

---

### Priority 3: Performance

#### 7. Consider Caching for Project Members Query
**Files affected:** Multiple detail pages fetch project members on every load.
**Issue:** Project members rarely change but are fetched fresh on every page load.
**Action:** Consider implementing SWR or React Query for client-side caching, or use Next.js caching strategies.

#### 8. Optimize Supabase Queries with Indexes
**Action:** Review slow queries in Supabase dashboard and add appropriate indexes. Key tables to review:
- `action_items` (by project_id, owner_user_id, status)
- `risks` (by project_id, status)
- `decisions` (by project_id, status)
- `meetings` (by project_id, status)

---

### Priority 4: Security

#### 9. Audit RLS Policies
**Action:** Review Row Level Security policies to ensure:
- Users can only access their own data
- Project members can only access their projects
- Admin roles have appropriate elevated access
- No policies allow unintended data exposure

#### 10. Add Rate Limiting to API Routes
**Issue:** No rate limiting on API routes could allow abuse.
**Action:** Consider adding rate limiting middleware, especially for:
- LLM processing routes (expensive)
- Authentication routes
- File upload routes

---

## Environment Variables Reference

The following environment variables are now configurable:

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PRIMARY_MODEL` | `gemini-3-pro-preview` | Primary Gemini model for meeting processing |
| `LLM_FALLBACK_MODEL` | `gpt-5.2` | Fallback OpenAI model |
| `LLM_UTILITY_MODEL` | `gemini-2.0-flash` | Utility model for JSON repair |

---

## Quick Commands

```bash
# Run build to verify no type errors
npm run build

# Check for TypeScript errors without building
npx tsc --noEmit

# Run linter
npm run lint

# Check database migrations status
npx supabase db diff
```

---

## Files Changed in This Review

```
src/app/api/risks/[id]/update/route.ts           # Race condition fix
src/app/(dashboard)/action-items/[id]/action-item-detail.tsx
src/app/(dashboard)/action-items/[id]/page.tsx
src/app/(dashboard)/risks/[id]/page.tsx
src/app/(dashboard)/risks/[id]/risk-detail.tsx
src/app/api/action-items/[id]/update/route.ts
src/app/api/meetings/[meetingId]/publish/route.ts
src/lib/utils.ts                                  # Added parseUpdatesArray
src/lib/llm/client.ts                             # Configurable models
src/components/google/calendar-event-picker.tsx   # Refresh button
src/components/meetings/meeting-ingestion.tsx     # Transcript auto-import
```

---

*This document was generated during a code review session. Update as items are completed.*
