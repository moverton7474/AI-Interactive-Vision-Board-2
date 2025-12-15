/**
 * Admin Update Print Order Status - Edge Function
 *
 * Allows platform admins to update print order status:
 * - Mark as reprinted
 * - Mark as refunded
 * - Mark as cancelled
 * - Update tracking info
 * - Add admin notes
 *
 * Note: Actual refunds must be processed through Stripe.
 * This function only updates the order record.
 *
 * Request Body:
 * - order_id: UUID of the order (required)
 * - status: New status (pending, processing, shipped, delivered, reprinted, refunded, cancelled)
 * - tracking_number: Tracking number for shipped orders
 * - admin_notes: Notes about the status change
 * - reason: Reason for status change (required for refund/cancel)
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

const VALID_STATUSES = [
  'pending',
  'processing',
  'production',
  'shipped',
  'delivered',
  'reprinted',
  'refunded',
  'cancelled',
  'on_hold'
];

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

    // Initialize admin context - only platform_admin can update order status
    const ctx = await initAdminContext(req, supabase, ['platform_admin']);

    const { order_id, status, tracking_number, admin_notes, reason } = ctx.body || {};

    // Validate order_id
    if (!order_id) {
      return adminErrorResponse('order_id is required', 'MISSING_PARAM', 400);
    }

    if (!isValidUUID(order_id)) {
      return adminErrorResponse('Invalid order_id format', 'INVALID_PARAM', 400);
    }

    // Get current order state
    const { data: currentOrder, error: fetchError } = await supabase
      .from('print_product_orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (fetchError || !currentOrder) {
      return adminErrorResponse('Order not found', 'NOT_FOUND', 404);
    }

    // Build update object
    const updateFields: Record<string, any> = {};
    const changes: string[] = [];

    // Handle status change
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return adminErrorResponse(`status must be one of: ${VALID_STATUSES.join(', ')}`, 'INVALID_PARAM', 400);
      }

      // Require reason for refund/cancel/reprinted
      if (['refunded', 'cancelled', 'reprinted'].includes(status) && !reason) {
        return adminErrorResponse('reason is required for refund/cancel/reprinted status', 'MISSING_PARAM', 400);
      }

      updateFields.status = status;
      changes.push(`status: ${currentOrder.status} → ${status}`);

      // Add status-specific notes
      if (reason) {
        const existingNotes = currentOrder.admin_notes || '';
        const timestamp = new Date().toISOString();
        const statusNote = `[${timestamp}] Status changed to ${status}: ${reason}`;
        updateFields.admin_notes = existingNotes ? `${existingNotes}\n${statusNote}` : statusNote;
      }
    }

    // Handle tracking number
    if (tracking_number !== undefined) {
      updateFields.tracking_number = tracking_number;
      changes.push(`tracking_number: ${currentOrder.tracking_number || 'none'} → ${tracking_number}`);
    }

    // Handle admin notes (append, don't replace)
    if (admin_notes && !['refunded', 'cancelled', 'reprinted'].includes(status)) {
      const existingNotes = currentOrder.admin_notes || '';
      const timestamp = new Date().toISOString();
      const newNote = `[${timestamp}] ${admin_notes}`;
      updateFields.admin_notes = existingNotes ? `${existingNotes}\n${newNote}` : newNote;
      changes.push('admin_notes updated');
    }

    // Check if there are any updates to make
    if (Object.keys(updateFields).length === 0) {
      return adminErrorResponse('No valid update fields provided', 'NO_UPDATES', 400);
    }

    // Add updated_at timestamp
    updateFields.updated_at = new Date().toISOString();

    // Perform update
    const { data: updatedOrder, error: updateError } = await supabase
      .from('print_product_orders')
      .update(updateFields)
      .eq('id', order_id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update order: ${updateError.message}`);
    }

    // Determine audit action based on status change
    let auditAction = 'admin.print.update';
    if (status === 'refunded') auditAction = 'admin.print.refund';
    else if (status === 'cancelled') auditAction = 'admin.print.cancel';
    else if (status === 'reprinted') auditAction = 'admin.print.reprint';

    // Log the admin action
    await logAdminAction(
      ctx,
      auditAction,
      'print_product_orders',
      order_id,
      `Admin updated print order: ${changes.join('; ')}${reason ? ` Reason: ${reason}` : ''}`,
      {
        oldValues: {
          status: currentOrder.status,
          tracking_number: currentOrder.tracking_number
        },
        newValues: updateFields
      }
    );

    return successResponse({
      order: updatedOrder,
      changes,
      warning: status === 'refunded'
        ? 'Note: This only updates the order status. Process the actual refund in Stripe separately.'
        : undefined
    });

  } catch (error) {
    return handleAdminError(error);
  }
});
