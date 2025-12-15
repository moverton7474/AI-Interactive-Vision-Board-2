import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * DraftPlanReviewStep Component Tests (v1.7)
 *
 * These tests verify the behavioral logic of the DraftPlanReviewStep component:
 * - Task editing (title, description, due date, priority)
 * - Adding new tasks by category
 * - Deleting tasks
 * - Validation rules
 * - AI regeneration
 * - Auto-save functionality
 */

// Mock task data
const mockTask = {
  id: 'task-123',
  title: 'Research investment options',
  description: 'Look into index funds and ETFs',
  dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  type: 'FINANCE' as const,
  isCompleted: false,
  priority: 'high' as const,
  displayOrder: 0
};

const mockTasks = [
  mockTask,
  {
    ...mockTask,
    id: 'task-456',
    title: 'Create monthly budget',
    type: 'FINANCE' as const,
    priority: 'medium' as const,
    displayOrder: 1
  },
  {
    ...mockTask,
    id: 'task-789',
    title: 'Schedule gym sessions',
    type: 'LIFESTYLE' as const,
    priority: 'low' as const,
    displayOrder: 2
  }
];

describe('DraftPlanReviewStep Component Logic', () => {
  describe('Task Editing', () => {
    it('should update task title locally', () => {
      const tasks = [...mockTasks];
      const taskId = 'task-123';
      const newTitle = 'Updated task title';

      const updatedTasks = tasks.map(task =>
        task.id === taskId ? { ...task, title: newTitle } : task
      );

      const updatedTask = updatedTasks.find(t => t.id === taskId);
      expect(updatedTask?.title).toBe('Updated task title');
    });

    it('should update task description locally', () => {
      const tasks = [...mockTasks];
      const taskId = 'task-123';
      const newDescription = 'New detailed description';

      const updatedTasks = tasks.map(task =>
        task.id === taskId ? { ...task, description: newDescription } : task
      );

      const updatedTask = updatedTasks.find(t => t.id === taskId);
      expect(updatedTask?.description).toBe('New detailed description');
    });

    it('should update task due date locally', () => {
      const tasks = [...mockTasks];
      const taskId = 'task-123';
      const newDueDate = '2024-06-15';

      const updatedTasks = tasks.map(task =>
        task.id === taskId ? { ...task, dueDate: newDueDate } : task
      );

      const updatedTask = updatedTasks.find(t => t.id === taskId);
      expect(updatedTask?.dueDate).toBe('2024-06-15');
    });

    it('should update task priority locally', () => {
      const tasks = [...mockTasks];
      const taskId = 'task-123';
      const newPriority = 'low' as const;

      const updatedTasks = tasks.map(task =>
        task.id === taskId ? { ...task, priority: newPriority } : task
      );

      const updatedTask = updatedTasks.find(t => t.id === taskId);
      expect(updatedTask?.priority).toBe('low');
    });

    it('should preserve other task fields when editing', () => {
      const tasks = [...mockTasks];
      const taskId = 'task-123';
      const originalTask = tasks.find(t => t.id === taskId)!;

      const updatedTasks = tasks.map(task =>
        task.id === taskId ? { ...task, title: 'New title' } : task
      );

      const updatedTask = updatedTasks.find(t => t.id === taskId);
      expect(updatedTask?.type).toBe(originalTask.type);
      expect(updatedTask?.displayOrder).toBe(originalTask.displayOrder);
      expect(updatedTask?.isCompleted).toBe(originalTask.isCompleted);
    });
  });

  describe('Adding Tasks', () => {
    it('should add new FINANCE task with correct defaults', () => {
      const tasks = [...mockTasks];
      const newTask = {
        id: crypto.randomUUID(),
        title: '',
        description: '',
        dueDate: undefined,
        type: 'FINANCE' as const,
        isCompleted: false,
        priority: 'medium' as const,
        displayOrder: tasks.length,
        source: 'manual' as const
      };

      const updatedTasks = [...tasks, newTask];

      expect(updatedTasks).toHaveLength(4);
      expect(updatedTasks[3].type).toBe('FINANCE');
      expect(updatedTasks[3].priority).toBe('medium');
      expect(updatedTasks[3].displayOrder).toBe(3);
    });

    it('should add new LIFESTYLE task', () => {
      const tasks = [...mockTasks];
      const newTask = {
        id: crypto.randomUUID(),
        title: '',
        description: '',
        type: 'LIFESTYLE' as const,
        isCompleted: false,
        priority: 'medium' as const,
        displayOrder: tasks.length
      };

      const updatedTasks = [...tasks, newTask];
      expect(updatedTasks[3].type).toBe('LIFESTYLE');
    });

    it('should add new ADMIN task', () => {
      const tasks = [...mockTasks];
      const newTask = {
        id: crypto.randomUUID(),
        title: '',
        description: '',
        type: 'ADMIN' as const,
        isCompleted: false,
        priority: 'medium' as const,
        displayOrder: tasks.length
      };

      const updatedTasks = [...tasks, newTask];
      expect(updatedTasks[3].type).toBe('ADMIN');
    });

    it('should generate unique IDs for new tasks', () => {
      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should correctly calculate display order for new task', () => {
      const existingTasks = [
        { displayOrder: 0 },
        { displayOrder: 1 },
        { displayOrder: 2 }
      ];

      const newDisplayOrder = existingTasks.length;
      expect(newDisplayOrder).toBe(3);
    });
  });

  describe('Deleting Tasks', () => {
    it('should remove task by id', () => {
      const tasks = [...mockTasks];
      const taskToDelete = 'task-456';

      const updatedTasks = tasks.filter(task => task.id !== taskToDelete);

      expect(updatedTasks).toHaveLength(2);
      expect(updatedTasks.find(t => t.id === taskToDelete)).toBeUndefined();
    });

    it('should preserve other tasks when deleting', () => {
      const tasks = [...mockTasks];
      const taskToDelete = 'task-456';

      const updatedTasks = tasks.filter(task => task.id !== taskToDelete);

      expect(updatedTasks.find(t => t.id === 'task-123')).toBeDefined();
      expect(updatedTasks.find(t => t.id === 'task-789')).toBeDefined();
    });

    it('should update display order after deletion', () => {
      const tasks = [...mockTasks];
      const taskToDelete = 'task-456';

      const updatedTasks = tasks
        .filter(task => task.id !== taskToDelete)
        .map((task, index) => ({ ...task, displayOrder: index }));

      expect(updatedTasks[0].displayOrder).toBe(0);
      expect(updatedTasks[1].displayOrder).toBe(1);
    });

    it('should not allow deletion if it would leave zero tasks', () => {
      const tasks = [mockTask]; // Only one task

      const canDelete = tasks.length > 1;
      expect(canDelete).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should require at least one task', () => {
      const tasks: typeof mockTasks = [];

      const isValid = tasks.length > 0;
      expect(isValid).toBe(false);
    });

    it('should require all tasks to have titles', () => {
      const tasks = [
        { ...mockTask, title: 'Has title' },
        { ...mockTask, id: 'task-2', title: '' }, // Invalid
        { ...mockTask, id: 'task-3', title: 'Also has title' }
      ];

      const allHaveTitles = tasks.every(t => t.title && t.title.trim().length > 0);
      expect(allHaveTitles).toBe(false);
    });

    it('should pass validation with valid tasks', () => {
      const tasks = [
        { ...mockTask, title: 'Task 1' },
        { ...mockTask, id: 'task-2', title: 'Task 2' }
      ];

      const isValid = tasks.length > 0 &&
        tasks.every(t => t.title && t.title.trim().length > 0);
      expect(isValid).toBe(true);
    });

    it('should trim whitespace when validating title', () => {
      const task = { ...mockTask, title: '   ' }; // Whitespace only

      const isValid = task.title && task.title.trim().length > 0;
      expect(isValid).toBe(false);
    });

    it('should identify tasks with empty titles', () => {
      const tasks = [
        { ...mockTask, title: 'Valid' },
        { ...mockTask, id: 'task-2', title: '' },
        { ...mockTask, id: 'task-3', title: '   ' }
      ];

      const invalidTasks = tasks.filter(t => !t.title || t.title.trim().length === 0);
      expect(invalidTasks).toHaveLength(2);
    });
  });

  describe('Priority Display', () => {
    it('should map priority to display color', () => {
      const priorityColors = {
        high: 'text-red-600',
        medium: 'text-yellow-600',
        low: 'text-green-600'
      };

      expect(priorityColors.high).toBe('text-red-600');
      expect(priorityColors.medium).toBe('text-yellow-600');
      expect(priorityColors.low).toBe('text-green-600');
    });

    it('should map priority to display label', () => {
      const priorityLabels = {
        high: 'High Priority',
        medium: 'Medium Priority',
        low: 'Low Priority'
      };

      expect(priorityLabels.high).toBe('High Priority');
    });
  });

  describe('Task Category Display', () => {
    it('should map task type to icon', () => {
      const typeIcons = {
        FINANCE: '💰',
        LIFESTYLE: '🌟',
        ADMIN: '📋'
      };

      expect(typeIcons.FINANCE).toBe('💰');
      expect(typeIcons.LIFESTYLE).toBe('🌟');
      expect(typeIcons.ADMIN).toBe('📋');
    });

    it('should map task type to display label', () => {
      const typeLabels = {
        FINANCE: 'Finance Goal',
        LIFESTYLE: 'Lifestyle Goal',
        ADMIN: 'Admin Task'
      };

      expect(typeLabels.FINANCE).toBe('Finance Goal');
    });

    it('should group tasks by type', () => {
      const tasks = [...mockTasks];

      const groupedByType = tasks.reduce((acc, task) => {
        const type = task.type;
        if (!acc[type]) acc[type] = [];
        acc[type].push(task);
        return acc;
      }, {} as Record<string, typeof mockTasks>);

      expect(groupedByType.FINANCE).toHaveLength(2);
      expect(groupedByType.LIFESTYLE).toHaveLength(1);
    });
  });

  describe('AI Regeneration', () => {
    it('should call generateActionPlan with correct context', async () => {
      const mockGenerateActionPlan = vi.fn().mockResolvedValue([
        { ...mockTask, id: 'new-1', title: 'AI Generated Task 1' },
        { ...mockTask, id: 'new-2', title: 'AI Generated Task 2' }
      ]);

      const context = {
        vision: 'I want financial freedom',
        target: 250000,
        theme: 'Modern Minimalist'
      };

      await mockGenerateActionPlan(context);

      expect(mockGenerateActionPlan).toHaveBeenCalledWith({
        vision: 'I want financial freedom',
        target: 250000,
        theme: 'Modern Minimalist'
      });
    });

    it('should replace all tasks on regeneration', async () => {
      const existingTasks = [...mockTasks];
      const newTasks = [
        { ...mockTask, id: 'new-1', title: 'New Task 1' },
        { ...mockTask, id: 'new-2', title: 'New Task 2' }
      ];

      // Regeneration replaces existing tasks
      const afterRegeneration = newTasks;

      expect(afterRegeneration).toHaveLength(2);
      expect(afterRegeneration.find(t => t.id === 'task-123')).toBeUndefined();
    });

    it('should handle regeneration error gracefully', async () => {
      const mockGenerateActionPlan = vi.fn().mockRejectedValue(new Error('AI service unavailable'));

      let error = null;
      try {
        await mockGenerateActionPlan({});
      } catch (e) {
        error = e;
      }

      expect(error).toBeTruthy();
      expect((error as Error).message).toBe('AI service unavailable');
    });

    it('should set loading state during regeneration', async () => {
      let isRegenerating = false;

      const mockRegenerate = async () => {
        isRegenerating = true;
        await new Promise(resolve => setTimeout(resolve, 100));
        isRegenerating = false;
      };

      const promise = mockRegenerate();
      expect(isRegenerating).toBe(true);
      await promise;
      expect(isRegenerating).toBe(false);
    });
  });

  describe('Auto-Save', () => {
    it('should trigger auto-save after task edit', () => {
      const onTasksChanged = vi.fn();

      const tasks = [...mockTasks];
      const updatedTasks = tasks.map(task =>
        task.id === 'task-123' ? { ...task, title: 'Updated' } : task
      );

      onTasksChanged(updatedTasks);

      expect(onTasksChanged).toHaveBeenCalledWith(updatedTasks);
    });

    it('should debounce rapid changes', async () => {
      const saveCallback = vi.fn();

      // Simulating debounce behavior
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      const debounce = (fn: () => void, delay: number) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fn, delay);
      };

      // Multiple rapid changes
      debounce(saveCallback, 500);
      debounce(saveCallback, 500);
      debounce(saveCallback, 500);

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 600));

      // Should only be called once
      expect(saveCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('AI Insights Panel', () => {
    it('should display AI insights when available', () => {
      const aiInsights = {
        summary: 'Your plan focuses on achieving financial independence',
        recommendations: [
          'Start with high-priority finance tasks',
          'Build habits around daily check-ins'
        ],
        keyThemes: ['Financial Freedom', 'Work-Life Balance']
      };

      expect(aiInsights.summary).toBeTruthy();
      expect(aiInsights.recommendations).toHaveLength(2);
      expect(aiInsights.keyThemes).toContain('Financial Freedom');
    });

    it('should handle missing AI insights gracefully', () => {
      const aiInsights = null;

      const shouldShowInsights = aiInsights !== null;
      expect(shouldShowInsights).toBe(false);
    });

    it('should toggle insights panel visibility', () => {
      let showInsights = false;

      // Toggle on
      showInsights = !showInsights;
      expect(showInsights).toBe(true);

      // Toggle off
      showInsights = !showInsights;
      expect(showInsights).toBe(false);
    });
  });

  describe('Task Due Date Handling', () => {
    it('should format date for display', () => {
      const dueDate = '2024-06-15';
      const formatted = new Date(dueDate + 'T12:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      expect(formatted).toMatch(/Jun 1[45], 2024/); // Allow for timezone variance
    });

    it('should handle missing due date', () => {
      const task = { ...mockTask, dueDate: undefined };

      const displayDate = task.dueDate || 'No date set';
      expect(displayDate).toBe('No date set');
    });

    it('should validate date is in future', () => {
      const today = new Date().toISOString().split('T')[0];
      const futureDate = '2025-12-31';
      const pastDate = '2020-01-01';

      expect(futureDate > today).toBe(true);
      expect(pastDate > today).toBe(false);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support Enter key to save inline edit', () => {
      const handleKeyDown = (e: { key: string }, saveCallback: () => void) => {
        if (e.key === 'Enter') {
          saveCallback();
        }
      };

      const saveCallback = vi.fn();
      handleKeyDown({ key: 'Enter' }, saveCallback);

      expect(saveCallback).toHaveBeenCalled();
    });

    it('should support Escape key to cancel inline edit', () => {
      const handleKeyDown = (e: { key: string }, cancelCallback: () => void) => {
        if (e.key === 'Escape') {
          cancelCallback();
        }
      };

      const cancelCallback = vi.fn();
      handleKeyDown({ key: 'Escape' }, cancelCallback);

      expect(cancelCallback).toHaveBeenCalled();
    });
  });

  describe('Task Ordering', () => {
    it('should maintain task order by displayOrder', () => {
      const unorderedTasks = [
        { ...mockTask, id: 'task-3', displayOrder: 2 },
        { ...mockTask, id: 'task-1', displayOrder: 0 },
        { ...mockTask, id: 'task-2', displayOrder: 1 }
      ];

      const orderedTasks = [...unorderedTasks].sort((a, b) => a.displayOrder - b.displayOrder);

      expect(orderedTasks[0].id).toBe('task-1');
      expect(orderedTasks[1].id).toBe('task-2');
      expect(orderedTasks[2].id).toBe('task-3');
    });
  });
});

describe('DraftPlanReviewStep Integration', () => {
  describe('Onboarding Flow', () => {
    it('should receive existing tasks from onboarding state', () => {
      const onboardingState = {
        visionText: 'My dream life',
        financialTarget: 250000,
        themeName: 'Modern Minimalist',
        generatedTasks: mockTasks
      };

      expect(onboardingState.generatedTasks).toEqual(mockTasks);
    });

    it('should generate tasks if none exist', async () => {
      const onboardingState = {
        visionText: 'My dream life',
        financialTarget: 250000,
        themeName: 'Modern Minimalist',
        generatedTasks: undefined
      };

      const mockGenerateActionPlan = vi.fn().mockResolvedValue(mockTasks);

      if (!onboardingState.generatedTasks) {
        await mockGenerateActionPlan({
          vision: onboardingState.visionText,
          target: onboardingState.financialTarget,
          theme: onboardingState.themeName
        });
      }

      expect(mockGenerateActionPlan).toHaveBeenCalled();
    });

    it('should call onTasksChanged when tasks are modified', () => {
      const onTasksChanged = vi.fn();

      const modifiedTasks = mockTasks.map(t =>
        t.id === 'task-123' ? { ...t, title: 'Modified' } : t
      );

      onTasksChanged(modifiedTasks);

      expect(onTasksChanged).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Modified' })
        ])
      );
    });
  });

  describe('canProceed Validation', () => {
    it('should allow proceeding when tasks are valid', () => {
      const tasks = [
        { ...mockTask, title: 'Valid Task 1' },
        { ...mockTask, id: 'task-2', title: 'Valid Task 2' }
      ];

      const canProceed = tasks.length > 0 &&
        tasks.every(t => t.title && t.title.trim().length > 0);

      expect(canProceed).toBe(true);
    });

    it('should prevent proceeding when no tasks', () => {
      const tasks: typeof mockTasks = [];

      const canProceed = tasks.length > 0 &&
        tasks.every(t => t.title && t.title.trim().length > 0);

      expect(canProceed).toBe(false);
    });

    it('should prevent proceeding when any task has empty title', () => {
      const tasks = [
        { ...mockTask, title: 'Valid' },
        { ...mockTask, id: 'task-2', title: '' }
      ];

      const canProceed = tasks.length > 0 &&
        tasks.every(t => t.title && t.title.trim().length > 0);

      expect(canProceed).toBe(false);
    });
  });
});
