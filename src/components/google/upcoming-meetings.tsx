'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Users,
  Video,
  ExternalLink,
  Loader2,
  RefreshCw,
  MapPin,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  HelpCircle,
  User,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui';
import type { CalendarEvent, CalendarAttendee } from '@/lib/google/types';

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

function formatDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end.getTime() - start.getTime();
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
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
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function getTimeUntilEvent(startTime: string): string | null {
  const now = new Date();
  const start = new Date(startTime);
  const diffMs = start.getTime() - now.getTime();

  if (diffMs < 0) return null; // Already started
  if (diffMs > 24 * 60 * 60 * 1000) return null; // More than 24 hours away

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0 && minutes <= 15) return 'Starting soon';
  if (hours === 0) return `In ${minutes}m`;
  if (minutes === 0) return `In ${hours}h`;
  return `In ${hours}h ${minutes}m`;
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

function getResponseStatusIcon(status: CalendarAttendee['responseStatus']) {
  switch (status) {
    case 'accepted':
      return <Check className="h-3 w-3 text-success-500" />;
    case 'declined':
      return <X className="h-3 w-3 text-danger-500" />;
    case 'tentative':
      return <HelpCircle className="h-3 w-3 text-warning-500" />;
    default:
      return <HelpCircle className="h-3 w-3 text-surface-400" />;
  }
}

