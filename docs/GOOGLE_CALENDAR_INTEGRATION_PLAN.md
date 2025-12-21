# Google Calendar Integration

> **Status: IMPLEMENTED** - Code complete, requires Google Cloud setup to enable.

## Overview

Integrate Google Calendar API to enhance the meeting creation workflow by:
1. Allowing users to connect their Google Calendar
2. Listing recent/upcoming meetings from their calendar
3. Auto-populating meeting metadata (title, date, attendees) when creating a new meeting

## Quick Start - Enable the Integration

### Step 1: Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the **Google Calendar API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

### Step 2: Create OAuth Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External (or Internal for Workspace orgs)
   - App name: "PMO Tool"
   - User support email: your email
   - Developer contact: your email
   - Scopes: Add `https://www.googleapis.com/auth/calendar.events.readonly` and `https://www.googleapis.com/auth/userinfo.email`
4. Create the OAuth client ID:
   - Application type: "Web application"
   - Name: "PMO Tool Web Client"
   - Authorized redirect URIs:
     - `http://localhost:3000/api/google/calendar/callback` (development)
     - `https://your-domain.com/api/google/calendar/callback` (production)
5. Copy the Client ID and Client Secret

### Step 3: Configure Environment Variables

Add to your `.env.local`:

```env
GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/google/calendar/callback
```

### Step 4: Run Database Migration

```bash
# Apply the new migration
supabase db push
# Or if using migrations directly:
supabase migration up
```

### Step 5: Test the Integration

1. Start the app: `npm run dev`
2. Go to your Profile page (`/profile`)
3. You should see "Google Calendar" in the Integrations section
4. Click "Connect Google Calendar"
5. Authorize the app
6. Go to create a new meeting - you should see "Import from Google Calendar" option

## Scope (< 100 Users - No OAuth Verification Required)

**In Scope:**
- Google Calendar OAuth connection per user
- Read calendar events (title, date, attendees, description)
- Pre-fill meeting form from calendar event selection
- User settings to connect/disconnect calendar

**Out of Scope (for now):**
- Creating calendar events from action items
- Google Meet transcript fetching (requires restricted scopes)
- Gmail integration
- Calendar webhooks/real-time sync

## Technical Architecture

### OAuth Flow

```
User clicks "Connect Google Calendar"
    ↓
Redirect to Google OAuth consent screen
(Scope: calendar.events.readonly)
    ↓
User authorizes
    ↓
Callback receives authorization code
    ↓
Exchange code for access_token + refresh_token
    ↓
Store tokens in user_oauth_tokens table
    ↓
User can now fetch calendar events
```

### Database Schema

```sql
-- New table for OAuth tokens
CREATE TABLE user_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL, -- 'google_calendar'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  scopes TEXT[], -- ['calendar.events.readonly']
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- RLS policies
ALTER TABLE user_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tokens"
  ON user_oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens"
  ON user_oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
  ON user_oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
  ON user_oauth_tokens FOR DELETE
  USING (auth.uid() = user_id);
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/google/calendar/auth` | GET | Initiate OAuth flow |
| `/api/google/calendar/callback` | GET | Handle OAuth callback |
| `/api/google/calendar/disconnect` | POST | Revoke and delete tokens |
| `/api/google/calendar/status` | GET | Check connection status |
| `/api/google/calendar/events` | GET | List calendar events |

### File Structure

```
src/
├── lib/
│   └── google/
│       ├── calendar-client.ts    # Google Calendar API wrapper
│       ├── oauth.ts              # OAuth utilities
│       └── types.ts              # TypeScript types
├── app/
│   └── api/
│       └── google/
│           └── calendar/
│               ├── auth/route.ts
│               ├── callback/route.ts
│               ├── disconnect/route.ts
│               ├── status/route.ts
│               └── events/route.ts
├── components/
│   └── google/
│       ├── calendar-connect-button.tsx
│       ├── calendar-event-picker.tsx
│       └── calendar-status.tsx
```

## Implementation Steps

### Phase 1: Infrastructure

1. **Google Cloud Setup**
   - Create/configure Google Cloud project
   - Enable Google Calendar API
   - Create OAuth 2.0 credentials
   - Configure authorized redirect URIs

2. **Database Migration**
   - Create `user_oauth_tokens` table
   - Add RLS policies
   - Create indexes

3. **Environment Variables**
   ```env
   GOOGLE_CALENDAR_CLIENT_ID=
   GOOGLE_CALENDAR_CLIENT_SECRET=
   GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/google/calendar/callback
   ```

### Phase 2: OAuth Flow

4. **OAuth Service Layer**
   - Token exchange logic
   - Token refresh logic
   - Token storage/retrieval

5. **API Routes**
   - Auth initiation endpoint
   - Callback handler
   - Disconnect endpoint
   - Status check endpoint

### Phase 3: Calendar API

6. **Calendar Client**
   - Fetch events with pagination
   - Filter by date range
   - Extract attendee information

7. **Events API**
   - List events endpoint
   - Response formatting

### Phase 4: UI Integration

8. **Settings Page**
   - Connection status display
   - Connect/disconnect button
   - Last sync info

9. **Meeting Creation Enhancement**
   - Calendar event picker component
   - Auto-populate form fields
   - Attendee import

## Security Considerations

- Store refresh tokens encrypted at rest (Supabase handles this)
- Access tokens expire in 1 hour, auto-refresh as needed
- RLS ensures users can only access their own tokens
- Minimal scope: `calendar.events.readonly` only
- Revoke tokens on disconnect

## Testing Plan

1. **OAuth Flow**
   - Successful authorization
   - User cancellation
   - Token refresh
   - Disconnect and re-connect

2. **Calendar API**
   - Fetch events with various date ranges
   - Handle empty calendars
   - Handle API rate limits
   - Attendee parsing edge cases

3. **UI/UX**
   - Connection state transitions
   - Event selection and form population
   - Error handling and messaging

## Rollback Plan

If issues arise:
1. Feature flag to disable calendar integration
2. Users can manually disconnect in settings
3. Delete `user_oauth_tokens` table entries if needed
4. Remove Google Cloud OAuth credentials

## Timeline Estimate

- Phase 1 (Infrastructure): 1-2 hours
- Phase 2 (OAuth Flow): 2-3 hours
- Phase 3 (Calendar API): 1-2 hours
- Phase 4 (UI Integration): 2-3 hours
- Testing: 1-2 hours

**Total: ~8-12 hours of development**
