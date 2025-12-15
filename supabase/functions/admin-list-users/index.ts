/**
 * Admin List Users - Edge Function
 *
 * Lists and searches users with filtering and pagination.
 * Requires platform_admin or support_agent role.
 *
 * Query Parameters:
 * - search: Search by email or name (partial match)
 * - tier: Filter by subscription tier (free, pro, elite)
 * - status: Filter by account status (active, locked)
 * - stripe_customer_id: Filter by Stripe customer ID
 * - date_from, date_to: Filter by created_at date range
 * - sort_by: Field to sort by (created_at, email, names)
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
  sanitizeRecords,
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

    // Initialize admin context with RBAC check
    // Allow both platform_admin and support_agent for read-only operations
    const ctx = await initAdminContext(req, supabase, ['platform_admin', 'support_agent']);

    const url = new URL(req.url);
    const pagination = parsePaginationParams(url);
    const filters = parseFilterParams(url);

    // Additional user-specific filters
    const stripeCustomerId = url.searchParams.get('stripe_customer_id');

    // Build query
    let query = supabase
      .from('profiles')
      .select(`
        id,
        names,
        email,
        avatar_url,
        subscription_tier,
        stripe_customer_id,
        is_beta_user,
        is_early_access,
        is_locked,
        credits,
        created_at,
        updated_at,
        last_sign_in_at
      `, { count: 'exact' });

    // Apply search filter (email or name)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      query = query.or(`email.ilike.%${searchLower}%,names.ilike.%${searchLower}%`);
    }

    // Apply tier filter
    if (filters.tier) {
      query = query.eq('subscription_tier', filters.tier.toUpperCase());
    }

    // Apply status filter
    if (filters.status) {
      if (filters.status === 'locked') {
        query = query.eq('is_locked', true);
      } else if (filters.status === 'active') {
        query = query.or('is_locked.is.null,is_locked.eq.false');
      }
    }

    // Apply Stripe customer ID filter
    if (stripeCustomerId) {
      query = query.eq('stripe_customer_id', stripeCustomerId);
    }

    // Apply date range filter
    query = applyDateFilter(query, 'created_at', filters.dateFrom, filters.dateTo);

    // Apply sorting
    query = applySorting(query, filters.sortBy, filters.sortOrder, 'created_at');

    // Apply pagination
    query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);

    // Execute query
    const { data: users, count, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    // Sanitize and return results
    const sanitizedUsers = sanitizeRecords(users || []);

    return paginatedResponse(sanitizedUsers, pagination, count || 0);

  } catch (error) {
    return handleAdminError(error);
  }
});
