# Google Calendar Integration

Connect your Google Calendar to import meeting metadata (title, date, attendees) when creating meetings.

## Setup

### 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable the **Google Calendar API**:
   - APIs & Services → Library → Search "Google Calendar API" → Enable

### 2. Create OAuth Credentials

1. Go to APIs & Services → Credentials → Create Credentials → OAuth client ID
2. Configure OAuth consent screen (if prompted):
   - User Type: External (or Internal for Workspace)
   - App name: "PMO Tool"
   - Scopes: `calendar.events.readonly`, `userinfo.email`
3. Create Web application credentials:
   - Authorized redirect URIs:
     - `http://localhost:3000/api/google/calendar/callback` (dev)
     - `https://your-domain.com/api/google/calendar/callback` (prod)

### 3. Environment Variables

Add to `.env.local`:

```env
GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/google/calendar/callback
```

### 4. Apply Database Migration

```bash
npx supabase db push
```

This creates the `user_oauth_tokens` table with RLS policies.

## Usage

1. Go to **Profile** → Integrations section
2. Click **Connect Google Calendar**
3. Authorize in Google's consent screen
4. When creating meetings, use **Import from Calendar** to select events

## Features

- **Dashboard widget**: Shows upcoming meetings (next 7 days)
- **Meeting import**: Auto-populates title, date, and attendees
- **Per-user tokens**: Each user connects their own calendar
- **Auto-refresh**: Tokens refresh automatically when expired

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/google/calendar/auth` | GET | Start OAuth flow |
| `/api/google/calendar/callback` | GET | Handle OAuth callback |
| `/api/google/calendar/disconnect` | POST | Revoke tokens |
| `/api/google/calendar/status` | GET | Check connection |
| `/api/google/calendar/events` | GET | List calendar events |

## Security

- Tokens stored with RLS (users access only their own)
- Minimal scope: read-only calendar access
- CSRF protection with HMAC-signed state parameter
- Tokens revoked on disconnect

## Troubleshooting

**"Access blocked" error during OAuth**
- Verify redirect URI matches exactly in Google Cloud Console
- Check that Calendar API is enabled

**No events showing**
- Verify the connected account has calendar events
- Check browser console for API errors

**Token refresh failing**
- Disconnect and reconnect the calendar
- Verify `GOOGLE_CALENDAR_CLIENT_SECRET` is correct
