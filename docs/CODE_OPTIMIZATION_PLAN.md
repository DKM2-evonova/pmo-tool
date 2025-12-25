# Code Optimization Plan - December 2025 Update

> **Previous Status: COMPLETE** — Earlier review resolved 109 issues.
> **Current Status: NEW ISSUES IDENTIFIED** — Comprehensive re-audit found 47 additional issues.

This document summarizes both the completed optimizations and newly identified issues from the December 25, 2025 comprehensive audit.

---

## New Issues Summary (December 25, 2025 Audit)

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Security | 3 | 3 | 4 | 5 | 15 |
| Database/Queries | 0 | 3 | 3 | 2 | 8 |
| Error Handling | 3 | 5 | 8 | 3 | 19 |
| React/Performance | 1 | 4 | 3 | 2 | 10 |
| **Total** | **7** | **15** | **18** | **12** | **52** |

---

## Priority 1: Critical Security Issues

### 1.1 File Upload Endpoints Missing Authentication
**Files:**
- `src/app/api/files/process/route.ts`
- `src/app/api/files/debug/route.ts`

**Issue:** These endpoints allow unauthenticated file uploads, enabling DoS attacks and resource abuse.

**Fix Required:**
```typescript
// Add at the start of POST handler
const supabase = await createServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### 1.2 Debug Routes Still Accessible via Environment Variable
**Files:**
- `src/app/api/debug/seed/route.ts`
- `src/app/api/debug/file-processing-test/route.ts`

**Issue:** Routes check `ENABLE_DEBUG_ROUTES` env var, which could be accidentally set in production.

**Fix Required:** Use build-time conditional compilation or remove debug routes entirely from production builds.

### 1.3 CRON_SECRET Not Required - Endpoint Open if Missing
**File:** `src/app/api/cron/drive-sync/route.ts` (lines 29-37)

**Current Code:**
```typescript
const cronSecret = process.env.CRON_SECRET;
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
// If CRON_SECRET not set, anyone can call this!
```

**Fix Required:**
```typescript
const cronSecret = process.env.CRON_SECRET;
if (!cronSecret) {
  log.error('CRON_SECRET environment variable is not set');
  return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
}
if (authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## Priority 2: High-Severity Issues

### 2.1 Fallback Secrets Should Be Removed
**Files:**
- `src/app/api/google/drive/webhook/route.ts:14`
- `src/app/api/cron/drive-sync/route.ts:12`

**Issue:** Code falls back to weak secrets like `'fallback-secret'` or `'default-secret'` if env vars are missing.

### 2.2 Race Condition in Drive File Processing
**File:** `src/lib/google/drive-ingestion.ts:117-149`

**Issue:** Two concurrent requests could both see status != "completed" and process the same file.

**Fix:** Use `SELECT FOR UPDATE` or optimistic locking with version field.

### 2.3 Race Condition in Action Item Updates
**File:** `src/app/api/action-items/[id]/update/route.ts:132-148`

**Issue:** Concurrent updates to the same action item's updates array overwrite each other.

**Fix:** Use atomic JSONB append:
```sql
UPDATE action_items SET updates = updates || $1::jsonb WHERE id = $2
```

### 2.4 Missing Transaction Handling in Publish Route
**File:** `src/app/api/meetings/[meetingId]/publish/route.ts`

**Issue:** Creates action items, decisions, risks, and evidence without transaction wrapper.

### 2.5 Console.log Usage Instead of Logger (15 instances)
**Files with direct console calls:**
| File | Line Numbers |
|------|--------------|
| `src/lib/google/drive-client.ts` | 405, 423 |
| `src/lib/google/drive-oauth.ts` | 115, 224, 260, 308 |
| `src/app/api/cron/drive-sync/route.ts` | 183, 192 |
| `src/app/api/google/drive/sync/route.ts` | 51, 104 |
| `src/app/api/google/drive/webhook/route.ts` | 44, 54, 72, 81, 89, 102, 108, 121, 129, 136, 140 |
| `src/components/meetings/meeting-ingestion.tsx` | 67 |
| `src/components/google/drive-connect.tsx` | 28 |

---

## Priority 3: React Performance Issues

### 3.1 Missing React.memo on Table Rows
**Files:**
- `src/components/action-items/action-items-table.tsx:70`
- `src/components/decisions/decisions-table.tsx:85`

**Issue:** Table rows re-render on every parent state change.

### 3.2 URL Parsing on Every Render
**File:** `src/components/decisions/decision-faceted-filters.tsx:54-88`

**Issue:** Creates new URL objects on every render instead of memoizing.

### 3.3 Substage Interval Dependency Issue
**File:** `src/components/meetings/processing-status.tsx:82-111`

**Issue:** `substageInterval` recalculates on every render, recreating intervals unnecessarily.

### 3.4 Static Arrays Defined Inside Components
**Files:**
- `src/components/layout/sidebar.tsx:39`
- `src/components/meetings/processing-status.tsx:25`

---

## Priority 4: Database Query Optimizations

### 4.1 N+1 Query in Relevant Context
**File:** `src/lib/llm/relevant-context.ts:46-61`

**Issue:** Makes 3 separate count queries, then 3 more to fetch data.

### 4.2 String-Based OR Conditions
**File:** `src/lib/llm/relevant-context.ts:180-185`

**Issue:** Builds filter strings manually instead of using Supabase methods.

---

## Priority 5: Error Handling Improvements

### 5.1 Fire-and-Forget Promises
**File:** `src/app/api/google/drive/webhook/route.ts:119-130`

**Issue:** `processWebhookChange()` called but not awaited, errors only logged.

### 5.2 Silent Duplicate Check Failures
**File:** `src/lib/google/drive-ingestion.ts:56`

**Issue:** On error, assumes not duplicate - could create duplicates on database issues.

### 5.3 Hardcoded Magic Values to Externalize
| Value | File | Line |
|-------|------|------|
| 50MB file size | `src/lib/file-processing.ts` | 358 |
| 10 char threshold | `src/lib/file-processing.ts` | 103 |
| 500 cache entries | `src/lib/embeddings/client.ts` | 21 |
| 30 min cache TTL | `src/lib/embeddings/client.ts` | 22 |
| 24h webhook exp | `src/lib/google/drive-client.ts` | 360 |
| 5 min token buffer | `src/lib/google/drive-oauth.ts` | 204 |

---

## Priority 6: Security Hardening

### 6.1 Missing Security Headers
Need middleware to add:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`

### 6.2 Missing Rate Limiting
No rate limiting on any API endpoints.

### 6.3 Logger Doesn't Filter Sensitive Data
**File:** `src/lib/logger.ts`

Sensitive fields (token, secret, password, key) not redacted from logs.

---

## Implementation Phases

### Phase 1: Critical Security (Immediate)
1. [ ] Add authentication to file upload endpoints
2. [ ] Require CRON_SECRET (fail if missing)
3. [ ] Remove fallback secrets
4. [ ] Disable debug routes properly in production

### Phase 2: High Priority (Days 2-3)
5. [ ] Fix race condition in Drive processing
6. [ ] Fix race condition in action item updates
7. [ ] Replace all console.log with logger (15 instances)
8. [ ] Add security headers middleware

### Phase 3: Performance (Days 4-5)
9. [ ] Add React.memo to table row components
10. [ ] Memoize URL operations in filters
11. [ ] Fix substage interval dependency
12. [ ] Move static arrays outside components

### Phase 4: Database (Day 6)
13. [ ] Create transaction wrapper for publish route
14. [ ] Optimize N+1 queries in relevant-context

### Phase 5: Error Handling (Day 7)
15. [ ] Add proper error propagation for async chains
16. [ ] Externalize hardcoded values to config
17. [ ] Add retry logic for transient failures

---

## Previously Completed Work (December 21, 2025)

The following improvements were made in the earlier optimization effort:

### Security Enhancements (Completed)
- OAuth CSRF protection with HMAC-SHA256 signatures
- Admin route protection requiring admin role
- UUID validation on all API routes
- Audit log RLS tightening
- Error sanitization for client responses

### Performance Optimizations (Completed)
- Parallel duplicate detection (Promise.all)
- Fuse.js index caching with 1-minute TTL
- Embedding LRU cache (500 entries, 30-min TTL)
- N+1 query fixes in admin team route
- Profile fetch consolidation

### Component Architecture (Completed)
- ReviewUI split from 1,467 to 901 lines
- Error Boundary component with fallback UI
- Toast notifications replacing alert() calls
- Re-render optimization with useCallback/useMemo

### Type Safety (Completed)
- Removed `any` types with proper interfaces
- Enum validation for status/probability/impact
- UUID regex pre-compiled at module level

### Database Migrations (Applied)
- `00027_fix_batch_audit_logs.sql`
- `00028_fix_audit_logs_rls.sql`
- `00029_fix_evidence_rls.sql`
- `00030_reconcile_updates_column.sql`

---

## Build Status

✅ Previous changes verified — build passing
⏳ New fixes pending implementation

---

*Last updated: December 25, 2025*
