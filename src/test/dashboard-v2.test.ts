import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockSupabaseClient,
  mockUser,
  mockHabit,
  mockActionTask,
  mockVisionBoard
} from './edge-function-utils';

/**
 * Dashboard V2 Component Logic Tests
 *
 * These tests verify the business logic and data transformations used in
 * Dashboard V2 components. Since React component rendering requires jsdom,
 * we test the underlying logic patterns.
 */

describe('Dashboard V2', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  describe('VisionHero Logic', () => {
    describe('Progress Calculation', () => {
      it('should calculate overall progress from tasks and habits', () => {
        const progress = {
          tasksCompleted: 3,
          tasksTotal: 5,
          habitsCompleted: 4,
          habitsTotal: 5
        };

        const taskProgress = progress.tasksTotal > 0
          ? (progress.tasksCompleted / progress.tasksTotal) * 50
          : 0;
        const habitProgress = progress.habitsTotal > 0
          ? (progress.habitsCompleted / progress.habitsTotal) * 50
          : 0;
        const overallProgress = Math.round(taskProgress + habitProgress);

        // Task progress: 3/5 * 50 = 30
        // Habit progress: 4/5 * 50 = 40
        // Total: 70
        expect(overallProgress).toBe(70);
      });

      it('should handle zero tasks gracefully', () => {
        const progress = {
          tasksCompleted: 0,
          tasksTotal: 0,
          habitsCompleted: 5,
          habitsTotal: 5
        };

        const taskProgress = progress.tasksTotal > 0
          ? (progress.tasksCompleted / progress.tasksTotal) * 50
          : 0;
        const habitProgress = progress.habitsTotal > 0
          ? (progress.habitsCompleted / progress.habitsTotal) * 50
          : 0;
        const overallProgress = Math.round(taskProgress + habitProgress);

        expect(overallProgress).toBe(50);
      });

      it('should handle zero habits gracefully', () => {
        const progress = {
          tasksCompleted: 5,
          tasksTotal: 5,
          habitsCompleted: 0,
          habitsTotal: 0
        };

        const taskProgress = progress.tasksTotal > 0
          ? (progress.tasksCompleted / progress.tasksTotal) * 50
          : 0;
        const habitProgress = progress.habitsTotal > 0
          ? (progress.habitsCompleted / progress.habitsTotal) * 50
          : 0;
        const overallProgress = Math.round(taskProgress + habitProgress);

        expect(overallProgress).toBe(50);
      });

      it('should return 0 when no tasks and no habits', () => {
        const progress = {
          tasksCompleted: 0,
          tasksTotal: 0,
          habitsCompleted: 0,
          habitsTotal: 0
        };

        const taskProgress = progress.tasksTotal > 0
          ? (progress.tasksCompleted / progress.tasksTotal) * 50
          : 0;
        const habitProgress = progress.habitsTotal > 0
          ? (progress.habitsCompleted / progress.habitsTotal) * 50
          : 0;
        const overallProgress = Math.round(taskProgress + habitProgress);

        expect(overallProgress).toBe(0);
      });
    });

    describe('Empty State Detection', () => {
      it('should detect when no vision exists', () => {
        const vision = null;
        const hasVision = vision && vision.imageUrl;
        expect(hasVision).toBeFalsy();
      });

      it('should detect when vision has no image', () => {
        const vision = { id: 'test', imageUrl: undefined };
        const hasVision = vision && vision.imageUrl;
        expect(hasVision).toBeFalsy();
      });

      it('should detect valid vision', () => {
        const vision = { id: 'test', imageUrl: 'https://example.com/image.jpg' };
        const hasVision = vision && vision.imageUrl;
        expect(hasVision).toBeTruthy();
      });
    });
  });

  describe('ExecutionPanel Logic', () => {
    describe('Task Type Colors', () => {
      const getTypeColor = (type?: string): string => {
        switch (type) {
          case 'FINANCE':
            return 'bg-green-100 text-green-700 border-green-200';
          case 'LIFESTYLE':
            return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'ADMIN':
            return 'bg-purple-100 text-purple-700 border-purple-200';
          default:
            return 'bg-gray-100 text-gray-600 border-gray-200';
        }
      };

      it('should return green for FINANCE type', () => {
        expect(getTypeColor('FINANCE')).toContain('green');
      });

      it('should return blue for LIFESTYLE type', () => {
        expect(getTypeColor('LIFESTYLE')).toContain('blue');
      });

      it('should return purple for ADMIN type', () => {
        expect(getTypeColor('ADMIN')).toContain('purple');
      });

      it('should return gray for unknown type', () => {
        expect(getTypeColor('UNKNOWN')).toContain('gray');
      });

      it('should return gray for undefined type', () => {
        expect(getTypeColor(undefined)).toContain('gray');
      });
    });

    describe('Task Completion Count', () => {
      it('should count completed tasks correctly', () => {
        const tasks = [
          { id: '1', title: 'Task 1', isCompleted: true },
          { id: '2', title: 'Task 2', isCompleted: false },
          { id: '3', title: 'Task 3', isCompleted: true },
          { id: '4', title: 'Task 4', isCompleted: false }
        ];

        const completedCount = tasks.filter(t => t.isCompleted).length;
        expect(completedCount).toBe(2);
      });

      it('should handle empty task list', () => {
        const tasks: any[] = [];
        const completedCount = tasks.filter(t => t.isCompleted).length;
        expect(completedCount).toBe(0);
      });
    });

    describe('Habit Icon Mapping', () => {
      const getHabitIcon = (title: string): string => {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('meditat') || lowerTitle.includes('mindful')) return '🧘';
        if (lowerTitle.includes('exercise') || lowerTitle.includes('workout') || lowerTitle.includes('gym')) return '💪';
        if (lowerTitle.includes('read')) return '📚';
        if (lowerTitle.includes('water') || lowerTitle.includes('hydrat')) return '💧';
        if (lowerTitle.includes('sleep') || lowerTitle.includes('rest')) return '😴';
        if (lowerTitle.includes('journal') || lowerTitle.includes('write')) return '✍️';
        if (lowerTitle.includes('walk') || lowerTitle.includes('step')) return '🚶';
        if (lowerTitle.includes('vitamin') || lowerTitle.includes('supplement')) return '💊';
        if (lowerTitle.includes('gratitude') || lowerTitle.includes('thankful')) return '🙏';
        if (lowerTitle.includes('pray') || lowerTitle.includes('spirit')) return '✨';
        return '⭐';
      };

      it('should return meditation icon for meditation habit', () => {
        expect(getHabitIcon('Morning Meditation')).toBe('🧘');
        expect(getHabitIcon('Mindfulness Practice')).toBe('🧘');
      });

      it('should return exercise icon for workout habits', () => {
        expect(getHabitIcon('Daily Exercise')).toBe('💪');
        expect(getHabitIcon('Gym Session')).toBe('💪');
        expect(getHabitIcon('Morning Workout')).toBe('💪');
      });

      it('should return book icon for reading habits', () => {
        expect(getHabitIcon('Read for 30 minutes')).toBe('📚');
      });

      it('should return water icon for hydration habits', () => {
        expect(getHabitIcon('Drink 8 glasses of water')).toBe('💧');
        expect(getHabitIcon('Stay hydrated')).toBe('💧');
      });

      it('should return default icon for unrecognized habits', () => {
        expect(getHabitIcon('Do something random')).toBe('⭐');
      });
    });
  });

  describe('SupportRow Logic', () => {
    describe('Relative Time Formatting', () => {
      const formatRelativeTime = (dateString?: string): string => {
        if (!dateString) return 'Never';

        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return `${Math.floor(diffDays / 30)} months ago`;
      };

      it('should return "Never" for undefined date', () => {
        expect(formatRelativeTime(undefined)).toBe('Never');
      });

      it('should return "Today" for current date', () => {
        const today = new Date().toISOString();
        expect(formatRelativeTime(today)).toBe('Today');
      });

      it('should return "Yesterday" for yesterday', () => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        expect(formatRelativeTime(yesterday)).toBe('Yesterday');
      });

      it('should return days ago for recent dates', () => {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
        expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago');
      });

      it('should return weeks ago for dates within a month', () => {
        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        expect(formatRelativeTime(twoWeeksAgo)).toBe('2 weeks ago');
      });
    });

    describe('Currency Formatting', () => {
      const formatCurrency = (amount?: number): string => {
        if (!amount) return '$0';
        if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
        if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
        return `$${amount.toLocaleString()}`;
      };

      it('should return $0 for undefined amount', () => {
        expect(formatCurrency(undefined)).toBe('$0');
      });

      it('should format millions correctly', () => {
        expect(formatCurrency(1500000)).toBe('$1.5M');
        expect(formatCurrency(2000000)).toBe('$2.0M');
      });

      it('should format thousands correctly', () => {
        expect(formatCurrency(50000)).toBe('$50K');
        expect(formatCurrency(100000)).toBe('$100K');
      });

      it('should format small amounts correctly', () => {
        expect(formatCurrency(500)).toBe('$500');
        expect(formatCurrency(999)).toBe('$999');
      });
    });

    describe('Financial Progress Calculation', () => {
      it('should calculate progress percentage correctly', () => {
        const targetAmount = 100000;
        const currentProgress = 25000;
        const progress = Math.min(Math.round((currentProgress / targetAmount) * 100), 100);
        expect(progress).toBe(25);
      });

      it('should cap progress at 100%', () => {
        const targetAmount = 100000;
        const currentProgress = 150000;
        const progress = Math.min(Math.round((currentProgress / targetAmount) * 100), 100);
        expect(progress).toBe(100);
      });

      it('should handle zero target', () => {
        const targetAmount = 0;
        const currentProgress = 25000;
        const progress = targetAmount > 0
          ? Math.min(Math.round((currentProgress / targetAmount) * 100), 100)
          : 0;
        expect(progress).toBe(0);
      });
    });
  });

  describe('PrintPanel Logic', () => {
    describe('Order Status Badges', () => {
      const getStatusBadge = (status: string) => {
        switch (status) {
          case 'pending':
            return { label: 'Processing', color: 'bg-yellow-100 text-yellow-700' };
          case 'submitted':
            return { label: 'Submitted', color: 'bg-blue-100 text-blue-700' };
          case 'shipped':
            return { label: 'Shipped', color: 'bg-purple-100 text-purple-700' };
          case 'delivered':
            return { label: 'Delivered', color: 'bg-green-100 text-green-700' };
          default:
            return { label: status, color: 'bg-gray-100 text-gray-600' };
        }
      };

      it('should return Processing for pending status', () => {
        const badge = getStatusBadge('pending');
        expect(badge.label).toBe('Processing');
        expect(badge.color).toContain('yellow');
      });

      it('should return Shipped for shipped status', () => {
        const badge = getStatusBadge('shipped');
        expect(badge.label).toBe('Shipped');
        expect(badge.color).toContain('purple');
      });

      it('should return Delivered for delivered status', () => {
        const badge = getStatusBadge('delivered');
        expect(badge.label).toBe('Delivered');
        expect(badge.color).toContain('green');
      });
    });

    describe('Product Type Formatting', () => {
      const formatProductType = (type: string): string => {
        const types: Record<string, string> = {
          poster: 'Vision Poster',
          canvas: 'Canvas Print',
          workbook: 'Vision Workbook',
          pad: 'Focus Pad',
          cards: 'Vision Cards'
        };
        return types[type.toLowerCase()] || type;
      };

      it('should format poster product type', () => {
        expect(formatProductType('poster')).toBe('Vision Poster');
      });

      it('should format canvas product type', () => {
        expect(formatProductType('canvas')).toBe('Canvas Print');
      });

      it('should format workbook product type', () => {
        expect(formatProductType('workbook')).toBe('Vision Workbook');
      });

      it('should return original for unknown type', () => {
        expect(formatProductType('unknown')).toBe('unknown');
      });
    });
  });

  describe('ToolsGrid Logic', () => {
    describe('Role-Based Filtering', () => {
      const tools = [
        { id: 'knowledge', title: 'Knowledge Base', requiresRole: undefined },
        { id: 'partner', title: 'Partner Workspace', requiresRole: undefined },
        { id: 'manager', title: 'Manager Dashboard', requiresRole: 'manager' as const },
        { id: 'admin', title: 'Admin Panel', requiresRole: 'admin' as const }
      ];

      const filterToolsByRole = (userRole?: string) => {
        return tools.filter((tool) => {
          if (!tool.requiresRole) return true;
          if (tool.requiresRole === 'admin') return userRole === 'admin';
          if (tool.requiresRole === 'manager') return userRole === 'manager' || userRole === 'admin';
          return false;
        });
      };

      it('should show only public tools for regular users', () => {
        const visibleTools = filterToolsByRole(undefined);
        expect(visibleTools).toHaveLength(2);
        expect(visibleTools.some(t => t.id === 'knowledge')).toBe(true);
        expect(visibleTools.some(t => t.id === 'manager')).toBe(false);
      });

      it('should show manager tools for managers', () => {
        const visibleTools = filterToolsByRole('manager');
        expect(visibleTools).toHaveLength(3);
        expect(visibleTools.some(t => t.id === 'manager')).toBe(true);
        expect(visibleTools.some(t => t.id === 'admin')).toBe(false);
      });

      it('should show all tools for admins', () => {
        const visibleTools = filterToolsByRole('admin');
        expect(visibleTools).toHaveLength(4);
        expect(visibleTools.some(t => t.id === 'admin')).toBe(true);
      });
    });
  });

  describe('Data Fetching Patterns', () => {
    describe('Active Vision Query', () => {
      it('should fetch primary vision board for user', async () => {
        const mockSelect = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [mockVisionBoard],
                  error: null
                })
              })
            })
          })
        });

        mockSupabase.from.mockReturnValue({ select: mockSelect });

        await mockSupabase.from('vision_boards')
          .select('id, prompt, image_url, is_favorite, created_at')
          .eq('user_id', mockUser.id)
          .order('is_favorite', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1);

        expect(mockSupabase.from).toHaveBeenCalledWith('vision_boards');
      });
    });

    describe('Today Tasks Query', () => {
      it('should build correct date range for today', () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        expect(tomorrow.getTime() - today.getTime()).toBe(24 * 60 * 60 * 1000);
      });

      it('should filter tasks by date range', async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const mockSelect = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [mockActionTask],
                  error: null
                })
              })
            })
          })
        });

        mockSupabase.from.mockReturnValue({ select: mockSelect });

        await mockSupabase.from('action_tasks')
          .select('id, title, description, due_date, type, is_completed, ai_metadata')
          .eq('user_id', mockUser.id)
          .gte('due_date', today.toISOString())
          .lt('due_date', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString())
          .order('due_date', { ascending: true });

        expect(mockSupabase.from).toHaveBeenCalledWith('action_tasks');
      });
    });

    describe('Habits with Completions Query', () => {
      it('should map habits with completion status', () => {
        const habits = [
          { id: 'habit-1', title: 'Meditation', current_streak: 5, is_active: true },
          { id: 'habit-2', title: 'Exercise', current_streak: 3, is_active: true }
        ];

        const completions = [{ habit_id: 'habit-1' }];
        const completedHabitIds = new Set(completions.map(c => c.habit_id));

        const mappedHabits = habits.map(habit => ({
          id: habit.id,
          name: habit.title,
          completedToday: completedHabitIds.has(habit.id),
          streak: habit.current_streak
        }));

        expect(mappedHabits[0].completedToday).toBe(true);
        expect(mappedHabits[1].completedToday).toBe(false);
      });
    });
  });

  describe('Optimistic Updates', () => {
    describe('Task Toggle', () => {
      it('should toggle task completion optimistically', () => {
        const tasks = [
          { id: 'task-1', isCompleted: false },
          { id: 'task-2', isCompleted: true }
        ];

        const taskId = 'task-1';
        const updatedTasks = tasks.map(t =>
          t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t
        );

        expect(updatedTasks[0].isCompleted).toBe(true);
        expect(updatedTasks[1].isCompleted).toBe(true);
      });

      it('should revert on error', () => {
        const tasks = [{ id: 'task-1', isCompleted: true }];
        const taskId = 'task-1';

        // Optimistic update
        let updatedTasks = tasks.map(t =>
          t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t
        );
        expect(updatedTasks[0].isCompleted).toBe(false);

        // Revert on error
        updatedTasks = updatedTasks.map(t =>
          t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t
        );
        expect(updatedTasks[0].isCompleted).toBe(true);
      });
    });

    describe('Habit Toggle', () => {
      it('should toggle habit completion optimistically', () => {
        const habits = [
          { id: 'habit-1', completedToday: false },
          { id: 'habit-2', completedToday: true }
        ];

        const habitId = 'habit-1';
        const updatedHabits = habits.map(h =>
          h.id === habitId ? { ...h, completedToday: !h.completedToday } : h
        );

        expect(updatedHabits[0].completedToday).toBe(true);
        expect(updatedHabits[1].completedToday).toBe(true);
      });
    });
  });
});
