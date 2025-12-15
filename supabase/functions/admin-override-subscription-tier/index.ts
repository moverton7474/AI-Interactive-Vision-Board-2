/**
 * Admin Override Subscription Tier - Edge Function
 *
 * Allows platform admins to manually override a user's subscription tier.
 * Use cases:
 * - Grant temporary access for support issues
 * - Apply promotional upgrades
 * - Handle billing issues while awaiting Stripe sync
 *
 * Request Body:
 * - user_id: UUID of the user (required)
 * - tier: New subscription tier (required: FREE, PRO, ELITE, TEAM)
 * - reason: Reason for the override (required for audit)
 * - expires_at: Optional expiration date for temporary overrides (ISO string)
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

const VALID_TIERS = ['FREE', 'PRO', 'ELITE', 'TEAM'];

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

    // Initialize admin context - only platform_admin can override tiers
    const ctx = await initAdminContext(req, supabase, ['platform_admin']);

    const { user_id, tier, reason, expires_at } = ctx.body || {};

    // Validate user_id
    if (!user_id) {
      return adminErrorResponse('user_id is required', 'MISSING_PARAM', 400);
    }

    if (!isValidUUID(user_id)) {
      return adminErrorResponse('Invalid user_id format', 'INVALID_PARAM', 400);
    }

    // Validate tier
    if (!tier) {
      return adminErrorResponse('tier is required', 'MISSING_PARAM', 400);
    }

    const normalizedTier = tier.toUpperCase();
    if (!VALID_TIERS.includes(normalizedTier)) {
      return adminErrorResponse(`tier must be one of: ${VALID_TIERS.join(', ')}`, 'INVALID_PARAM', 400);
    }

    // Validate reason
    if (!reason) {
      return adminErrorResponse('reason is required for audit purposes', 'MISSING_PARAM', 400);
    }

    if (typeof reason !== 'string' || reason.length < 5) {
      return adminErrorResponse('reason must be at least 5 characters', 'INVALID_PARAM', 400);
    }

    // Validate expires_at if provided
    let expiresAt: Date | null = null;
    if (expires_at) {
      expiresAt = new Date(expires_at);
      if (isNaN(expiresAt.getTime())) {
        return adminErrorResponse('Invalid expires_at date format', 'INVALID_PARAM', 400);
      }
      if (expiresAt <= new Date()) {
        return adminErrorResponse('expires_at must be in the future', 'INVALID_PARAM', 400);
      }
    }

    // Get current user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, names, email, subscription_tier, admin_notes')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      return adminErrorResponse('User not found', 'NOT_FOUND', 404);
    }

    const previousTier = profile.subscription_tier || 'FREE';

    // Build update fields
    const updateFields: Record<string, any> = {
      subscription_tier: normalizedTier,
      updated_at: new Date().toISOString()
    };

    // Add admin note about the override
    const timestamp = new Date().toISOString();
    const overrideNote = `[${timestamp}] TIER OVERRIDE: ${previousTier} → ${normalizedTier}. Reason: ${reason}${expiresAt ? `. Expires: ${expiresAt.toISOString()}` : ''}`;

    const existingNotes = profile.admin_notes || '';
    updateFields.admin_notes = existingNotes ? `${existingNotes}\n${overrideNote}` : overrideNote;

    // Perform update
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(updateFields)
      .eq('id', user_id)
      .select('id, names, email, subscription_tier')
      .single();

    if (updateError) {
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }

    // Log the override action
    await logAdminAction(
      ctx,
      'admin.subscription.override',
      'profiles',
      user_id,
      `Admin overrode subscription tier: ${previousTier} → ${normalizedTier}. Reason: ${reason}`,
      {
        oldValues: { subscription_tier: previousTier },
        newValues: {
          subscription_tier: normalizedTier,
          override_reason: reason,
          override_expires: expiresAt?.toISOString()
        }
      }
    );

    return successResponse({
      overridden: true,
      user: {
        id: user_id,
        email: profile.email,
        name: profile.names,
        previousTier,
        newTier: normalizedTier
      },
      override: {
        reason,
        appliedAt: timestamp,
        expiresAt: expiresAt?.toISOString() || null
      },
      warning: expiresAt
        ? `This override will expire on ${expiresAt.toISOString()}. Set up a reminder to review.`
        : 'This override is permanent until changed. Consider syncing from Stripe when billing issues are resolved.'
    });

  } catch (error) {
    return handleAdminError(error);
  }
});
