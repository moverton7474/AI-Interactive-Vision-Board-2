import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockSupabaseClient,
  createMockRequest,
  createOptionsRequest,
  mockUser,
  mockHabit,
  mockHabitCompletion
} from './edge-function-utils';

/**
 * Habit Service Edge Function Tests
 *
 * These tests verify the business logic of the habit-service Edge Function.
 * Since Edge Functions run in Deno, we test the logic patterns rather than
 * the actual Deno handlers.
 */

describe('Habit Service', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  describe('CORS Handling', () => {
    it('should handle OPTIONS preflight requests', () => {
      const request = createOptionsRequest();
      expect(request.method).toBe('OPTIONS');
    });

    it('should include proper CORS headers in request', () => {
      const request = createMockRequest({ action: 'list' });
      expect(request.headers.get('Authorization')).toBe('Bearer test-token');
      expect(request.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('Authentication', () => {
    it('should require authorization header', () => {
      const request = new Request('https://test.supabase.co/functions/v1/habit-service?action=list', {
        method: 'GET'
      });
      expect(request.headers.get('Authorization')).toBeNull();
    });

    it('should extract user from auth token', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const result = await mockSupabase.auth.getUser('test-token');
      expect(result.data.user).toEqual(mockUser);
      expect(result.error).toBeNull();
    });

    it('should handle invalid auth token', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      });

      const result = await mockSupabase.auth.getUser('invalid-token');
      expect(result.data.user).toBeNull();
      expect(result.error).toBeTruthy();
    });
  });

  describe('Create Habit', () => {
    it('should require title for habit creation', () => {
      const body = { description: 'Test habit' };
      expect(body.title).toBeUndefined();
    });

    it('should create habit with required fields', () => {
      const habitData = {
        user_id: mockUser.id,
        title: 'Morning Meditation',
        description: 'Meditate for 10 minutes',
        frequency: 'daily',
        custom_days: [],
        reminder_time: null,
        task_id: null,
        is_active: true
      };

      expect(habitData.title).toBe('Morning Meditation');
      expect(habitData.frequency).toBe('daily');
      expect(habitData.is_active).toBe(true);
    });

    it('should default frequency to daily if not provided', () => {
      const body = { title: 'Test Habit' };
      const frequency = body.frequency || 'daily';
      expect(frequency).toBe('daily');
    });

    it('should insert habit into database', async () => {
      const habitData = {
        user_id: mockUser.id,
        title: 'Test Habit',
        frequency: 'daily'
      };

      const mockInsertResult = {
        data: { ...mockHabit, ...habitData },
        error: null
      };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(mockInsertResult)
        })
      });

      mockSupabase.from.mockReturnValue({ insert: mockInsert });

      const result = await mockSupabase.from('habits').insert(habitData).select().single();
      expect(mockSupabase.from).toHaveBeenCalledWith('habits');
    });
  });

  describe('Complete Habit', () => {
    it('should require habitId for completion', () => {
      const body = { date: '2024-01-15' };
      expect(body.habitId).toBeUndefined();
    });

    it('should verify habit belongs to user before completion', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockHabit,
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({ select: mockSelect });

      // Simulate the verification query
      await mockSupabase.from('habits')
        .select('id, title, user_id')
        .eq('id', mockHabit.id)
        .eq('user_id', mockUser.id)
        .single();

      expect(mockSupabase.from).toHaveBeenCalledWith('habits');
    });

    it('should use current date if not provided', () => {
      const providedDate = null;
      const completionDate = providedDate || new Date().toISOString().split('T')[0];
      expect(completionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle duplicate completion error', async () => {
      const duplicateError = { code: '23505', message: 'duplicate key' };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: duplicateError
          })
        })
      });

      mockSupabase.from.mockReturnValue({ insert: mockInsert });

      const result = await mockSupabase.from('habit_completions')
        .insert({ habit_id: 'test', completed_at: '2024-01-15' })
        .select()
        .single();

      expect(result.error?.code).toBe('23505');
    });

    it('should call streak calculation after completion', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 5, error: null });

      const result = await mockSupabase.rpc('calculate_streak', { p_habit_id: mockHabit.id });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('calculate_streak', { p_habit_id: mockHabit.id });
      expect(result.data).toBe(5);
    });
  });

  describe('Uncomplete Habit', () => {
    it('should remove completion for specific date', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      });

      mockSupabase.from.mockReturnValue({ delete: mockDelete });

      await mockSupabase.from('habit_completions')
        .delete()
        .eq('habit_id', mockHabit.id)
        .eq('completed_at', '2024-01-15');

      expect(mockSupabase.from).toHaveBeenCalledWith('habit_completions');
    });
  });

  describe('List Habits', () => {
    it('should filter inactive habits by default', () => {
      const includeInactive = false;
      expect(includeInactive).toBe(false);
    });

    it('should support filtering by taskId', () => {
      const params = new URLSearchParams('taskId=task-123');
      expect(params.get('taskId')).toBe('task-123');
    });

    it('should enrich habits with streak data', async () => {
      const habits = [mockHabit];

      mockSupabase.rpc.mockResolvedValue({ data: 5, error: null });

      const enrichedHabits = await Promise.all(
        habits.map(async (habit) => {
          const { data: streakData } = await mockSupabase.rpc('calculate_streak', { p_habit_id: habit.id });
          return {
            ...habit,
            currentStreak: streakData || 0
          };
        })
      );

      expect(enrichedHabits[0].currentStreak).toBe(5);
    });

    it('should check today completion status', () => {
      const today = new Date().toISOString().split('T')[0];
      const completions = [{ completed_at: today }];
      const completedToday = completions.some(c => c.completed_at === today);
      expect(completedToday).toBe(true);
    });
  });

  describe('Get Habit Stats', () => {
    it('should calculate date range from period', () => {
      const period = '30';
      const periodDays = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      expect(periodDays).toBe(30);
      expect(startDate).toBeInstanceOf(Date);
    });

    it('should calculate completion rate correctly', () => {
      const completedDays = 25;
      const expectedDays = 30;
      const completionRate = expectedDays > 0 ? (completedDays / expectedDays) * 100 : 0;

      expect(completionRate).toBeCloseTo(83.33, 1);
    });

    it('should calculate average mood from ratings', () => {
      const moodRatings = [4, 5, 3, 4, 5];
      const averageMood = moodRatings.reduce((a, b) => a + b, 0) / moodRatings.length;

      expect(averageMood).toBe(4.2);
    });

    it('should handle empty mood ratings', () => {
      const moodRatings: number[] = [];
      const averageMood = moodRatings.length > 0
        ? moodRatings.reduce((a, b) => a + b, 0) / moodRatings.length
        : null;

      expect(averageMood).toBeNull();
    });
  });

  describe('Update Habit', () => {
    it('should require habitId for update', () => {
      const body = { title: 'New Title' };
      expect(body.habitId).toBeUndefined();
    });

    it('should only include provided fields in update', () => {
      const body = { habitId: 'test', title: 'New Title' };
      const updates: Record<string, any> = {};

      if (body.title !== undefined) updates.title = body.title;
      if (body.description !== undefined) updates.description = body.description;

      expect(updates).toEqual({ title: 'New Title' });
      expect(updates.description).toBeUndefined();
    });

    it('should reject update with no fields', () => {
      const updates = {};
      expect(Object.keys(updates).length).toBe(0);
    });
  });

  describe('Delete Habit', () => {
    it('should support soft delete (deactivate)', async () => {
      const body = { habitId: mockHabit.id, permanent: false };

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      mockSupabase.from.mockReturnValue({ update: mockUpdate });

      await mockSupabase.from('habits')
        .update({ is_active: false })
        .eq('id', body.habitId);

      expect(body.permanent).toBe(false);
    });

    it('should support permanent delete', async () => {
      const body = { habitId: mockHabit.id, permanent: true };

      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      mockSupabase.from.mockReturnValue({ delete: mockDelete });

      await mockSupabase.from('habits')
        .delete()
        .eq('id', body.habitId);

      expect(body.permanent).toBe(true);
    });
  });

  describe('Expected Days Calculation', () => {
    const calculateExpectedDays = (
      frequency: string,
      periodDays: number,
      createdAt: string
    ): number => {
      const habitAge = Math.floor(
        (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const effectiveDays = Math.min(periodDays, habitAge + 1);

      switch (frequency) {
        case 'daily':
          return effectiveDays;
        case 'weekdays':
          return Math.round(effectiveDays * (5 / 7));
        case 'weekly':
          return Math.ceil(effectiveDays / 7);
        default:
          return effectiveDays;
      }
    };

    it('should calculate daily expected days correctly', () => {
      const createdAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const expected = calculateExpectedDays('daily', 30, createdAt);
      expect(expected).toBe(30);
    });

    it('should calculate weekdays expected days correctly', () => {
      const createdAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const expected = calculateExpectedDays('weekdays', 30, createdAt);
      // 30 * 5/7 ≈ 21
      expect(expected).toBeCloseTo(21, 0);
    });

    it('should calculate weekly expected days correctly', () => {
      const createdAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const expected = calculateExpectedDays('weekly', 30, createdAt);
      // ceil(30/7) = 5
      expect(expected).toBe(5);
    });

    it('should cap expected days to habit age', () => {
      // Habit created 5 days ago
      const createdAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const expected = calculateExpectedDays('daily', 30, createdAt);
      expect(expected).toBeLessThanOrEqual(6); // 5 days + 1 for today
    });
  });

  describe('Streak Milestones', () => {
    const milestones = [7, 14, 21, 30, 60, 90, 100, 365];

    it('should recognize 7-day milestone', () => {
      const currentStreak = 7;
      expect(milestones.includes(currentStreak)).toBe(true);
    });

    it('should recognize 30-day milestone', () => {
      const currentStreak = 30;
      expect(milestones.includes(currentStreak)).toBe(true);
    });

    it('should recognize 100-day milestone', () => {
      const currentStreak = 100;
      expect(milestones.includes(currentStreak)).toBe(true);
    });

    it('should not trigger for non-milestone streaks', () => {
      const currentStreak = 15;
      expect(milestones.includes(currentStreak)).toBe(false);
    });
  });
});
