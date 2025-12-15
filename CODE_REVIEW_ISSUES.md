# Code Review Issues Report

## Critical Issues

### 1. Security: Debug Route Missing Admin Authorization
**Location**: `src/app/api/debug/action-items/route.ts`

**Issue**: The debug route uses service client to bypass RLS and exposes sensitive data (all action items, projects, memberships) without checking if the user is an admin.

**Risk**: Any authenticated user can access all data across all projects.

**Fix**: Add admin role check before returning data:
```typescript
// Check if user is admin
const { data: profile } = await supabase
  .from('profiles')
  .select('global_role')
  .eq('id', user.id)
  .single();

if (profile?.global_role !== 'admin') {
  return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
}
```

---

### 2. Security: Missing Authorization Checks on Update Routes
**Locations**: 
- `src/app/api/action-items/[id]/update/route.ts`
- `src/app/api/risks/[id]/update/route.ts`

**Issue**: These routes use service client (bypasses RLS) but don't verify that the user has access to the project containing the action item/risk before allowing updates.

**Risk**: Users could potentially update action items or risks from projects they don't have access to.

**Fix**: Add project membership verification:
```typescript
// Get the action item/risk to check project access
const { data: item } = await serviceSupabase
  .from('action_items') // or 'risks'
  .select('project_id')
  .eq('id', id)
  .single();

if (!item) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// Verify user has access to the project
const { data: membership } = await supabase
  .from('project_members')
  .select('project_id')
  .eq('project_id', item.project_id)
  .eq('user_id', user.id)
  .single();

// Also check if user is admin
const { data: profile } = await supabase
  .from('profiles')
  .select('global_role')
  .eq('id', user.id)
  .single();

if (!membership && profile?.global_role !== 'admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

### 3. Deprecated Method: `.substr()` Usage
**Locations**:
- `src/app/api/action-items/[id]/update/route.ts:66`
- `src/app/api/risks/[id]/update/route.ts:68`

**Issue**: `.substr()` is deprecated and should be replaced with `.substring()` or `.slice()`.

**Fix**: Replace `.substr(2, 9)` with `.slice(2, 11)`:
```typescript
// Before
id: Date.now().toString() + Math.random().toString(36).substr(2, 9),

// After
id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
```

---

## High Priority Issues

### 4. Unused Error Variable in Middleware
**Location**: `src/lib/supabase/middleware.ts:44`

**Issue**: `authError` is retrieved but never checked. If authentication fails, the code should handle it appropriately.

**Fix**: Add error handling:
```typescript
const {
  data: { user },
  error: authError,
} = await supabase.auth.getUser();

if (authError && !isPublicRoute) {
  // Log error and redirect to login
  console.error('Auth error:', authError);
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}
```

---

### 5. Type Safety: Excessive Use of `any[]`
**Locations**:
- `src/app/(dashboard)/action-items/[id]/page.tsx:64`
- `src/app/(dashboard)/risks/[id]/page.tsx:64`
- `src/app/api/action-items/[id]/update/route.ts:74`
- `src/app/api/risks/[id]/update/route.ts:76`
- `src/lib/llm/processor.ts:68, 135, 164`

**Issue**: Using `any[]` defeats TypeScript's type safety. Should define proper interfaces for update arrays and attendees.

**Fix**: Create proper types:
```typescript
interface StatusUpdate {
  id: string;
  content: string;
  created_at: string;
  created_by_user_id: string;
  created_by_name: string;
}

let updatesArray: StatusUpdate[] = [];
```

---

### 6. Production Code: Console Logging
**Locations**: Multiple files throughout the codebase (33 files found)

**Issue**: Excessive `console.log`, `console.error`, and `console.warn` statements in production code. These should be replaced with a proper logging solution or removed.

**Recommendation**: 
- Use a logging library (e.g., `pino`, `winston`) with log levels
- Remove debug console.logs
- Keep console.error for critical errors but consider using a logging service
- Use environment-based logging (only log in development)

---

## Medium Priority Issues

### 7. Missing Error Handling in Process Route
**Location**: `src/app/api/meetings/[meetingId]/process/route.ts:29-32`

**Issue**: The status update to 'Processing' doesn't check for errors. If this fails, the meeting status might be inconsistent.

**Fix**: Check for errors:
```typescript
const { error: statusError } = await supabase
  .from('meetings')
  .update({ status: 'Processing' })
  .eq('id', meetingId);

