/**
 * Admin Get Team Detail - Edge Function
 *
 * Returns detailed team information including:
 * - Team profile and settings
 * - All members with roles
 * - Activity metrics
 * - Integrations summary
 *
 * Query Parameters:
 * - team_id: UUID of the team to retrieve (required)
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

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Initialize admin context
    const ctx = await initAdminContext(req, supabase, ['platform_admin', 'support_agent']);

    const url = new URL(req.url);
    const teamId = url.searchParams.get('team_id');

    // Validate team_id
    if (!teamId) {
      return adminErrorResponse('team_id parameter is required', 'MISSING_PARAM', 400);
    }

    if (!isValidUUID(teamId)) {
      return adminErrorResponse('Invalid team_id format', 'INVALID_PARAM', 400);
    }

    // Get team details
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select(`
        id,
        name,
        slug,
        description,
        owner_id,
        plan,
        is_enterprise,
        trial_ends_at,
        settings,
        created_at,
        updated_at,
        owner:profiles!teams_owner_id_fkey (
          id,
          names,
          email
        )
      `)
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return adminErrorResponse('Team not found', 'NOT_FOUND', 404);
    }

    // Get all team members
    const { data: members } = await supabase
      .from('team_members')
      .select(`
        id,
        user_id,
        role,
        is_active,
        created_at,
        last_active_at,
        profiles:user_id (
          id,
          names,
          email,
          avatar_url
        )
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });

    // Get team goals summary
    const { data: goals, count: goalsCount } = await supabase
      .from('team_goals')
      .select('id, status', { count: 'exact' })
      .eq('team_id', teamId);

    const goalStats = {
      total: goalsCount || 0,
      active: (goals || []).filter((g: any) => g.status === 'active').length,
      completed: (goals || []).filter((g: any) => g.status === 'completed').length
    };

    // Get integrations summary (without credentials)
    const { data: integrations } = await supabase
      .from('team_integrations')
      .select(`
        id,
        integration_type,
        name,
        is_active,
        last_sync_at,
        error_message
      `)
      .eq('team_id', teamId);

    // Calculate member stats
    const activeMembers = (members || []).filter((m: any) => m.is_active);
    const membersByRole = (members || []).reduce((acc: Record<string, number>, m: any) => {
      acc[m.role] = (acc[m.role] || 0) + 1;
      return acc;
    }, {});

    // Build response
    const teamDetail = {
      team,
      members: members || [],
      stats: {
        totalMembers: (members || []).length,
        activeMembers: activeMembers.length,
        membersByRole,
        goals: goalStats
      },
      integrations: integrations || []
    };

    return successResponse(teamDetail);

  } catch (error) {
    return handleAdminError(error);
  }
});
