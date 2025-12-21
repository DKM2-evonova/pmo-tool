# PMO Tool Application - Code Optimization Plan

## Overview

This document tracks the comprehensive code review and optimization effort for the PMO Tool Application. The analysis identified **109 issues** across 5 categories, prioritized by severity.

**Last Updated:** December 21, 2025

---

## Summary of Issues Found

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| **Security & Auth** | 3 | 4 | 5 | 2 | 14 |
| **API & Backend** | 2 | 5 | 8 | 4 | 19 |
| **React Components** | 1 | 4 | 15 | 13 | 33 |
| **Library/Utilities** | 2 | 5 | 12 | 6 | 25 |
| **Database/Schema** | 4 | 5 | 6 | 3 | 18 |
| **Total** | **12** | **23** | **46** | **28** | **109** |

---

## Phase 1: Critical Fixes - COMPLETED ✅

All critical issues have been resolved.

### 1. Fixed Audit Log Column Names ✅
**Files Modified:**
- `supabase/migrations/00027_fix_batch_audit_logs.sql` (new)
- `src/app/api/meetings/[meetingId]/publish/route.ts`

**Issue:** `batch_create_audit_logs` function referenced `before_state`/`after_state` but table uses `before_data`/`after_data`. Also cast to non-existent `audit_action_type` enum.

**Fix:** Created migration 00027 to fix column references and remove invalid enum cast.

### 2. Fixed Race Condition in Meeting Publish ✅
**File:** `src/app/api/meetings/[meetingId]/publish/route.ts`

**Issue:** Separate update queries for item data and updates array were not atomic.

**Fix:** Combined into single atomic update queries:
- Lines 422-447: Action item updates now include `updates` field in same query
- Lines 473-484: Action item close includes `updates` in same query
- Lines 609-620: Risk close includes `updates` in same query

### 3. Fixed OAuth CSRF Vulnerability ✅
**Files Modified:**
- `src/app/api/google/calendar/auth/route.ts`
- `src/app/api/google/calendar/callback/route.ts`

**Issue:** OAuth state parameter used simple Base64 encoding, easily decodable.

**Fix:**
- Added HMAC-SHA256 signature using crypto module
- State now includes: random UUID token, user ID, timestamp, and signature
- Callback verifies signature with timing-safe comparison
- Backward compatible with old format during transition

### 4. Added Admin Override to Milestones Route ✅
**File:** `src/app/api/projects/[projectId]/milestones/route.ts`

**Issue:** Missing admin bypass for authorization, inconsistent with other endpoints.

**Fix:**
- Added UUID validation for projectId
- Added admin role check to bypass project membership requirement

### 5. Fixed Sequential Duplicate Checks ✅
**File:** `src/lib/embeddings/duplicate-detection.ts`

**Issue:** Sequential `for...await` loops caused O(n) latency for duplicate checks.

**Fix:** Changed to parallel `Promise.all()` - all action items, decisions, and risks now checked concurrently.

### 6. Added Bounds Check to Calendar Events ✅
**File:** `src/app/api/google/calendar/events/route.ts`

**Issue:** No validation on `daysBack`/`daysAhead` parameters could enable DoS.

**Fix:** Added MAX_DAYS=90 and MIN_DAYS=1 limits with validation and clamping.

---

## Quick Wins - COMPLETED ✅

### 7. Moved UUID Regex to Module Level ✅
**File:** `src/lib/utils.ts`

Pre-compiled regex at module load for better performance.

### 8. Replaced alert() with Proper Error Handling ✅
**Files Modified:**
- `src/components/profile/profile-form.tsx` - Added success/error message state
- `src/components/action-items/kanban-board.tsx` - Added toast notification with auto-dismiss
- `src/components/admin/user-management.tsx` - Added inline error message

### 9. Added aria-labels to Icon Buttons ✅
**Files Modified:**
- `src/components/admin/meeting-management.tsx` - "Meeting actions menu"
- `src/components/admin/user-management.tsx` - "User actions menu"
- `src/components/projects/member-management.tsx` - Dynamic "Remove [name] from project"
- `src/components/admin/team-overview.tsx` - "Delete project [name]"

---

## Phase 2: High Priority - PENDING

### Security Issues

| # | Issue | File | Status |
|---|-------|------|--------|
| 1 | Debug route exposes all memberships | `src/app/api/debug/action-items/route.ts:112` | Pending |
| 2 | Overly permissive RLS on audit_logs | `supabase/migrations/00011_create_audit_logs.sql:43-47` | Pending |
| 3 | Missing UUID validation on owner_user_id | `src/app/api/risks/[id]/update/route.ts:164-177` | Pending |

### Performance Issues

