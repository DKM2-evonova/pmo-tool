# PMO Tool Application - Code Optimization Plan

## Overview

This document tracks the comprehensive code review and optimization effort for the PMO Tool Application. The analysis identified **109 issues** across 5 categories, prioritized by severity.

**Last Updated:** December 21, 2025
**Phase 2 Completed:** December 21, 2025 (all items)
**Phase 3 Progress:** December 21, 2025 (majority completed)

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

## Phase 2: High Priority - COMPLETED ✅

### Security Issues

| # | Issue | File | Status |
|---|-------|------|--------|
| 1 | Debug routes disabled in production | `src/app/api/debug/**/*.ts` | ✅ Completed |
| 2 | Overly permissive RLS on audit_logs | `supabase/migrations/00028_fix_audit_logs_rls.sql` | ✅ Completed |
| 3 | Missing UUID validation on owner_user_id | `src/app/api/risks/[id]/update/route.ts` and `src/app/api/action-items/[id]/update/route.ts` | ✅ Completed |

### Performance Issues

| # | Issue | File | Status |
|---|-------|------|--------|
| 4 | N+1 queries in admin team overview | `src/app/api/admin/team/route.ts` - Using Maps for O(1) lookup | ✅ Completed |
| 5 | Fuse index recreated every call | `src/lib/llm/owner-resolution.ts` - Added caching with 1min TTL | ✅ Completed |
| 6 | No embedding caching | `src/lib/embeddings/client.ts` - Added LRU cache with 30min TTL | ✅ Completed |
| 7 | Profile fetched multiple times per request | `src/app/api/risks/[id]/update/route.ts` and `src/app/api/action-items/[id]/update/route.ts` - Single fetch with all fields | ✅ Completed |

### Component Issues

| # | Issue | File | Status |
|---|-------|------|--------|
| 8 | ReviewUI is 1467 lines - needs splitting | `src/components/meetings/review-ui.tsx` | ✅ Completed |
| 9 | Missing Error Boundary | `src/components/ui/error-boundary.tsx` | ✅ Completed |
| 10 | Excessive re-renders - missing useCallback/useMemo | `src/components/meetings/review-ui.tsx` | ✅ Completed |
| 11 | editFormData typed as `any` | `src/components/meetings/review-ui.tsx:80` | ✅ Completed |

---

## Phase 3: Medium Priority - PARTIALLY COMPLETED

### API Improvements

- [x] Add JSON parsing try-catch to all routes accepting body
- [x] Validate status enum values before database update
- [x] Add consistent error response format (already consistent)
- [x] Fix email length validation in POST contact route (already done)

### Component Improvements

- [x] Split ReviewUI into smaller components (done in Phase 2)
- [x] Add ARIA labels to remaining icon-only buttons (11 buttons fixed)
- [x] Fix useEffect dependency arrays (verified correct)
- [x] Add loading states during async operations (already present)
- [ ] Replace remaining `alert()` calls with toast notifications (28 occurrences, deferred)

### Library Improvements

- [x] Add input validation to `parseTimestamp()`, `truncate()`, `getInitials()`
- [ ] Handle DST edge cases in date arithmetic
- [ ] Add AbortController for fetch cleanup
- [ ] Consolidate duplicate check functions into generic function

### Database Improvements

- [x] Add missing index on `(user_id, provider)` for oauth_tokens (UNIQUE constraint provides this)
- [ ] Reconcile TEXT vs JSONB for updates fields
- [ ] Add soft delete support across all entities
- [x] Fix RLS policies for evidence table (missing UPDATE/DELETE) - Migration 00029

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
- Phase 2 completed: December 21, 2025
- Build verified: Passing

---

## Phase 2 Implementation Details

### 1. Debug Routes Production Protection
Added environment-based protection to all debug routes:
```typescript
if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_DEBUG_ROUTES) {
  return NextResponse.json({ error: 'Debug routes disabled in production' }, { status: 404 });
}
```

### 2. Audit Logs RLS Fix (Migration 00028)
Changed INSERT policy from `WITH CHECK (true)` to `WITH CHECK (false)`:
- Audit logs can only be inserted via SECURITY DEFINER functions or service role
- Regular authenticated users cannot directly insert audit logs

### 3. UUID Validation on owner_user_id
Added validation before database operations:
```typescript
if (owner_user_id && !isValidUUID(owner_user_id)) {
  return NextResponse.json({ error: 'Invalid owner_user_id format' }, { status: 400 });
}
```

### 4. Admin Team Route Optimization
Changed from O(n²) array filters to O(n) Map-based grouping:
```typescript
const membersByProject = new Map<string, typeof members>();
members?.forEach(m => {
  const existing = membersByProject.get(m.project_id) || [];
  existing.push(m);
  membersByProject.set(m.project_id, existing);
});
```

### 5. Fuse Index Caching
Added module-level cache with 1-minute TTL:
- Cache key based on member/contact IDs
- Automatic cleanup of stale entries
- Significant performance improvement for repeated owner resolution

