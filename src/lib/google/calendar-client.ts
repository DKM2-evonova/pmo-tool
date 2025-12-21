/**
 * Google Calendar API Client
 */

import { getValidAccessToken } from './oauth';
import type { GoogleCalendarEvent, CalendarEvent, CalendarEventsResponse } from './types';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Fetch calendar events from Google Calendar API
 */
export async function fetchCalendarEvents(
  userId: string,
  options: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    pageToken?: string;
    calendarId?: string;
  } = {}
): Promise<CalendarEventsResponse> {
  const accessToken = await getValidAccessToken(userId);

  if (!accessToken) {
    throw new Error('No valid access token available. Please reconnect your calendar.');
  }

  const {
    timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    maxResults = 50,
    pageToken,
    calendarId = 'primary',
  } = options;

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    maxResults: maxResults.toString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    ...(pageToken && { pageToken }),
  });

  const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch calendar events: ${error}`);
  }

  const data = await response.json();
  const events: CalendarEvent[] = (data.items || [])
    .filter((event: GoogleCalendarEvent) => event.status !== 'cancelled')
    .map(transformGoogleEvent);

  return {
    events,
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Transform Google Calendar event to our simplified format
 */
function transformGoogleEvent(event: GoogleCalendarEvent): CalendarEvent {
  // Extract meeting link (Google Meet or other video conferencing)
  let meetingLink: string | null = null;
  let isGoogleMeet = false;
  let conferenceProvider: string | null = null;

  if (event.hangoutLink) {
    meetingLink = event.hangoutLink;
    isGoogleMeet = true;
    conferenceProvider = 'Google Meet';
  } else if (event.conferenceData?.entryPoints) {
    const videoEntry = event.conferenceData.entryPoints.find(
      (ep) => ep.entryPointType === 'video'
    );
    if (videoEntry) {
      meetingLink = videoEntry.uri;
      conferenceProvider = event.conferenceData.conferenceSolution?.name || null;
      isGoogleMeet = conferenceProvider === 'Google Meet';
    }
  }

  // Detect Zoom links in description or location if no conference data
  if (!meetingLink && (event.description || event.location)) {
    const zoomRegex = /https:\/\/[\w.-]*zoom\.us\/[^\s<>"]*/i;
    const textToSearch = `${event.description || ''} ${event.location || ''}`;
    const zoomMatch = textToSearch.match(zoomRegex);
    if (zoomMatch) {
      meetingLink = zoomMatch[0];
      conferenceProvider = 'Zoom';
    }
  }

  // Get start/end times (handle all-day events)
  const startTime = event.start.dateTime || event.start.date || '';
  const endTime = event.end.dateTime || event.end.date || '';
  const isAllDay = !event.start.dateTime && !!event.start.date;

  // Transform attendees with response status
  const attendees = (event.attendees || [])
    .filter((a) => !a.self) // Exclude the authenticated user
    .map((a) => ({
      name: a.displayName || null,
      email: a.email || '',
      responseStatus: a.responseStatus || null,
      isOrganizer: a.organizer || false,
    }))
    .filter((a) => a.email); // Only include attendees with emails

  // Extract organizer info
  const organizer = event.organizer?.email
    ? {
        name: event.organizer.displayName || null,
        email: event.organizer.email,
      }
    : null;

  return {
    id: event.id,
    title: event.summary || '(No title)',
    description: event.description || null,
    startTime,
    endTime,
    attendees,
    meetingLink,
    isGoogleMeet,
    location: event.location || null,
    organizer,
    isAllDay,
    calendarLink: event.htmlLink || null,
    conferenceProvider,
  };
}

/**
 * Get a single calendar event by ID
 */
export async function getCalendarEvent(
  userId: string,
  eventId: string,
  calendarId: string = 'primary'
): Promise<CalendarEvent | null> {
  const accessToken = await getValidAccessToken(userId);

  if (!accessToken) {
    throw new Error('No valid access token available. Please reconnect your calendar.');
  }

  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const error = await response.text();
    throw new Error(`Failed to fetch calendar event: ${error}`);
  }

  const event = await response.json();
  return transformGoogleEvent(event);
}

/**
 * Get the authenticated user's email from Google
 */
export async function getUserEmail(accessToken: string): Promise<string | null> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.email || null;
}

/**
 * Fetch recent past meetings (for meeting creation workflow)
 */
export async function fetchRecentMeetings(
  userId: string,
  daysBack: number = 14
): Promise<CalendarEvent[]> {
  const timeMin = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date().toISOString();

  const { events } = await fetchCalendarEvents(userId, {
    timeMin,
    timeMax,
    maxResults: 100,
  });

  // Filter to only include meetings with attendees (likely actual meetings, not personal events)
  return events.filter((event) => event.attendees.length > 0);
}

/**
 * Fetch upcoming meetings
 */
export async function fetchUpcomingMeetings(
  userId: string,
  daysAhead: number = 7
): Promise<CalendarEvent[]> {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

  const { events } = await fetchCalendarEvents(userId, {
    timeMin,
    timeMax,
    maxResults: 50,
  });

  return events.filter((event) => event.attendees.length > 0);
}
