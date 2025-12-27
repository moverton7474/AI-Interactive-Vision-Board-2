import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createTracer } from "../_shared/agent-tracing.ts";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalendarEventRequest {
  title: string;
  description?: string;
  start_time: string; // ISO 8601
  end_time: string; // ISO 8601
  location?: string;
  attendees?: string[]; // Email addresses
  reminders?: {
    method: 'email' | 'popup';
    minutes: number;
  }[];
  related_goal_id?: string;
  related_habit_id?: string;
}

/**
 * Google Calendar Event Creation
 *
 * Creates events in the user's connected Google Calendar.
 * Supports:
 * - Basic event creation with title, description, time
 * - Location and attendees
 * - Custom reminders
 * - Linking to goals/habits for context
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

    const supabase = createClient(SUPABASE_URL ?? '', SUPABASE_SERVICE_ROLE_KEY ?? '');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Invalid or expired authentication token');
    }

    const userId = user.id;
    const tracer = createTracer(supabase, userId);
    const eventRequest: CalendarEventRequest = await req.json();

    // Validate required fields
    if (!eventRequest.title || !eventRequest.start_time || !eventRequest.end_time) {
      throw new Error('title, start_time, and end_time are required');
    }

    // Trace the tool call
    await tracer.traceToolCall({
      toolName: 'google_calendar',
      functionName: 'create_event',
      inputData: {
        title: eventRequest.title,
        start_time: eventRequest.start_time,
        end_time: eventRequest.end_time
      }
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
      // Token expires in less than 1 minute, refresh it
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

      // Fetch updated token
      const { data: refreshedConn } = await supabase
        .from('user_calendar_connections')
        .select('access_token_encrypted')
        .eq('id', connection.id)
        .single();

      accessToken = refreshedConn?.access_token_encrypted || accessToken;
    }

    // Build Google Calendar event
    const googleEvent: any = {
      summary: eventRequest.title,
      description: eventRequest.description || '',
      start: {
        dateTime: eventRequest.start_time,
        timeZone: 'UTC'
      },
      end: {
        dateTime: eventRequest.end_time,
        timeZone: 'UTC'
      }
    };

    if (eventRequest.location) {
      googleEvent.location = eventRequest.location;
    }

    if (eventRequest.attendees && eventRequest.attendees.length > 0) {
      googleEvent.attendees = eventRequest.attendees.map(email => ({ email }));
    }

    if (eventRequest.reminders && eventRequest.reminders.length > 0) {
      googleEvent.reminders = {
        useDefault: false,
        overrides: eventRequest.reminders.map(r => ({
          method: r.method,
          minutes: r.minutes
        }))
      };
    } else {
      googleEvent.reminders = {
        useDefault: true
      };
    }

    // Add extended properties for linking to goals/habits
    if (eventRequest.related_goal_id || eventRequest.related_habit_id) {
      googleEvent.extendedProperties = {
        private: {
          ...(eventRequest.related_goal_id && { visionBoardGoalId: eventRequest.related_goal_id }),
          ...(eventRequest.related_habit_id && { visionBoardHabitId: eventRequest.related_habit_id }),
          source: 'vision-board-ai-coach'
        }
      };
    }

    // Create event in Google Calendar
    const createResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id || 'primary'}/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(googleEvent)
      }
    );

    const eventData = await createResponse.json();
    const duration = Date.now() - startTime;

    if (eventData.error) {
      await tracer.traceToolResult({
        toolName: 'google_calendar',
        functionName: 'create_event',
        outputData: { error: eventData.error },
        durationMs: duration,
        error: eventData.error.message
      });

      throw new Error(`Google Calendar error: ${eventData.error.message}`);
    }

    // Update last synced time
    await supabase
      .from('user_calendar_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connection.id);

    // Log to agent action history
    await supabase.from('agent_action_history').insert({
      user_id: userId,
      action_type: 'create_calendar_event',
      action_status: 'executed',
      action_payload: {
        title: eventRequest.title,
        start_time: eventRequest.start_time,
        end_time: eventRequest.end_time,
        google_event_id: eventData.id
      },
      trigger_context: 'calendar_tool',
      executed_at: new Date().toISOString()
    });

    // Trace success
    await tracer.traceToolResult({
      toolName: 'google_calendar',
      functionName: 'create_event',
      outputData: {
        event_id: eventData.id,
        html_link: eventData.htmlLink
      },
      durationMs: duration
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Calendar event created: ${eventRequest.title}`,
        event: {
          id: eventData.id,
          title: eventData.summary,
          start: eventData.start,
          end: eventData.end,
          html_link: eventData.htmlLink
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Calendar create event error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
