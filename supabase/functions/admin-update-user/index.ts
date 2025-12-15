/**
 * Admin Update User - Edge Function
 *
 * Allows platform admins to update user properties:
 * - Adjust credits
 * - Lock/unlock account
 * - Set internal flags (is_beta_user, is_early_access)
 * - Add admin notes
 *
 * All mutations are logged to audit_logs.
 *
 * Request Body:
 * - user_id: UUID of the user to update (required)
 * - credits: New credit amount (optional)
 * - credits_delta: Amount to add/subtract from credits (optional)
 * - is_locked: Boolean to lock/unlock account (optional)
 * - locked_reason: Reason for locking (required if is_locked=true)
 * - is_beta_user: Boolean flag (optional)
 * - is_early_access: Boolean flag (optional)
 * - admin_notes: Admin notes text (optional)
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

    // Initialize admin context - only platform_admin can update users
    const ctx = await initAdminContext(req, supabase, ['platform_admin']);

    const { user_id, ...updates } = ctx.body || {};

    // Validate user_id
    if (!user_id) {
      return adminErrorResponse('user_id is required', 'MISSING_PARAM', 400);
    }

    if (!isValidUUID(user_id)) {
      return adminErrorResponse('Invalid user_id format', 'INVALID_PARAM', 400);
    }

    // Get current user state for audit
    const { data: currentUser, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user_id)
      .single();

    if (fetchError || !currentUser) {
      return adminErrorResponse('User not found', 'NOT_FOUND', 404);
    }

    // Build update object
    const updateFields: Record<string, any> = {};
    const changes: string[] = [];

    // Handle credits
    if (updates.credits !== undefined) {
      if (typeof updates.credits !== 'number' || updates.credits < 0) {
        return adminErrorResponse('credits must be a non-negative number', 'INVALID_PARAM', 400);
      }
      updateFields.credits = updates.credits;
      changes.push(`credits: ${currentUser.credits || 0} → ${updates.credits}`);
    }

    // Handle credits_delta (add/subtract)
    if (updates.credits_delta !== undefined) {
      if (typeof updates.credits_delta !== 'number') {
        return adminErrorResponse('credits_delta must be a number', 'INVALID_PARAM', 400);
      }
      const newCredits = Math.max(0, (currentUser.credits || 0) + updates.credits_delta);
      updateFields.credits = newCredits;
      changes.push(`credits: ${currentUser.credits || 0} → ${newCredits} (delta: ${updates.credits_delta})`);
    }

    // Handle account locking
    if (updates.is_locked !== undefined) {
      if (typeof updates.is_locked !== 'boolean') {
        return adminErrorResponse('is_locked must be a boolean', 'INVALID_PARAM', 400);
      }

      if (updates.is_locked && !updates.locked_reason) {
        return adminErrorResponse('locked_reason is required when locking an account', 'MISSING_PARAM', 400);
      }

      updateFields.is_locked = updates.is_locked;

      if (updates.is_locked) {
        updateFields.locked_at = new Date().toISOString();
        updateFields.locked_reason = updates.locked_reason;
        changes.push(`account LOCKED: ${updates.locked_reason}`);
      } else {
        updateFields.locked_at = null;
        updateFields.locked_reason = null;
        changes.push('account UNLOCKED');
      }
    }

    // Handle beta flag
    if (updates.is_beta_user !== undefined) {
      if (typeof updates.is_beta_user !== 'boolean') {
        return adminErrorResponse('is_beta_user must be a boolean', 'INVALID_PARAM', 400);
      }
      updateFields.is_beta_user = updates.is_beta_user;
      changes.push(`is_beta_user: ${currentUser.is_beta_user || false} → ${updates.is_beta_user}`);
    }

    // Handle early access flag
    if (updates.is_early_access !== undefined) {
      if (typeof updates.is_early_access !== 'boolean') {
        return adminErrorResponse('is_early_access must be a boolean', 'INVALID_PARAM', 400);
      }
      updateFields.is_early_access = updates.is_early_access;
      changes.push(`is_early_access: ${currentUser.is_early_access || false} → ${updates.is_early_access}`);
    }

    // Handle admin notes
    if (updates.admin_notes !== undefined) {
      if (typeof updates.admin_notes !== 'string') {
        return adminErrorResponse('admin_notes must be a string', 'INVALID_PARAM', 400);
      }
      updateFields.admin_notes = updates.admin_notes;
      changes.push('admin_notes updated');
    }

    // Check if there are any updates to make
    if (Object.keys(updateFields).length === 0) {
      return adminErrorResponse('No valid update fields provided', 'NO_UPDATES', 400);
    }

    // Add updated_at timestamp
    updateFields.updated_at = new Date().toISOString();

    // Perform update
    const { data: updatedUser, error: updateError } = await supabase
      .from('profiles')
      .update(updateFields)
      .eq('id', user_id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update user: ${updateError.message}`);
    }

    // Log the admin action
    await logAdminAction(
      ctx,
      'admin.user.update',
      'profiles',
      user_id,
      `Admin updated user: ${changes.join('; ')}`,
      {
        oldValues: {
          credits: currentUser.credits,
          is_locked: currentUser.is_locked,
          is_beta_user: currentUser.is_beta_user,
          is_early_access: currentUser.is_early_access
        },
        newValues: updateFields
      }
    );

    // Return sanitized user data
    const { plaid_access_token, ...safeUser } = updatedUser;

    return successResponse({
      user: safeUser,
      changes
    });

  } catch (error) {
    return handleAdminError(error);
  }
});
