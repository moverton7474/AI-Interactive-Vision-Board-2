/**
 * Team Get Communications - Edge Function
 *
 * Lists all communications for a team with filtering and pagination.
 * Team managers can see all communications for their team.
 * Platform admins can see all communications across teams.
 *
 * Query Parameters:
 * - team_id: UUID of the team (required for non-platform-admins)
 * - status: Filter by status (draft, scheduled, sending, sent, partial, failed, cancelled)
 * - template_type: Filter by template type
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 20, max: 100)
 * - sort_by: Field to sort by (default: created_at)
 * - sort_order: 'asc' or 'desc' (default: desc)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  initAdminContext,
  successResponse,
  paginatedResponse,
  handleAdminError,
  adminErrorResponse,
  isValidUUID,
  parsePaginationParams,
  corsHeaders
} from '../_shared/admin-utils.ts'

declare const Deno: any;

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }
    });
  }

  if (req.method !== 'GET') {
    return adminErrorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Initialize admin context
    const ctx = await initAdminContext(req, supabase, ['platform_admin', 'support_agent']);

    // Parse query parameters
    const url = new URL(req.url);
    const team_id = url.searchParams.get('team_id');
    const status = url.searchParams.get('status');
    const template_type = url.searchParams.get('template_type');
    const sort_by = url.searchParams.get('sort_by') || 'created_at';
    const sort_order = url.searchParams.get('sort_order') || 'desc';

    const pagination = parsePaginationParams(url);

    const isPlatformAdmin = ctx.authz.platformRole === 'platform_admin';

    // Non-platform-admins must specify team_id
    if (!isPlatformAdmin && !team_id) {
      return adminErrorResponse('team_id is required', 'MISSING_PARAM', 400);
    }

    if (team_id && !isValidUUID(team_id)) {
      return adminErrorResponse('Invalid team_id format', 'INVALID_PARAM', 400);
    }

    // Verify user has access to the team
    if (team_id && !isPlatformAdmin) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', team_id)
        .eq('user_id', ctx.authz.userId)
        .eq('is_active', true)
        .single();

      if (!membership || !['owner', 'admin', 'manager'].includes(membership.role)) {
        return adminErrorResponse(
          'You must be a team manager to view communications',
          'FORBIDDEN',
          403
        );
      }
    }

    // Build query
    let query = supabase
      .from('team_communications')
      .select(`
        id,
        team_id,
        sender_id,
        subject,
        template_type,
        recipient_filter,
        total_recipients,
        sent_count,
        delivered_count,
        opened_count,
        clicked_count,
        failed_count,
        bounced_count,
        status,
        scheduled_for,
        sent_at,
        completed_at,
        created_at,
        updated_at,
        teams (
          id,
          name
        ),
        sender:profiles!team_communications_sender_id_fkey (
          id,
          names,
          email
        )
      `, { count: 'exact' });

    // Apply filters
    if (team_id) {
      query = query.eq('team_id', team_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (template_type) {
      query = query.eq('template_type', template_type);
    }

    // Apply sorting
    query = query.order(sort_by, { ascending: sort_order === 'asc' });

    // Apply pagination
    query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);

    const { data: communications, error, count } = await query;

    if (error) {
      console.error('Error fetching communications:', error);
      return adminErrorResponse('Failed to fetch communications', 'INTERNAL_ERROR', 500);
    }

    // Transform data for response
    const transformedData = (communications || []).map((comm: any) => ({
      id: comm.id,
      team_id: comm.team_id,
      team_name: comm.teams?.name || 'Unknown Team',
      sender_id: comm.sender_id,
      sender_name: comm.sender?.names || comm.sender?.email?.split('@')[0] || 'Unknown',
      sender_email: comm.sender?.email,
      subject: comm.subject,
      template_type: comm.template_type,
      recipient_filter: comm.recipient_filter,
      stats: {
        total_recipients: comm.total_recipients,
        sent: comm.sent_count,
        delivered: comm.delivered_count,
        opened: comm.opened_count,
        clicked: comm.clicked_count,
        failed: comm.failed_count,
        bounced: comm.bounced_count
      },
      open_rate: comm.delivered_count > 0
        ? Math.round((comm.opened_count / comm.delivered_count) * 100)
        : 0,
      click_rate: comm.opened_count > 0
        ? Math.round((comm.clicked_count / comm.opened_count) * 100)
        : 0,
      status: comm.status,
      scheduled_for: comm.scheduled_for,
      sent_at: comm.sent_at,
      completed_at: comm.completed_at,
      created_at: comm.created_at
    }));

    return paginatedResponse(transformedData, pagination, count || 0);

  } catch (error) {
    return handleAdminError(error);
  }
});
