import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createTracer } from "../_shared/agent-tracing.ts";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AvailabilityRequest {
  date?: string; // YYYY-MM-DD, defaults to today
  start_date?: string; // For range queries
  end_date?: string; // For range queries
  duration_minutes?: number; // Find slots of this duration
  working_hours_start?: string; // HH:MM, defaults to 09:00
  working_hours_end?: string; // HH:MM, defaults to 17:00
}

interface TimeSlot {
  start: string;
  end: string;
  duration_minutes: number;
}

interface BusyPeriod {
  start: string;
  end: string;
  summary?: string;
}

/**
 * Google Calendar Availability Checker
 *
 * Checks user's calendar availability:
 * - Get busy periods for a date/range
 * - Find available time slots
 * - Suggest optimal meeting times
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid or expired authentication token');
    }

    const userId = user.id;
    const tracer = createTracer(supabase, userId);
    const request: AvailabilityRequest = await req.json();

    // Set defaults
    const today = new Date();
    const startDate = request.start_date || request.date ||
      today.toISOString().split('T')[0];
    const endDate = request.end_date ||
      new Date(new Date(startDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const workingHoursStart = request.working_hours_start || '09:00';
    const workingHoursEnd = request.working_hours_end || '17:00';
    const slotDuration = request.duration_minutes || 30;

    await tracer.traceToolCall({
      toolName: 'google_calendar',
      functionName: 'check_availability',
      inputData: { startDate, endDate, slotDuration }
    });

    const startTime = Date.now();

    // Get user's calendar connection
    const { data: connection, error: connError } = await supabase
      .from('user_calendar_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      throw new Error('No active Google Calendar connection. Please connect your calendar first.');
    }

    // Check if token needs refresh
    let accessToken = connection.access_token_encrypted;
    if (new Date(connection.token_expires_at) < new Date(Date.now() + 60 * 1000)) {
      const refreshResponse = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({ action: 'refresh' })
      });

      const refreshResult = await refreshResponse.json();
      if (!refreshResult.success) {
        throw new Error('Failed to refresh calendar token. Please reconnect your calendar.');
      }

      const { data: refreshedConn } = await supabase
        .from('user_calendar_connections')
        .select('access_token_encrypted')
        .eq('id', connection.id)
        .single();

      accessToken = refreshedConn?.access_token_encrypted || accessToken;
    }

    // Build time range
    const timeMin = new Date(`${startDate}T${workingHoursStart}:00Z`).toISOString();
    const timeMax = new Date(`${endDate}T${workingHoursEnd}:00Z`).toISOString();

    // Fetch events in the range
    const eventsUrl = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id || 'primary'}/events`
    );
    eventsUrl.searchParams.set('timeMin', timeMin);
    eventsUrl.searchParams.set('timeMax', timeMax);
    eventsUrl.searchParams.set('singleEvents', 'true');
    eventsUrl.searchParams.set('orderBy', 'startTime');

    const eventsResponse = await fetch(eventsUrl.toString(), {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const eventsData = await eventsResponse.json();
    const duration = Date.now() - startTime;

    if (eventsData.error) {
      await tracer.traceToolResult({
        toolName: 'google_calendar',
        functionName: 'check_availability',
        outputData: { error: eventsData.error },
        durationMs: duration,
        error: eventsData.error.message
      });

      throw new Error(`Google Calendar error: ${eventsData.error.message}`);
    }

    // Extract busy periods
    const busyPeriods: BusyPeriod[] = (eventsData.items || [])
      .filter((event: any) => event.status !== 'cancelled')
      .map((event: any) => ({
        start: event.start.dateTime || `${event.start.date}T${workingHoursStart}:00Z`,
        end: event.end.dateTime || `${event.end.date}T${workingHoursEnd}:00Z`,
        summary: event.summary
      }));

    // Calculate available slots
    const availableSlots: TimeSlot[] = [];
    const dates = getDatesBetween(startDate, endDate);

    for (const date of dates) {
      const dayStart = new Date(`${date}T${workingHoursStart}:00Z`);
      const dayEnd = new Date(`${date}T${workingHoursEnd}:00Z`);

      // Get busy periods for this day
      const dayBusy = busyPeriods.filter(bp => {
        const bpStart = new Date(bp.start);
        return bpStart >= dayStart && bpStart < dayEnd;
      }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      // Find gaps
      let currentTime = dayStart;

      for (const busy of dayBusy) {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);

        // Gap before this busy period
        const gapDuration = (busyStart.getTime() - currentTime.getTime()) / (1000 * 60);
        if (gapDuration >= slotDuration) {
          availableSlots.push({
            start: currentTime.toISOString(),
            end: busyStart.toISOString(),
            duration_minutes: Math.floor(gapDuration)
          });
        }

        currentTime = busyEnd > currentTime ? busyEnd : currentTime;
      }

      // Gap after last busy period
      const endGapDuration = (dayEnd.getTime() - currentTime.getTime()) / (1000 * 60);
      if (endGapDuration >= slotDuration) {
        availableSlots.push({
          start: currentTime.toISOString(),
          end: dayEnd.toISOString(),
          duration_minutes: Math.floor(endGapDuration)
        });
      }
    }

    // Update last synced time
    await supabase
      .from('user_calendar_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connection.id);

    await tracer.traceToolResult({
      toolName: 'google_calendar',
      functionName: 'check_availability',
      outputData: {
        busy_count: busyPeriods.length,
        available_slots_count: availableSlots.length
      },
      durationMs: duration
    });

    return new Response(
      JSON.stringify({
        success: true,
        date_range: { start: startDate, end: endDate },
        working_hours: { start: workingHoursStart, end: workingHoursEnd },
        busy_periods: busyPeriods.map(bp => ({
          start: bp.start,
          end: bp.end,
          // Don't expose event titles for privacy
          has_event: true
        })),
        available_slots: availableSlots,
        summary: {
          total_busy_events: busyPeriods.length,
          total_available_slots: availableSlots.length,
          next_available: availableSlots[0] || null
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Calendar availability error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

/**
 * Get array of dates between start and end (inclusive)
 */
function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current < end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
