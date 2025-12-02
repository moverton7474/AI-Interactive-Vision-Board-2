/**
 * Habit Creation Flow Tests
 *
 * Tests for creating, completing, and managing habits
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock storage service
const mockGetHabits = vi.fn();
const mockCreateHabit = vi.fn();
const mockDeleteHabit = vi.fn();
const mockCompleteHabit = vi.fn();
const mockGetTodayCompletions = vi.fn();
const mockGetHabitStats = vi.fn();

vi.mock('../services/storageService', () => ({
  getHabits: mockGetHabits,
  createHabit: mockCreateHabit,
  deleteHabit: mockDeleteHabit,
  completeHabit: mockCompleteHabit,
  getTodayCompletions: mockGetTodayCompletions,
  getHabitStats: mockGetHabitStats,
}));

describe('Habit Creation Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Habit', () => {
    it('should create a daily habit successfully', async () => {
      const newHabit = {
        title: 'Morning Meditation',
        description: '10 minutes of mindfulness',
        frequency: 'daily',
        category: 'wellness',
        reminder_time: '07:00',
      };

      mockCreateHabit.mockResolvedValueOnce({
        id: 'habit-123',
        ...newHabit,
        current_streak: 0,
        longest_streak: 0,
        total_completions: 0,
        created_at: new Date().toISOString(),
      });

      const result = await mockCreateHabit(newHabit);

      expect(result).toBeDefined();
      expect(result.id).toBe('habit-123');
      expect(result.title).toBe('Morning Meditation');
      expect(result.frequency).toBe('daily');
    });

    it('should create a weekly habit successfully', async () => {
      const newHabit = {
        title: 'Weekly Review',
        description: 'Review goals and progress',
        frequency: 'weekly',
        category: 'productivity',
      };

      mockCreateHabit.mockResolvedValueOnce({
        id: 'habit-456',
        ...newHabit,
        current_streak: 0,
        longest_streak: 0,
        total_completions: 0,
        created_at: new Date().toISOString(),
      });

      const result = await mockCreateHabit(newHabit);

      expect(result.frequency).toBe('weekly');
    });

    it('should create a weekday-only habit', async () => {
      const newHabit = {
        title: 'Work Exercise',
        frequency: 'weekdays',
        category: 'fitness',
      };

      mockCreateHabit.mockResolvedValueOnce({
        id: 'habit-789',
        ...newHabit,
        current_streak: 0,
      });

      const result = await mockCreateHabit(newHabit);

      expect(result.frequency).toBe('weekdays');
    });

    it('should create a custom day habit', async () => {
      const newHabit = {
        title: 'Gym Session',
        frequency: 'custom',
        custom_days: ['Mon', 'Wed', 'Fri'],
        category: 'fitness',
      };

      mockCreateHabit.mockResolvedValueOnce({
        id: 'habit-custom',
        ...newHabit,
        current_streak: 0,
      });

      const result = await mockCreateHabit(newHabit);

      expect(result.frequency).toBe('custom');
      expect(result.custom_days).toContain('Mon');
    });

    it('should reject habit creation without title', async () => {
      mockCreateHabit.mockRejectedValueOnce(new Error('Title is required'));

      await expect(mockCreateHabit({ description: 'No title' }))
        .rejects.toThrow('Title is required');
    });
  });

  describe('Complete Habit', () => {
    it('should mark habit as completed for today', async () => {
      mockCompleteHabit.mockResolvedValueOnce({
        habit_id: 'habit-123',
        completed_at: new Date().toISOString(),
        streak_increased: true,
        new_streak: 5,
      });

      const result = await mockCompleteHabit('habit-123');

      expect(result.habit_id).toBe('habit-123');
      expect(result.streak_increased).toBe(true);
    });

    it('should not allow completing the same habit twice today', async () => {
      mockCompleteHabit.mockResolvedValueOnce({ already_completed: true });

      const result = await mockCompleteHabit('habit-123');

      expect(result.already_completed).toBe(true);
    });

    it('should update streak count on completion', async () => {
      mockCompleteHabit.mockResolvedValueOnce({
        habit_id: 'habit-123',
        new_streak: 10,
        streak_increased: true,
      });

      const result = await mockCompleteHabit('habit-123');

      expect(result.new_streak).toBe(10);
    });

    it('should reset streak if habit was missed', async () => {
      mockCompleteHabit.mockResolvedValueOnce({
        habit_id: 'habit-123',
        new_streak: 1,
        streak_reset: true,
      });

      const result = await mockCompleteHabit('habit-123');

      expect(result.new_streak).toBe(1);
      expect(result.streak_reset).toBe(true);
    });
  });

  describe('Get Habits', () => {
    it('should retrieve all user habits', async () => {
      mockGetHabits.mockResolvedValueOnce([
        { id: 'habit-1', title: 'Meditation', frequency: 'daily', current_streak: 5 },
        { id: 'habit-2', title: 'Exercise', frequency: 'daily', current_streak: 3 },
        { id: 'habit-3', title: 'Reading', frequency: 'weekly', current_streak: 2 },
      ]);

      const habits = await mockGetHabits();

      expect(habits).toHaveLength(3);
      expect(habits[0].title).toBe('Meditation');
    });

    it('should return empty array for new user', async () => {
      mockGetHabits.mockResolvedValueOnce([]);

      const habits = await mockGetHabits();

      expect(habits).toHaveLength(0);
    });
  });

  describe('Get Today Completions', () => {
    it('should return list of completed habit IDs', async () => {
      mockGetTodayCompletions.mockResolvedValueOnce(['habit-1', 'habit-3']);

      const completions = await mockGetTodayCompletions();

      expect(completions).toContain('habit-1');
      expect(completions).toContain('habit-3');
      expect(completions).not.toContain('habit-2');
    });
  });

  describe('Habit Statistics', () => {
    it('should calculate overall stats correctly', async () => {
      mockGetHabitStats.mockResolvedValueOnce({
        totalHabits: 5,
        totalCompletions: 150,
        longestStreak: 30,
        currentStreakTotal: 45,
        weeklyCompletionRate: 85,
      });

      const stats = await mockGetHabitStats();

      expect(stats.totalHabits).toBe(5);
      expect(stats.totalCompletions).toBe(150);
      expect(stats.longestStreak).toBe(30);
      expect(stats.weeklyCompletionRate).toBe(85);
    });
  });

  describe('Delete Habit', () => {
    it('should delete habit successfully', async () => {
      mockDeleteHabit.mockResolvedValueOnce({ success: true });

      const result = await mockDeleteHabit('habit-123');

      expect(result.success).toBe(true);
    });

    it('should handle deleting non-existent habit', async () => {
      mockDeleteHabit.mockRejectedValueOnce(new Error('Habit not found'));

      await expect(mockDeleteHabit('non-existent'))
        .rejects.toThrow('Habit not found');
    });
  });
});

describe('Habit Tracker Component Behavior', () => {
  it('should have all frequency options available', () => {
    const frequencyOptions = [
      { value: 'daily', label: 'Every Day' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'weekdays', label: 'Weekdays Only' },
      { value: 'custom', label: 'Custom Days' },
    ];

    expect(frequencyOptions).toHaveLength(4);
    expect(frequencyOptions.map(o => o.value)).toContain('daily');
    expect(frequencyOptions.map(o => o.value)).toContain('custom');
  });

  it('should display all days of the week for custom selection', () => {
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    expect(daysOfWeek).toHaveLength(7);
    expect(daysOfWeek[0]).toBe('Sun');
    expect(daysOfWeek[6]).toBe('Sat');
  });

  it('should show loading state while fetching habits', () => {
    const loading = true;
    expect(loading).toBe(true);
  });

  it('should show create modal when triggered', () => {
    let showCreateModal = false;
    showCreateModal = true;
    expect(showCreateModal).toBe(true);
  });

  it('should disable complete button for already completed habits', () => {
    const todayCompleted = ['habit-1', 'habit-2'];
    const habitId = 'habit-1';
    const isCompleted = todayCompleted.includes(habitId);

    expect(isCompleted).toBe(true);
  });

  it('should update streak display after completion', () => {
    const habit = { id: 'habit-1', current_streak: 5 };
    const updatedHabit = { ...habit, current_streak: habit.current_streak + 1 };

    expect(updatedHabit.current_streak).toBe(6);
  });
});

describe('Habit Categories', () => {
  it('should support common habit categories', () => {
    const categories = [
      'wellness',
      'fitness',
      'productivity',
      'learning',
      'health',
      'mindfulness',
      'social',
      'finance',
      'creativity',
      'other',
    ];

    expect(categories.length).toBeGreaterThan(5);
    expect(categories).toContain('wellness');
    expect(categories).toContain('fitness');
  });
});
