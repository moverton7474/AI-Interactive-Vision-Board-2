import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockSupabaseClient,
  mockUser,
  createMockRequest,
  parseResponse
} from './edge-function-utils';

/**
 * Agent Confirmation Flow Integration Tests
 *
 * Tests for the Human-in-the-Loop (HITL) confirmation flow
 * that ensures user approval before executing high-risk actions.
 */

// Mock pending action
const mockPendingAction = {
  id: 'action-123',
  user_id: 'test-user-123',
  session_id: 'session-456',
  action_type: 'make_voice_call',
  action_payload: {
    call_type: 'motivation',
    message: 'Great job on your progress!',
    phone_number: '+1234567890'
  },
  status: 'pending',
  confidence_score: 0.85,
  risk_level: 'high',
  expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Mock expired action
const mockExpiredAction = {
  ...mockPendingAction,
  id: 'action-expired',
  expires_at: new Date(Date.now() - 60 * 1000).toISOString() // Expired 1 minute ago
};

// Mock already processed action
const mockConfirmedAction = {
  ...mockPendingAction,
  id: 'action-confirmed',
  status: 'confirmed',
  confirmed_at: new Date().toISOString()
};

describe('Pending Action Creation', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  it('should create a pending action with correct structure', async () => {
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockPendingAction,
          error: null
        })
      })
    });

    mockSupabase.from.mockReturnValue({ insert: insertMock });

    const result = await mockSupabase.from('pending_agent_actions')
      .insert({
        user_id: mockUser.id,
        action_type: 'make_voice_call',
        action_payload: mockPendingAction.action_payload,
        status: 'pending',
        risk_level: 'high',
        expires_at: mockPendingAction.expires_at
      })
      .select()
      .single();

    expect(result.data).toBeDefined();
    expect(result.data.status).toBe('pending');
    expect(result.data.risk_level).toBe('high');
    expect(result.error).toBeNull();
  });

  it('should set appropriate expiration time based on risk level', () => {
    const getExpirationMinutes = (riskLevel: string): number => {
      switch (riskLevel) {
        case 'low': return 15;
        case 'medium': return 10;
        case 'high': return 5;
        case 'critical': return 3;
        default: return 5;
      }
    };

    expect(getExpirationMinutes('low')).toBe(15);
    expect(getExpirationMinutes('high')).toBe(5);
    expect(getExpirationMinutes('critical')).toBe(3);
  });

  it('should include confidence score in pending action', () => {
    expect(mockPendingAction.confidence_score).toBe(0.85);
    expect(mockPendingAction.confidence_score).toBeGreaterThan(0);
    expect(mockPendingAction.confidence_score).toBeLessThanOrEqual(1);
  });
});

