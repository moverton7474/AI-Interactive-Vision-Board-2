/**
 * Admin Get User Detail - Edge Function
 *
 * Returns detailed user profile including:
 * - Profile information
 * - Subscription status
 * - Team memberships
 * - Usage statistics (vision boards, habits, print orders)
 * - AMIE profile summary
 *
 * NEVER exposes: API keys, Plaid tokens, Gemini keys, or other secrets
 *
 * Query Parameters:
 * - user_id: UUID of the user to retrieve (required)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  initAdminContext,
  successResponse,
  handleAdminError,
  adminErrorResponse,
  isValidUUID,
  getAdminUserProfile,
  getUserTeamMemberships,
  getUserStats,
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
    const userId = url.searchParams.get('user_id');

    // Validate user_id
    if (!userId) {
      return adminErrorResponse('user_id parameter is required', 'MISSING_PARAM', 400);
    }

    if (!isValidUUID(userId)) {
      return adminErrorResponse('Invalid user_id format', 'INVALID_PARAM', 400);
    }

    // Get profile
    const profile = await getAdminUserProfile(supabase, userId);
    if (!profile) {
      return adminErrorResponse('User not found', 'NOT_FOUND', 404);
    }

    // Get team memberships
    const teamMemberships = await getUserTeamMemberships(supabase, userId);

    // Get usage stats
    const stats = await getUserStats(supabase, userId);

    // Get AMIE profile summary (if exists) - without exposing sensitive data
    const { data: amieProfile } = await supabase
      .from('user_identity_profiles')
      .select(`
        id,
        coaching_theme,
        core_values,
        life_roles,
        is_active,
        created_at,
        updated_at
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    // Get platform role if any
    const { data: platformRole } = await supabase
      .from('platform_roles')
      .select('role, is_active, granted_at, expires_at')
      .eq('user_id', userId)
      .single();

    // Get recent activity summary
    const { data: recentVisions } = await supabase
      .from('vision_boards')
      .select('id, prompt, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get recent print orders
    const { data: recentOrders } = await supabase
      .from('print_product_orders')
      .select('id, product_name, status, total_price, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Build response
    const userDetail = {
      profile,
      platformRole: platformRole || null,
      teamMemberships,
      stats: {
        ...stats,
        activeTeams: teamMemberships.filter((tm: any) => tm.is_active).length
      },
      amieProfile: amieProfile || null,
      recentActivity: {
        visions: recentVisions || [],
        orders: recentOrders || []
      }
    };

    return successResponse(userDetail);

  } catch (error) {
    return handleAdminError(error);
  }
});
