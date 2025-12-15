/**
 * Admin Get Print Order Detail - Edge Function
 *
 * Returns detailed print order information for support.
 * Includes user info, product details, shipping info, and status history.
 *
 * Query Parameters:
 * - order_id: UUID of the order to retrieve (required)
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
    const orderId = url.searchParams.get('order_id');

    // Validate order_id
    if (!orderId) {
      return adminErrorResponse('order_id parameter is required', 'MISSING_PARAM', 400);
    }

    if (!isValidUUID(orderId)) {
      return adminErrorResponse('Invalid order_id format', 'INVALID_PARAM', 400);
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('print_product_orders')
      .select(`
        id,
        user_id,
        team_id,
        product_id,
        product_name,
        product_type,
        prodigi_sku,
        quantity,
        customization,
        shipping_address,
        subtotal,
        shipping_cost,
        total_price,
        status,
        tracking_number,
        prodigi_order_id,
        prodigi_status,
        notes,
        admin_notes,
        created_at,
        updated_at
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return adminErrorResponse('Order not found', 'NOT_FOUND', 404);
    }

    // Get user details
    const { data: user } = await supabase
      .from('profiles')
      .select('id, names, email, subscription_tier')
      .eq('id', order.user_id)
      .single();

    // Get team details if team order
    let team = null;
    if (order.team_id) {
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, name, slug')
        .eq('id', order.team_id)
        .single();
      team = teamData;
    }

    // Get related audit logs for status changes
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select(`
        id,
        action,
        old_values,
        new_values,
        description,
        user_id,
        platform_role,
        created_at
      `)
      .eq('target_table', 'print_product_orders')
      .eq('target_id', orderId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Build response
    const orderDetail = {
      order,
      user: user || null,
      team,
      statusHistory: auditLogs || []
    };

    return successResponse(orderDetail);

  } catch (error) {
    return handleAdminError(error);
  }
});
