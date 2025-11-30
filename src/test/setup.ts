import { vi, beforeEach, afterEach } from 'vitest';

// Mock environment variables
vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('VITE_STRIPE_PRICE_PRO', 'price_test_pro');
vi.stubEnv('VITE_STRIPE_PRICE_ELITE', 'price_test_elite');

// Mock fetch globally
global.fetch = vi.fn();

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after tests
afterEach(() => {
  vi.restoreAllMocks();
});
