// hooks/useEntitlementPolling.ts
// Polls for entitlement changes after Stripe checkout return (P0-B)

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface EntitlementState {
  subscriptionTier: 'FREE' | 'PRO' | 'ELITE';
  credits: number;
  isPolling: boolean;
  pollError: string | null;
}

interface UseEntitlementPollingOptions {
  sessionId: string | null;
  onSuccess?: (tier: string) => void;
  onTimeout?: () => void;
  maxAttempts?: number;
  intervalMs?: number;
}

export function useEntitlementPolling({
  sessionId,
  onSuccess,
  onTimeout,
  maxAttempts = 20,
  intervalMs = 1000,
}: UseEntitlementPollingOptions) {
  const [state, setState] = useState<EntitlementState>({
    subscriptionTier: 'FREE',
    credits: 0,
    isPolling: false,
    pollError: null,
  });

  const [attempts, setAttempts] = useState(0);

  const checkEntitlements = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_tier, credits')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('[EntitlementPolling] Profile fetch error:', error);
        return null;
      }

      return profile;
    } catch (err) {
      console.error('[EntitlementPolling] Check error:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    let pollInterval: NodeJS.Timeout | null = null;
    let cancelled = false;

    const startPolling = async () => {
      setState(prev => ({ ...prev, isPolling: true, pollError: null }));
      console.log('[EntitlementPolling] Starting poll for session:', sessionId);

      // Get initial state
      const initialProfile = await checkEntitlements();
      const initialTier = initialProfile?.subscription_tier || 'FREE';

      pollInterval = setInterval(async () => {
        if (cancelled) return;

        setAttempts(prev => {
          const newAttempts = prev + 1;
          console.log(`[EntitlementPolling] Attempt ${newAttempts}/${maxAttempts}`);

          if (newAttempts >= maxAttempts) {
            // Timeout reached
            if (pollInterval) clearInterval(pollInterval);
            setState(prev => ({
              ...prev,
              isPolling: false,
              pollError: 'Entitlement update is taking longer than expected. Please refresh if your subscription is not updated.',
            }));
            onTimeout?.();
            return newAttempts;
          }

          return newAttempts;
        });

        const profile = await checkEntitlements();
        if (!profile) return;

        // Check if tier changed from initial
        if (profile.subscription_tier !== initialTier && profile.subscription_tier !== 'FREE') {
          console.log('[EntitlementPolling] Entitlement updated!', profile);

          if (pollInterval) clearInterval(pollInterval);

          setState({
            subscriptionTier: profile.subscription_tier as 'FREE' | 'PRO' | 'ELITE',
            credits: profile.credits,
            isPolling: false,
            pollError: null,
          });

          onSuccess?.(profile.subscription_tier);

          // Clean up URL
          const url = new URL(window.location.href);
          url.searchParams.delete('session_id');
          window.history.replaceState({}, '', url.toString());
        }
      }, intervalMs);
    };

    startPolling();

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [sessionId, maxAttempts, intervalMs, checkEntitlements, onSuccess, onTimeout]);

  return {
    ...state,
    attempts,
    maxAttempts,
  };
}

export default useEntitlementPolling;
