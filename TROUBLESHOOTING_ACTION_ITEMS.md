# Action Item Detail Page - Troubleshooting Log

## Issue Summary

**Error**: When clicking into the details of an action item, users receive the error:
```
Action item not found: "c3357229-0412-48c8-8ad7-8413ef48612d"
```

**Location**: `/action-items/[id]/page.tsx`

**Error Type**: Console Error in Next.js 16.0.10 (Turbopack)

## Problem Analysis

The action item detail page is failing to fetch action items even though:
1. The action item ID exists in the database
2. The user should have access based on project membership
3. The service client is being used to bypass RLS

## Root Cause Investigation

### Initial Hypothesis
The service client (`createServiceClient`) was not properly bypassing Row Level Security (RLS) because it was using `createServerClient` from `@supabase/ssr`, which is designed for user sessions and may override the service role key.

### Evidence
- The error occurs even when using the service client
- Console logs show the action item is not found despite existing in the database
- The service client was using `createServerClient` which manages cookies and user sessions

## Attempted Solutions

### Solution 1: Fixed Service Client Implementation
**Date**: Current session

**Changes Made**:
1. Updated `src/lib/supabase/server.ts`:
   - Changed `createServiceClient()` from using `createServerClient` (from `@supabase/ssr`) to `createClient` (from `@supabase/supabase-js`)
   - Removed `async` keyword since it's no longer needed
   - Added proper configuration to disable auth session management

**Code Changes**:
```typescript
// Before
export async function createServiceClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseServiceKey, { ... });
}

// After
export function createServiceClient() {
  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
```

2. Updated all service client calls:
   - Removed `await` from all `createServiceClient()` calls
   - Updated files:
     - `src/app/(dashboard)/action-items/[id]/page.tsx`
     - `src/app/api/debug/action-items/route.ts`
     - `src/app/api/debug/seed/route.ts`
     - `src/app/api/meetings/[meetingId]/route.ts`
     - `src/app/api/meetings/[meetingId]/publish/route.ts`

3. Improved error handling in action item detail page:
   - Added proper error checking before checking if item exists
   - Enhanced logging to diagnose issues
   - Added specific error code handling (PGRST116 for "not found")

**Result**: ❌ Issue persists - action items still not found

### Solution 2: Enhanced Error Logging
**Date**: Current session

**Changes Made**:
- Added comprehensive console logging in `src/app/(dashboard)/action-items/[id]/page.tsx`:
  - User ID and project memberships
  - Admin status
  - Action item fetch results with error details
  - Access check results

**Result**: ⚠️ Better diagnostics but issue not resolved

## Current State

### Files Modified
1. `src/lib/supabase/server.ts` - Service client implementation
2. `src/app/(dashboard)/action-items/[id]/page.tsx` - Error handling and logging
3. Multiple API routes - Removed `await` from service client calls

### Current Implementation
The action item detail page:
1. Uses service client to fetch action item (bypasses RLS)
2. Manually checks user's project memberships
3. Verifies access before displaying
4. Has comprehensive error logging

## Potential Remaining Issues

### 1. Service Role Key Configuration
- **Hypothesis**: The `SUPABASE_SERVICE_ROLE_KEY` environment variable may not be set correctly
- **Check**: Verify environment variable is loaded in production/development
- **Location**: `.env.local` or deployment environment variables

### 2. Database Connection
- **Hypothesis**: The service client may not be connecting to the correct database
- **Check**: Verify `NEXT_PUBLIC_SUPABASE_URL` matches the database URL
- **Location**: Environment configuration

### 3. RLS Policies Still Active
- **Hypothesis**: Even with service role key, RLS might still be interfering
- **Check**: Verify service role key has proper permissions
- **Location**: Supabase dashboard → Settings → API

### 4. Foreign Key Relationships
- **Hypothesis**: The query includes foreign key relationships that may fail
- **Check**: The select includes:
  - `owner:profiles!action_items_owner_user_id_fkey(...)`
  - `project:projects(...)`
  - `source_meeting:meetings(...)`
- **Note**: These relationships might be causing the query to fail if any related record is missing

### 5. Query Syntax Issue
- **Hypothesis**: The `.single()` method may be failing due to query structure
- **Check**: Try fetching without `.single()` first to see if multiple results are returned
- **Alternative**: Use `.maybeSingle()` instead of `.single()`

## Next Steps to Investigate

### Immediate Actions
1. **Verify Environment Variables**:
   ```bash
   # Check if service role key is set
   echo $SUPABASE_SERVICE_ROLE_KEY
   ```

2. **Test Service Client Directly**:
   - Create a test API route that uses service client to fetch action items
   - Verify it can bypass RLS

3. **Check Database Directly**:
   - Query the database directly to verify the action item exists
   - Check if the user has project membership

4. **Simplify the Query**:
   - Try fetching action item without foreign key relationships first
   - Add relationships one at a time to identify the failing relationship

5. **Check Supabase Logs**:
   - Review Supabase dashboard logs for query errors
   - Check for RLS policy violations

### Debugging Tools Available
- `/api/debug/action-items` - Debug endpoint to test RLS vs service client
- Console logs in the action item detail page
- Browser network tab to see actual API calls

## Lessons Learned

### 1. Service Client Implementation
- **Lesson**: `createServerClient` from `@supabase/ssr` is designed for user sessions and may override service role keys
- **Solution**: Use `createClient` from `@supabase/supabase-js` for true service role access
- **Reference**: [Supabase Documentation](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors)

### 2. Error Handling
- **Lesson**: Always check for database errors before checking if data exists
- **Implementation**: Check `error` object before checking `data` object
- **Benefit**: Better error messages and debugging information

