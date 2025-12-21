'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { Calendar, Check, X, Loader2, ExternalLink } from 'lucide-react';

interface CalendarStatus {
  configured: boolean;
  connected: boolean;
  provider: string | null;
  connectedAt: string | null;
}

export function CalendarConnect() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();

    // Check for success/error in URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'calendar_connected') {
      setError(null);
      // Clear the URL param
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('error')?.startsWith('calendar_')) {
      setError('Failed to connect calendar. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/google/calendar/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch calendar status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/google/calendar/auth');
      if (!response.ok) {
        throw new Error('Failed to initiate authorization');
      }

      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (err) {
      setError('Failed to connect to Google Calendar');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google Calendar?')) {
      return;
    }

    setIsDisconnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/google/calendar/disconnect', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setStatus({ ...status!, connected: false, provider: null, connectedAt: null });
    } catch (err) {
      setError('Failed to disconnect calendar');
    } finally {
      setIsDisconnecting(false);
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

  if (!status?.configured) {
    return (
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100">
            <Calendar className="h-5 w-5 text-surface-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-900">
              Google Calendar
            </h2>
            <p className="text-sm text-surface-500">
              Integration not configured
            </p>
          </div>
        </div>
        <p className="text-sm text-surface-500">
          Google Calendar integration is not configured for this deployment.
          Contact your administrator to enable it.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
          status.connected ? 'bg-success-50' : 'bg-surface-100'
        }`}>
          <Calendar className={`h-5 w-5 ${
            status.connected ? 'text-success-600' : 'text-surface-600'
          }`} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-surface-900">
            Google Calendar
          </h2>
          <p className="text-sm text-surface-500">
            {status.connected
              ? 'Import meetings and attendees from your calendar'
              : 'Connect to import meetings when processing transcripts'
            }
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      {status.connected ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-success-200 bg-success-50/50 p-4">
            <div className="flex items-center gap-3">
              <Check className="h-5 w-5 text-success-600" />
              <div>
                <p className="font-medium text-surface-900">Connected</p>
                <p className="text-sm text-surface-500">
                  Connected {status.connectedAt && new Date(status.connectedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              isLoading={isDisconnecting}
              className="text-danger-600 hover:text-danger-700 hover:bg-danger-50"
            >
              <X className="h-4 w-4 mr-1" />
              Disconnect
            </Button>
          </div>

          <p className="text-sm text-surface-500">
            When creating a new meeting, you can select from your recent calendar events
            to auto-fill the meeting title, date, and attendees.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <Button
            onClick={handleConnect}
            isLoading={isConnecting}
            leftIcon={<Calendar className="h-4 w-4" />}
          >
            Connect Google Calendar
          </Button>

          <p className="text-xs text-surface-400">
            We only request read-only access to your calendar events.
            We will never modify your calendar.
          </p>
        </div>
      )}
    </div>
  );
}
