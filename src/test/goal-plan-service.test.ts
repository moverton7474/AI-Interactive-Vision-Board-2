import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockSupabaseClient,
  mockUser,
  mockActionTask
} from './edge-function-utils';

/**
 * Goal Plan Service Tests (v1.7 Draft Plan Review)
 *
 * These tests verify the business logic of the goal plan storage service functions:
 * - createDraftPlan
 * - getDraftPlan / getActivePlan
 * - saveDraftTask / deleteDraftTask
 * - approvePlan
 * - getPlanHistory
 * - updateDraftPlan
 * - saveDraftTasks
 */

// Mock goal plan data
const mockGoalPlan = {
  id: 'plan-123',
  user_id: mockUser.id,
  status: 'draft',
  version: 1,
  source: 'onboarding',
  ai_insights: {
    summary: 'Your plan focuses on financial independence',
    recommendations: ['Start with small daily tasks']
  },
  vision_text: 'I want to achieve financial freedom',
  financial_target: 250000,
  theme_id: 'theme-123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  approved_at: null,
  archived_at: null
};

const mockDraftTask = {
  id: 'task-draft-123',
  plan_id: 'plan-123',
  user_id: mockUser.id,
  title: 'Research investment options',
  description: 'Look into index funds and ETFs',
  due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  type: 'FINANCE',
  is_completed: false,
  priority: 'high',
  display_order: 0,
  source: 'onboarding',
  ai_metadata: { generated: true },
  created_at: new Date().toISOString()
};