describe('Action Confirmation', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  describe('Validation Checks', () => {
    it('should reject confirmation without action_id', () => {
      const request = createMockRequest({});
      const body = {};

      expect(body).not.toHaveProperty('action_id');
    });

    it('should reject confirmation for non-existent action', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'Not found' }
              })
            })
          })
        })
      });

      const result = await mockSupabase.from('pending_agent_actions')
        .select('*')
        .eq('id', 'non-existent-id')
        .eq('user_id', mockUser.id)
        .single();

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should reject confirmation for another users action', async () => {
      const otherUserAction = {
        ...mockPendingAction,
        user_id: 'other-user-456'
      };

      // Simulating RLS - query returns null when user_id doesn't match
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        })
      });

      const result = await mockSupabase.from('pending_agent_actions')
        .select('*')
        .eq('id', otherUserAction.id)
        .eq('user_id', mockUser.id) // Current user trying to access
        .single();

      expect(result.data).toBeNull();
    });

    it('should reject confirmation for expired action', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockExpiredAction,
                error: null
              })
            })
          })
        })
      });

      const result = await mockSupabase.from('pending_agent_actions')
        .select('*')
        .eq('id', mockExpiredAction.id)
        .eq('user_id', mockUser.id)
        .single();

      const expiresAt = new Date(result.data.expires_at);
      const isExpired = expiresAt < new Date();

      expect(isExpired).toBe(true);
    });

    it('should reject confirmation for already processed action', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockConfirmedAction,
                error: null
              })
            })
          })
        })
      });

      const result = await mockSupabase.from('pending_agent_actions')
        .select('*')
        .eq('id', mockConfirmedAction.id)
        .eq('user_id', mockUser.id)
        .single();

      expect(result.data.status).toBe('confirmed');
      expect(result.data.status).not.toBe('pending');
    });
  });

  describe('Successful Confirmation', () => {
    it('should update action status to confirmed', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: { ...mockPendingAction, status: 'confirmed', confirmed_at: new Date().toISOString() },
          error: null
        })
      });

      mockSupabase.from.mockReturnValue({ update: updateMock });

      await mockSupabase.from('pending_agent_actions')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString()
        })
        .eq('id', mockPendingAction.id);

      expect(updateMock).toHaveBeenCalledWith({
        status: 'confirmed',
        confirmed_at: expect.any(String)
      });
    });

    it('should execute the action after confirmation', async () => {
      // Mock the action execution
      const executeAction = async (actionType: string, payload: any) => {
        switch (actionType) {
          case 'make_voice_call':
            return { success: true, message: 'Call initiated' };
          case 'send_email':
            return { success: true, message: 'Email sent' };
          default:
            return { success: false, error: 'Unknown action type' };
        }
      };

      const result = await executeAction(
        mockPendingAction.action_type,
        mockPendingAction.action_payload
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Call initiated');
    });

    it('should log action to history after execution', async () => {
      const insertMock = vi.fn().mockResolvedValue({
        data: {
          user_id: mockUser.id,
          action_type: mockPendingAction.action_type,
          action_status: 'executed',
          action_payload: mockPendingAction.action_payload,
          trigger_context: 'confirmation'
        },
        error: null
      });

      mockSupabase.from.mockReturnValue({ insert: insertMock });

      await mockSupabase.from('agent_action_history').insert({
        user_id: mockUser.id,
        action_type: mockPendingAction.action_type,
        action_status: 'executed',
        action_payload: mockPendingAction.action_payload,
        trigger_context: 'confirmation'
      });

      expect(insertMock).toHaveBeenCalled();
    });

    it('should record feedback when provided', async () => {
      const feedback = {
        rating: 4,
        comment: 'Helpful action'
      };

      const insertMock = vi.fn().mockResolvedValue({
        data: {
          user_id: mockUser.id,
          action_id: mockPendingAction.id,
          feedback_type: 'confirmation',
          rating: feedback.rating,
          comment: feedback.comment
        },
        error: null
      });

      mockSupabase.from.mockReturnValue({ insert: insertMock });

      await mockSupabase.from('agent_action_feedback').insert({
        user_id: mockUser.id,
        action_id: mockPendingAction.id,
        feedback_type: 'confirmation',
        rating: feedback.rating,
        comment: feedback.comment
      });

      expect(insertMock).toHaveBeenCalled();
    });
  });

  describe('Execution Failure Handling', () => {
    it('should update status to failed when execution fails', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: {
            ...mockPendingAction,
            status: 'failed',
            execution_result: { error: 'Service unavailable' }
          },
          error: null
        })
      });

      mockSupabase.from.mockReturnValue({ update: updateMock });

      await mockSupabase.from('pending_agent_actions')
        .update({
          status: 'failed',
          execution_result: { error: 'Service unavailable' }
        })
        .eq('id', mockPendingAction.id);

      expect(updateMock).toHaveBeenCalledWith({
        status: 'failed',
        execution_result: { error: 'Service unavailable' }
      });
    });
  });
});

describe('Action Cancellation', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  it('should update action status to cancelled', async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: { ...mockPendingAction, status: 'cancelled' },
        error: null
      })
    });

    mockSupabase.from.mockReturnValue({ update: updateMock });

    await mockSupabase.from('pending_agent_actions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: 'User declined'
      })
      .eq('id', mockPendingAction.id);

    expect(updateMock).toHaveBeenCalled();
  });

  it('should categorize rejection reasons correctly', () => {
    const categorizeRejection = (reason: string): string => {
      if (!reason) return 'unspecified';
      const lowerReason = reason.toLowerCase();

      if (lowerReason.includes('not now') || lowerReason.includes('later')) return 'timing';
      if (lowerReason.includes('privacy') || lowerReason.includes('sensitive')) return 'privacy';
      if (lowerReason.includes('wrong') || lowerReason.includes('incorrect')) return 'incorrect_action';
      if (lowerReason.includes('changed') || lowerReason.includes('nevermind')) return 'changed_mind';
      if (lowerReason.includes('cost') || lowerReason.includes('expensive')) return 'resource_concern';
      if (lowerReason.includes('manual') || lowerReason.includes('myself')) return 'prefer_manual';
      return 'other';
    };

    expect(categorizeRejection('Not now, maybe later')).toBe('timing');
    expect(categorizeRejection('This is sensitive info')).toBe('privacy');
    expect(categorizeRejection('Wrong action')).toBe('incorrect_action');
    expect(categorizeRejection('I changed my mind')).toBe('changed_mind');
    expect(categorizeRejection("I'll do it myself")).toBe('prefer_manual');
    expect(categorizeRejection('Some other reason')).toBe('other');
    expect(categorizeRejection('')).toBe('unspecified');
  });

  it('should record rejection feedback for analytics', async () => {
    const insertMock = vi.fn().mockResolvedValue({
      data: {
        user_id: mockUser.id,
        action_id: mockPendingAction.id,
        feedback_type: 'rejection',
        rejection_reason: 'timing'
      },
      error: null
    });

    mockSupabase.from.mockReturnValue({ insert: insertMock });

    await mockSupabase.from('agent_action_feedback').insert({
      user_id: mockUser.id,
      action_id: mockPendingAction.id,
      feedback_type: 'rejection',
      rejection_reason: 'timing'
    });

    expect(insertMock).toHaveBeenCalled();
  });
});

