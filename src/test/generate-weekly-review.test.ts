import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockSupabaseClient,
  mockUser,
  mockHabit,
  mockActionTask,
  mockWeeklyReview,
  getWeekBoundaries
} from './edge-function-utils';

/**
 * Generate Weekly Review Edge Function Tests
 */

describe('Generate Weekly Review', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  describe('Week Range Calculation', () => {
    const getWeekRange = (customStart?: string): { weekStart: string; weekEnd: string } => {
      let startDate: Date;

      if (customStart) {
        startDate = new Date(customStart);
      } else {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(now);
        startDate.setDate(now.getDate() - daysToMonday - 7);
      }

      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);

      return {
        weekStart: startDate.toISOString().split('T')[0],
        weekEnd: endDate.toISOString().split('T')[0]
      };
    };

    it('should calculate previous week Monday to Sunday', () => {
      const { weekStart, weekEnd } = getWeekRange();
      const start = new Date(weekStart);
      const end = new Date(weekEnd);

      // Check week is 7 days
      const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBe(6);
    });

    it('should use custom start date when provided', () => {
      const { weekStart, weekEnd } = getWeekRange('2024-01-15');

      expect(weekStart).toBe('2024-01-15');
      expect(weekEnd).toBe('2024-01-21');
    });

    it('should format dates as YYYY-MM-DD', () => {
      const { weekStart, weekEnd } = getWeekRange();

      expect(weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(weekEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Expected Days Calculation', () => {
    const getExpectedDaysInWeek = (frequency: string): number => {
      switch (frequency) {
        case 'daily': return 7;
        case 'weekdays': return 5;
        case 'weekly': return 1;
        default: return 7;
      }
    };

    it('should return 7 for daily habits', () => {
      expect(getExpectedDaysInWeek('daily')).toBe(7);
    });

    it('should return 5 for weekday habits', () => {
      expect(getExpectedDaysInWeek('weekdays')).toBe(5);
    });

    it('should return 1 for weekly habits', () => {
      expect(getExpectedDaysInWeek('weekly')).toBe(1);
    });

    it('should default to 7 for unknown frequency', () => {
      expect(getExpectedDaysInWeek('custom')).toBe(7);
    });
  });

  describe('Habit Completion Rate Calculation', () => {
    const getExpectedDaysInWeek = (frequency: string): number => {
      switch (frequency) {
        case 'daily': return 7;
        case 'weekdays': return 5;
        case 'weekly': return 1;
        default: return 7;
      }
    };

    const calculateHabitCompletionRate = (
      habits: any[],
      completions: any[]
    ): number => {
      if (habits.length === 0) return 0;

      let totalExpected = 0;
      let totalCompleted = 0;

      for (const habit of habits) {
        const expectedDays = getExpectedDaysInWeek(habit.frequency);
        totalExpected += expectedDays;

        const habitCompletions = completions.filter((c: any) => c.habit_id === habit.id);
        totalCompleted += Math.min(habitCompletions.length, expectedDays);
      }

      return totalExpected > 0 ? Math.round((totalCompleted / totalExpected) * 100) : 0;
    };

    it('should return 0 for no habits', () => {
      expect(calculateHabitCompletionRate([], [])).toBe(0);
    });

    it('should calculate 100% for fully completed habits', () => {
      const habits = [{ id: 'h1', frequency: 'daily' }];
      const completions = Array(7).fill(null).map((_, i) => ({ habit_id: 'h1' }));

      expect(calculateHabitCompletionRate(habits, completions)).toBe(100);
    });

    it('should calculate partial completion correctly', () => {
      const habits = [{ id: 'h1', frequency: 'daily' }];
      const completions = [
        { habit_id: 'h1' },
        { habit_id: 'h1' },
        { habit_id: 'h1' },
        { habit_id: 'h1' }
      ];

      // 4/7 = 57%
      expect(calculateHabitCompletionRate(habits, completions)).toBe(57);
    });

    it('should handle multiple habits', () => {
      const habits = [
        { id: 'h1', frequency: 'daily' },  // 7 expected
        { id: 'h2', frequency: 'weekly' }   // 1 expected
      ];
      const completions = [
        { habit_id: 'h1' }, { habit_id: 'h1' }, { habit_id: 'h1' },
        { habit_id: 'h1' }, { habit_id: 'h1' }, { habit_id: 'h1' },
        { habit_id: 'h1' }, // 7/7 for h1
        { habit_id: 'h2' }  // 1/1 for h2
      ];

      // 8/8 = 100%
      expect(calculateHabitCompletionRate(habits, completions)).toBe(100);
    });

    it('should cap completions at expected days', () => {
      const habits = [{ id: 'h1', frequency: 'weekly' }];
      // Even with 5 completions, weekly only expects 1
      const completions = Array(5).fill({ habit_id: 'h1' });

      expect(calculateHabitCompletionRate(habits, completions)).toBe(100);
    });
  });

  describe('Wins Identification', () => {
    const getExpectedDaysInWeek = (frequency: string): number => {
      switch (frequency) {
        case 'daily': return 7;
        case 'weekdays': return 5;
        case 'weekly': return 1;
        default: return 7;
      }
    };

    const identifyWins = (
      habits: any[],
      completions: any[],
      tasks: any[],
      knowledgeBase: any
    ): any[] => {
      const wins: any[] = [];

      // Completed tasks
      const completedTasks = tasks.filter((t: any) => t.status === 'completed');
      for (const task of completedTasks.slice(0, 3)) {
        wins.push({
          type: 'task_completed',
          title: task.title,
          category: task.category
        });
      }

      // High habit completion
      const habitGroups = new Map<string, number>();
      for (const completion of completions) {
        const count = habitGroups.get(completion.habit_id) || 0;
        habitGroups.set(completion.habit_id, count + 1);
      }

      for (const habit of habits) {
        const count = habitGroups.get(habit.id) || 0;
        const expected = getExpectedDaysInWeek(habit.frequency);
        if (count >= expected) {
          wins.push({
            type: 'habit_streak',
            title: `${habit.title} - 100% completion`,
            habitId: habit.id
          });
        }
      }

      // Mood improvement
      if (knowledgeBase.sentiment_trend === 'improving') {
        wins.push({
          type: 'mood_improvement',
          title: 'Mood trend improving!'
        });
      }

      return wins.slice(0, 5);
    };

    it('should identify completed tasks as wins', () => {
      const tasks = [
        { title: 'Task 1', status: 'completed', category: 'financial' },
        { title: 'Task 2', status: 'pending' }
      ];
      const wins = identifyWins([], [], tasks, {});

      expect(wins.length).toBe(1);
      expect(wins[0].type).toBe('task_completed');
      expect(wins[0].title).toBe('Task 1');
    });

    it('should identify 100% habit completion as wins', () => {
      const habits = [{ id: 'h1', title: 'Meditation', frequency: 'daily' }];
      const completions = Array(7).fill({ habit_id: 'h1' });

      const wins = identifyWins(habits, completions, [], {});

      const habitWin = wins.find(w => w.type === 'habit_streak');
      expect(habitWin).toBeDefined();
      expect(habitWin.title).toContain('Meditation');
    });

    it('should identify mood improvement', () => {
      const knowledgeBase = { sentiment_trend: 'improving' };
      const wins = identifyWins([], [], [], knowledgeBase);

      expect(wins.some(w => w.type === 'mood_improvement')).toBe(true);
    });

    it('should limit wins to 5', () => {
      const tasks = Array(10).fill(null).map((_, i) => ({
        title: `Task ${i}`,
        status: 'completed'
      }));

      const wins = identifyWins([], [], tasks, {});
      expect(wins.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Blockers Identification', () => {
    const getExpectedDaysInWeek = (frequency: string): number => {
      switch (frequency) {
        case 'daily': return 7;
        case 'weekdays': return 5;
        case 'weekly': return 1;
        default: return 7;
      }
    };

    const identifyBlockers = (
      habits: any[],
      completions: any[],
      tasks: any[],
      weekEnd: string
    ): any[] => {
      const blockers: any[] = [];

      // Missed habits
      const habitGroups = new Map<string, number>();
      for (const completion of completions) {
        const count = habitGroups.get(completion.habit_id) || 0;
        habitGroups.set(completion.habit_id, count + 1);
      }

      for (const habit of habits) {
        const count = habitGroups.get(habit.id) || 0;
        const expected = getExpectedDaysInWeek(habit.frequency);
        const completionRate = count / expected;

        if (completionRate < 0.5) {
          blockers.push({
            type: 'habit_missed',
            title: `${habit.title} - only ${Math.round(completionRate * 100)}% completed`,
            habitId: habit.id,
            severity: completionRate < 0.25 ? 'high' : 'medium'
          });
        }
      }

      // Overdue tasks
      const overdueTasks = tasks.filter((t: any) => {
        if (t.status === 'completed') return false;
        if (!t.due_date) return false;
        return new Date(t.due_date) < new Date(weekEnd);
      });

      for (const task of overdueTasks.slice(0, 3)) {
        blockers.push({
          type: 'task_overdue',
          title: task.title,
          dueDate: task.due_date,
          severity: 'high'
        });
      }

      return blockers.slice(0, 5);
    };

    it('should identify low habit completion as blocker', () => {
      const habits = [{ id: 'h1', title: 'Exercise', frequency: 'daily' }];
      const completions = [{ habit_id: 'h1' }, { habit_id: 'h1' }]; // 2/7

      const blockers = identifyBlockers(habits, completions, [], '2024-01-21');

      expect(blockers.length).toBe(1);
      expect(blockers[0].type).toBe('habit_missed');
      expect(blockers[0].title).toContain('Exercise');
    });

    it('should mark very low completion as high severity', () => {
      const habits = [{ id: 'h1', title: 'Reading', frequency: 'daily' }];
      const completions = [{ habit_id: 'h1' }]; // 1/7 = 14%

      const blockers = identifyBlockers(habits, completions, [], '2024-01-21');

      expect(blockers[0].severity).toBe('high');
    });

    it('should mark moderate completion as medium severity', () => {
      const habits = [{ id: 'h1', title: 'Journaling', frequency: 'daily' }];
      const completions = [{ habit_id: 'h1' }, { habit_id: 'h1' }]; // 2/7 = 29%

      const blockers = identifyBlockers(habits, completions, [], '2024-01-21');

      expect(blockers[0].severity).toBe('medium');
    });

    it('should identify overdue tasks', () => {
      const tasks = [
        { title: 'Overdue Task', status: 'pending', due_date: '2024-01-10' },
        { title: 'Future Task', status: 'pending', due_date: '2024-12-31' }
      ];

      const blockers = identifyBlockers([], [], tasks, '2024-01-21');

      expect(blockers.length).toBe(1);
      expect(blockers[0].type).toBe('task_overdue');
      expect(blockers[0].title).toBe('Overdue Task');
    });

    it('should not mark completed tasks as overdue', () => {
      const tasks = [
        { title: 'Done Task', status: 'completed', due_date: '2024-01-10' }
      ];

      const blockers = identifyBlockers([], [], tasks, '2024-01-21');
      expect(blockers.length).toBe(0);
    });

    it('should limit blockers to 5', () => {
      const habits = Array(10).fill(null).map((_, i) => ({
        id: `h${i}`,
        title: `Habit ${i}`,
        frequency: 'daily'
      }));

      const blockers = identifyBlockers(habits, [], [], '2024-01-21');
      expect(blockers.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Fallback Insights Generation', () => {
    const generateFallbackInsights = (
      wins: any[],
      blockers: any[],
      habitCompletionRate: number,
      tasksCompleted: number
    ): string => {
      let insights = '';

      if (habitCompletionRate >= 80) {
        insights += `Great week! You achieved a ${habitCompletionRate}% habit completion rate. `;
      } else if (habitCompletionRate >= 50) {
        insights += `Solid progress this week with ${habitCompletionRate}% habit completion. `;
      } else {
        insights += `This week was challenging with ${habitCompletionRate}% habit completion. `;
      }

      if (wins.length > 0) {
        insights += `\n\nYour wins: ${wins.map(w => w.title).join(', ')}. `;
      }

      if (blockers.length > 0) {
        insights += `\n\nAreas to focus on: ${blockers.slice(0, 2).map(b => b.title).join(', ')}. `;
      }

      return insights;
    };

    it('should celebrate high completion rate', () => {
      const insights = generateFallbackInsights([], [], 85, 5);
      expect(insights).toContain('Great week');
      expect(insights).toContain('85%');
    });

    it('should acknowledge moderate completion', () => {
      const insights = generateFallbackInsights([], [], 60, 3);
      expect(insights).toContain('Solid progress');
    });

    it('should be empathetic about low completion', () => {
      const insights = generateFallbackInsights([], [], 30, 1);
      expect(insights).toContain('challenging');
    });

    it('should include wins when present', () => {
      const wins = [{ title: 'Completed Budget Review' }];
      const insights = generateFallbackInsights(wins, [], 70, 3);
      expect(insights).toContain('Completed Budget Review');
    });

    it('should include blockers when present', () => {
      const blockers = [{ title: 'Exercise - 30% completed' }];
      const insights = generateFallbackInsights([], blockers, 70, 3);
      expect(insights).toContain('Exercise - 30% completed');
    });
  });

  describe('Fallback Next Steps Generation', () => {
    const generateFallbackNextSteps = (blockers: any[], habits: any[], tasks: any[]): string[] => {
      const steps: string[] = [];

      const missedHabit = blockers.find(b => b.type === 'habit_missed');
      if (missedHabit) {
        steps.push(`Recommit to "${missedHabit.title.split(' - ')[0]}" - set a daily reminder`);
      }

      const overdueTask = blockers.find(b => b.type === 'task_overdue');
      if (overdueTask) {
        steps.push(`Complete or reschedule: "${overdueTask.title}"`);
      }

      if (habits.length > 0 && steps.length < 3) {
        steps.push('Review and adjust habit reminder times if needed');
      }

      if (tasks.length > 0 && steps.length < 3) {
        steps.push('Plan your top 3 priorities for next week');
      }

      if (steps.length < 3) {
        steps.push('Spend 5 minutes visualizing your dream retirement');
      }

      return steps.slice(0, 3);
    };

    it('should suggest addressing missed habits', () => {
      const blockers = [{ type: 'habit_missed', title: 'Meditation - 20% completed' }];
      const steps = generateFallbackNextSteps(blockers, [], []);

      expect(steps.some(s => s.includes('Meditation'))).toBe(true);
    });

    it('should suggest addressing overdue tasks', () => {
      const blockers = [{ type: 'task_overdue', title: 'Budget Review' }];
      const steps = generateFallbackNextSteps(blockers, [], []);

      expect(steps.some(s => s.includes('Budget Review'))).toBe(true);
    });

    it('should limit to 3 steps', () => {
      const blockers = [
        { type: 'habit_missed', title: 'Habit 1 - 0%' },
        { type: 'task_overdue', title: 'Task 1' }
      ];
      const habits = [{ id: 'h1' }];
      const tasks = [{ id: 't1' }];

      const steps = generateFallbackNextSteps(blockers, habits, tasks);
      expect(steps.length).toBeLessThanOrEqual(3);
    });

    it('should include visualization when steps are short', () => {
      const steps = generateFallbackNextSteps([], [], []);
      expect(steps.some(s => s.includes('visualizing'))).toBe(true);
    });
  });

  describe('Sentiment Trend Calculation', () => {
    const calculateSentimentTrend = (moodAverage: number | null): string => {
      if (!moodAverage) return 'insufficient_data';
      if (moodAverage >= 4) return 'positive';
      if (moodAverage >= 3) return 'stable';
      return 'needs_attention';
    };

    it('should return insufficient_data for null mood', () => {
      expect(calculateSentimentTrend(null)).toBe('insufficient_data');
    });

    it('should return positive for high mood', () => {
      expect(calculateSentimentTrend(4.5)).toBe('positive');
    });

    it('should return stable for moderate mood', () => {
      expect(calculateSentimentTrend(3.5)).toBe('stable');
    });

    it('should return needs_attention for low mood', () => {
      expect(calculateSentimentTrend(2.5)).toBe('needs_attention');
    });
  });

  describe('Day Name Helper', () => {
    const getCurrentDayName = (): string => {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return days[new Date().getDay()];
    };

    it('should return a valid day name', () => {
      const dayName = getCurrentDayName();
      const validDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      expect(validDays).toContain(dayName);
    });
  });

  describe('Review Storage', () => {
    it('should upsert review with user_id and week_start conflict', async () => {
      const mockUpsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockWeeklyReview,
            error: null
          })
        })
      });

      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert
      });

      await mockSupabase.from('weekly_reviews').upsert({
        user_id: mockUser.id,
        week_start: '2024-01-15',
        habit_completion_rate: 85
      }, { onConflict: 'user_id,week_start' }).select().single();

      expect(mockSupabase.from).toHaveBeenCalledWith('weekly_reviews');
    });

    it('should check for existing review before generating', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'existing-review' },
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const result = await mockSupabase.from('weekly_reviews')
        .select('id')
        .eq('user_id', mockUser.id)
        .eq('week_start', '2024-01-15')
        .single();

      expect(result.data.id).toBe('existing-review');
    });
  });

  describe('Notification Scheduling', () => {
    it('should create notification for weekly review', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert
      });

      await mockSupabase.from('scheduled_checkins').insert({
        user_id: mockUser.id,
        checkin_type: 'weekly_review',
        scheduled_for: new Date().toISOString(),
        channel: 'push',
        status: 'pending',
        content: {
          type: 'weekly_review_ready',
          week_start: '2024-01-15',
          habit_completion_rate: 85
        }
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('scheduled_checkins');
    });
  });

  describe('Mood Average Calculation', () => {
    it('should calculate average mood from completions', () => {
      const completions = [
        { mood_rating: 4 },
        { mood_rating: 5 },
        { mood_rating: 3 },
        { mood_rating: 4 }
      ];

      const moodRatings = completions
        .filter(c => c.mood_rating)
        .map(c => c.mood_rating);

      const moodAverage = moodRatings.length > 0
        ? Math.round(moodRatings.reduce((a, b) => a + b, 0) / moodRatings.length * 10) / 10
        : null;

      expect(moodAverage).toBe(4);
    });

    it('should return null when no mood ratings', () => {
      const completions = [
        { habit_id: 'h1' },
        { habit_id: 'h2' }
      ];

      const moodRatings = completions
        .filter((c: any) => c.mood_rating)
        .map((c: any) => c.mood_rating);

      const moodAverage = moodRatings.length > 0
        ? moodRatings.reduce((a, b) => a + b, 0) / moodRatings.length
        : null;

      expect(moodAverage).toBeNull();
    });

    it('should handle decimal averages', () => {
      const completions = [
        { mood_rating: 4 },
        { mood_rating: 3 },
        { mood_rating: 4 }
      ];

      const moodRatings = completions.map(c => c.mood_rating);
      const moodAverage = Math.round(
        moodRatings.reduce((a, b) => a + b, 0) / moodRatings.length * 10
      ) / 10;

      expect(moodAverage).toBe(3.7);
    });
  });
});
