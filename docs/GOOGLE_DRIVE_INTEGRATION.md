# Google Drive Auto-Ingestion Integration

This document explains how to set up and use the Google Drive auto-ingestion feature, which automatically imports meeting transcripts from Google Drive.

## Overview

The Google Drive integration automatically detects and imports meeting transcripts from watched folders (typically the "Meet Recordings" folder created by Google Meet). It uses a dual approach for reliability:

1. **Google Drive Push Notifications (Webhooks)**: Real-time detection of new files
2. **Hourly Polling (Cron Job)**: Backup mechanism to catch any missed files

Imported meetings are created in **Draft** status, allowing users to review and assign them to projects before processing.

## Prerequisites

- Google Cloud project with OAuth 2.0 credentials
- Supabase database with migrations applied
- Vercel deployment (for cron jobs in production)

## Setup Instructions

### 1. Enable Google Drive API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services > Library**
4. Search for "Google Drive API"
5. Click **Enable**

### 2. Configure OAuth Credentials

If you already have Google Calendar OAuth credentials, you can reuse them. Otherwise:

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Select **Web application**
4. Add authorized redirect URI:
   - Development: `http://localhost:3000/api/google/drive/callback`
   - Production: `https://your-domain.com/api/google/drive/callback`
5. Copy the Client ID and Client Secret

### 3. Environment Variables

Add the following to your `.env.local` file:

```bash
# Google Drive OAuth (can be same as Calendar credentials)
GOOGLE_DRIVE_CLIENT_ID=your-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-client-secret
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/api/google/drive/callback

# Security secrets (generate random strings)
WEBHOOK_SECRET=your-random-webhook-secret
CRON_SECRET=your-random-cron-secret

# App URL (for webhook registration)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Generating Secrets**: Use a secure random string generator:
```bash
openssl rand -hex 16
```

### 4. Database Migration

The Drive integration requires additional database tables. Apply the migration:

```bash
npx supabase db push
```

Or manually run the SQL in `supabase/migrations/00031_create_drive_ingestion_tables.sql`.

### 5. Vercel Configuration (Production)

The `vercel.json` file includes cron configuration for hourly polling:

```json
{
  "crons": [
    {
      "path": "/api/cron/drive-sync",
      "schedule": "0 * * * *"
    }
  ]
}
```

This runs every hour to:
- Poll watched folders for new files
- Renew expiring webhook channels
- Clean up expired channels

## User Guide

### Connecting Google Drive

1. Navigate to **Profile** (click your avatar or go to `/profile`)
2. Scroll to the **Integrations** section
3. Click **Connect Google Drive**
4. Authorize the application in the Google OAuth popup
5. You'll be redirected back with "Google Drive connected successfully!"

### Adding Watched Folders

1. After connecting, click **Add Folder**
2. The "Meet Recordings" folder is auto-detected and recommended
3. Click **Add** to start watching the folder
4. Alternatively, click **Browse Other Folders** to search for different folders

### How Syncing Works

- **Real-time**: New files are detected within seconds via webhooks (when configured)
- **Hourly**: Cron job checks for any missed files every hour
- **Manual**: Click **Sync Now** to trigger immediate sync

### Viewing Imported Meetings

Imported meetings appear in the **Meetings** list with:
- Status: **Draft**
- A "From Google Drive" indicator

From there, you can:
1. Assign the meeting to a project
2. Review the transcript
3. Process the meeting to extract action items, decisions, and risks

## Architecture

### Database Tables

| Table | Purpose |
|-------|---------|
| `drive_watched_folders` | Folders being monitored per user |
| `drive_processed_files` | Track processed files to prevent duplicates |
| `drive_webhook_channels` | Active webhook channels (24h expiration) |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/google/drive/auth` | GET | Initiate OAuth flow |
| `/api/google/drive/callback` | GET | Handle OAuth callback |
| `/api/google/drive/status` | GET | Get connection status |
| `/api/google/drive/disconnect` | POST | Disconnect and cleanup |
| `/api/google/drive/folders` | GET | List available folders |
| `/api/google/drive/folders` | POST | Add folder to watch list |
| `/api/google/drive/folders/[folderId]` | DELETE | Remove watched folder |
| `/api/google/drive/folders/meet-recordings` | GET | Auto-detect Meet Recordings folder |
| `/api/google/drive/sync` | POST | Trigger manual sync |
| `/api/google/drive/webhook` | POST | Receive Google Drive push notifications |
| `/api/cron/drive-sync` | GET | Hourly cron for polling and maintenance |

### Duplicate Prevention

The system uses multi-layer deduplication to prevent importing the same meeting multiple times:

1. **Drive File ID**: Same file can't be processed twice by the same user
2. **Content Fingerprint**: SHA-256 hash of transcript start (first 2000 chars)
3. **Title + Date Match**: Same title on same date in same project is flagged

This is important because Google Meet saves transcripts to each attendee's Drive, so multiple team members may have copies of the same recording.

## Troubleshooting

### "Contact administrator" message

The Drive integration is not configured. Ensure these environment variables are set:
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`

Restart the dev server after adding them.

### OAuth Error: "redirect_uri_mismatch"

The redirect URI in Google Cloud Console doesn't match your environment. Ensure:
- `GOOGLE_DRIVE_REDIRECT_URI` matches exactly what's in Google Cloud Console
- Include the full URL with protocol (`http://` or `https://`)

### Files not being detected

1. Check if the folder is actively being watched (green "Real-time sync" indicator)
2. Try clicking "Sync Now" for manual sync
3. Check browser console and server logs for errors
4. Verify the file is a supported format (DOCX, PDF, TXT, Google Doc)

### Webhook not working

Webhooks require a publicly accessible URL. In development:
- Webhooks won't work on `localhost`
- The hourly polling will still catch new files
- Use a service like ngrok for testing webhooks locally

In production:
- Ensure `NEXT_PUBLIC_APP_URL` points to your public domain
- Webhook channels expire after 24 hours and are auto-renewed

## Security Considerations

- **Read-only Access**: The integration only requests read access to Drive files
- **User-scoped**: Each user connects their own Drive account
- **RLS Protected**: All database tables have Row Level Security policies
- **Token Storage**: OAuth tokens are encrypted in the database
- **Webhook Verification**: Webhook requests are verified with HMAC-SHA256

## File Support

| Format | MIME Type | Notes |
|--------|-----------|-------|
| Google Docs | `application/vnd.google-apps.document` | Exported as plain text |
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Standard Word format |
| PDF | `application/pdf` | Text extracted from PDF |
| TXT | `text/plain` | Plain text files |
| RTF | `application/rtf` | Rich text format |
