'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, Clock, Users, Video, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';
import type { CalendarEvent } from '@/lib/google/types';

interface CalendarStatus {
  configured: boolean;
  connected: boolean;
  provider: string | null;
  connectedAt: string | null;
}

function formatEventTime(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
}

function formatEventDate(startTime: string): string {
  const date = new Date(startTime);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const dateKey = new Date(event.startTime).toDateString();
    const existing = grouped.get(dateKey) || [];
    grouped.set(dateKey, [...existing, event]);
  }

  return grouped;
}

export function UpcomingMeetings() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/google/calendar/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);

        if (data.connected) {
          await fetchEvents();
        }
      }
    } catch (err) {
      console.error('Failed to fetch calendar status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/google/calendar/events?mode=upcoming&daysAhead=7');
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
        setError(null);
      } else {
        const data = await response.json();
        if (data.code === 'RECONNECT_REQUIRED') {
          setStatus(prev => prev ? { ...prev, connected: false } : null);
          setError('Calendar connection expired. Please reconnect.');
        } else {
          setError('Failed to load upcoming meetings');
        }
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
      setError('Failed to load upcoming meetings');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchEvents();
    setIsRefreshing(false);
  };

  const handleConnect = async () => {
    try {
      const response = await fetch('/api/google/calendar/auth');
      if (!response.ok) {
        throw new Error('Failed to initiate authorization');
      }
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (err) {
      setError('Failed to connect to Google Calendar');
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        </div>
      </div>
    );
  }

  // Integration not configured
  if (!status?.configured) {
    return null; // Don't show anything if Google Calendar isn't configured
  }

  // Not connected - show prompt to connect
  if (!status?.connected) {
    return (
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
            <Calendar className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-900">
              Upcoming Meetings
            </h2>
            <p className="text-sm text-surface-500">
              Connect your calendar to see upcoming meetings
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-surface-300 bg-surface-50/50 p-6 text-center">
          <Calendar className="mx-auto h-10 w-10 text-surface-400 mb-3" />
          <p className="text-sm text-surface-600 mb-4">
            Link your Google Calendar to view upcoming meetings and quickly import them for processing.
          </p>
          <Button
            onClick={handleConnect}
            leftIcon={<Calendar className="h-4 w-4" />}
          >
            Connect Google Calendar
          </Button>
          <p className="text-xs text-surface-400 mt-3">
            Read-only access. We will never modify your calendar.
          </p>
        </div>
      </div>
    );
  }

  const groupedEvents = groupEventsByDate(events);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
            <Calendar className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-900">
              Upcoming Meetings
            </h2>
            <p className="text-sm text-surface-500">
              Next 7 days from Google Calendar
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
          {error}
          {status && !status.connected && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleConnect}
              className="ml-2 text-danger-700 underline"
            >
              Reconnect
            </Button>
          )}
        </div>
      )}

      {events.length === 0 ? (
        <div className="rounded-lg border border-surface-200 bg-surface-50/50 p-6 text-center">
          <Calendar className="mx-auto h-8 w-8 text-surface-400 mb-2" />
          <p className="text-sm text-surface-500">
            No upcoming meetings in the next 7 days
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(groupedEvents.entries()).map(([dateKey, dateEvents]) => (
            <div key={dateKey}>
              <h3 className="text-sm font-medium text-surface-500 mb-2">
                {formatEventDate(dateEvents[0].startTime)}
              </h3>
              <div className="space-y-2">
                {dateEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-surface-200 bg-white p-3 hover:border-surface-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-surface-900 truncate">
                          {event.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-sm text-surface-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatEventTime(event.startTime, event.endTime)}
                          </span>
                          {event.attendees.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {event.attendees.length}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.meetingLink && (
                          <a
                            href={event.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                          >
                            {event.isGoogleMeet ? (
                              <Video className="h-4 w-4" />
                            ) : (
                              <ExternalLink className="h-4 w-4" />
                            )}
                            <span className="hidden sm:inline">Join</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-surface-100">
        <Link
          href="/profile"
          className="text-sm text-surface-500 hover:text-surface-700 flex items-center gap-1"
        >
          <span>Manage calendar connection</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