if (statusError) {
  console.error('Failed to update meeting status:', statusError);
  // Consider whether to continue or return error
}
```

---

### 8. Inefficient Project Members Fetching
**Locations**:
- `src/app/(dashboard)/action-items/[id]/page.tsx:40-61`
- `src/app/(dashboard)/risks/[id]/page.tsx:40-61`

**Issue**: Project members are fetched one-by-one in a loop, causing N+1 query problem.

**Fix**: Use a single query with join:
```typescript
const { data: members } = await serviceSupabase
  .from('project_members')
  .select(`
    user_id,
    profile:profiles!project_members_user_id_fkey(id, full_name, email)
  `)
  .eq('project_id', actionItem.project_id);

const projectMembers = members
  ?.filter(m => m.profile)
  .map(m => ({
    id: m.profile.id,
    full_name: m.profile.full_name || '',
    email: m.profile.email,
  })) || [];
```

---

### 9. Missing Input Validation
**Location**: Multiple API routes

**Issue**: API routes accept user input without validation. Should validate request bodies using Zod or similar.

**Example Fix**:
```typescript
import { z } from 'zod';

const UpdateRequestSchema = z.object({
  content: z.string().optional(),
  title: z.string().min(1).max(500).optional(),
  status: z.enum(['Open', 'In Progress', 'Closed']).optional(),
  // ... other fields
});

const body = UpdateRequestSchema.parse(await request.json());
```

---

### 10. Missing Authentication Check in Process Route
**Location**: `src/app/api/meetings/[meetingId]/process/route.ts`

**Issue**: The route doesn't verify the user is authenticated before processing.

**Fix**: Add authentication check at the start:
```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## Low Priority Issues

### 11. Inconsistent Error Messages
**Issue**: Error messages vary in format and detail across the codebase. Some return detailed messages, others return generic ones.

**Recommendation**: Standardize error response format:
```typescript
interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}
```

---

### 12. Missing Rate Limiting
**Issue**: API routes don't have rate limiting, which could lead to abuse.

**Recommendation**: Implement rate limiting using middleware or a library like `@upstash/ratelimit`.

---

### 13. Hardcoded Values
**Location**: `src/app/api/meetings/[meetingId]/publish/route.ts:72`

**Issue**: Lock timeout (30 minutes) is hardcoded.

**Recommendation**: Move to environment variable or configuration:
```typescript
const LOCK_TIMEOUT_MINUTES = parseInt(process.env.LOCK_TIMEOUT_MINUTES || '30', 10);
```

---

### 14. Missing Transaction Handling
**Location**: `src/app/api/meetings/[meetingId]/publish/route.ts`

**Issue**: Multiple database operations are performed sequentially without transaction handling. If one fails, partial data might be saved.

**Recommendation**: Use Supabase transactions or implement rollback logic for critical operations.

---

## Summary

**Critical Issues**: 3
**High Priority Issues**: 3
**Medium Priority Issues**: 4
**Low Priority Issues**: 4

**Total Issues Found**: 14

### Priority Actions:
1. ✅ Fix debug route authorization (Critical) - **FIXED**
2. ✅ Add authorization checks to update routes (Critical) - **FIXED**
3. ✅ Replace deprecated `.substr()` method (Critical) - **FIXED**
4. ✅ Add error handling in middleware (High) - **FIXED**
5. ✅ Improve type safety (High) - **FIXED**
6. ✅ Address console logging in production (High) - **IMPLEMENTED** (added structured logging utility)

---

## Fixes Applied (December 14, 2025)

### Critical Issues Fixed:

1. **Debug Route Authorization** (`src/app/api/debug/action-items/route.ts`)
   - Added admin role check before exposing sensitive data
   - Returns 403 Forbidden for non-admin users

