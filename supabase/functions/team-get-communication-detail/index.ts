/**
 * Team Get Communication Detail - Edge Function
 *
 * Retrieves detailed information about a specific communication,
 * including recipient list with delivery status.
 *
 * Query Parameters:
 * - id: UUID of the communication (required)
 * - include_recipients: boolean - include recipient list (default: true)
 * - recipient_status: Filter recipients by status
 * - recipient_page: Page number for recipients (default: 1)
 * - recipient_limit: Recipients per page (default: 50, max: 200)
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
    const communication_id = url.searchParams.get('id');
    const include_recipients = url.searchParams.get('include_recipients') !== 'false';
    const recipient_status = url.searchParams.get('recipient_status');
    const recipient_page = Math.max(1, parseInt(url.searchParams.get('recipient_page') || '1'));
    const recipient_limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('recipient_limit') || '50')));
    const recipient_offset = (recipient_page - 1) * recipient_limit;

    if (!communication_id) {
      return adminErrorResponse('id is required', 'MISSING_PARAM', 400);
    }

    if (!isValidUUID(communication_id)) {
      return adminErrorResponse('Invalid id format', 'INVALID_PARAM', 400);
    }

    // Fetch communication with team and sender info
    const { data: communication, error: commError } = await supabase
      .from('team_communications')
      .select(`
        *,
        teams (
          id,
          name,
          owner_id
        ),
        sender:profiles!team_communications_sender_id_fkey (
          id,
          names,
          email
        )
      `)
      .eq('id', communication_id)
      .single();

    if (commError || !communication) {
      return adminErrorResponse('Communication not found', 'NOT_FOUND', 404);
    }

    // Verify user has access
    const isPlatformAdmin = ctx.authz.platformRole === 'platform_admin';

    if (!isPlatformAdmin) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', communication.team_id)
        .eq('user_id', ctx.authz.userId)
        .eq('is_active', true)
        .single();

      if (!membership || !['owner', 'admin', 'manager'].includes(membership.role)) {
        return adminErrorResponse(
          'You must be a team manager to view this communication',
          'FORBIDDEN',
          403
        );
      }
    }

    // Build response
    const response: any = {
      id: communication.id,
      team_id: communication.team_id,
      team_name: communication.teams?.name || 'Unknown Team',
      sender: {
        id: communication.sender_id,
        name: communication.sender?.names || communication.sender?.email?.split('@')[0] || 'Unknown',
        email: communication.sender?.email
      },
      subject: communication.subject,
      body_html: communication.body_html,
      body_text: communication.body_text,
      template_type: communication.template_type,
      recipient_filter: communication.recipient_filter,
      stats: {
        total_recipients: communication.total_recipients,
        sent: communication.sent_count,
        delivered: communication.delivered_count,
        opened: communication.opened_count,
        clicked: communication.clicked_count,
        failed: communication.failed_count,
        bounced: communication.bounced_count
      },
      rates: {
        delivery_rate: communication.total_recipients > 0
          ? Math.round((communication.sent_count / communication.total_recipients) * 100)
          : 0,
        open_rate: communication.delivered_count > 0
          ? Math.round((communication.opened_count / communication.delivered_count) * 100)
          : 0,
        click_rate: communication.opened_count > 0
          ? Math.round((communication.clicked_count / communication.opened_count) * 100)
          : 0,
        bounce_rate: communication.total_recipients > 0
          ? Math.round((communication.bounced_count / communication.total_recipients) * 100)
          : 0
      },
      status: communication.status,
      scheduled_for: communication.scheduled_for,
      sent_at: communication.sent_at,
      completed_at: communication.completed_at,
      created_at: communication.created_at,
      updated_at: communication.updated_at,
      metadata: communication.metadata
    };

    // Fetch recipients if requested
    if (include_recipients) {
      let recipientsQuery = supabase
        .from('team_communication_recipients')
        .select(`
          id,
          user_id,
          email,
          status,
          queued_at,
          sent_at,
          delivered_at,
          opened_at,
          clicked_at,
          error_message,
          retry_count,
          resend_id,
          created_at,
          profiles:user_id (
            id,
            names,
            avatar_url
          )
        `, { count: 'exact' })
        .eq('communication_id', communication_id);

      // Filter by status if specified
      if (recipient_status) {
        recipientsQuery = recipientsQuery.eq('status', recipient_status);
      }

      // Order by status priority (failed first, then by sent_at)
      recipientsQuery = recipientsQuery
        .order('status', { ascending: true })
        .order('sent_at', { ascending: false, nullsFirst: false });

      // Apply pagination
      recipientsQuery = recipientsQuery.range(recipient_offset, recipient_offset + recipient_limit - 1);

      const { data: recipients, error: recipientsError, count } = await recipientsQuery;

      if (recipientsError) {
        console.error('Error fetching recipients:', recipientsError);
        // Don't fail the whole request, just exclude recipients
        response.recipients = [];
        response.recipients_error = 'Failed to fetch recipients';
      } else {
        response.recipients = (recipients || []).map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          name: r.profiles?.names || r.email.split('@')[0],
          email: r.email,
          avatar_url: r.profiles?.avatar_url,
          status: r.status,
          queued_at: r.queued_at,
          sent_at: r.sent_at,
          delivered_at: r.delivered_at,
          opened_at: r.opened_at,
          clicked_at: r.clicked_at,
          error_message: r.error_message,
          retry_count: r.retry_count
        }));

        response.recipients_meta = {
          total: count || 0,
          page: recipient_page,
          limit: recipient_limit,
          hasMore: (recipient_offset + (recipients?.length || 0)) < (count || 0)
        };
      }

      // Also get recipient status breakdown
      const { data: statusCounts } = await supabase
        .from('team_communication_recipients')
        .select('status')
        .eq('communication_id', communication_id);

      if (statusCounts) {
        const breakdown: Record<string, number> = {};
        statusCounts.forEach((r: any) => {
          breakdown[r.status] = (breakdown[r.status] || 0) + 1;
        });
        response.status_breakdown = breakdown;
      }
    }

    return successResponse(response);

  } catch (error) {
    return handleAdminError(error);
  }
});
