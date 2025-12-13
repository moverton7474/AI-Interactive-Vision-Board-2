/**
 * Admin Update Team - Edge Function
 *
 * Allows platform admins to update team properties:
 * - Change team owner
 * - Rename team
 * - Toggle enterprise features
 * - Update trial dates
 *
 * All mutations are logged to audit_logs.
 *
 * Request Body:
 * - team_id: UUID of the team to update (required)
 * - name: New team name (optional)
 * - description: New description (optional)
 * - owner_id: New owner user ID (optional)
 * - plan: Team plan (free, pro, enterprise) (optional)
 * - is_enterprise: Boolean flag (optional)
 * - trial_ends_at: Trial end date ISO string (optional)
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

    // Initialize admin context - only platform_admin can update teams
    const ctx = await initAdminContext(req, supabase, ['platform_admin']);

    const { team_id, ...updates } = ctx.body || {};

    // Validate team_id
    if (!team_id) {
      return adminErrorResponse('team_id is required', 'MISSING_PARAM', 400);
    }

    if (!isValidUUID(team_id)) {
      return adminErrorResponse('Invalid team_id format', 'INVALID_PARAM', 400);
    }

    // Get current team state for audit
    const { data: currentTeam, error: fetchError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', team_id)
      .single();

    if (fetchError || !currentTeam) {
      return adminErrorResponse('Team not found', 'NOT_FOUND', 404);
    }

    // Build update object
    const updateFields: Record<string, any> = {};
    const changes: string[] = [];

    // Handle name change
    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string' || updates.name.trim().length < 2) {
        return adminErrorResponse('name must be at least 2 characters', 'INVALID_PARAM', 400);
      }
      updateFields.name = updates.name.trim();
      changes.push(`name: "${currentTeam.name}" → "${updates.name.trim()}"`);
    }

    // Handle description change
    if (updates.description !== undefined) {
      updateFields.description = updates.description;
      changes.push('description updated');
    }

    // Handle owner change
    if (updates.owner_id !== undefined) {
      if (!isValidUUID(updates.owner_id)) {
        return adminErrorResponse('Invalid owner_id format', 'INVALID_PARAM', 400);
      }

      // Verify new owner exists
      const { data: newOwner } = await supabase
        .from('profiles')
        .select('id, names, email')
        .eq('id', updates.owner_id)
        .single();

      if (!newOwner) {
        return adminErrorResponse('New owner user not found', 'NOT_FOUND', 404);
      }

      // Ensure new owner is a team member (or add them as owner)
      const { data: membership } = await supabase
        .from('team_members')
        .select('id, role')
        .eq('team_id', team_id)
        .eq('user_id', updates.owner_id)
        .single();

      if (membership) {
        // Update existing membership to owner role
        await supabase
          .from('team_members')
          .update({ role: 'owner' })
          .eq('id', membership.id);
      } else {
        // Add as new owner member
        await supabase
          .from('team_members')
          .insert({
            team_id,
            user_id: updates.owner_id,
            role: 'owner',
            is_active: true
          });
      }

      // Demote previous owner to admin
      if (currentTeam.owner_id !== updates.owner_id) {
        await supabase
          .from('team_members')
          .update({ role: 'admin' })
          .eq('team_id', team_id)
          .eq('user_id', currentTeam.owner_id)
          .eq('role', 'owner');
      }

      updateFields.owner_id = updates.owner_id;
      changes.push(`owner changed to ${newOwner.email}`);
    }

    // Handle plan change
    if (updates.plan !== undefined) {
      const validPlans = ['free', 'pro', 'enterprise'];
      if (!validPlans.includes(updates.plan)) {
        return adminErrorResponse(`plan must be one of: ${validPlans.join(', ')}`, 'INVALID_PARAM', 400);
      }
      updateFields.plan = updates.plan;
      changes.push(`plan: ${currentTeam.plan || 'free'} → ${updates.plan}`);
    }

    // Handle enterprise flag
    if (updates.is_enterprise !== undefined) {
      if (typeof updates.is_enterprise !== 'boolean') {
        return adminErrorResponse('is_enterprise must be a boolean', 'INVALID_PARAM', 400);
      }
      updateFields.is_enterprise = updates.is_enterprise;
      changes.push(`is_enterprise: ${currentTeam.is_enterprise || false} → ${updates.is_enterprise}`);
    }

    // Handle trial end date
    if (updates.trial_ends_at !== undefined) {
      if (updates.trial_ends_at !== null) {
        const trialDate = new Date(updates.trial_ends_at);
        if (isNaN(trialDate.getTime())) {
          return adminErrorResponse('Invalid trial_ends_at date format', 'INVALID_PARAM', 400);
        }
        updateFields.trial_ends_at = trialDate.toISOString();
      } else {
        updateFields.trial_ends_at = null;
      }
      changes.push(`trial_ends_at updated`);
    }

    // Check if there are any updates to make
    if (Object.keys(updateFields).length === 0) {
      return adminErrorResponse('No valid update fields provided', 'NO_UPDATES', 400);
    }

    // Add updated_at timestamp
    updateFields.updated_at = new Date().toISOString();

    // Perform update
    const { data: updatedTeam, error: updateError } = await supabase
      .from('teams')
      .update(updateFields)
      .eq('id', team_id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update team: ${updateError.message}`);
    }

    // Log the admin action
    await logAdminAction(
      ctx,
      'admin.team.update',
      'teams',
      team_id,
      `Admin updated team: ${changes.join('; ')}`,
      {
        teamId: team_id,
        oldValues: {
          name: currentTeam.name,
          owner_id: currentTeam.owner_id,
          plan: currentTeam.plan,
          is_enterprise: currentTeam.is_enterprise
        },
        newValues: updateFields
      }
    );

    return successResponse({
      team: updatedTeam,
      changes
    });

  } catch (error) {
    return handleAdminError(error);
  }
});
