/**
 * Admin List Teams - Edge Function
 *
 * Lists and searches teams with filtering and pagination.
 * Requires platform_admin or support_agent role.
 *
 * Query Parameters:
 * - search: Search by team name (partial match)
 * - owner_id: Filter by owner user ID
 * - min_members: Filter by minimum member count
 * - max_members: Filter by maximum member count
 * - date_from, date_to: Filter by created_at date range
 * - sort_by: Field to sort by (created_at, name, member_count)
 * - sort_order: asc or desc (default: desc)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 200)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  initAdminContext,
  parsePaginationParams,
  parseFilterParams,
  paginatedResponse,
  handleAdminError,
  applyDateFilter,
  applySorting,
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
    const pagination = parsePaginationParams(url);
    const filters = parseFilterParams(url);

    // Additional team-specific filters
    const ownerId = url.searchParams.get('owner_id');
    const minMembers = url.searchParams.get('min_members');
    const maxMembers = url.searchParams.get('max_members');

    // Build query
    let query = supabase
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
        created_at,
        updated_at,
        owner:profiles!teams_owner_id_fkey (
          id,
          names,
          email
        )
      `, { count: 'exact' });

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      query = query.ilike('name', `%${searchLower}%`);
    }

    // Apply owner filter
    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    // Apply date range filter
    query = applyDateFilter(query, 'created_at', filters.dateFrom, filters.dateTo);

    // Apply sorting
    query = applySorting(query, filters.sortBy, filters.sortOrder, 'created_at');

    // Apply pagination
    query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);

    // Execute query
    const { data: teams, count, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch teams: ${error.message}`);
    }

    // Get member counts for each team
    const teamIds = (teams || []).map((t: any) => t.id);

    let memberCounts: Record<string, number> = {};
    if (teamIds.length > 0) {
      const { data: members } = await supabase
        .from('team_members')
        .select('team_id')
        .in('team_id', teamIds)
        .eq('is_active', true);

      if (members) {
        memberCounts = members.reduce((acc: Record<string, number>, m: any) => {
          acc[m.team_id] = (acc[m.team_id] || 0) + 1;
          return acc;
        }, {});
      }
    }

    // Enrich teams with member counts
    let enrichedTeams = (teams || []).map((team: any) => ({
      ...team,
      memberCount: memberCounts[team.id] || 0
    }));

    // Apply member count filters (post-query due to aggregation)
    if (minMembers) {
      const min = parseInt(minMembers);
      enrichedTeams = enrichedTeams.filter((t: any) => t.memberCount >= min);
    }
    if (maxMembers) {
      const max = parseInt(maxMembers);
      enrichedTeams = enrichedTeams.filter((t: any) => t.memberCount <= max);
    }

    return paginatedResponse(enrichedTeams, pagination, count || 0);

  } catch (error) {
    return handleAdminError(error);
  }
});
