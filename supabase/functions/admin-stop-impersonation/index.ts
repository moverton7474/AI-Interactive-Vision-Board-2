/**
 * Admin Stop Impersonation - Edge Function
 *
 * Ends an active impersonation session.
 * Creates audit log entry for the session end.
 *
 * Request Body:
 * - session_token: The impersonation session token (required)
 * - reason: Reason for ending the session (optional)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  initAdminContext,
  successResponse,
  handleAdminError,
  adminErrorResponse,
  corsHeaders
} from '../_shared/admin-utils.ts'

declare const Deno: any;

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    });
  }

  if (req.method !== 'POST') {
    return adminErrorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Initialize admin context - only platform_admin can stop impersonation
    const ctx = await initAdminContext(req, supabase, ['platform_admin']);

    const { session_token, reason } = ctx.body || {};

    // Validate session_token
    if (!session_token) {
      return adminErrorResponse('session_token is required', 'MISSING_PARAM', 400);
    }

    if (typeof session_token !== 'string' || session_token.length < 32) {
      return adminErrorResponse('Invalid session_token format', 'INVALID_PARAM', 400);
    }

    // Verify the session exists and belongs to this admin
    const { data: session } = await supabase
      .from('admin_impersonation_sessions')
      .select('id, admin_user_id, target_user_id, is_active')
      .eq('session_token', session_token)
      .single();

    if (!session) {
      return adminErrorResponse('Impersonation session not found', 'NOT_FOUND', 404);
    }

    if (!session.is_active) {
      return adminErrorResponse('Impersonation session is already ended', 'ALREADY_ENDED', 400);
    }

    // Verify the admin owns this session
    if (session.admin_user_id !== ctx.authz.userId) {
      return adminErrorResponse('Cannot end another admin\'s impersonation session', 'FORBIDDEN', 403);
    }

    // End the session using the SQL function
    const { data: ended, error: endError } = await supabase
      .rpc('end_impersonation_session', {
        p_session_token: session_token,
        p_reason: reason || 'Manual stop by admin'
      });

    if (endError) {
      throw new Error(`Failed to end impersonation session: ${endError.message}`);
    }

    if (!ended) {
      return adminErrorResponse('Failed to end impersonation session', 'OPERATION_FAILED', 500);
    }

    return successResponse({
      ended: true,
      sessionId: session.id,
      message: 'Impersonation session ended successfully'
    });

  } catch (error) {
    return handleAdminError(error);
  }
});
