/**
 * Admin Manage Team Membership - Edge Function
 *
 * Allows platform admins to manage team memberships:
 * - Add members to a team
 * - Remove members from a team
 * - Change member roles
 *
 * All mutations are logged to audit_logs.
 *
 * Request Body:
 * - team_id: UUID of the team (required)
 * - action: 'add' | 'remove' | 'change_role' (required)
 * - user_id: UUID of the user to manage (required)
 * - role: New role for add/change_role actions (owner, admin, member, viewer)
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

const VALID_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'];

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

    // Initialize admin context - only platform_admin can manage memberships
    const ctx = await initAdminContext(req, supabase, ['platform_admin']);

    const { team_id, action, user_id, role } = ctx.body || {};

    // Validate required fields
    if (!team_id) {
      return adminErrorResponse('team_id is required', 'MISSING_PARAM', 400);
    }
    if (!action) {
      return adminErrorResponse('action is required', 'MISSING_PARAM', 400);
    }
    if (!user_id) {
      return adminErrorResponse('user_id is required', 'MISSING_PARAM', 400);
    }

    // Validate UUIDs
    if (!isValidUUID(team_id)) {
      return adminErrorResponse('Invalid team_id format', 'INVALID_PARAM', 400);
    }
    if (!isValidUUID(user_id)) {
      return adminErrorResponse('Invalid user_id format', 'INVALID_PARAM', 400);
    }

    // Validate action
    const validActions = ['add', 'remove', 'change_role'];
    if (!validActions.includes(action)) {
      return adminErrorResponse(`action must be one of: ${validActions.join(', ')}`, 'INVALID_PARAM', 400);
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

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, names, email')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return adminErrorResponse('User not found', 'NOT_FOUND', 404);
    }

    // Get existing membership
    const { data: existingMembership } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', team_id)
      .eq('user_id', user_id)
      .single();

    let result: any;
    let auditAction: string;
    let description: string;
    let oldValues: Record<string, any> = {};
    let newValues: Record<string, any> = {};

    switch (action) {
      case 'add': {
        if (!role) {
          return adminErrorResponse('role is required for add action', 'MISSING_PARAM', 400);
        }
        if (!VALID_ROLES.includes(role)) {
          return adminErrorResponse(`role must be one of: ${VALID_ROLES.join(', ')}`, 'INVALID_PARAM', 400);
        }

        if (existingMembership && existingMembership.is_active) {
          return adminErrorResponse('User is already a member of this team', 'CONFLICT', 409);
        }

        if (existingMembership) {
          // Reactivate existing membership
          const { data, error } = await supabase
            .from('team_members')
            .update({ role, is_active: true })
            .eq('id', existingMembership.id)
            .select()
            .single();

          if (error) throw new Error(`Failed to reactivate membership: ${error.message}`);
          result = data;
          oldValues = { is_active: false, role: existingMembership.role };
        } else {
          // Create new membership
          const { data, error } = await supabase
            .from('team_members')
            .insert({
              team_id,
              user_id,
              role,
              is_active: true
            })
            .select()
            .single();

          if (error) throw new Error(`Failed to add member: ${error.message}`);
          result = data;
        }

        newValues = { role, is_active: true };
        auditAction = 'admin.team.member.add';
        description = `Admin added ${user.email} to team "${team.name}" as ${role}`;
        break;
      }

      case 'remove': {
        if (!existingMembership || !existingMembership.is_active) {
          return adminErrorResponse('User is not an active member of this team', 'NOT_FOUND', 404);
        }

        // Prevent removing the team owner
        if (team.owner_id === user_id) {
          return adminErrorResponse('Cannot remove the team owner. Transfer ownership first.', 'FORBIDDEN', 403);
        }

        // Soft delete by setting is_active = false
        const { data, error } = await supabase
          .from('team_members')
          .update({ is_active: false })
          .eq('id', existingMembership.id)
          .select()
          .single();

        if (error) throw new Error(`Failed to remove member: ${error.message}`);

        result = data;
        oldValues = { role: existingMembership.role, is_active: true };
        newValues = { is_active: false };
        auditAction = 'admin.team.member.remove';
        description = `Admin removed ${user.email} from team "${team.name}"`;
        break;
      }

      case 'change_role': {
        if (!role) {
          return adminErrorResponse('role is required for change_role action', 'MISSING_PARAM', 400);
        }
        if (!VALID_ROLES.includes(role)) {
          return adminErrorResponse(`role must be one of: ${VALID_ROLES.join(', ')}`, 'INVALID_PARAM', 400);
        }

        if (!existingMembership || !existingMembership.is_active) {
          return adminErrorResponse('User is not an active member of this team', 'NOT_FOUND', 404);
        }

        // If changing to owner, also update team owner_id
        if (role === 'owner' && existingMembership.role !== 'owner') {
          // Demote current owner to admin
          await supabase
            .from('team_members')
            .update({ role: 'admin' })
            .eq('team_id', team_id)
            .eq('role', 'owner');

          // Update team owner_id
          await supabase
            .from('teams')
            .update({ owner_id: user_id })
            .eq('id', team_id);
        }

        const { data, error } = await supabase
          .from('team_members')
          .update({ role })
          .eq('id', existingMembership.id)
          .select()
          .single();

        if (error) throw new Error(`Failed to change role: ${error.message}`);

        result = data;
        oldValues = { role: existingMembership.role };
        newValues = { role };
        auditAction = 'admin.team.member.role_change';
        description = `Admin changed ${user.email}'s role in team "${team.name}" from ${existingMembership.role} to ${role}`;
        break;
      }

      default:
        return adminErrorResponse('Invalid action', 'INVALID_PARAM', 400);
    }

    // Log the admin action
    await logAdminAction(
      ctx,
      auditAction,
      'team_members',
      result.id,
      description,
      {
        teamId: team_id,
        oldValues,
        newValues
      }
    );

    return successResponse({
      membership: result,
      action,
      description
    });

  } catch (error) {
    return handleAdminError(error);
  }
});
