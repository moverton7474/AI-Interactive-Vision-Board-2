/**
 * Team Send Communication - Edge Function
 *
 * Allows team managers to create and send communications to team members.
 * Supports announcements, recognition, reminders, and direct messages.
 *
 * Request Body:
 * - team_id: UUID of the team (required)
 * - subject: Email subject line (required)
 * - body_html: HTML content of the message (required)
 * - body_text: Plain text fallback (optional)
 * - template_type: 'announcement' | 'recognition' | 'reminder' | 'custom' (default: 'custom')
 * - recipient_filter: { roles?: string[], status?: string[] } (optional)
 * - scheduled_for: ISO datetime for scheduled send (optional, sends immediately if not set)
 * - send_now: boolean - if true, sends immediately (default: true)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  initAdminContext,
  successResponse,
  handleAdminError,
  adminErrorResponse,
  isValidUUID,
  logAdminAction,
  corsHeaders
} from '../_shared/admin-utils.ts'

declare const Deno: any;

const VALID_TEMPLATE_TYPES = ['announcement', 'recognition', 'reminder', 'welcome', 'milestone', 'custom'];
const TEMPLATE_TO_EMAIL_TEMPLATE: Record<string, string> = {
  'announcement': 'team_announcement',
  'recognition': 'team_recognition',
  'reminder': 'team_reminder',
  'welcome': 'welcome',
  'milestone': 'milestone_celebration',
  'custom': 'manager_direct_message'
};

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

    // Initialize admin context - platform_admin or team managers can send
    const ctx = await initAdminContext(req, supabase, ['platform_admin', 'support_agent']);

    const {
      team_id,
      subject,
      body_html,
      body_text,
      template_type = 'custom',
      recipient_filter = {},
      scheduled_for,
      send_now = true
    } = ctx.body || {};

    // Validate required fields
    if (!team_id) {
      return adminErrorResponse('team_id is required', 'MISSING_PARAM', 400);
    }
    if (!subject) {
      return adminErrorResponse('subject is required', 'MISSING_PARAM', 400);
    }
    if (!body_html) {
      return adminErrorResponse('body_html is required', 'MISSING_PARAM', 400);
    }

    // Validate UUIDs
    if (!isValidUUID(team_id)) {
      return adminErrorResponse('Invalid team_id format', 'INVALID_PARAM', 400);
    }

    // Validate template type
    if (!VALID_TEMPLATE_TYPES.includes(template_type)) {
      return adminErrorResponse(
        `template_type must be one of: ${VALID_TEMPLATE_TYPES.join(', ')}`,
        'INVALID_PARAM',
        400
      );
    }

    // Verify team exists
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, owner_id')
      .eq('id', team_id)
      .single();

    if (teamError || !team) {
      return adminErrorResponse('Team not found', 'NOT_FOUND', 404);
    }

    // Check if sender has permission (is platform admin or team manager)
    const isPlatformAdmin = ctx.authz.platformRole === 'platform_admin';
    let isTeamManager = false;

    if (!isPlatformAdmin) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', team_id)
        .eq('user_id', ctx.authz.userId)
        .eq('is_active', true)
        .single();

      isTeamManager = membership?.role && ['owner', 'admin', 'manager'].includes(membership.role);
    }

    if (!isPlatformAdmin && !isTeamManager) {
      return adminErrorResponse(
        'You must be a team manager or platform admin to send communications',
        'FORBIDDEN',
        403
      );
    }

    // Get sender profile
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('names, email')
      .eq('id', ctx.authz.userId)
      .single();

    const senderName = senderProfile?.names || senderProfile?.email?.split('@')[0] || 'Team Manager';

    // Get eligible recipients
    const { data: recipients, error: recipientsError } = await supabase
      .rpc('get_team_communication_recipients', {
        p_team_id: team_id,
        p_filter: recipient_filter
      });

    if (recipientsError) {
      console.error('Error fetching recipients:', recipientsError);
      return adminErrorResponse('Failed to fetch recipients', 'INTERNAL_ERROR', 500);
    }

    if (!recipients || recipients.length === 0) {
      return adminErrorResponse(
        'No eligible recipients found. Check recipient filter and member preferences.',
        'NO_RECIPIENTS',
        400
      );
    }

    // Determine status based on scheduling
    const isScheduled = !!scheduled_for && !send_now;
    const status = isScheduled ? 'scheduled' : (send_now ? 'sending' : 'draft');

    // Create communication record
    const { data: communication, error: createError } = await supabase
      .from('team_communications')
      .insert({
        team_id,
        sender_id: ctx.authz.userId,
        subject,
        body_html,
        body_text: body_text || stripHtml(body_html),
        template_type,
        recipient_filter,
        total_recipients: recipients.length,
        status,
        scheduled_for: isScheduled ? scheduled_for : null
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating communication:', createError);
      return adminErrorResponse('Failed to create communication', 'INTERNAL_ERROR', 500);
    }

    // Create recipient records
    const recipientRecords = recipients.map((r: any) => ({
      communication_id: communication.id,
      user_id: r.user_id,
      email: r.email,
      status: 'pending'
    }));

    const { error: recipientError } = await supabase
      .from('team_communication_recipients')
      .insert(recipientRecords);

    if (recipientError) {
      console.error('Error creating recipient records:', recipientError);
      // Cleanup communication record
      await supabase.from('team_communications').delete().eq('id', communication.id);
      return adminErrorResponse('Failed to create recipient records', 'INTERNAL_ERROR', 500);
    }

    // If sending now, process immediately
    let sentCount = 0;
    let failedCount = 0;

    if (send_now && !isScheduled) {
      const emailTemplate = TEMPLATE_TO_EMAIL_TEMPLATE[template_type] || 'manager_direct_message';

      for (const recipient of recipients) {
        try {
          // Get recipient name
          const { data: recipientProfile } = await supabase
            .from('profiles')
            .select('names')
            .eq('id', recipient.user_id)
            .single();

          const recipientName = recipientProfile?.names || recipient.email.split('@')[0];

          // Send email via send-email function
          const { error: sendError } = await supabase.functions.invoke('send-email', {
            body: {
              to: recipient.email,
              template: emailTemplate,
              data: {
                name: recipientName,
                senderName,
                teamName: team.name,
                subject,
                message: body_html,
                body_html
              },
              subject,
              userId: recipient.user_id
            }
          });

          if (sendError) {
            console.error(`Failed to send to ${recipient.email}:`, sendError);
            await supabase
              .from('team_communication_recipients')
              .update({
                status: 'failed',
                error_message: sendError.message || 'Send failed',
                sent_at: new Date().toISOString()
              })
              .eq('communication_id', communication.id)
              .eq('user_id', recipient.user_id);
            failedCount++;
          } else {
            await supabase
              .from('team_communication_recipients')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString()
              })
              .eq('communication_id', communication.id)
              .eq('user_id', recipient.user_id);
            sentCount++;
          }
        } catch (err) {
          console.error(`Exception sending to ${recipient.email}:`, err);
          failedCount++;
        }
      }

      // Update communication status
      const finalStatus = failedCount === 0 ? 'sent' : (sentCount > 0 ? 'partial' : 'failed');
      await supabase
        .from('team_communications')
        .update({
          status: finalStatus,
          sent_count: sentCount,
          failed_count: failedCount,
          sent_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
        .eq('id', communication.id);
    }

    // Log the admin action
    await logAdminAction(
      ctx,
      'admin.team.communication.send',
      'team_communications',
      communication.id,
      `${senderName} sent ${template_type} to ${recipients.length} members of team "${team.name}"`,
      {
        teamId: team_id,
        newValues: {
          template_type,
          recipient_count: recipients.length,
          status: send_now ? 'sent' : status
        }
      }
    );

    return successResponse({
      communication: {
        ...communication,
        sent_count: sentCount,
        failed_count: failedCount,
        status: send_now ? (failedCount === 0 ? 'sent' : 'partial') : status
      },
      recipients_count: recipients.length,
      sent_count: sentCount,
      failed_count: failedCount,
      message: send_now
        ? `Successfully sent to ${sentCount} of ${recipients.length} recipients`
        : isScheduled
          ? `Scheduled for ${scheduled_for}`
          : 'Communication saved as draft'
    });

  } catch (error) {
    return handleAdminError(error);
  }
});

/**
 * Strip HTML tags from content for plain text version
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
