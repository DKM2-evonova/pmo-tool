# Publish Meeting Transaction Function - FIXED

## Status: RESOLVED (Migration 00040)

## Issue Summary
The `publish_meeting_transaction` PostgreSQL function was failing with type mismatch errors when trying to publish a meeting.

## Errors Encountered
```
1. Transaction failed: column "updates" is of type jsonb but expression is of type text
2. Transaction failed: column "status" is of type entity_status but expression is of type text
```

---

## Root Cause Analysis (Deep Dive)

After a comprehensive code review, **FOUR critical issues** were identified:

### Issue 1: `audit_logs` Column Name Mismatch

Migrations 00037 and 00038 tried to INSERT into `audit_logs` with columns that **don't exist**:

```sql
-- What 00037/00038 used (WRONG):
INSERT INTO audit_logs (entity_type, entity_id, action, changes, meeting_id, user_id, user_name)

-- Actual audit_logs schema (from 00011):
CREATE TABLE audit_logs (
  id, user_id, action_type, entity_type, entity_id, project_id, before_data, after_data, timestamp
)
```

### Issue 2: `updates` Column Type Mismatch

| Migration | Action | Expected Type |
|-----------|--------|---------------|
| 00015 | Added `action_items.updates` | JSONB |
| 00019 | Added `risks.updates` | JSONB |
| 00021 | Change to TEXT | **Never applied** |
| 00030 | Change to TEXT | **Never applied** |

Production Supabase has JSONB columns, requiring `::jsonb` casts.

### Issue 3: Parameter Name Inconsistency

| Migration | Parameter Name |
|-----------|----------------|
| 00035 (original) | `p_evidence_records` |
| 00037 | `p_evidence` (WRONG) |
| 00038+ | `p_evidence_records` |

### Issue 4: Enum Type Casts Missing (Final Issue)

PostgreSQL enum columns require explicit casts from text:

| Table | Column | Enum Type |
|-------|--------|-----------|
| action_items | status | `entity_status` |
| risks | status | `entity_status` |
| risks | probability | `risk_severity` |
| risks | impact | `risk_severity` |
| decisions | status | `decision_status` |
| decisions | category | `decision_category` |
| decisions | source | `decision_source` |
| meetings | status | `meeting_status` |

---

## The Solution: Migration 00040

Created [supabase/migrations/00040_fix_publish_enum_casts.sql](../supabase/migrations/00040_fix_publish_enum_casts.sql)

Key fixes:
1. **All enum columns have explicit casts** (e.g., `::entity_status`, `::decision_status`)
2. **Uses `::jsonb` cast** for updates column
3. **Uses `create_audit_log()` function** instead of direct INSERT
4. **Uses `p_evidence_records`** parameter name (matches API)
5. **Properly maps temp_ids to real ids** for evidence and audit records

---

## How to Apply

Run this in Supabase SQL Editor:

```sql
-- Copy the entire contents of:
-- supabase/migrations/00040_fix_publish_enum_casts.sql
```

---

## Verification

After applying, test with:
```sql
-- Check function exists with correct signature
SELECT proname, pronargs
FROM pg_proc
WHERE proname = 'publish_meeting_transaction';
-- Should show: publish_meeting_transaction, 6
```

---

## Files Involved
- [src/app/api/meetings/[meetingId]/publish/route.ts](../src/app/api/meetings/[meetingId]/publish/route.ts) - API route
- [supabase/migrations/00040_fix_publish_enum_casts.sql](../supabase/migrations/00040_fix_publish_enum_casts.sql) - **THE FINAL FIX**
- [supabase/migrations/00011_create_audit_logs.sql](../supabase/migrations/00011_create_audit_logs.sql) - Defines `create_audit_log()` function

## History
1. 00035: Original function
2. 00037: Wrong parameter name (`p_evidence`), audit_logs column mismatch
3. 00038: Correct parameter, but removed JSONB cast, audit_logs column mismatch
4. 00039: Fixed audit_logs and JSONB, but missing enum casts
5. **00040: Final fix** - all enum casts added, fully working

## Date
January 2, 2026
