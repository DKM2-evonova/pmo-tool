'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Video, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';
import type { CalendarEvent } from '@/lib/google/types';

interface CalendarEventPickerProps {
  onSelect: (event: CalendarEvent) => void;
  onCancel?: () => void;
}

export function CalendarEventPicker({ onSelect, onCancel }: CalendarEventPickerProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysBack, setDaysBack] = useState(14);

  useEffect(() => {
    fetchEvents();
  }, [daysBack]);

  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/google/calendar/events?mode=recent&daysBack=${daysBack}`);

      if (!response.ok) {
        const data = await response.json();
        if (data.code === 'RECONNECT_REQUIRED') {
          setError('Calendar connection expired. Please reconnect in your profile settings.');
        } else {
          throw new Error(data.error || 'Failed to fetch events');
        }
        return;
      }

      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      setError('Failed to load calendar events');
      console.error('Error fetching calendar events:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatEventTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Group events by date
  const groupedEvents = events.reduce((groups, event) => {
    const date = new Date(event.startTime).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(event);
    return groups;
  }, {} as Record<string, CalendarEvent[]>);

  // Sort dates in reverse chronological order (most recent first)
  const sortedDates = Object.keys(groupedEvents).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-danger-600 mb-4">{error}</p>
        <Button variant="secondary" onClick={fetchEvents}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-surface-900">
          Select a Meeting
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-surface-500">Show past</span>
          <select
            value={daysBack}
            onChange={(e) => setDaysBack(parseInt(e.target.value))}
            className="input py-1 px-2 text-sm"
          >
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </select>
        </div>
      </div>

      {/* Events list */}
      {events.length === 0 ? (
        <div className="text-center py-12 text-surface-500">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-surface-300" />
          <p>No meetings found in the last {daysBack} days</p>
          <p className="text-sm mt-1">
            Only meetings with attendees are shown
          </p>
        </div>
      ) : (
        <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
          {sortedDates.map((dateString) => (
            <div key={dateString}>
              <h4 className="text-sm font-medium text-surface-500 mb-2">
                {formatEventDate(dateString)}
              </h4>
              <div className="space-y-2">
                {groupedEvents[dateString].map((event) => (
                  <button
                    key={event.id}
                    onClick={() => onSelect(event)}
                    className="w-full text-left p-4 rounded-lg border border-surface-200 hover:border-primary-300 hover:bg-primary-50/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-surface-900 truncate">
                          {event.title}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-surface-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatEventTime(event.startTime)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
                          </span>
                          {event.isGoogleMeet && (
                            <span className="flex items-center gap-1 text-primary-600">
                              <Video className="h-3.5 w-3.5" />
                              Google Meet
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronDown className="h-5 w-5 text-surface-400 -rotate-90" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancel button */}
      {onCancel && (
        <div className="flex justify-end pt-4 border-t border-surface-200">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