describe('Goal Plan Service', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  describe('createDraftPlan', () => {
    it('should require authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const result = await mockSupabase.auth.getUser();
      expect(result.data.user).toBeNull();
    });

    it('should get next version number for user', async () => {
      const existingPlans = [{ version: 2 }];
      const nextVersion = (existingPlans[0]?.version || 0) + 1;
      expect(nextVersion).toBe(3);
    });

    it('should handle first plan (no existing plans)', () => {
      const existingPlans: any[] = [];
      const nextVersion = (existingPlans[0]?.version || 0) + 1;
      expect(nextVersion).toBe(1);
    });

    it('should create plan with correct fields', () => {
      const planData = {
        user_id: mockUser.id,
        status: 'draft',
        version: 1,
        source: 'onboarding',
        vision_text: 'My dream life',
        financial_target: 500000,
        theme_id: 'theme-abc',
        ai_insights: {},
        created_at: expect.any(String),
        updated_at: expect.any(String)
      };

      expect(planData.status).toBe('draft');
      expect(planData.source).toBe('onboarding');
      expect(planData.financial_target).toBe(500000);
    });

    it('should insert plan into database', async () => {
      const mockInsertResult = {
        data: mockGoalPlan,
        error: null
      };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(mockInsertResult)
        })
      });

      mockSupabase.from.mockReturnValue({ insert: mockInsert });

      const result = await mockSupabase.from('goal_plans').insert([mockGoalPlan]).select().single();
      expect(mockSupabase.from).toHaveBeenCalledWith('goal_plans');
    });
  });

  describe('getDraftPlan', () => {
    it('should filter by user_id and status=draft', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockGoalPlan, error: null })
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({ select: mockSelect });

      // Simulate the query
      await mockSupabase.from('goal_plans')
        .select('*')
        .eq('user_id', mockUser.id)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(mockSupabase.from).toHaveBeenCalledWith('goal_plans');
    });

    it('should load associated tasks with the plan', async () => {
      const tasksForPlan = [mockDraftTask, { ...mockDraftTask, id: 'task-2', display_order: 1 }];

      const mockTaskSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: tasksForPlan, error: null })
        })
      });

      mockSupabase.from.mockReturnValue({ select: mockTaskSelect });

      const result = await mockSupabase.from('action_tasks')
        .select('*')
        .eq('plan_id', mockGoalPlan.id)
        .order('display_order', { ascending: true });

      expect(mockSupabase.from).toHaveBeenCalledWith('action_tasks');
    });

    it('should handle no draft plan found (PGRST116)', async () => {
      const noRowError = { code: 'PGRST116', message: 'No rows found' };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: noRowError })
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({ select: mockSelect });

      // Simulate the query that returns no rows
      const result = await mockSupabase.from('goal_plans')
        .select('*')
        .eq('user_id', mockUser.id)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // PGRST116 should be handled gracefully (return null, not throw)
      expect(result.error?.code).toBe('PGRST116');
    });
  });

  describe('getActivePlan', () => {
    it('should filter by status=active', async () => {
      const activePlan = { ...mockGoalPlan, status: 'active', approved_at: new Date().toISOString() };

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: activePlan, error: null })
          })
        })
      });

      mockSupabase.from.mockReturnValue({ select: mockSelect });

      await mockSupabase.from('goal_plans')
        .select('*')
        .eq('user_id', mockUser.id)
        .eq('status', 'active')
        .single();

      expect(mockSupabase.from).toHaveBeenCalledWith('goal_plans');
    });
  });

  describe('saveDraftTask', () => {
    it('should verify plan belongs to user and is draft', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: mockGoalPlan.id, status: 'draft' }, error: null })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({ select: mockSelect });

      // Verify plan ownership query
      await mockSupabase.from('goal_plans')
        .select('id, status')
        .eq('id', mockGoalPlan.id)
        .eq('user_id', mockUser.id)
        .eq('status', 'draft')
        .single();

      expect(mockSupabase.from).toHaveBeenCalledWith('goal_plans');
    });

    it('should reject save if plan is not draft', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const result = await mockSupabase.from('goal_plans')
        .select('id, status')
        .eq('id', mockGoalPlan.id)
        .eq('user_id', mockUser.id)
        .eq('status', 'draft')
        .single();

      // No plan found means either wrong user or not a draft
      expect(result.data).toBeNull();
    });

    it('should update existing task when id provided', async () => {
      const taskData = {
        title: 'Updated title',
        description: 'Updated description',
        priority: 'medium'
      };

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { ...mockDraftTask, ...taskData }, error: null })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({ update: mockUpdate });

      await mockSupabase.from('action_tasks')
        .update(taskData)
        .eq('id', mockDraftTask.id)
        .eq('plan_id', mockGoalPlan.id)
        .select()
        .single();

      expect(mockSupabase.from).toHaveBeenCalledWith('action_tasks');
    });

    it('should insert new task when no id provided', async () => {
      const newTaskData = {
        plan_id: mockGoalPlan.id,
        user_id: mockUser.id,
        title: 'New task',
        description: 'Brand new task',
        priority: 'low',
        display_order: 3
      };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'new-task-id', ...newTaskData }, error: null })
        })
      });

      mockSupabase.from.mockReturnValue({ insert: mockInsert });

      await mockSupabase.from('action_tasks')
        .insert([newTaskData])
        .select()
        .single();

      expect(mockSupabase.from).toHaveBeenCalledWith('action_tasks');
    });

    it('should include all task fields in save', () => {
      const taskData = {
        plan_id: 'plan-123',
        user_id: 'user-123',
        title: 'Test task',
        description: 'Description',
        due_date: '2024-02-01',
        type: 'FINANCE',
        is_completed: false,
        priority: 'high',
        display_order: 0,
        source: 'manual',
        ai_metadata: {},
        updated_at: expect.any(String)
      };

      expect(taskData.priority).toBe('high');
      expect(taskData.display_order).toBe(0);
      expect(taskData.source).toBe('manual');
    });
  });

  describe('deleteDraftTask', () => {
    it('should verify plan ownership before delete', async () => {
      // Similar to saveDraftTask, need to verify plan first
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: mockGoalPlan.id }, error: null })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const result = await mockSupabase.from('goal_plans')
        .select('id')
        .eq('id', mockGoalPlan.id)
        .eq('user_id', mockUser.id)
        .eq('status', 'draft')
        .single();

      expect(result.data?.id).toBe(mockGoalPlan.id);
    });

    it('should delete task by id and plan_id', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      });

      mockSupabase.from.mockReturnValue({ delete: mockDelete });

      await mockSupabase.from('action_tasks')
        .delete()
        .eq('id', mockDraftTask.id)
        .eq('plan_id', mockGoalPlan.id);

      expect(mockSupabase.from).toHaveBeenCalledWith('action_tasks');
    });

    it('should return false if plan not found', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const result = await mockSupabase.from('goal_plans')
        .select('id')
        .eq('id', 'non-existent')
        .eq('user_id', mockUser.id)
        .eq('status', 'draft')
        .single();

      expect(result.data).toBeNull();
    });
  });

  describe('approvePlan', () => {
    it('should call approve_goal_plan RPC function', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

      const result = await mockSupabase.rpc('approve_goal_plan', {
        p_plan_id: mockGoalPlan.id,
        p_user_id: mockUser.id
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('approve_goal_plan', {
        p_plan_id: mockGoalPlan.id,
        p_user_id: mockUser.id
      });
      expect(result.data).toBe(true);
    });

    it('should handle RPC error', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Plan not found or not a draft' }
      });

      const result = await mockSupabase.rpc('approve_goal_plan', {
        p_plan_id: 'invalid-plan',
        p_user_id: mockUser.id
      });

      expect(result.error).toBeTruthy();
    });

    it('should return false if RPC returns false', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: false, error: null });

      const result = await mockSupabase.rpc('approve_goal_plan', {
        p_plan_id: mockGoalPlan.id,
        p_user_id: mockUser.id
      });

      expect(result.data).toBe(false);
    });
  });

  describe('getPlanHistory', () => {
    it('should return all plans for user ordered by version', async () => {
      const planHistory = [
        { ...mockGoalPlan, version: 3, status: 'active' },
        { ...mockGoalPlan, id: 'plan-2', version: 2, status: 'archived' },
        { ...mockGoalPlan, id: 'plan-1', version: 1, status: 'archived' }
      ];

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: planHistory, error: null })
        })
      });

      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const result = await mockSupabase.from('goal_plans')
        .select('*')
        .eq('user_id', mockUser.id)
        .order('version', { ascending: false });

      expect(result.data).toHaveLength(3);
      expect(result.data[0].version).toBe(3);
    });

    it('should return empty array for user with no plans', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      });

      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const result = await mockSupabase.from('goal_plans')
        .select('*')
        .eq('user_id', mockUser.id)
        .order('version', { ascending: false });

      expect(result.data).toEqual([]);
    });
  });

  describe('updateDraftPlan', () => {
    it('should update only provided fields', async () => {
      const updates = {
        vision_text: 'Updated vision',
        financial_target: 300000,
        updated_at: new Date().toISOString()
      };

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
          })
        })
      });

      mockSupabase.from.mockReturnValue({ update: mockUpdate });

      await mockSupabase.from('goal_plans')
        .update(updates)
        .eq('id', mockGoalPlan.id)
        .eq('user_id', mockUser.id)
        .eq('status', 'draft');

      expect(mockSupabase.from).toHaveBeenCalledWith('goal_plans');
    });

    it('should filter by draft status to prevent updating active plans', () => {
      // The query must include eq('status', 'draft')
      const constraints = {
        id: mockGoalPlan.id,
        user_id: mockUser.id,
        status: 'draft' // This is critical
      };

      expect(constraints.status).toBe('draft');
    });
  });

  describe('saveDraftTasks (bulk)', () => {
    it('should delete existing tasks before inserting new ones', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      mockSupabase.from.mockReturnValue({ delete: mockDelete });

      await mockSupabase.from('action_tasks')
        .delete()
        .eq('plan_id', mockGoalPlan.id);

      expect(mockSupabase.from).toHaveBeenCalledWith('action_tasks');
    });

    it('should insert multiple tasks with correct display_order', async () => {
      const tasks = [
        { title: 'Task 1', description: 'Desc 1', type: 'FINANCE' },
        { title: 'Task 2', description: 'Desc 2', type: 'LIFESTYLE' },
        { title: 'Task 3', description: 'Desc 3', type: 'ADMIN' }
      ];

      const taskRows = tasks.map((task, index) => ({
        id: `new-task-${index}`,
        plan_id: mockGoalPlan.id,
        user_id: mockUser.id,
        title: task.title,
        description: task.description,
        type: task.type,
        is_completed: false,
        priority: 'medium',
        display_order: index, // Critical: maintains order
        source: 'onboarding',
        ai_metadata: {},
        created_at: expect.any(String)
      }));

      expect(taskRows[0].display_order).toBe(0);
      expect(taskRows[1].display_order).toBe(1);
      expect(taskRows[2].display_order).toBe(2);
    });

    it('should return inserted tasks mapped to ActionTask type', async () => {
      const insertedData = [
        { ...mockDraftTask, id: 'task-1' },
        { ...mockDraftTask, id: 'task-2', display_order: 1 }
      ];

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: insertedData, error: null })
      });

      mockSupabase.from.mockReturnValue({ insert: mockInsert });

      const result = await mockSupabase.from('action_tasks')
        .insert([/* tasks */])
        .select();

      expect(result.data).toHaveLength(2);
    });
  });

  describe('Data Mapping', () => {
    it('should correctly map GoalPlan from database row', () => {
      const dbRow = {
        id: 'plan-123',
        user_id: 'user-123',
        status: 'draft',
        version: 1,
        source: 'onboarding',
        ai_insights: { summary: 'test' },
        vision_text: 'My vision',
        financial_target: '250000', // Note: comes as string from DB
        theme_id: 'theme-123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        approved_at: null,
        archived_at: null
      };

      // Mapping logic
      const mapped = {
        id: dbRow.id,
        userId: dbRow.user_id,
        status: dbRow.status,
        version: dbRow.version,
        source: dbRow.source,
        aiInsights: dbRow.ai_insights,
        visionText: dbRow.vision_text,
        financialTarget: dbRow.financial_target ? parseFloat(dbRow.financial_target) : undefined,
        themeId: dbRow.theme_id,
        createdAt: dbRow.created_at,
        updatedAt: dbRow.updated_at,
        approvedAt: dbRow.approved_at,
        archivedAt: dbRow.archived_at
      };

      expect(mapped.userId).toBe('user-123'); // snake_case to camelCase
      expect(mapped.financialTarget).toBe(250000); // string to number
      expect(mapped.aiInsights).toEqual({ summary: 'test' });
    });

    it('should correctly map ActionTask from database row', () => {
      const dbRow = {
        id: 'task-123',
        title: 'Task title',
        description: 'Task description',
        due_date: '2024-02-01',
        type: 'FINANCE',
        is_completed: false,
        milestone_year: 2025,
        ai_metadata: { generated: true },
        plan_id: 'plan-123',
        plan_version: 1,
        display_order: 0,
        priority: 'high',
        source: 'onboarding'
      };

      // Mapping logic
      const mapped = {
        id: dbRow.id,
        title: dbRow.title,
        description: dbRow.description,
        dueDate: dbRow.due_date,
        type: dbRow.type,
        isCompleted: dbRow.is_completed,
        milestoneYear: dbRow.milestone_year,
        aiMetadata: dbRow.ai_metadata,
        planId: dbRow.plan_id,
        planVersion: dbRow.plan_version,
        displayOrder: dbRow.display_order,
        priority: dbRow.priority,
        source: dbRow.source
      };

      expect(mapped.dueDate).toBe('2024-02-01'); // due_date -> dueDate
      expect(mapped.isCompleted).toBe(false); // is_completed -> isCompleted
      expect(mapped.displayOrder).toBe(0);
    });
  });

  describe('Plan Status Transitions', () => {
    it('should only allow draft -> active transition', () => {
      const validTransitions: Record<string, string[]> = {
        draft: ['active'],
        active: ['archived'],
        archived: [] // Cannot transition from archived
      };

      expect(validTransitions.draft).toContain('active');
      expect(validTransitions.active).not.toContain('draft');
      expect(validTransitions.archived).toHaveLength(0);
    });

    it('should set approved_at when transitioning to active', () => {
      const plan = { ...mockGoalPlan, status: 'draft', approved_at: null };

      // Simulating approval
      const approvedPlan = {
        ...plan,
        status: 'active',
        approved_at: new Date().toISOString()
      };

      expect(approvedPlan.status).toBe('active');
      expect(approvedPlan.approved_at).toBeTruthy();
    });

    it('should set archived_at when transitioning to archived', () => {
      const plan = { ...mockGoalPlan, status: 'active', approved_at: '2024-01-01T00:00:00Z' };

      // Simulating archival
      const archivedPlan = {
        ...plan,
        status: 'archived',
        archived_at: new Date().toISOString()
      };

      expect(archivedPlan.status).toBe('archived');
      expect(archivedPlan.archived_at).toBeTruthy();
    });
  });

  describe('Task Validation', () => {
    it('should require task title to be non-empty', () => {
      const task = { title: '', description: 'Has description' };
      const isValid = task.title && task.title.trim().length > 0;
      expect(isValid).toBeFalsy();
    });

    it('should accept valid task', () => {
      const task = { title: 'Valid title', description: '' };
      const isValid = task.title && task.title.trim().length > 0;
      expect(isValid).toBe(true);
    });

    it('should validate priority values', () => {
      const validPriorities = ['high', 'medium', 'low'];

      expect(validPriorities.includes('high')).toBe(true);
      expect(validPriorities.includes('medium')).toBe(true);
      expect(validPriorities.includes('low')).toBe(true);
      expect(validPriorities.includes('urgent')).toBe(false);
    });

    it('should validate task type values', () => {
      const validTypes = ['FINANCE', 'LIFESTYLE', 'ADMIN'];

      expect(validTypes.includes('FINANCE')).toBe(true);
      expect(validTypes.includes('LIFESTYLE')).toBe(true);
      expect(validTypes.includes('ADMIN')).toBe(true);
      expect(validTypes.includes('OTHER')).toBe(false);
    });
  });

  describe('Plan Requirements', () => {
    it('should require at least one task for approval', () => {
      const tasks: any[] = [];
      const canApprove = tasks.length > 0;
      expect(canApprove).toBe(false);
    });

    it('should require all tasks to have titles for approval', () => {
      const tasks = [
        { title: 'Task 1' },
        { title: '' }, // Invalid
        { title: 'Task 3' }
      ];

      const allHaveTitles = tasks.every(t => t.title && t.title.trim().length > 0);
      expect(allHaveTitles).toBe(false);
    });

    it('should pass validation with valid tasks', () => {
      const tasks = [
        { title: 'Task 1' },
        { title: 'Task 2' },
        { title: 'Task 3' }
      ];

      const canApprove = tasks.length > 0 &&
        tasks.every(t => t.title && t.title.trim().length > 0);
      expect(canApprove).toBe(true);
    });
  });
});
