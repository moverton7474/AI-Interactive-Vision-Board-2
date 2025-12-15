/**
 * Admin List Print Orders - Edge Function
 *
 * Lists and filters print orders for support operations.
 * Requires platform_admin or support_agent role.
 *
 * Query Parameters:
 * - user_id: Filter by user ID
 * - team_id: Filter by team ID
 * - status: Filter by order status (pending, processing, shipped, delivered, cancelled, refunded)
 * - product_type: Filter by product type (pad, cards, sticker, canvas, bundle)
 * - date_from, date_to: Filter by created_at date range
 * - sort_by: Field to sort by (created_at, total_price, status)
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
    const pagination = parsePaginationParams(url);
    const filters = parseFilterParams(url);

    // Print order specific filters
    const userId = url.searchParams.get('user_id');
    const teamId = url.searchParams.get('team_id');
    const productType = url.searchParams.get('product_type');

    // Build query
    let query = supabase
      .from('print_product_orders')
      .select(`
        id,
        user_id,
        product_id,
        product_name,
        product_type,
        prodigi_sku,
        quantity,
        subtotal,
        shipping_cost,
        total_price,
        status,
        shipping_address,
        tracking_number,
        prodigi_order_id,
        created_at,
        updated_at,
        user:profiles!print_product_orders_user_id_fkey (
          id,
          names,
          email
        )
      `, { count: 'exact' });

    // Apply user filter
    if (userId) {
      if (!isValidUUID(userId)) {
        throw new Error('Invalid user_id format');
      }
      query = query.eq('user_id', userId);
    }

    // Apply team filter
    if (teamId) {
      if (!isValidUUID(teamId)) {
        throw new Error('Invalid team_id format');
      }
      query = query.eq('team_id', teamId);
    }

    // Apply status filter
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    // Apply product type filter
    if (productType) {
      query = query.eq('product_type', productType);
    }

    // Apply date range filter
    query = applyDateFilter(query, 'created_at', filters.dateFrom, filters.dateTo);

    // Apply sorting
    query = applySorting(query, filters.sortBy, filters.sortOrder, 'created_at');

    // Apply pagination
    query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);

    // Execute query
    const { data: orders, count, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch orders: ${error.message}`);
    }

    return paginatedResponse(orders || [], pagination, count || 0);

  } catch (error) {
    return handleAdminError(error);
  }
});
