# API Reference

This document provides a comprehensive reference for all PMO Tool API endpoints.

---

## Authentication

All API routes require authentication via Supabase Auth. Include the session cookie or Authorization header with a valid JWT token.

```typescript
// Routes automatically check authentication:
const supabase = await createServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## Meetings

### Process Meeting

Initiates LLM processing on a meeting transcript.

```
POST /api/meetings/[meetingId]/process
```

**Response:**
```json
{
  "success": true,
  "meetingId": "uuid",
  "status": "Review"
}
```

### Publish Meeting

Commits reviewed changes from a meeting to the database.

```
POST /api/meetings/[meetingId]/publish
```

**Request Body:**
```json
{
  "action_items": [...],
  "decisions": [...],
  "risks": [...],
  "recap": {...}
}
```

**Response:**
```json
{
  "success": true,
  "published": {
    "actionItems": 5,
    "decisions": 2,
    "risks": 1
  }
}
```

### Get Meeting

Retrieves meeting details including transcript and processed data.

```
GET /api/meetings/[meetingId]
```

### Delete Meeting

Soft-deletes a meeting (sets status to 'Deleted').

```
DELETE /api/meetings/[meetingId]
```

---

## Action Items

### Update Action Item

Updates status, adds comments, or modifies action item fields.

```
PUT /api/action-items/[id]/update
```

**Request Body:**
```json
{
  "status": "In Progress",
  "comment": "Started working on this today"
}
```

**Response:**
```json
{
  "success": true,
  "actionItem": {
    "id": "uuid",
    "status": "In Progress",
    "updates": [...]
  }
}
```

---

## Decisions

### Create Decision (Manual)

Creates a decision without a meeting source.

```
POST /api/decisions
```

**Request Body:**
```json
{
  "project_id": "uuid",
  "title": "Decision title",
  "rationale": "Why this decision was made",
  "outcome": "What was decided",
  "category": "technology",
  "impact_areas": ["scope", "time"],
  "decision_maker_user_id": "uuid"
}
```

### Update Decision

Updates decision fields.

```
PATCH /api/decisions/[id]
```

**Request Body:**
```json
{
  "status": "approved",
  "outcome": "Updated outcome text"
}
```

### Supersede Decision

Marks a decision as superseded by another.

```
POST /api/decisions/[id]/supersede
```

**Request Body:**
```json
{
  "superseded_by_id": "uuid"
}
```

### Delete Decision

Deletes a decision.

```
DELETE /api/decisions/[id]
```

---

## Risks

### Update Risk

Updates risk status, adds comments, or modifies fields.

```
PUT /api/risks/[id]/update
```

**Request Body:**
```json
{
  "status": "Closed",
  "comment": "Risk has been mitigated"
}
```

---

## Projects

### Get Project Milestones

Retrieves milestones for a project.

```
GET /api/projects/[projectId]/milestones
```

### Update Milestones

Bulk update milestones for a project.

```
PUT /api/projects/[projectId]/milestones
```

**Request Body:**
```json
{
  "milestones": [
    {
      "id": "uuid",
      "title": "Phase 1 Complete",
      "target_date": "2026-02-01",
      "status": "in_progress",
      "depends_on": null
    }
  ]
}
```

### Import Milestones from Template

Imports milestones from an Excel template.

```
POST /api/projects/[projectId]/milestones/import
```

**Request Body:** `multipart/form-data` with Excel file

### Download Milestone Template

Downloads an Excel template for milestone import.

```
GET /api/projects/[projectId]/milestones/template
```

---

## Google Calendar Integration

### Start OAuth Flow

Redirects to Google OAuth consent screen.

```
GET /api/google/calendar/auth
```

### OAuth Callback

Handles OAuth callback and stores tokens.

```
GET /api/google/calendar/callback
```

### Check Connection Status

Returns whether user has connected their calendar.

```
GET /api/google/calendar/status
```

**Response:**
```json
{
  "connected": true,
  "email": "user@example.com"
}
```

### List Calendar Events

Fetches upcoming calendar events.

```
GET /api/google/calendar/events?days=7
```

**Response:**
```json
{
  "events": [
    {
      "id": "event-id",
      "title": "Project Sync",
      "start": "2026-01-05T10:00:00Z",
      "attendees": [...]
    }
  ]
}
```

### Disconnect Calendar

Revokes tokens and disconnects calendar.

```
POST /api/google/calendar/disconnect
```

---

## Google Drive Integration

### Start OAuth Flow

Redirects to Google OAuth consent screen for Drive.

```
GET /api/google/drive/auth
```

### OAuth Callback

Handles OAuth callback and stores tokens.

```
GET /api/google/drive/callback
```

### Check Connection Status

Returns whether user has connected their Drive.

```
GET /api/google/drive/status
```

### List Available Folders

Lists folders available for watching.

```
GET /api/google/drive/folders
```

### Add Watched Folder

Adds a folder to the watch list.

```
POST /api/google/drive/folders
```

**Request Body:**
```json
{
  "folderId": "drive-folder-id",
  "folderName": "Meet Recordings"
}
```

### Remove Watched Folder

Removes a folder from the watch list.

```
DELETE /api/google/drive/folders/[folderId]
```

### Auto-detect Meet Recordings Folder

Automatically finds the "Meet Recordings" folder.

```
GET /api/google/drive/folders/meet-recordings
```

### Trigger Manual Sync

Triggers an immediate sync of watched folders.

```
POST /api/google/drive/sync
```

### Disconnect Drive

Revokes tokens and removes all watched folders.

```
POST /api/google/drive/disconnect
```

### Webhook Handler

Receives Google Drive push notifications.

```
POST /api/google/drive/webhook
```

**Headers:** Must include `X-Goog-Channel-Token` for verification.

---

## Cron Jobs

### Drive Sync Cron

Hourly job for polling watched folders and renewing webhook channels.

```
GET /api/cron/drive-sync
```

**Headers:**
```
Authorization: Bearer ${CRON_SECRET}
```

---

## Admin Routes

These routes require `global_role = 'admin'`.

### Refresh Schema

Regenerates TypeScript types from database schema.

```
POST /api/admin/refresh-schema
```

### User Management

```
GET /api/admin/users
PUT /api/admin/users/[id]
DELETE /api/admin/users/[id]
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": { ... }  // Optional additional context
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (invalid input) |
| 401 | Unauthorized (not authenticated) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (e.g., locked resource) |
| 500 | Internal Server Error |

---

## Rate Limiting

Pre-configured rate limits (enforced per user):

| Limit Type | Requests | Window |
|------------|----------|--------|
| Standard | 100 | 1 minute |
| LLM Processing | 10 | 1 minute |
| File Upload | 20 | 1 minute |
| Auth | 5 | 1 minute |

When rate limited, returns:
```json
{
  "error": "Too many requests",
  "retryAfter": 60
}
```