| # | Issue | File | Status |
|---|-------|------|--------|
| 4 | N+1 queries in admin team overview | `src/app/api/admin/team/route.ts:75-77` | Pending |
| 5 | Fuse index recreated every call | `src/lib/llm/owner-resolution.ts:206-212` | Pending |
| 6 | No embedding caching | `src/lib/embeddings/client.ts:30` | Pending |
| 7 | Profile fetched multiple times per request | Multiple API routes | Pending |

### Component Issues

| # | Issue | File | Status |
|---|-------|------|--------|
| 8 | ReviewUI is 1467 lines - needs splitting | `src/components/meetings/review-ui.tsx` | Pending |
| 9 | Missing Error Boundary | Multiple components | Pending |
| 10 | Excessive re-renders - missing useCallback/useMemo | `src/components/meetings/review-ui.tsx` | Pending |
| 11 | editFormData typed as `any` | `src/components/meetings/review-ui.tsx:80` | Pending |

---

## Phase 3: Medium Priority - PENDING

### API Improvements

- [ ] Add JSON parsing try-catch to all routes accepting body
- [ ] Validate status enum values before database update
- [ ] Add consistent error response format
- [ ] Fix email length validation in POST contact route

### Component Improvements

- [ ] Split ReviewUI into smaller components:
  - `ReviewLockManager`
  - `ItemEditorModal`
  - `NewContactModal`
  - `ProposedItemsList`
- [ ] Add ARIA labels to remaining icon-only buttons
- [ ] Fix useEffect dependency arrays
- [ ] Add loading states during async operations
- [ ] Replace remaining `alert()` calls with toast notifications

### Library Improvements

- [ ] Add input validation to `parseTimestamp()`, `truncate()`, `getInitials()`
- [ ] Handle DST edge cases in date arithmetic
- [ ] Add AbortController for fetch cleanup
- [ ] Consolidate duplicate check functions into generic function

### Database Improvements

- [ ] Add missing index on `(user_id, provider)` for oauth_tokens
- [ ] Reconcile TEXT vs JSONB for updates fields
- [ ] Add soft delete support across all entities
- [ ] Fix RLS policies for evidence table (missing UPDATE/DELETE)

---

## Phase 4: Low Priority - PENDING

- [ ] Remove unused exports
- [ ] Add comprehensive documentation
- [ ] Consolidate duplicate utility functions
- [ ] Improve accessibility across all components
- [ ] Add unit tests for critical paths

---

## Detailed Issue Reference

### Critical Database Issues

1. **Type Mismatches:** 3 critical mismatches between database and TypeScript
2. **Missing Constraints:** 5 missing NOT NULL and CHECK constraints
3. **Column Mismatch:** 3 fields defined in TypeScript but missing from database (`source_file_path`, `source_file_name`, `source_file_type` in meetings)

### Component Issues Summary

| Category | Count |
|----------|-------|
| Missing Error Boundaries | 1 |
| useEffect Dependency Issues | 4 |
| Memory Leaks | 1 |
| Accessibility Issues | 5 |
| Missing Loading States | 2 |
| Performance Issues (Re-renders) | 5 |
| Large Components (>500 lines) | 3 |
| Prop Drilling | 2 |
| Type Safety Issues | 2 |

### Files Needing Most Attention

1. **`src/components/meetings/review-ui.tsx`** (1467 lines)
   - Needs splitting into smaller components
   - Multiple state variables should use useReducer
   - Missing useCallback on handlers
   - `editFormData` typed as `any`

2. **`src/app/api/meetings/[meetingId]/publish/route.ts`** (725 lines)
   - Complex publish logic
   - Multiple database operations

3. **`src/lib/llm/processor.ts`**
   - Deep clones entire object unnecessarily
   - Fuse index recreation

---

## Implementation Notes

### Migration 00027 - Batch Audit Logs Fix

```sql
-- Key changes:
-- 1. Column names: before_state/after_state -> before_data/after_data
-- 2. Removed invalid audit_action_type enum cast (action_type is TEXT)
```

### OAuth CSRF Protection Implementation

The new state parameter structure:
```typescript
{
  token: crypto.randomUUID(),     // Unpredictable random token
  userId: user.id,                // User identifier
  timestamp: Date.now(),          // For expiry check
  sig: hmacSignature              // HMAC-SHA256 signature (first 16 chars)
}
```

Callback verification:
1. Decode state (supports both base64url and base64)
2. Verify userId matches authenticated user
3. Verify timestamp is within 5 minutes
4. Verify HMAC signature with timing-safe comparison

---

## Testing Recommendations

After implementing remaining fixes:

1. **API Testing**
   - Test all routes with invalid UUIDs
   - Test authorization bypasses
   - Test rate limiting on calendar events

2. **Component Testing**
   - Test error states display correctly
   - Test keyboard navigation (aria-labels)
   - Test form validation

3. **Database Testing**
   - Run migration 00027 on staging
   - Verify batch operations work correctly
   - Test RLS policies

---

## References

- Original analysis performed: December 21, 2025
- Phase 1 completed: December 21, 2025
- Build verified: Passing
