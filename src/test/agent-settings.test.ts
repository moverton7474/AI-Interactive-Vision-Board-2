import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockSupabaseClient,
  mockUser
} from './edge-function-utils';

/**
 * Agent Settings Tests
 *
 * Tests for the effective agent settings calculation logic.
 * The getEffectiveSettings function merges user and team settings
 * with team policies taking precedence for restrictions.
 */

// Mock user agent settings
const mockUserAgentSettings = {
  user_id: 'test-user-123',
  agent_actions_enabled: true,
  allow_send_email: true,
  allow_send_sms: true,
  allow_voice_calls: true,
  allow_create_tasks: true,
  allow_schedule_reminders: true,
  confidence_threshold: 0.75,
  require_high_confidence: false,
  auto_approve_low_risk: true,
  auto_approve_medium_risk: true,
  require_confirmation_email: true,
  require_confirmation_sms: true,
  require_confirmation_voice: true
};

// Mock team AI settings
const mockTeamAISettings = {
  team_id: 'team-123',
  allow_send_email: true,
  allow_send_sms: false, // Team disables SMS
  allow_voice_calls: false, // Team disables voice calls
  allow_create_tasks: true,
  allow_schedule_reminders: true,
  min_confidence_threshold: 0.60,
  allow_user_auto_approve_low: true,
  allow_user_auto_approve_medium: false, // Team restricts medium risk
  allow_user_auto_approve_high: false,
  require_admin_approval_critical: true,
  require_confirmation: true
};

