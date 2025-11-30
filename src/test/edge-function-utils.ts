import { vi } from 'vitest';

/**
 * Test utilities for Supabase Edge Functions
 */

// Mock user for authentication tests
export const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  created_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated'
};

// Mock profile for subscription tier tests
export const mockProfile = {
  id: 'test-user-123',
  email: 'test@example.com',
  full_name: 'Test User',
  subscription_tier: 'pro',
  credits: 100,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Mock Supabase client
export const createMockSupabaseClient = (overrides: Record<string, any> = {}) => {
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ single: mockSingle }),
    order: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) }),
    gte: vi.fn().mockReturnValue({ lte: vi.fn().mockResolvedValue({ data: [], error: null }) })
  });
  const mockInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) });
  const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) }) });
  const mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null })
    },
    from: vi.fn().mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      upsert: mockInsert
    }),
    rpc: mockRpc,
    ...overrides
  };
};

// Create mock Edge Function request
export const createMockRequest = (
  body: Record<string, any>,
  options: {
    method?: string;
    headers?: Record<string, string>;
  } = {}
) => {
  const { method = 'POST', headers = {} } = options;

  return new Request('https://test.supabase.co/functions/v1/test', {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
      ...headers
    },
    body: method !== 'GET' ? JSON.stringify(body) : undefined
  });
};

// Create CORS preflight request
export const createOptionsRequest = () => {
  return new Request('https://test.supabase.co/functions/v1/test', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST'
    }
  });
};

// Parse JSON response from Edge Function
export const parseResponse = async (response: Response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

// Mock Deno environment
export const mockDenoEnv = (env: Record<string, string>) => {
  (globalThis as any).Deno = {
    env: {
      get: vi.fn((key: string) => env[key] || null)
    }
  };
};

// Standard CORS headers for verification
export const expectedCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Mock habit data
export const mockHabit = {
  id: 'habit-123',
  user_id: 'test-user-123',
  title: 'Morning Meditation',
  description: 'Meditate for 10 minutes',
  frequency: 'daily',
  target_days: [1, 2, 3, 4, 5],
  is_active: true,
  current_streak: 5,
  longest_streak: 10,
  total_completions: 50,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Mock habit completion
export const mockHabitCompletion = {
  id: 'completion-123',
  habit_id: 'habit-123',
  user_id: 'test-user-123',
  completed_date: new Date().toISOString().split('T')[0],
  notes: 'Great session!',
  created_at: new Date().toISOString()
};

// Mock vision board
export const mockVisionBoard = {
  id: 'board-123',
  user_id: 'test-user-123',
  title: 'Dream Retirement',
  description: 'Beachfront villa in Thailand',
  image_url: 'https://example.com/image.jpg',
  is_primary: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Mock action task
export const mockActionTask = {
  id: 'task-123',
  user_id: 'test-user-123',
  title: 'Research visa requirements',
  description: 'Look into Thailand retirement visa options',
  status: 'pending',
  due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  priority: 'high',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Mock weekly review
export const mockWeeklyReview = {
  id: 'review-123',
  user_id: 'test-user-123',
  week_start: '2024-01-01',
  week_end: '2024-01-07',
  habit_completion_rate: 85.5,
  tasks_completed: 5,
  tasks_created: 3,
  wins: ['Completed meditation streak', 'Finished financial review'],
  blockers: ['Delayed visa research'],
  ai_insights: 'Great progress on habits! Consider setting specific times for tasks.',
  mood_average: 4.2,
  created_at: new Date().toISOString()
};

// Mock knowledge base
export const mockKnowledgeBase = {
  id: 'kb-123',
  user_id: 'test-user-123',
  compiled_at: new Date().toISOString(),
  data: {
    profile: mockProfile,
    vision_boards: [mockVisionBoard],
    habits: [mockHabit],
    tasks: [mockActionTask],
    weekly_reviews: [mockWeeklyReview]
  },
  ai_context: 'User Test User is working towards retirement in Thailand...',
  version: 1
};

// Helper to create date ranges
export const getDateRange = (daysBack: number) => {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
};

// Helper to get week boundaries
export const getWeekBoundaries = (date: Date = new Date()) => {
  const dayOfWeek = date.getDay();
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return {
    start: startOfWeek.toISOString().split('T')[0],
    end: endOfWeek.toISOString().split('T')[0]
  };
};
