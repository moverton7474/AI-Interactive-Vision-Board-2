/**
 * Admin Start Impersonation - Edge Function
 *
 * Creates a time-limited impersonation session for platform admins.
 * Allows admins to "see what the user sees" without exposing secrets.
 *
 * Security:
 * - Only platform_admin can impersonate
 * - Creates audit log entry
 * - Session is time-limited (default 60 minutes)
 * - Cannot impersonate yourself
 * - Returns a session token for frontend use
 *
 * Request Body:
 * - target_user_id: UUID of user to impersonate (required)
 * - reason: Reason for impersonation (recommended for audit trail)
 * - duration_minutes: Session duration (default: 60, max: 240)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  initAdminContext,
  successResponse,
  handleAdminError,
  adminErrorResponse,
  isValidUUID,
  corsHeaders
} from '../_shared/admin-utils.ts'

declare const Deno: any;

const MAX_DURATION_MINUTES = 240; // 4 hours max
const DEFAULT_DURATION_MINUTES = 60;

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

    // Initialize admin context - ONLY platform_admin can impersonate
    const ctx = await initAdminContext(req, supabase, ['platform_admin']);

    const { target_user_id, reason, duration_minutes } = ctx.body || {};

    // Validate target_user_id
    if (!target_user_id) {
      return adminErrorResponse('target_user_id is required', 'MISSING_PARAM', 400);
    }

    if (!isValidUUID(target_user_id)) {
      return adminErrorResponse('Invalid target_user_id format', 'INVALID_PARAM', 400);
    }

    // Prevent self-impersonation
    if (target_user_id === ctx.authz.userId) {
      return adminErrorResponse('Cannot impersonate yourself', 'FORBIDDEN', 403);
    }

    // Validate and clamp duration
    let duration = duration_minutes || DEFAULT_DURATION_MINUTES;
    if (typeof duration !== 'number' || duration < 1) {
      duration = DEFAULT_DURATION_MINUTES;
    }
    duration = Math.min(duration, MAX_DURATION_MINUTES);

    // Verify target user exists
    const { data: targetUser, error: userError } = await supabase
      .from('profiles')
      .select('id, names, email')
      .eq('id', target_user_id)
      .single();

    if (userError || !targetUser) {
      return adminErrorResponse('Target user not found', 'NOT_FOUND', 404);
    }

    // Get IP and user agent for audit
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || null;
    const userAgent = req.headers.get('user-agent') || null;

    // Create impersonation session using the SQL function
    const { data: session, error: sessionError } = await supabase
      .rpc('create_impersonation_session', {
        p_admin_user_id: ctx.authz.userId,
        p_target_user_id: target_user_id,
        p_reason: reason || 'Admin support request',
        p_duration_minutes: duration,
        p_ip_address: ipAddress,
        p_user_agent: userAgent
      });

    if (sessionError) {
      throw new Error(`Failed to create impersonation session: ${sessionError.message}`);
    }

    if (!session || session.length === 0) {
      throw new Error('Failed to create impersonation session');
    }

    const sessionData = session[0];

    return successResponse({
      impersonation: {
        sessionId: sessionData.session_id,
        sessionToken: sessionData.session_token,
        targetUser: {
          id: targetUser.id,
          name: targetUser.names,
          email: targetUser.email
        },
        expiresAt: sessionData.expires_at,
        durationMinutes: duration
      },
      instructions: [
        'Use the session_token in the X-Impersonation-Token header for subsequent requests',
        'The session will automatically expire after the specified duration',
        'Use admin-stop-impersonation to end the session early',
        'All actions during impersonation are logged for audit purposes'
      ]
    });

  } catch (error) {
    return handleAdminError(error);
  }
});