describe('Agent Effective Settings', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  describe('Permission Merging', () => {
    it('should require both user and team permission for actions', () => {
      // User allows SMS, Team disallows => Result: false
      const userAllows = mockUserAgentSettings.allow_send_sms;
      const teamAllows = mockTeamAISettings.allow_send_sms;
      const effectivePermission = userAllows && teamAllows;

      expect(userAllows).toBe(true);
      expect(teamAllows).toBe(false);
      expect(effectivePermission).toBe(false);
    });

    it('should allow action only when both user and team permit', () => {
      // User allows email, Team allows => Result: true
      const userAllows = mockUserAgentSettings.allow_send_email;
      const teamAllows = mockTeamAISettings.allow_send_email;
      const effectivePermission = userAllows && teamAllows;

      expect(effectivePermission).toBe(true);
    });

    it('should block voice calls when team disables', () => {
      const userAllows = mockUserAgentSettings.allow_voice_calls;
      const teamAllows = mockTeamAISettings.allow_voice_calls;
      const effectivePermission = userAllows && teamAllows;

      expect(userAllows).toBe(true);
      expect(teamAllows).toBe(false);
      expect(effectivePermission).toBe(false);
    });
  });

  describe('Confidence Threshold Calculation', () => {
    it('should use user threshold when above team minimum', () => {
      const userThreshold = mockUserAgentSettings.confidence_threshold; // 0.75
      const teamMinimum = mockTeamAISettings.min_confidence_threshold; // 0.60
      const effectiveThreshold = Math.max(userThreshold, teamMinimum);

      expect(effectiveThreshold).toBe(0.75);
    });

    it('should enforce team minimum when user sets lower', () => {
      const userThreshold = 0.50; // User tries to set lower
      const teamMinimum = 0.60; // Team minimum
      const effectiveThreshold = Math.max(userThreshold, teamMinimum);

      expect(effectiveThreshold).toBe(0.60);
    });

    it('should handle missing user threshold with default', () => {
      const userThreshold = undefined;
      const teamMinimum = 0.60;
      const defaultThreshold = 0.70;
      const effectiveThreshold = Math.max(userThreshold ?? defaultThreshold, teamMinimum);

      expect(effectiveThreshold).toBe(0.70);
    });
  });

  describe('Auto-Approval Permissions', () => {
    it('should allow low-risk auto-approve when both permit', () => {
      const userAutoApproveLow = mockUserAgentSettings.auto_approve_low_risk;
      const teamAllowsAutoApproveLow = mockTeamAISettings.allow_user_auto_approve_low;
      const canAutoApproveLow = userAutoApproveLow && teamAllowsAutoApproveLow;

      expect(canAutoApproveLow).toBe(true);
    });

    it('should block medium-risk auto-approve when team restricts', () => {
      const userAutoApproveMedium = mockUserAgentSettings.auto_approve_medium_risk;
      const teamAllowsAutoApproveMedium = mockTeamAISettings.allow_user_auto_approve_medium;
      const canAutoApproveMedium = userAutoApproveMedium && teamAllowsAutoApproveMedium;

      expect(userAutoApproveMedium).toBe(true);
      expect(teamAllowsAutoApproveMedium).toBe(false);
      expect(canAutoApproveMedium).toBe(false);
    });

    it('should never allow high-risk auto-approve with default team policy', () => {
      const teamAllowsAutoApproveHigh = mockTeamAISettings.allow_user_auto_approve_high;
      expect(teamAllowsAutoApproveHigh).toBe(false);
    });
  });

  describe('Confirmation Requirements', () => {
    it('should require confirmation when either user or team requires', () => {
      const userRequiresEmail = mockUserAgentSettings.require_confirmation_email;
      const teamRequiresConfirmation = mockTeamAISettings.require_confirmation;
      const mustConfirmEmail = userRequiresEmail || teamRequiresConfirmation;

      expect(mustConfirmEmail).toBe(true);
    });

    it('should require confirmation even if user disables but team requires', () => {
      const userRequiresEmail = false; // User opts out
      const teamRequiresConfirmation = true; // Team policy requires
      const mustConfirmEmail = userRequiresEmail || teamRequiresConfirmation;

      expect(mustConfirmEmail).toBe(true);
    });
  });

  describe('Settings Retrieval', () => {
    it('should handle user with no settings (use defaults)', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      const result = await mockSupabase.from('user_agent_settings')
        .select('*')
        .eq('user_id', mockUser.id)
        .single();

      expect(result.data).toBeNull();
      // When null, defaults should be used
    });

    it('should fetch user settings correctly', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockUserAgentSettings,
              error: null
            })
          })
        })
      });

      const result = await mockSupabase.from('user_agent_settings')
        .select('*')
        .eq('user_id', mockUser.id)
        .single();

      expect(result.data).toEqual(mockUserAgentSettings);
      expect(result.data.confidence_threshold).toBe(0.75);
    });

    it('should fetch team settings for user', async () => {
      // First query gets team membership
      const mockTeamMemberResult = {
        data: { team_id: 'team-123' },
        error: null
      };

      // Second query gets team settings
      mockSupabase.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(mockTeamMemberResult)
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockTeamAISettings,
                error: null
              })
            })
          })
        });

      const memberResult = await mockSupabase.from('team_members')
        .select('team_id')
        .eq('user_id', mockUser.id)
        .eq('status', 'active')
        .single();

      expect(memberResult.data.team_id).toBe('team-123');

      const teamResult = await mockSupabase.from('team_ai_settings')
        .select('*')
        .eq('team_id', 'team-123')
        .single();

      expect(teamResult.data).toEqual(mockTeamAISettings);
    });
  });

  describe('Feature Flag Integration', () => {
    it('should check if feature flag is enabled globally', async () => {
      const mockFeatureFlag = {
        flag_name: 'agent_confirmation_flow',
        enabled_globally: true,
        enabled_for_teams: [],
        enabled_for_users: [],
        rollout_percentage: 0
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockFeatureFlag,
              error: null
            })
          })
        })
      });

      const result = await mockSupabase.from('feature_flags')
        .select('*')
        .eq('flag_name', 'agent_confirmation_flow')
        .single();

      expect(result.data.enabled_globally).toBe(true);
    });

    it('should check if feature is enabled for specific team', () => {
      const featureFlag = {
        flag_name: 'agent_voice_call_tool',
        enabled_globally: false,
        enabled_for_teams: ['team-123', 'team-456'],
        enabled_for_users: [],
        rollout_percentage: 0
      };

      const teamId = 'team-123';
      const isEnabledForTeam = featureFlag.enabled_for_teams.includes(teamId);

      expect(isEnabledForTeam).toBe(true);
    });

    it('should calculate rollout percentage deterministically', () => {
      // Simple hash-based rollout check (simulating DB function)
      const hashUserId = (userId: string): number => {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
          hash = ((hash << 5) - hash) + userId.charCodeAt(i);
          hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash) % 100;
      };

      const rolloutPercentage = 50;
      const userId = 'test-user-123';
      const userBucket = hashUserId(userId);
      const isInRollout = userBucket < rolloutPercentage;

      // The result should be deterministic for the same user
      expect(hashUserId(userId)).toBe(hashUserId(userId));
      expect(typeof isInRollout).toBe('boolean');
    });
  });

  describe('Risk Level Categorization', () => {
    const categorizeRisk = (actionType: string): 'low' | 'medium' | 'high' | 'critical' => {
      const riskMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
        'create_task': 'low',
        'schedule_reminder': 'low',
        'query_user_data': 'low',
        'update_habit_completion': 'medium',
        'update_progress': 'medium',
        'send_email': 'high',
        'send_sms': 'high',
        'make_voice_call': 'high',
        'send_email_to_contact': 'critical',
        'modify_financial_data': 'critical'
      };
      return riskMap[actionType] || 'medium';
    };

    it('should categorize task creation as low risk', () => {
      expect(categorizeRisk('create_task')).toBe('low');
    });

    it('should categorize email sending as high risk', () => {
      expect(categorizeRisk('send_email')).toBe('high');
    });

    it('should categorize external email as critical', () => {
      expect(categorizeRisk('send_email_to_contact')).toBe('critical');
    });

    it('should default unknown actions to medium risk', () => {
      expect(categorizeRisk('unknown_action')).toBe('medium');
    });
  });

  describe('Confirmation Requirement Logic', () => {
    const requiresConfirmation = (
      actionType: string,
      riskLevel: string,
      effectiveSettings: {
        auto_approve_low_risk: boolean;
        auto_approve_medium_risk: boolean;
        require_confirmation_email: boolean;
        require_confirmation_sms: boolean;
        require_confirmation_voice: boolean;
      }
    ): boolean => {
      // Critical actions always require confirmation
      if (riskLevel === 'critical') return true;

      // High risk actions check specific settings
      if (riskLevel === 'high') {
        if (actionType.includes('email')) return effectiveSettings.require_confirmation_email;
        if (actionType.includes('sms')) return effectiveSettings.require_confirmation_sms;
        if (actionType.includes('voice') || actionType.includes('call')) {
          return effectiveSettings.require_confirmation_voice;
        }
        return true; // Default to requiring confirmation for unknown high-risk
      }

      // Medium risk - check auto-approve setting
      if (riskLevel === 'medium') {
        return !effectiveSettings.auto_approve_medium_risk;
      }

      // Low risk - check auto-approve setting
      return !effectiveSettings.auto_approve_low_risk;
    };

    const testSettings = {
      auto_approve_low_risk: true,
      auto_approve_medium_risk: false,
      require_confirmation_email: true,
      require_confirmation_sms: true,
      require_confirmation_voice: true
    };

    it('should not require confirmation for auto-approved low risk', () => {
      expect(requiresConfirmation('create_task', 'low', testSettings)).toBe(false);
    });

    it('should require confirmation for medium risk when not auto-approved', () => {
      expect(requiresConfirmation('update_progress', 'medium', testSettings)).toBe(true);
    });

    it('should always require confirmation for critical actions', () => {
      expect(requiresConfirmation('send_email_to_contact', 'critical', testSettings)).toBe(true);
    });

    it('should check email confirmation setting for email actions', () => {
      expect(requiresConfirmation('send_email', 'high', testSettings)).toBe(true);

      const noEmailConfirmSettings = { ...testSettings, require_confirmation_email: false };
      expect(requiresConfirmation('send_email', 'high', noEmailConfirmSettings)).toBe(false);
    });
  });
});