### 6. Embedding Caching
Added LRU-style cache for OpenAI embeddings:
- 500 entry capacity with 30-minute TTL
- Works for both single and batch embedding generation
- Smart batching: only requests uncached embeddings from API
- Hash-based keys for long texts

### 7. Profile Fetch Optimization
Combined duplicate profile queries into single fetch:
- Before: Two separate queries for `global_role` and `full_name`
- After: Single query with `select('global_role, full_name')`

### 8. ReviewUI Component Split (1467 -> 901 lines)
Extracted large component into smaller, focused components:

**New files created in `src/components/meetings/review/`:**
- `types.ts` (55 lines) - Shared types: EditFormData, EditingItem, NewContactTarget, OwnerSelectOption
- `edit-item-modal.tsx` (147 lines) - Modal for editing action items, decisions, risks
- `new-contact-modal.tsx` (140 lines) - Modal for adding new contacts with similar name detection
- `lock-controls.tsx` (97 lines) - LockBanner and LockControls components
- `action-item-card.tsx` (184 lines) - Individual action item card with owner resolution
- `decision-card.tsx` (94 lines) - Individual decision card
- `risk-card.tsx` (179 lines) - Individual risk card with owner resolution
- `status-badges.tsx` (31 lines) - OperationBadge and ResolutionStatusBadge
- `index.ts` (8 lines) - Barrel exports

### 9. Error Boundary
Created reusable Error Boundary component:

**File:** `src/components/ui/error-boundary.tsx`
```typescript
// Class component with getDerivedStateFromError and componentDidCatch
// Features:
// - Custom fallback prop for specialized error UIs
// - onError callback for error reporting
// - "Try again" button with reset functionality
// - Expandable error details for debugging
// - withErrorBoundary HOC for easy component wrapping
```

### 10. Re-render Optimization
Added useCallback and useMemo throughout ReviewUI:
- All event handlers wrapped in useCallback with proper dependencies
- `ownerOptions` memoized with useMemo
- `unresolvedOwnerNames` computed with useMemo
- `canPublish` computed with useMemo
- Section toggle handlers memoized

### 11. Type Safety Fix
Changed `editFormData` from `any` to proper type:
```typescript
// Before
const [editFormData, setEditFormData] = useState<any>({});

// After
interface EditFormData {
  title?: string;
  description?: string;
  rationale?: string;
  outcome?: string;
  mitigation?: string;
}
const [editFormData, setEditFormData] = useState<EditFormData>({});
```

---

## Phase 3 Implementation Details

### 1. JSON Parsing Try-Catch
Added explicit JSON parsing error handling to all API routes accepting body:
- `src/app/api/action-items/[id]/update/route.ts`
- `src/app/api/risks/[id]/update/route.ts`
- `src/app/api/projects/[projectId]/milestones/route.ts`
- `src/app/api/projects/[projectId]/contacts/route.ts`
- `src/app/api/projects/[projectId]/contacts/[contactId]/route.ts`

Returns `{ error: 'Invalid JSON in request body' }` with status 400 for malformed JSON.

### 2. Status Enum Validation
Added validation for status, probability, and impact fields:
- Action items: Validates `EntityStatus` enum values (Open, In Progress, Closed)
- Risks: Validates `EntityStatus` for status, `RiskSeverity` for probability/impact (Low, Med, High)

### 3. ARIA Labels Added
Added `aria-label` attributes to 11 icon-only buttons:
- `src/components/layout/sidebar.tsx` - Toggle sidebar, Open/Close mobile menu
- `src/components/layout/header.tsx` - View notifications
- `src/components/ui/modal.tsx` - Close dialog
- `src/components/meetings/transcript-upload.tsx` - Clear transcript file
- `src/components/projects/project-form.tsx` - Remove milestone
- `src/components/projects/milestone-list.tsx` - Delete milestone
- `src/components/decisions/decisions-table.tsx` - View decision details
- `src/components/action-items/action-items-table.tsx` - View action item details

### 4. Utility Function Validation
Enhanced input validation in `src/lib/utils.ts`:

**parseTimestamp():**
- Validates input is non-empty string
- Checks for exactly 3 parts (HH:MM:SS)
- Validates no NaN or negative values
- Enforces minutes/seconds range (0-59)

**truncate():**
- Handles null/undefined input
- Handles maxLength < 4 gracefully

**getInitials():**
- Handles null/undefined input
- Trims whitespace
- Filters empty parts

### 5. Evidence RLS Policies (Migration 00029)
Added missing UPDATE and DELETE policies to evidence table:
- Project members can update/delete evidence for meetings in their projects
- Admins can update/delete any evidence

### 6. Remaining Items Deferred
- **Replace alert() calls:** 28 occurrences across 14 files - requires toast notification system
- **AbortController for fetch cleanup:** Requires component-by-component review
- **DST edge cases:** Low impact, needs careful testing
- **Consolidate duplicate check functions:** Refactoring task