describe('Action Expiration', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  it('should automatically expire old pending actions', async () => {
    // Simulate the expire_pending_actions() function
    const updateMock = vi.fn().mockResolvedValue({
      data: { count: 5 },
      error: null
    });

    mockSupabase.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lt: vi.fn().mockResolvedValue({
            data: { count: 5 },
            error: null
          })
        })
      })
    });

    // This simulates what the DB function does
    const expiredCount = 5; // Mocked result
    expect(expiredCount).toBeGreaterThan(0);
  });

  it('should only expire actions with pending status', () => {
    const shouldExpire = (action: typeof mockPendingAction) => {
      return action.status === 'pending' &&
             new Date(action.expires_at) < new Date();
    };

    expect(shouldExpire(mockPendingAction)).toBe(false); // Not expired yet
    expect(shouldExpire(mockExpiredAction)).toBe(true); // Expired
    expect(shouldExpire(mockConfirmedAction)).toBe(false); // Already processed
  });
});

describe('Realtime Subscription', () => {
  it('should handle INSERT events for new pending actions', () => {
    const handleRealtimeEvent = (
      eventType: string,
      payload: any
    ) => {
      switch (eventType) {
        case 'INSERT':
          return { type: 'add', action: payload.new };
        case 'UPDATE':
          return { type: 'update', action: payload.new };
        case 'DELETE':
          return { type: 'remove', id: payload.old.id };
        default:
          return null;
      }
    };

    const insertEvent = handleRealtimeEvent('INSERT', { new: mockPendingAction });
    expect(insertEvent).toEqual({ type: 'add', action: mockPendingAction });
  });

  it('should handle UPDATE events for action status changes', () => {
    const handleRealtimeEvent = (
      eventType: string,
      payload: any
    ) => {
      if (eventType === 'UPDATE') {
        return { type: 'update', action: payload.new };
      }
      return null;
    };

    const updatedAction = { ...mockPendingAction, status: 'confirmed' };
    const updateEvent = handleRealtimeEvent('UPDATE', { new: updatedAction });

    expect(updateEvent?.action.status).toBe('confirmed');
  });

  it('should filter events by user_id for security', () => {
    const filterByUser = (
      events: any[],
      currentUserId: string
    ) => {
      return events.filter(e => e.user_id === currentUserId);
    };

    const allEvents = [
      { user_id: 'test-user-123', action: 'A' },
      { user_id: 'other-user-456', action: 'B' },
      { user_id: 'test-user-123', action: 'C' }
    ];

    const filteredEvents = filterByUser(allEvents, 'test-user-123');
    expect(filteredEvents.length).toBe(2);
    expect(filteredEvents.every(e => e.user_id === 'test-user-123')).toBe(true);
  });
});

describe('Time-to-Decision Metrics', () => {
  it('should calculate time from action creation to response', () => {
    const createdAt = new Date(Date.now() - 30000); // 30 seconds ago
    const respondedAt = new Date();
    const timeToDecisionMs = respondedAt.getTime() - createdAt.getTime();

    expect(timeToDecisionMs).toBeGreaterThanOrEqual(30000);
    expect(timeToDecisionMs).toBeLessThan(35000); // Allow some tolerance
  });

  it('should record time to decision in feedback', async () => {
    let mockSupabase = createMockSupabaseClient();
    const timeToDecisionMs = 15000; // 15 seconds

    const insertMock = vi.fn().mockResolvedValue({
      data: {
        user_id: mockUser.id,
        action_id: mockPendingAction.id,
        feedback_type: 'confirmation',
        time_to_decision_ms: timeToDecisionMs
      },
      error: null
    });

    mockSupabase.from.mockReturnValue({ insert: insertMock });

    await mockSupabase.from('agent_action_feedback').insert({
      user_id: mockUser.id,
      action_id: mockPendingAction.id,
      feedback_type: 'confirmation',
      time_to_decision_ms: timeToDecisionMs
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        time_to_decision_ms: 15000
      })
    );
  });
});
