import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createTracer, withTiming } from "../_shared/agent-tracing.ts";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Confirm and execute a pending agent action
 *
 * This function handles the Human-in-the-Loop (HITL) confirmation flow.
 * When a user approves a pending action, this function:
 * 1. Validates the action is still pending and not expired
 * 2. Updates the action status to 'confirmed'
 * 3. Executes the original action
 * 4. Records the result and logs for feedback
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestStartTime = Date.now();

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
    const { action_id, feedback } = await req.json();

    // Initialize tracer for observability
    const tracer = createTracer(supabase, userId);

    if (!action_id) {
      throw new Error('action_id is required');
    }

    // Get the pending action
    const { data: pendingAction, error: fetchError } = await supabase
      .from('pending_agent_actions')
      .select('*')
      .eq('id', action_id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !pendingAction) {
      throw new Error('Pending action not found');
    }

    // Check if already processed
    if (pendingAction.status !== 'pending') {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Action already ${pendingAction.status}`,
          status: pendingAction.status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    if (new Date(pendingAction.expires_at) < new Date()) {
      await supabase
        .from('pending_agent_actions')
        .update({ status: 'expired' })
        .eq('id', action_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Action has expired. Please request it again.',
          status: 'expired'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as confirmed
    await supabase
      .from('pending_agent_actions')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      })
      .eq('id', action_id);

    // Execute the action with tracing
    const actionType = pendingAction.action_type;
    const actionPayload = pendingAction.action_payload;
    let executionResult: any;

    // Trace user confirmation response
    const confirmationTime = Date.now() - new Date(pendingAction.created_at).getTime();
    await tracer.traceUserResponse({
      actionType,
      response: 'confirmed',
      feedback: feedback || undefined,
      timeToDecisionMs: confirmationTime,
    });

    try {
      // Trace tool call start
      await tracer.traceToolCall({
        toolName: 'action_executor',
        functionName: actionType,
        inputData: actionPayload,
        confidenceScore: pendingAction.confidence_score,
      });

      const executionStart = Date.now();
      executionResult = await executeAction(supabase, userId, actionType, actionPayload);
      const executionDuration = Date.now() - executionStart;

      // Trace tool result
      await tracer.traceToolResult({
        toolName: 'action_executor',
        functionName: actionType,
        outputData: executionResult,
        durationMs: executionDuration,
        error: executionResult.success ? undefined : executionResult.error,
      });

      // Trace action executed
      await tracer.traceActionExecuted({
        actionType,
        inputData: actionPayload,
        outputData: executionResult,
        durationMs: executionDuration,
        success: executionResult.success,
        error: executionResult.success ? undefined : executionResult.error,
      });

      // Update pending action with result
      await supabase
        .from('pending_agent_actions')
        .update({
          status: executionResult.success ? 'executed' : 'failed',
          executed_at: new Date().toISOString(),
          execution_result: executionResult
        })
        .eq('id', action_id);

      // Log to agent action history
      await supabase.from('agent_action_history').insert({
        user_id: userId,
        action_type: actionType,
        action_status: executionResult.success ? 'executed' : 'failed',
        action_payload: actionPayload,
        trigger_context: 'confirmation',
        confidence_score: pendingAction.confidence_score,
        risk_level: pendingAction.risk_level,
        executed_at: new Date().toISOString()
      });

      // Record feedback if provided
      if (feedback) {
        await supabase.from('agent_action_feedback').insert({
          user_id: userId,
          action_id: action_id,
          feedback_type: 'confirmation',
          rating: feedback.rating,
          comment: feedback.comment,
          time_to_decision_ms: confirmationTime,
          created_at: new Date().toISOString()
        });
      }

    } catch (execError: any) {
      console.error('Action execution error:', execError);

      // Trace error
      await tracer.traceError({
        errorCode: 'EXECUTION_FAILED',
        errorMessage: execError.message,
        context: { actionType, actionPayload },
        functionName: actionType,
      });

      await supabase
        .from('pending_agent_actions')
        .update({
          status: 'failed',
          execution_result: { error: execError.message }
        })
        .eq('id', action_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Execution failed: ${execError.message}`,
          status: 'failed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Action executed: ${actionType.replace(/_/g, ' ')}`,
        result: executionResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Confirm action error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

/**
 * Execute the confirmed action based on type
 */
async function executeAction(
  supabase: any,
  userId: string,
  actionType: string,
  payload: any
): Promise<any> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  switch (actionType) {
    case 'make_voice_call': {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/agent-voice-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          user_id: userId,
          phone_number: payload.phone_number,
          call_type: payload.call_type,
          message: payload.message,
          related_habit_id: payload.related_habit_id,
          related_goal_id: payload.related_goal_id
        })
      });
      return await response.json();
    }

    case 'send_sms': {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/agent-send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          user_id: userId,
          phone_number: payload.phone_number,
          message: payload.message
        })
      });
      return await response.json();
    }

    case 'send_email': {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          to: payload.to,
          subject: payload.subject,
          template: 'generic',
          data: {
            subject: payload.subject,
            html: `<p>${payload.body}</p>`,
            content: payload.body
          }
        })
      });
      return await response.json();
    }

    case 'create_calendar_event': {
      // Calendar integration would go here
      // For now, create as a task with calendar metadata
      const { data: task, error } = await supabase
        .from('action_steps')
        .insert({
          user_id: userId,
          title: payload.title,
          description: payload.description || '',
          due_date: payload.start_time?.split('T')[0],
          priority: 'medium',
          status: 'pending',
          metadata: {
            calendar_event: true,
            start_time: payload.start_time,
            end_time: payload.end_time,
            attendees: payload.attendees
          }
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, message: `Calendar event created: ${payload.title}`, taskId: task.id };
    }

    case 'send_email_to_contact': {
      // High-security action: sending email to external contact
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          to: payload.contact_email,
          subject: payload.subject,
          template: 'user_to_contact',
          data: {
            from_name: payload.from_name,
            subject: payload.subject,
            html: `<p>${payload.body}</p>`,
            content: payload.body
          }
        })
      });
      return await response.json();
    }

    default:
      return { success: false, error: `Unknown action type: ${actionType}` };
  }
}
