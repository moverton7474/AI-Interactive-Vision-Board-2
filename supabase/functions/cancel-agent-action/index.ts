import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createTracer } from "../_shared/agent-tracing.ts";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Cancel a pending agent action
 *
 * This function handles the Human-in-the-Loop (HITL) rejection flow.
 * When a user declines a pending action, this function:
 * 1. Validates the action is still pending
 * 2. Updates the action status to 'cancelled'
 * 3. Records the reason and any feedback
 * 4. Logs the cancellation for learning/improvement
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
    const { action_id, reason, feedback } = await req.json();

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

    // Update to cancelled status
    const { error: updateError } = await supabase
      .from('pending_agent_actions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || 'User declined'
      })
      .eq('id', action_id);

    if (updateError) {
      throw new Error(`Failed to cancel action: ${updateError.message}`);
    }

    // Calculate time to decision for analytics
    const timeToDecisionMs = Date.now() - new Date(pendingAction.created_at).getTime();

    // Trace user cancellation response
    await tracer.traceUserResponse({
      actionType: pendingAction.action_type,
      response: 'cancelled',
      feedback: { reason, ...feedback },
      timeToDecisionMs,
    });

    // Log to agent action history
    await supabase.from('agent_action_history').insert({
      user_id: userId,
      action_type: pendingAction.action_type,
      action_status: 'cancelled',
      action_payload: pendingAction.action_payload,
      trigger_context: 'cancellation',
      confidence_score: pendingAction.confidence_score,
      risk_level: pendingAction.risk_level,
      executed_at: new Date().toISOString()
    });

    // Record feedback if provided (helps improve AI suggestions)
    const categorizedReason = categorizeRejection(reason);
    if (feedback) {
      await supabase.from('agent_action_feedback').insert({
        user_id: userId,
        action_id: action_id,
        feedback_type: 'rejection',
        rating: feedback.rating,
        comment: feedback.comment || reason,
        rejection_reason: categorizedReason,
        time_to_decision_ms: timeToDecisionMs,
        created_at: new Date().toISOString()
      });
    } else if (reason) {
      // Auto-generate feedback from reason
      await supabase.from('agent_action_feedback').insert({
        user_id: userId,
        action_id: action_id,
        feedback_type: 'rejection',
        comment: reason,
        rejection_reason: categorizedReason,
        time_to_decision_ms: timeToDecisionMs,
        created_at: new Date().toISOString()
      });
    }

    // Trace decision point for analytics
    await tracer.traceDecisionPoint({
      decision: 'action_cancelled',
      factors: {
        action_type: pendingAction.action_type,
        risk_level: pendingAction.risk_level,
        rejection_category: categorizedReason
      },
      outcome: 'rejected',
      confidenceScore: pendingAction.confidence_score,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Action cancelled: ${pendingAction.action_type.replace(/_/g, ' ')}`,
        actionType: pendingAction.action_type
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Cancel action error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

/**
 * Categorize rejection reason for analytics and learning
 */
function categorizeRejection(reason: string): string {
  if (!reason) return 'unspecified';

  const lowerReason = reason.toLowerCase();

  // Timing-related
  if (lowerReason.includes('not now') || lowerReason.includes('later') ||
      lowerReason.includes('busy') || lowerReason.includes('timing')) {
    return 'timing';
  }

  // Privacy/security concerns
  if (lowerReason.includes('privacy') || lowerReason.includes('secure') ||
      lowerReason.includes('sensitive') || lowerReason.includes('personal')) {
    return 'privacy';
  }

  // Incorrect action
  if (lowerReason.includes('wrong') || lowerReason.includes('incorrect') ||
      lowerReason.includes('mistake') || lowerReason.includes('not what')) {
    return 'incorrect_action';
  }

  // Changed mind
  if (lowerReason.includes('changed') || lowerReason.includes('nevermind') ||
      lowerReason.includes('cancel') || lowerReason.includes("don't want")) {
    return 'changed_mind';
  }

  // Cost/resource concerns
  if (lowerReason.includes('expensive') || lowerReason.includes('cost') ||
      lowerReason.includes('limit') || lowerReason.includes('quota')) {
    return 'resource_concern';
  }

  // Prefer manual
  if (lowerReason.includes('manual') || lowerReason.includes('myself') ||
      lowerReason.includes('prefer to') || lowerReason.includes("i'll do")) {
    return 'prefer_manual';
  }

  return 'other';
}