### 3. Async/Await Patterns
- **Lesson**: Service clients that don't use cookies don't need to be async
- **Implementation**: Removed `async` from `createServiceClient()` and all `await` calls

### 4. Comprehensive Logging
- **Lesson**: Detailed logging helps diagnose issues in production
- **Implementation**: Added extensive console logs with context (user ID, project IDs, error codes)

## Code References

### Key Files
- `src/lib/supabase/server.ts` - Service client implementation
- `src/app/(dashboard)/action-items/[id]/page.tsx` - Action item detail page
- `src/app/(dashboard)/action-items/[id]/action-item-detail.tsx` - Client component
- `supabase/migrations/00006_create_action_items.sql` - RLS policies

### Related Issues
- RLS policies for action items require project membership
- Service client should bypass all RLS policies
- Manual access control is implemented after fetching

## Environment Requirements

### Required Environment Variables
```bash
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>  # Critical for service client
```

### Verification
```typescript
// In server.ts, these should not be placeholders
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Should not equal 'placeholder-service-key'
```

## Additional Notes

- The action item list page (`/action-items`) works correctly using regular client with RLS
- The issue is specific to the detail page (`/action-items/[id]`)
- The service client approach was chosen to manually implement access control
- Alternative approach: Use regular client and rely on RLS policies instead of service client

## Final Resolution

### Root Cause Analysis

The action item detail page failures were caused by **two separate but related issues**:

1. **RLS Policy Conflicts**: Complex Row-Level Security policies were blocking access to action item detail pages
2. **Missing Database Migrations**: The `updates` column for status updates didn't exist in the remote Supabase database

### Solution Implemented

#### Issue 1: RLS Blocking Access to Detail Pages

**Problem**: The original implementation used the regular Supabase client with RLS, but the policies were either too restrictive or not working as expected.

**Solution**:
- Switched to using the **service client** (bypasses RLS) for fetching action item data
- This allows the server to manually verify access while bypassing client-side RLS restrictions
- Added comprehensive logging to debug access issues

**Code Changes**:
- Modified `/src/app/(dashboard)/action-items/[id]/page.tsx` to use service client
- Added detailed debugging logs for troubleshooting

#### Issue 2: Missing Database Schema Updates

**Problem**: Status updates failed with "column action_items.updates does not exist" because the database migration wasn't applied to the remote Supabase instance.

**Solution**:
- Applied the missing migration manually via Supabase SQL Editor:
```sql
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS updates JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN action_items.updates IS 'Array of status updates with timestamps and comments';
CREATE INDEX IF NOT EXISTS idx_action_items_updates ON action_items USING gin(updates);
```

#### Issue 3: Client-Side Updates Blocked by RLS

**Problem**: Direct database updates from the client were blocked by RLS policies and schema cache issues.

**Solution**:
- Created API routes (`/api/action-items/[id]/update`) that use the service client
- Moved all action item updates (status updates and general edits) to server-side API routes
- This bypasses client-side RLS restrictions and schema cache issues

**Code Changes**:
- Created `/src/app/api/action-items/[id]/update/route.ts`
- Modified client-side code to use API routes instead of direct database calls

### Files Modified

1. **Server Components**:
   - `src/app/(dashboard)/action-items/[id]/page.tsx` - Service client approach with debugging

2. **API Routes**:
   - `src/app/api/action-items/[id]/update/route.ts` - Server-side update handling

3. **Client Components**:
   - `src/app/(dashboard)/action-items/[id]/action-item-detail.tsx` - API route integration

4. **Documentation**:
   - `TROUBLESHOOTING_ACTION_ITEMS.md` - Complete troubleshooting guide

### Key Learnings

1. **RLS Complexity**: Row-Level Security can create unexpected access issues, especially with complex foreign key relationships
2. **Service Client Benefits**: Using the service client for sensitive operations bypasses RLS while maintaining security through server-side validation
3. **Migration Management**: Remote Supabase databases require manual migration application when not using CLI linking
4. **API Route Pattern**: For operations that modify data, API routes with service clients provide reliable access control

### Testing Results

✅ **Action item detail pages load successfully**
✅ **Status updates save and display correctly**
✅ **General action item edits work**
✅ **RLS bypassed appropriately for authorized users**
✅ **Database schema updated with required columns**

## Status

**Current Status**: ✅ **RESOLVED**

**Last Updated**: Current session

**Resolution**: Fixed by identifying root causes and implementing comprehensive solution

---

## Quick Reference for Future Issues

### Symptoms
- Action item cards don't open (404 errors)
- "Action item not found" errors
- Status updates fail with schema errors

### Quick Diagnosis
1. Check browser console for RLS errors
2. Verify database has `updates` column: `SELECT updates FROM action_items LIMIT 1;`
3. Test with service client vs regular client

### Emergency Fix
If action items won't load:
```typescript
// Temporary: Use service client in page.tsx
const serviceSupabase = createServiceClient();
const { data: actionItem } = await serviceSupabase.from('action_items').select('*').eq('id', id).single();
```

If updates fail:
1. Apply migration: `ALTER TABLE action_items ADD COLUMN IF NOT EXISTS updates JSONB DEFAULT '[]'::jsonb;`
2. Refresh schema: `NOTIFY pgrst, 'reload schema';`
3. Check API route: `/api/action-items/[id]/update`

### Files to Check
- `src/app/(dashboard)/action-items/[id]/page.tsx` - Service client implementation
- `src/app/api/action-items/[id]/update/route.ts` - Update API route
- `src/app/(dashboard)/action-items/[id]/action-item-detail.tsx` - Client-side API calls
- `src/app/api/admin/refresh-schema/route.ts` - Schema refresh utility
- `TROUBLESHOOTING_ACTION_ITEMS.md` - Complete troubleshooting guide

