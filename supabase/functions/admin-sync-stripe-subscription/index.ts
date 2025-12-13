/**
 * Admin Sync Stripe Subscription - Edge Function
 *
 * Syncs a user's subscription status from Stripe.
 * Useful when webhooks fail or data gets out of sync.
 *
 * Request Body:
 * - user_id: UUID of the user to sync (required)
 * - stripe_customer_id: Override Stripe customer ID (optional, uses profile value if not provided)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.11.0'
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
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

    if (!STRIPE_SECRET_KEY) {
      return adminErrorResponse('Stripe is not configured', 'CONFIG_ERROR', 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

    // Initialize admin context - only platform_admin can sync subscriptions
    const ctx = await initAdminContext(req, supabase, ['platform_admin']);

    const { user_id, stripe_customer_id: providedCustomerId } = ctx.body || {};

    // Validate user_id
    if (!user_id) {
      return adminErrorResponse('user_id is required', 'MISSING_PARAM', 400);
    }

    if (!isValidUUID(user_id)) {
      return adminErrorResponse('Invalid user_id format', 'INVALID_PARAM', 400);
    }

    // Get current user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, names, email, stripe_customer_id, subscription_tier')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      return adminErrorResponse('User not found', 'NOT_FOUND', 404);
    }

    // Get Stripe customer ID
    const stripeCustomerId = providedCustomerId || profile.stripe_customer_id;

    if (!stripeCustomerId) {
      return adminErrorResponse(
        'User has no Stripe customer ID. They may not have a subscription.',
        'NO_STRIPE_CUSTOMER',
        400
      );
    }

    // Fetch customer from Stripe
    let customer;
    try {
      customer = await stripe.customers.retrieve(stripeCustomerId);
    } catch (stripeError: any) {
      return adminErrorResponse(
        `Stripe customer not found: ${stripeError.message}`,
        'STRIPE_ERROR',
        400
      );
    }

    if (customer.deleted) {
      return adminErrorResponse('Stripe customer has been deleted', 'CUSTOMER_DELETED', 400);
    }

    // Fetch active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 10
    });

    // Find the most relevant subscription (active or most recent)
    const activeSubscription = subscriptions.data.find(s =>
      s.status === 'active' || s.status === 'trialing'
    );

    const mostRecentSubscription = subscriptions.data[0];
    const relevantSubscription = activeSubscription || mostRecentSubscription;

    // Map Stripe price/product to subscription tier
    let newTier = 'FREE';
    let subscriptionStatus = 'none';
    let periodEnd: string | null = null;

    if (relevantSubscription) {
      subscriptionStatus = relevantSubscription.status;
      periodEnd = new Date(relevantSubscription.current_period_end * 1000).toISOString();

      // Map price to tier (you may need to adjust these based on your Stripe setup)
      const priceId = relevantSubscription.items.data[0]?.price?.id;
      const productId = relevantSubscription.items.data[0]?.price?.product;

      if (relevantSubscription.status === 'active' || relevantSubscription.status === 'trialing') {
        // Check for price ID or product ID patterns
        // These should match your actual Stripe price/product IDs
        const priceStr = priceId || productId || '';

        if (priceStr.includes('elite') || priceStr.includes('ELITE')) {
          newTier = 'ELITE';
        } else if (priceStr.includes('pro') || priceStr.includes('PRO')) {
          newTier = 'PRO';
        } else if (priceStr.includes('team') || priceStr.includes('TEAM')) {
          newTier = 'TEAM';
        } else {
          // Default to PRO for any active paid subscription
          newTier = 'PRO';
        }
      }
    }

    // Update profile with synced data
    const updateFields: Record<string, any> = {
      subscription_tier: newTier,
      updated_at: new Date().toISOString()
    };

    // Update stripe_customer_id if it was provided and different
    if (providedCustomerId && providedCustomerId !== profile.stripe_customer_id) {
      updateFields.stripe_customer_id = providedCustomerId;
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update(updateFields)
      .eq('id', user_id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }

    // Log the sync action
    await logAdminAction(
      ctx,
      'admin.subscription.sync',
      'profiles',
      user_id,
      `Synced subscription from Stripe: ${profile.subscription_tier || 'FREE'} → ${newTier}`,
      {
        oldValues: { subscription_tier: profile.subscription_tier },
        newValues: { subscription_tier: newTier }
      }
    );

    return successResponse({
      synced: true,
      user: {
        id: user_id,
        email: profile.email,
        previousTier: profile.subscription_tier || 'FREE',
        newTier
      },
      stripe: {
        customerId: stripeCustomerId,
        subscriptionStatus,
        periodEnd,
        subscriptionCount: subscriptions.data.length
      }
    });

  } catch (error) {
    return handleAdminError(error);
  }
});
