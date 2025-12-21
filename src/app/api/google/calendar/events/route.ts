import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchCalendarEvents, fetchRecentMeetings } from '@/lib/google/calendar-client';

/**
 * GET /api/google/calendar/events
 * Fetches calendar events for the authenticated user
 *
 * Query params:
 * - mode: 'recent' (past meetings) | 'upcoming' | 'range' (default: 'recent')
 * - daysBack: number (for recent mode, default: 14)
 * - daysAhead: number (for upcoming mode, default: 7)
 * - timeMin: ISO string (for range mode)
 * - timeMax: ISO string (for range mode)
 * - pageToken: string (for pagination)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('mode') || 'recent';
    const daysBack = parseInt(searchParams.get('daysBack') || '14', 10);
    const daysAhead = parseInt(searchParams.get('daysAhead') || '7', 10);
    const timeMin = searchParams.get('timeMin');
    const timeMax = searchParams.get('timeMax');
    const pageToken = searchParams.get('pageToken') || undefined;

    let result;

    switch (mode) {
      case 'recent':
        // Fetch recent past meetings (good for meeting creation workflow)
        const events = await fetchRecentMeetings(user.id, daysBack);
        result = { events, nextPageToken: undefined };
        break;

      case 'upcoming':
        // Fetch upcoming meetings
        const timeMinUpcoming = new Date().toISOString();
        const timeMaxUpcoming = new Date(
          Date.now() + daysAhead * 24 * 60 * 60 * 1000
        ).toISOString();
        result = await fetchCalendarEvents(user.id, {
          timeMin: timeMinUpcoming,
          timeMax: timeMaxUpcoming,
          pageToken,
        });
        break;

      case 'range':
        // Fetch events in a specific date range
        if (!timeMin || !timeMax) {
          return NextResponse.json(
            { error: 'timeMin and timeMax are required for range mode' },
            { status: 400 }
          );
        }
        result = await fetchCalendarEvents(user.id, {
          timeMin,
          timeMax,
          pageToken,
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid mode. Use "recent", "upcoming", or "range"' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching calendar events:', error);

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('No valid access token')) {
        return NextResponse.json(
          { error: 'Calendar not connected or session expired', code: 'RECONNECT_REQUIRED' },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}