function getResponseStatusLabel(status: CalendarAttendee['responseStatus']) {
  switch (status) {
    case 'accepted':
      return 'Accepted';
    case 'declined':
      return 'Declined';
    case 'tentative':
      return 'Maybe';
    default:
      return 'Pending';
  }
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function getAvatarColor(email: string): string {
  const colors = [
    'from-blue-500 to-blue-600',
    'from-purple-500 to-purple-600',
    'from-emerald-500 to-emerald-600',
    'from-rose-500 to-rose-600',
    'from-amber-500 to-amber-600',
    'from-cyan-500 to-cyan-600',
    'from-indigo-500 to-indigo-600',
    'from-pink-500 to-pink-600',
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function ConferenceIcon({ provider }: { provider: string | null }) {
  if (provider === 'Zoom') {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.585 6.836A2.586 2.586 0 0 0 2 9.422v5.156a2.586 2.586 0 0 0 2.585 2.586h8.672a2.586 2.586 0 0 0 2.586-2.586v-1.078l3.3 2.2a1.034 1.034 0 0 0 1.614-.857V9.157a1.034 1.034 0 0 0-1.613-.857l-3.301 2.2V9.422a2.586 2.586 0 0 0-2.586-2.586z" />
      </svg>
    );
  }
  return <Video className="h-4 w-4" />;
}

interface MeetingCardProps {
  event: CalendarEvent;
  isExpanded: boolean;
  onToggle: () => void;
}

function MeetingCard({ event, isExpanded, onToggle }: MeetingCardProps) {
  const timeUntil = getTimeUntilEvent(event.startTime);
  const isStartingSoon = timeUntil === 'Starting soon';
  const acceptedCount = event.attendees.filter((a) => a.responseStatus === 'accepted').length;
  const pendingCount = event.attendees.filter(
    (a) => !a.responseStatus || a.responseStatus === 'needsAction'
  ).length;

  return (
    <div
      className={`
        glass-card p-4 cursor-pointer
        ${isStartingSoon ? 'ring-2 ring-primary-500/30 ring-offset-1' : ''}
      `}
      onClick={onToggle}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title & Time Until */}
          <div className="flex items-start gap-2">
            <h4 className="font-semibold text-surface-900 leading-tight">
              {event.title}
            </h4>
            {timeUntil && (
              <span
                className={`
                  flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium
                  ${
                    isStartingSoon
                      ? 'bg-primary-100 text-primary-700 animate-pulse'
                      : 'bg-surface-100 text-surface-600'
                  }
                `}
              >
                {timeUntil}
              </span>
            )}
          </div>

          {/* Time & Duration */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1.5 text-sm text-surface-600">
              <Clock className="h-3.5 w-3.5 text-surface-400" />
              <span>{formatEventTime(event.startTime, event.endTime)}</span>
              <span className="text-surface-400">·</span>
              <span className="text-surface-500">
                {event.isAllDay ? 'All day' : formatDuration(event.startTime, event.endTime)}
              </span>
            </div>
          </div>

          {/* Quick Info Row */}
          <div className="flex items-center flex-wrap gap-3 mt-2">
            {/* Attendees Summary */}
            {event.attendees.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  {event.attendees.slice(0, 3).map((attendee, idx) => (
                    <div
                      key={attendee.email}
                      className={`
                        w-6 h-6 rounded-full flex items-center justify-center
                        text-[10px] font-semibold text-white
                        bg-gradient-to-br ${getAvatarColor(attendee.email)}
                        ring-2 ring-white
                      `}
                      style={{ zIndex: 3 - idx }}
                      title={attendee.name || attendee.email}
                    >
                      {getInitials(attendee.name, attendee.email)}
                    </div>
                  ))}
                  {event.attendees.length > 3 && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center
                        text-[10px] font-semibold bg-surface-200 text-surface-600
                        ring-2 ring-white"
                    >
                      +{event.attendees.length - 3}
                    </div>
                  )}
                </div>
                <span className="text-xs text-surface-500">
                  {acceptedCount > 0 && (
                    <span className="text-success-600">{acceptedCount} yes</span>
                  )}
                  {acceptedCount > 0 && pendingCount > 0 && ' · '}
                  {pendingCount > 0 && <span className="text-surface-500">{pendingCount} pending</span>}
                </span>
              </div>
            )}

            {/* Location */}
            {event.location && (
              <div className="flex items-center gap-1 text-xs text-surface-500">
                <MapPin className="h-3 w-3" />
                <span className="truncate max-w-[150px]">{event.location}</span>
              </div>
            )}

            {/* Conference Provider Badge */}
            {event.conferenceProvider && (
              <div
                className={`
                  flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                  ${
                    event.isGoogleMeet
                      ? 'bg-blue-50 text-blue-700'
                      : event.conferenceProvider === 'Zoom'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-surface-100 text-surface-600'
                  }
                `}
              >
                <ConferenceIcon provider={event.conferenceProvider} />
                <span>{event.conferenceProvider}</span>
              </div>
            )}
          </div>

          {/* Description Preview */}
          {event.description && !isExpanded && (
            <p className="mt-2 text-sm text-surface-600 line-clamp-2">
              {event.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {event.meetingLink && (
            <a
              href={event.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                text-sm font-medium transition-all
                ${
                  isStartingSoon
                    ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'
                    : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                }
              `}
            >
              <ConferenceIcon provider={event.conferenceProvider} />
              <span>Join</span>
            </a>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-surface-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-surface-400" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-surface-100 space-y-4">
          {/* Description */}
          {event.description && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-surface-500 mb-1.5">
                <FileText className="h-3.5 w-3.5" />
                <span>Description</span>
              </div>
              <p className="text-sm text-surface-700 whitespace-pre-wrap line-clamp-4">
                {event.description}
              </p>
            </div>
          )}

          {/* Organizer */}
          {event.organizer && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-surface-500 mb-1.5">
                <User className="h-3.5 w-3.5" />
                <span>Organizer</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center
                    text-xs font-semibold text-white
                    bg-gradient-to-br ${getAvatarColor(event.organizer.email)}
                  `}
                >
                  {getInitials(event.organizer.name, event.organizer.email)}
                </div>
                <div>
                  <p className="text-sm font-medium text-surface-900">
                    {event.organizer.name || event.organizer.email}
                  </p>
                  {event.organizer.name && (
                    <p className="text-xs text-surface-500">{event.organizer.email}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Attendees List */}
          {event.attendees.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-surface-500 mb-2">
                <Users className="h-3.5 w-3.5" />
                <span>Attendees ({event.attendees.length})</span>
              </div>
              <div className="grid gap-2">
                {event.attendees.map((attendee) => (
                  <div
                    key={attendee.email}
                    className="flex items-center gap-3 p-2 rounded-lg bg-surface-50/50"
                  >
                    <div
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center
                        text-xs font-semibold text-white
                        bg-gradient-to-br ${getAvatarColor(attendee.email)}
                      `}
                    >
                      {getInitials(attendee.name, attendee.email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-900 truncate">
                        {attendee.name || attendee.email}
                        {attendee.isOrganizer && (
                          <span className="ml-1.5 text-xs text-surface-500">(Organizer)</span>
                        )}
                      </p>
                      {attendee.name && (
                        <p className="text-xs text-surface-500 truncate">{attendee.email}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getResponseStatusIcon(attendee.responseStatus)}
                      <span
                        className={`
                          text-xs font-medium
                          ${
                            attendee.responseStatus === 'accepted'
                              ? 'text-success-600'
                              : attendee.responseStatus === 'declined'
                              ? 'text-danger-600'
                              : attendee.responseStatus === 'tentative'
                              ? 'text-warning-600'
                              : 'text-surface-500'
                          }
                        `}
                      >
                        {getResponseStatusLabel(attendee.responseStatus)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Location (full) */}
          {event.location && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-surface-500 mb-1.5">
                <MapPin className="h-3.5 w-3.5" />
                <span>Location</span>
              </div>
              <p className="text-sm text-surface-700">{event.location}</p>
            </div>
          )}

          {/* View in Calendar Link */}
          {event.calendarLink && (
            <a
              href={event.calendarLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700"
            >
              <Calendar className="h-4 w-4" />
              <span>View in Google Calendar</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function UpcomingMeetings() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

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
          setStatus((prev) => (prev ? { ...prev, connected: false } : null));
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

  const toggleExpanded = (eventId: string) => {
    setExpandedEventId((prev) => (prev === eventId ? null : eventId));
  };

  if (isLoading) {
    return (
      <div className="glass-panel p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        </div>
      </div>
    );
  }

  // Integration not configured
  if (!status?.configured) {
    return null;
  }

  // Not connected - show prompt to connect
  if (!status?.connected) {
    return (
      <div className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-sm">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-900">Upcoming Meetings</h2>
            <p className="text-sm text-surface-500">Connect your calendar to see upcoming meetings</p>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-surface-300 bg-surface-50/50 p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center mb-4">
            <Calendar className="h-8 w-8 text-primary-600" />
          </div>
          <h3 className="text-base font-semibold text-surface-900 mb-2">
            Connect Google Calendar
          </h3>
          <p className="text-sm text-surface-600 mb-6 max-w-sm mx-auto">
            Link your Google Calendar to view upcoming meetings, see attendees, and quickly join
            video calls.
          </p>
          <Button onClick={handleConnect} leftIcon={<Calendar className="h-4 w-4" />}>
            Connect Google Calendar
          </Button>
          <p className="text-xs text-surface-400 mt-4">
            Read-only access. We will never modify your calendar.
          </p>
        </div>
      </div>
    );
  }

  const groupedEvents = groupEventsByDate(events);

  return (
    <div className="glass-panel p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-sm">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-900">Upcoming Meetings</h2>
            <p className="text-sm text-surface-500">
              {events.length === 0 ? 'No meetings scheduled' : `${events.length} meetings this week`}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-surface-500 hover:text-surface-700"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-4 rounded-xl bg-danger-50 border border-danger-100 p-4">
          <p className="text-sm text-danger-700">{error}</p>
          {status && !status.connected && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleConnect}
              className="mt-2 text-danger-700 hover:text-danger-800"
            >
              Reconnect Calendar
            </Button>
          )}
        </div>
      )}

      {/* Empty State */}
      {events.length === 0 ? (
        <div className="rounded-xl border border-surface-200 bg-surface-50/50 p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center mb-3">
            <Calendar className="h-6 w-6 text-surface-400" />
          </div>
          <p className="text-sm text-surface-600 font-medium">No upcoming meetings</p>
          <p className="text-xs text-surface-400 mt-1">
            Your calendar is clear for the next 7 days
          </p>
        </div>
      ) : (
        /* Events List */
        <div className="space-y-6">
          {Array.from(groupedEvents.entries()).map(([dateKey, dateEvents]) => (
            <div key={dateKey}>
              {/* Date Header */}
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-surface-700">
                  {formatEventDate(dateEvents[0].startTime)}
                </h3>
                <div className="flex-1 h-px bg-surface-200" />
                <span className="text-xs text-surface-400">
                  {dateEvents.length} {dateEvents.length === 1 ? 'meeting' : 'meetings'}
                </span>
              </div>

              {/* Events for this date */}
              <div className="space-y-3">
                {dateEvents.map((event) => (
                  <MeetingCard
                    key={event.id}
                    event={event}
                    isExpanded={expandedEventId === event.id}
                    onToggle={() => toggleExpanded(event.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-surface-100 flex items-center justify-between">
        <Link
          href="/profile"
          className="text-sm text-surface-500 hover:text-surface-700 flex items-center gap-1.5 transition-colors"
        >
          <span>Manage calendar</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        <p className="text-xs text-surface-400">
          Synced with Google Calendar
        </p>
      </div>
    </div>
  );
}
