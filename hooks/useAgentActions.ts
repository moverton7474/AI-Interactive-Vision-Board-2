/**
 * useAgentActions Hook
 *
 * Provides real-time state management for agent actions including:
 * - Pending actions that need user confirmation
 * - Action history with filtering
 * - Real-time updates via Supabase subscriptions
 * - Confirm/cancel action handlers
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  PendingAgentAction,
  AgentActionHistory,
  UserAgentSettings,
  AgentActionRiskLevel,
} from '../types';

export interface UseAgentActionsOptions {
  /** Whether to auto-subscribe to realtime updates */
  enableRealtime?: boolean;
  /** Limit for action history fetch */
  historyLimit?: number;
  /** Filter by action type */
  actionTypeFilter?: string[];
  /** Filter by status */
  statusFilter?: string[];
}

export interface UseAgentActionsReturn {
  // State
  pendingActions: PendingAgentAction[];
  actionHistory: AgentActionHistory[];
  settings: Partial<UserAgentSettings> | null;
  loading: boolean;
  error: string | null;

  // Actions
  confirmAction: (actionId: string, feedback?: { rating?: number; comment?: string }) => Promise<boolean>;
  cancelAction: (actionId: string, reason?: string) => Promise<boolean>;
  refreshPendingActions: () => Promise<void>;
  refreshActionHistory: () => Promise<void>;
  updateSettings: (updates: Partial<UserAgentSettings>) => Promise<boolean>;

  // Computed
  pendingCount: number;
  hasHighRiskPending: boolean;
}

export function useAgentActions(options: UseAgentActionsOptions = {}): UseAgentActionsReturn {
  const {
    enableRealtime = true,
    historyLimit = 20,
    actionTypeFilter,
    statusFilter,
  } = options;

  const [pendingActions, setPendingActions] = useState<PendingAgentAction[]>([]);
  const [actionHistory, setActionHistory] = useState<AgentActionHistory[]>([]);
  const [settings, setSettings] = useState<Partial<UserAgentSettings> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const subscriptionRef = useRef<any>(null);
  const userIdRef = useRef<string | null>(null);

  // Fetch pending actions
  const refreshPendingActions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      userIdRef.current = user.id;

      let query = supabase
        .from('pending_agent_actions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (actionTypeFilter && actionTypeFilter.length > 0) {
        query = query.in('action_type', actionTypeFilter);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        // Table might not exist yet
        if (fetchError.code === '42P01') {
          console.log('pending_agent_actions table not yet created');
          return;
        }
        throw fetchError;
      }

      setPendingActions(data || []);
    } catch (err: any) {
      console.error('Error fetching pending actions:', err);
      setError(err.message);
    }
  }, [actionTypeFilter]);

  // Fetch action history
  const refreshActionHistory = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('agent_action_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(historyLimit);

      if (actionTypeFilter && actionTypeFilter.length > 0) {
        query = query.in('action_type', actionTypeFilter);
      }

      if (statusFilter && statusFilter.length > 0) {
        query = query.in('action_status', statusFilter);
      }

      const { data, error: fetchError } = await query;

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      setActionHistory(data || []);
    } catch (err: any) {
      console.error('Error fetching action history:', err);
      setError(err.message);
    }
  }, [historyLimit, actionTypeFilter, statusFilter]);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchError } = await supabase
        .from('user_agent_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      setSettings(data || null);
    } catch (err: any) {
      console.error('Error fetching settings:', err);
    }
  }, []);

  // Confirm a pending action
  const confirmAction = useCallback(async (
    actionId: string,
    feedback?: { rating?: number; comment?: string }
  ): Promise<boolean> => {
    try {
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/confirm-agent-action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action_id: actionId, feedback }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        setError(result.error);
        return false;
      }

      // Optimistically update local state
      setPendingActions(prev => prev.filter(a => a.id !== actionId));
      await refreshActionHistory();

      return true;
    } catch (err: any) {
      console.error('Error confirming action:', err);
      setError(err.message);
      return false;
    }
  }, [refreshActionHistory]);

  // Cancel a pending action
  const cancelAction = useCallback(async (
    actionId: string,
    reason?: string
  ): Promise<boolean> => {
    try {
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cancel-agent-action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action_id: actionId, reason }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        setError(result.error);
        return false;
      }

      // Optimistically update local state
      setPendingActions(prev => prev.filter(a => a.id !== actionId));
      await refreshActionHistory();

      return true;
    } catch (err: any) {
      console.error('Error cancelling action:', err);
      setError(err.message);
      return false;
    }
  }, [refreshActionHistory]);

  // Update settings
  const updateSettings = useCallback(async (
    updates: Partial<UserAgentSettings>
  ): Promise<boolean> => {
    try {
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: saveError } = await supabase
        .from('user_agent_settings')
        .upsert({
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (saveError) throw saveError;

      // Update local state
      setSettings(prev => ({ ...prev, ...updates }));

      return true;
    } catch (err: any) {
      console.error('Error updating settings:', err);
      setError(err.message);
      return false;
    }
  }, []);

  // Setup realtime subscription
  useEffect(() => {
    if (!enableRealtime) return;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Subscribe to pending actions changes
      subscriptionRef.current = supabase
        .channel('pending_agent_actions_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pending_agent_actions',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('Pending action change:', payload);

            if (payload.eventType === 'INSERT') {
              const newAction = payload.new as PendingAgentAction;
              if (newAction.status === 'pending') {
                setPendingActions(prev => [newAction, ...prev]);
              }
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as PendingAgentAction;
              if (updated.status !== 'pending') {
                // Remove from pending if no longer pending
                setPendingActions(prev => prev.filter(a => a.id !== updated.id));
              } else {
                // Update in place
                setPendingActions(prev =>
                  prev.map(a => a.id === updated.id ? updated : a)
                );
              }
            } else if (payload.eventType === 'DELETE') {
              setPendingActions(prev =>
                prev.filter(a => a.id !== payload.old.id)
              );
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'agent_action_history',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('New action history:', payload);
            const newAction = payload.new as AgentActionHistory;
            setActionHistory(prev => [newAction, ...prev.slice(0, historyLimit - 1)]);
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [enableRealtime, historyLimit]);

  // Initial data fetch
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      await Promise.all([
        refreshPendingActions(),
        refreshActionHistory(),
        fetchSettings(),
      ]);

      setLoading(false);
    };

    fetchAll();
  }, [refreshPendingActions, refreshActionHistory, fetchSettings]);

  // Computed values
  const pendingCount = pendingActions.length;
  const hasHighRiskPending = pendingActions.some(
    a => a.risk_level === 'high' || a.risk_level === 'critical'
  );

  return {
    // State
    pendingActions,
    actionHistory,
    settings,
    loading,
    error,

    // Actions
    confirmAction,
    cancelAction,
    refreshPendingActions,
    refreshActionHistory,
    updateSettings,

    // Computed
    pendingCount,
    hasHighRiskPending,
  };
}

// Export types for consumers
export type { PendingAgentAction, AgentActionHistory, AgentActionRiskLevel };
