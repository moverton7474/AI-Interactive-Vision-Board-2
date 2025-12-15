/**
 * useSubscriptionPolling - P0-B: Frontend Pro Unlock Polling
 *
 * After Stripe checkout completes, the webhook may take 1-3 seconds to process.
 * This hook polls the user's profile to detect when their subscription tier updates,
 * providing immediate UI feedback without requiring a page refresh.
 *
 * Usage:
 *   const { isPolling, message } = useSubscriptionPolling({
 *     userId: session.user.id,
 *     currentTier: subscriptionTier,
 *     onTierUpdate: (newTier) => setSubscriptionTier(newTier)
 *   });
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface UseSubscriptionPollingOptions {
  userId: string | undefined;
  currentTier: 'FREE' | 'PRO' | 'ELITE';
  onTierUpdate: (newTier: 'FREE' | 'PRO' | 'ELITE', newCredits?: number) => void;
  onCreditsUpdate?: (credits: number) => void;
}

interface UseSubscriptionPollingResult {
  isPolling: boolean;
  message: string | null;
  checkoutSessionId: string | null;
}

const POLLING_INTERVAL_MS = 1500; // Poll every 1.5 seconds
const MAX_POLLING_DURATION_MS = 15000; // Stop after 15 seconds
const POLL_ATTEMPTS = Math.ceil(MAX_POLLING_DURATION_MS / POLLING_INTERVAL_MS);

export function useSubscriptionPolling({
  userId,
  currentTier,
  onTierUpdate,
  onCreditsUpdate,
}: UseSubscriptionPollingOptions): UseSubscriptionPollingResult {
  const [isPolling, setIsPolling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);

  // Track initial tier to detect changes
  const initialTierRef = useRef<string>(currentTier);
  const pollCountRef = useRef(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check URL for session_id on mount and URL changes
  useEffect(() => {
    const checkForCheckoutReturn = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');

      if (sessionId && userId) {
        console.log('🔄 Detected Stripe checkout return, session:', sessionId);
        setCheckoutSessionId(sessionId);

        // Clean up URL (remove session_id parameter)
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('session_id');
        window.history.replaceState({}, '', newUrl.toString());

        // Start polling if current tier is FREE (expecting upgrade)
        if (currentTier === 'FREE') {
          setIsPolling(true);
          setMessage('Processing your upgrade...');
          initialTierRef.current = currentTier;
          pollCountRef.current = 0;
        }
      }
    };

    checkForCheckoutReturn();
  }, [userId, currentTier]);

  // Polling logic
  const pollForUpdate = useCallback(async () => {
    if (!userId) return;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_tier, credits')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Polling error:', error);
        return;
      }

      if (profile) {
        const newTier = profile.subscription_tier as 'FREE' | 'PRO' | 'ELITE';

        // Check if tier has upgraded
        if (newTier !== 'FREE' && initialTierRef.current === 'FREE') {
          console.log('✅ Subscription upgrade detected!', { from: initialTierRef.current, to: newTier });

          // Stop polling
          setIsPolling(false);
          setMessage(null);

          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          // Notify parent component
          onTierUpdate(newTier, profile.credits);
          if (onCreditsUpdate && profile.credits !== undefined) {
            onCreditsUpdate(profile.credits);
          }

          return;
        }

        // Update credits if they changed (credit pack purchase)
        if (onCreditsUpdate && profile.credits !== undefined) {
          onCreditsUpdate(profile.credits);
        }
      }

      // Increment poll count
      pollCountRef.current += 1;

      // Check if max attempts reached
      if (pollCountRef.current >= POLL_ATTEMPTS) {
        console.log('⏱️ Polling timeout reached, stopping');
        setIsPolling(false);
        setMessage('Your upgrade is being processed. Please refresh if needed.');

        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } else {
        // Update message with progress
        const remaining = POLL_ATTEMPTS - pollCountRef.current;
        if (remaining <= 3) {
          setMessage('Almost there...');
        }
      }
    } catch (err) {
      console.error('Polling exception:', err);
    }
  }, [userId, onTierUpdate, onCreditsUpdate]);

  // Start/stop polling interval
  useEffect(() => {
    if (isPolling && userId) {
      // Immediately poll once
      pollForUpdate();

      // Set up interval
      pollingIntervalRef.current = setInterval(pollForUpdate, POLLING_INTERVAL_MS);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }
  }, [isPolling, userId, pollForUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return {
    isPolling,
    message,
    checkoutSessionId,
  };
}

export default useSubscriptionPolling;