2. **Update Routes Authorization** (`src/app/api/action-items/[id]/update/route.ts`, `src/app/api/risks/[id]/update/route.ts`)
   - Added project membership verification before allowing updates
   - Checks both project membership and admin role
   - Returns 403 Forbidden for unauthorized users

3. **Deprecated `.substr()` Replacement**
   - Replaced `.substr(2, 9)` with `.slice(2, 11)` in both update routes

### High Priority Issues Fixed:

4. **Middleware Auth Error Handling** (`src/lib/supabase/middleware.ts`)
   - Now properly handles `authError` and redirects to login on auth failures

5. **Type Safety Improvements**
   - Added `StatusUpdate` interface to action-items and risks update routes
   - Added `StatusUpdate` interface to action-items and risks page components
   - Replaced `any[]` with proper typed arrays

### Medium Priority Issues Fixed:

6. **Process Route Error Handling** (`src/app/api/meetings/[meetingId]/process/route.ts`)
   - Added error checking for status update to 'Processing'
   - Returns 500 error if status update fails

7. **N+1 Query Fix** (`src/app/(dashboard)/action-items/[id]/page.tsx`, `src/app/(dashboard)/risks/[id]/page.tsx`)
   - Replaced loop-based profile fetching with single join query
   - Uses Supabase foreign key joins for efficient data retrieval

### Issues Deferred:

- ✅ **Console Logging**: Implemented structured logging utility (`src/lib/logger.ts`) with log levels and scoped loggers
- **Input Validation**: Consider adding Zod validation in a future iteration
- **Rate Limiting**: Consider implementing @upstash/ratelimit in a future iteration
- **Transaction Handling**: Consider for critical multi-step operations

---

## Fixes Applied (December 15, 2025)

### Critical Security Fix:

1. **Debug Seed Route Authorization** (`src/app/api/debug/seed/route.ts`)
   - **CRITICAL**: Route was completely unprotected - anyone could POST to inject test data
   - Added authentication check (401 for unauthenticated users)
   - Added admin role authorization (403 for non-admin users)
   - Added structured logging for access attempts

### High Priority Fixes:

2. **Structured Logging Migration** - Migrated console.log/console.error to structured logger:
   - `src/app/api/action-items/[id]/update/route.ts` - 8 statements migrated to `loggers.api`
   - `src/app/api/risks/[id]/update/route.ts` - 8 statements migrated to `loggers.api`
   - `src/lib/file-processing.ts` - 20+ statements migrated to `loggers.file`
   - `src/app/api/files/process/route.ts` - 3 statements migrated to `loggers.file`

3. **Type Safety Improvements**:
   - Added `UpdateActionItemData` interface in action-items update route (replaced `any`)
   - Added `UpdateRiskData` interface in risks update route (replaced `any`)
   - Added `MatchRpcResult` interface in `src/lib/embeddings/duplicate-detection.ts` (replaced 3 `any` usages)
   - Fixed mammoth type from `any` to proper `Awaited<typeof import('mammoth')>`

4. **Error Handling Improvements**:
   - Added error handling for `.single()` queries in action-items and risks update routes
   - Fixed `src/lib/embeddings/client.ts` to throw immediately when OpenAI API key is missing (was logging error but continuing)

### Files Modified:

| File | Changes |
|------|---------|
| `src/app/api/action-items/[id]/update/route.ts` | Structured logger, `UpdateActionItemData` type, error handling |
| `src/app/api/risks/[id]/update/route.ts` | Structured logger, `UpdateRiskData` type, error handling |
| `src/app/api/debug/seed/route.ts` | Auth + admin check (security fix), structured logger |
| `src/lib/embeddings/client.ts` | Throw error on missing API key |
| `src/lib/embeddings/duplicate-detection.ts` | `MatchRpcResult` type for RPC responses |
| `src/lib/file-processing.ts` | Structured logger, proper mammoth type |
| `src/app/api/files/process/route.ts` | Structured logger |

### Remaining Issues (Deferred):

- **Input Validation with Zod**: Large refactor affecting all API routes
- **Rate Limiting**: Requires external service (Upstash Redis)
- **Transaction Handling**: Requires Supabase database functions/RPCs
- **Console.log in client components**: Client-side logging is separate concern