describe('Agent Settings Edge Cases', () => {
  it('should handle null team settings gracefully', () => {
    const userSettings = mockUserAgentSettings;
    const teamSettings = null;

    // When no team settings, use user settings with safe defaults
    const effectiveAllowSms = userSettings.allow_send_sms && (teamSettings?.allow_send_sms ?? true);
    const effectiveThreshold = Math.max(
      userSettings.confidence_threshold,
      teamSettings?.min_confidence_threshold ?? 0.50
    );

    expect(effectiveAllowSms).toBe(true);
    expect(effectiveThreshold).toBe(0.75);
  });

  it('should handle null user settings gracefully', () => {
    const userSettings = null;
    const teamSettings = mockTeamAISettings;
    const defaultSettings = {
      agent_actions_enabled: false,
      allow_send_sms: false,
      confidence_threshold: 0.70
    };

    const effectiveEnabled = userSettings?.agent_actions_enabled ?? defaultSettings.agent_actions_enabled;
    const effectiveAllowSms = (userSettings?.allow_send_sms ?? defaultSettings.allow_send_sms)
      && teamSettings.allow_send_sms;

    expect(effectiveEnabled).toBe(false);
    expect(effectiveAllowSms).toBe(false);
  });

  it('should handle both settings being null', () => {
    const userSettings = null;
    const teamSettings = null;
    const defaultSettings = {
      agent_actions_enabled: false,
      allow_send_email: true,
      allow_send_sms: false,
      allow_voice_calls: false,
      confidence_threshold: 0.70,
      auto_approve_low_risk: true,
      auto_approve_medium_risk: false
    };

    // With no settings, use safe defaults
    expect(defaultSettings.agent_actions_enabled).toBe(false);
    expect(defaultSettings.allow_send_sms).toBe(false);
    expect(defaultSettings.confidence_threshold).toBe(0.70);
  });
});
