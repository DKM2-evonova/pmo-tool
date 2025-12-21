/**
 * Google Calendar Integration Types
 */

// OAuth token stored in database
export interface OAuthToken {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at: string | null;
  scopes: string[];
  created_at: string;
  updated_at: string;
}

// Google OAuth token response
export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// Google Calendar Event from API
export interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: GoogleCalendarAttendee[];
  organizer?: {
    email?: string;
    displayName?: string;
    self?: boolean;
  };
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
    }>;
    conferenceSolution?: {
      name: string;
    };
  };
  status?: string;
  htmlLink?: string;
  created?: string;
  updated?: string;
}

export interface GoogleCalendarAttendee {
  email?: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  self?: boolean;
  organizer?: boolean;
}

// Attendee with response status for our application
export interface CalendarAttendee {
  name: string | null;
  email: string;
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted' | null;
  isOrganizer: boolean;
}

// Simplified event for our application
export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  attendees: CalendarAttendee[];
  meetingLink: string | null;
  isGoogleMeet: boolean;
  // New fields for enhanced display
  location: string | null;
  organizer: {
    name: string | null;
    email: string;
  } | null;
  isAllDay: boolean;
  calendarLink: string | null;
  conferenceProvider: string | null; // "Google Meet", "Zoom", etc.
}

// Calendar connection status
export interface CalendarConnectionStatus {
  connected: boolean;
  provider: 'google_calendar' | null;
  email?: string;
  connectedAt?: string;
  expiresAt?: string;
}

// API response types
export interface CalendarEventsResponse {
  events: CalendarEvent[];
  nextPageToken?: string;
}

export interface CalendarAuthResponse {
  authUrl: string;
}

export interface CalendarStatusResponse {
  connected: boolean;
  provider: string | null;
  connectedAt: string | null;
}
