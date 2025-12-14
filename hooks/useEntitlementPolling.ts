import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * P0-B: Frontend Unlock Feedback Loop
 *
 * After returning from Stripe checkout, poll for entitlement updates
 * without requiring a page reload. This provides immediate feedback
 * when the webhook processes the subscription.
 *
 * Usage:
 * const { pollForEntitlements, isPolling, entitlementStatus } = useEntitlementPolling();
 *
 * // Call after returning from Stripe
 * useEffect(() => {
 *   if (searchParams.get('session_id')) {
 *     pollForEntitlements(userId, 'PRO');
 *   }
 * }, [searchParams]);
 */

export interface EntitlementStatus {
    success: boolean;
    tier: string | null;
    credits: number | null;
    message: string;
}

export interface UseEntitlementPollingResult {
    pollForEntitlements: (
        userId: string,
        expectedTier?: string,
        onSuccess?: (profile: { subscription_tier: string; credits: number }) => void
    ) => Promise<boolean>;
    isPolling: boolean;
    entitlementStatus: EntitlementStatus | null;
    cancelPolling: () => void;
}

export function useEntitlementPolling(): UseEntitlementPollingResult {
    const [isPolling, setIsPolling] = useState(false);
    const [entitlementStatus, setEntitlementStatus] = useState<EntitlementStatus | null>(null);
    const cancelRef = useRef(false);

    const cancelPolling = useCallback(() => {
        cancelRef.current = true;
    }, []);

    const pollForEntitlements = useCallback(async (
        userId: string,
        expectedTier: string = 'PRO',
        onSuccess?: (profile: { subscription_tier: string; credits: number }) => void
    ): Promise<boolean> => {
        setIsPolling(true);
        cancelRef.current = false;

        const POLL_INTERVAL = 1200; // 1.2 seconds between polls
        const MAX_POLL_TIME = 10000; // 10 seconds max
        const startTime = Date.now();

        console.log('[EntitlementPolling] Starting poll for user:', userId, 'expecting tier:', expectedTier);

        setEntitlementStatus({
            success: false,
            tier: null,
            credits: null,
            message: 'Checking your subscription status...'
        });

        while (Date.now() - startTime < MAX_POLL_TIME && !cancelRef.current) {
            try {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('subscription_tier, credits, stripe_customer_id')
                    .eq('id', userId)
                    .single();

                if (error) {
                    console.warn('[EntitlementPolling] Query error:', error.message);
                } else if (profile) {
                    console.log('[EntitlementPolling] Current tier:', profile.subscription_tier);

                    // Check if tier has been updated to paid
                    if (profile.subscription_tier && profile.subscription_tier !== 'FREE') {
                        console.log('[EntitlementPolling] Entitlement updated! Tier:', profile.subscription_tier);

                        setEntitlementStatus({
                            success: true,
                            tier: profile.subscription_tier,
                            credits: profile.credits,
                            message: `Welcome to ${profile.subscription_tier}! Your account has been upgraded.`
                        });

                        setIsPolling(false);

                        // Call success callback with updated profile
                        if (onSuccess) {
                            onSuccess({
                                subscription_tier: profile.subscription_tier,
                                credits: profile.credits || 0
                            });
                        }

                        return true;
                    }
                }
            } catch (err) {
                console.error('[EntitlementPolling] Poll error:', err);
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        }

        // Timeout or cancelled
        if (cancelRef.current) {
            console.log('[EntitlementPolling] Polling cancelled');
            setEntitlementStatus({
                success: false,
                tier: null,
                credits: null,
                message: 'Polling cancelled'
            });
        } else {
            console.log('[EntitlementPolling] Polling timed out');
            setEntitlementStatus({
                success: false,
                tier: null,
                credits: null,
                message: 'Your subscription is being processed. It may take a few moments to appear. Please refresh if needed.'
            });
        }

        setIsPolling(false);
        return false;
    }, []);

    return {
        pollForEntitlements,
        isPolling,
        entitlementStatus,
        cancelPolling
    };
}

/**
 * Helper function to clear checkout session_id from URL
 * Call after processing to prevent re-polling on refresh
 */
export function clearCheckoutSessionFromUrl(): void {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    if (url.searchParams.has('session_id')) {
        url.searchParams.delete('session_id');
        window.history.replaceState({}, '', url.pathname + url.search);
        console.log('[EntitlementPolling] Cleared session_id from URL');
    }
}
