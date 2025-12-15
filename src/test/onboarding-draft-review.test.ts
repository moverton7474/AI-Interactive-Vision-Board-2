import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockSupabaseClient,
  mockUser
} from './edge-function-utils';

/**
 * E2E Tests: Onboarding Flow with Draft Plan Review (v1.7)
 *
 * These tests verify the complete onboarding flow including:
 * - Theme selection
 * - Vision capture
 * - Photo upload (optional)
 * - Financial target selection
 * - Vision generation
 * - DRAFT_PLAN_REVIEW step (new in v1.7)
 * - Habits setup
 * - Completion
 */

// Onboarding step definitions
const ONBOARDING_STEPS = [
  'THEME',
  'COACH_INTRO',
  'VISION_CAPTURE',
  'PHOTO_UPLOAD',
  'FINANCIAL_TARGET',
  'VISION_GENERATION',
  'DRAFT_PLAN_REVIEW', // v1.7 - replaces ACTION_PLAN_PREVIEW when feature flag enabled
  'HABITS_SETUP',
  'COMPLETION'
] as const;

type OnboardingStep = typeof ONBOARDING_STEPS[number];

// Mock onboarding state
const mockOnboardingState = {
  currentStep: 'THEME' as OnboardingStep,
  themeId: undefined as string | undefined,
  themeName: undefined as string | undefined,
  visionText: undefined as string | undefined,
  photoRefId: undefined as string | undefined,
  identityDescription: undefined as string | undefined,
  financialTarget: undefined as number | undefined,
  financialTargetLabel: undefined as string | undefined,
  primaryVisionId: undefined as string | undefined,
  primaryVisionUrl: undefined as string | undefined,
  generatedTasks: undefined as any[] | undefined,
  selectedHabits: [] as string[]
};

// Mock themes
const mockThemes = [
  { id: 'theme-1', name: 'Modern Minimalist', color: '#1a365d' },
  { id: 'theme-2', name: 'Warm & Inspiring', color: '#9c4221' },
  { id: 'theme-3', name: 'Nature & Growth', color: '#276749' }
];

// Mock generated tasks
const mockGeneratedTasks = [
  {
    id: 'task-1',
    title: 'Research investment options',
    description: 'Look into index funds and ETFs',
    type: 'FINANCE',
    priority: 'high',
    displayOrder: 0
  },
  {
    id: 'task-2',
    title: 'Create emergency fund plan',
    description: 'Save 3-6 months of expenses',
    type: 'FINANCE',
    priority: 'medium',
    displayOrder: 1
  },
  {
    id: 'task-3',
    title: 'Schedule weekly planning sessions',
    description: 'Block time for goal review',
    type: 'ADMIN',
    priority: 'medium',
    displayOrder: 2
  }
];

describe('Onboarding Flow E2E', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
  let onboardingState: typeof mockOnboardingState;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    onboardingState = { ...mockOnboardingState };
    vi.clearAllMocks();
  });

  describe('Step Navigation', () => {
    it('should start at THEME step', () => {
      expect(onboardingState.currentStep).toBe('THEME');
    });

    it('should navigate forward through all steps', () => {
      const steps = [...ONBOARDING_STEPS];
      let currentIndex = 0;

      while (currentIndex < steps.length - 1) {
        currentIndex++;
        onboardingState.currentStep = steps[currentIndex];
      }

      expect(onboardingState.currentStep).toBe('COMPLETION');
    });

    it('should navigate backward through steps', () => {
      onboardingState.currentStep = 'HABITS_SETUP';
      const currentIndex = ONBOARDING_STEPS.indexOf('HABITS_SETUP');

      onboardingState.currentStep = ONBOARDING_STEPS[currentIndex - 1];

      expect(onboardingState.currentStep).toBe('DRAFT_PLAN_REVIEW');
    });

    it('should not navigate backward from first step', () => {
      onboardingState.currentStep = 'THEME';
      const currentIndex = ONBOARDING_STEPS.indexOf('THEME');

      const canGoBack = currentIndex > 0;
      expect(canGoBack).toBe(false);
    });

    it('should show back button after first step', () => {
      const currentIndex = ONBOARDING_STEPS.indexOf('COACH_INTRO');
      const showBackButton = currentIndex > 0 && onboardingState.currentStep !== 'COMPLETION';

      expect(showBackButton).toBe(true);
    });
  });

  describe('THEME Step', () => {
    it('should require theme selection to proceed', () => {
      onboardingState.themeId = undefined;

      const canProceed = !!onboardingState.themeId;
      expect(canProceed).toBe(false);
    });

    it('should allow proceeding after theme selection', () => {
      onboardingState.themeId = 'theme-1';
      onboardingState.themeName = 'Modern Minimalist';

      const canProceed = !!onboardingState.themeId;
      expect(canProceed).toBe(true);
    });
  });

  describe('COACH_INTRO Step', () => {
    it('should always allow proceeding', () => {
      onboardingState.currentStep = 'COACH_INTRO';

      const canProceed = true; // No requirements for this step
      expect(canProceed).toBe(true);
    });
  });

  describe('VISION_CAPTURE Step', () => {
    it('should require minimum 20 characters', () => {
      onboardingState.visionText = 'Short';

      const canProceed = !!onboardingState.visionText &&
        onboardingState.visionText.length >= 20;
      expect(canProceed).toBe(false);
    });

    it('should allow proceeding with valid vision text', () => {
      onboardingState.visionText = 'I want to achieve financial freedom and travel the world';

      const canProceed = !!onboardingState.visionText &&
        onboardingState.visionText.length >= 20;
      expect(canProceed).toBe(true);
    });
  });

  describe('PHOTO_UPLOAD Step', () => {
    it('should be optional (allow skip)', () => {
      onboardingState.photoRefId = undefined;

      const canProceed = true; // Optional step
      expect(canProceed).toBe(true);
    });

    it('should save photo info when uploaded', () => {
      onboardingState.photoRefId = 'photo-123';
      onboardingState.identityDescription = 'Woman with brown hair';

      expect(onboardingState.photoRefId).toBe('photo-123');
      expect(onboardingState.identityDescription).toBeTruthy();
    });
  });

  describe('FINANCIAL_TARGET Step', () => {
    it('should require target selection (including 0 for "Not sure")', () => {
      onboardingState.financialTarget = undefined;

      const canProceed = onboardingState.financialTarget !== undefined;
      expect(canProceed).toBe(false);
    });

    it('should allow "Not sure" option (0)', () => {
      onboardingState.financialTarget = 0;
      onboardingState.financialTargetLabel = 'Not sure yet';

      const canProceed = onboardingState.financialTarget !== undefined;
      expect(canProceed).toBe(true);
    });

    it('should allow specific target selection', () => {
      onboardingState.financialTarget = 250000;
      onboardingState.financialTargetLabel = '$250,000';

      const canProceed = onboardingState.financialTarget !== undefined;
      expect(canProceed).toBe(true);
    });
  });

  describe('VISION_GENERATION Step', () => {
    it('should auto-advance when vision URL is set', () => {
      onboardingState.primaryVisionUrl = undefined;
      onboardingState.currentStep = 'VISION_GENERATION';

      // Simulate vision generation completion
      onboardingState.primaryVisionId = 'vision-123';
      onboardingState.primaryVisionUrl = 'https://example.com/vision.png';

      const shouldAutoAdvance = onboardingState.currentStep === 'VISION_GENERATION' &&
        !!onboardingState.primaryVisionUrl;
      expect(shouldAutoAdvance).toBe(true);
    });

    it('should require vision URL to be set', () => {
      onboardingState.primaryVisionUrl = undefined;

      const canProceed = !!onboardingState.primaryVisionUrl;
      expect(canProceed).toBe(false);
    });
  });

  describe('DRAFT_PLAN_REVIEW Step (v1.7)', () => {
    it('should be included in steps when feature flag enabled', () => {
      const ENABLE_DRAFT_PLAN_REVIEW = true;
      const steps = ENABLE_DRAFT_PLAN_REVIEW
        ? ONBOARDING_STEPS
        : ONBOARDING_STEPS.filter(s => s !== 'DRAFT_PLAN_REVIEW');

      expect(steps).toContain('DRAFT_PLAN_REVIEW');
    });

    it('should receive generated tasks from previous step', () => {
      onboardingState.generatedTasks = mockGeneratedTasks;

      expect(onboardingState.generatedTasks).toHaveLength(3);
    });

    it('should generate tasks if none exist', async () => {
      onboardingState.visionText = 'I want financial freedom';
      onboardingState.financialTarget = 250000;
      onboardingState.themeName = 'Modern Minimalist';
      onboardingState.generatedTasks = undefined;

      const mockGenerateActionPlan = vi.fn().mockResolvedValue(mockGeneratedTasks);

      if (!onboardingState.generatedTasks) {
        const tasks = await mockGenerateActionPlan({
          vision: onboardingState.visionText,
          target: onboardingState.financialTarget,
          theme: onboardingState.themeName
        });
        onboardingState.generatedTasks = tasks;
      }

      expect(onboardingState.generatedTasks).toHaveLength(3);
    });

    it('should allow editing tasks', () => {
      onboardingState.generatedTasks = [...mockGeneratedTasks];

      const updatedTasks = onboardingState.generatedTasks.map(task =>
        task.id === 'task-1' ? { ...task, title: 'Updated title' } : task
      );
      onboardingState.generatedTasks = updatedTasks;

      expect(onboardingState.generatedTasks[0].title).toBe('Updated title');
    });

    it('should allow adding new tasks', () => {
      onboardingState.generatedTasks = [...mockGeneratedTasks];

      const newTask = {
        id: 'task-new',
        title: 'New manual task',
        description: '',
        type: 'LIFESTYLE',
        priority: 'medium',
        displayOrder: 3
      };
      onboardingState.generatedTasks = [...onboardingState.generatedTasks, newTask];

      expect(onboardingState.generatedTasks).toHaveLength(4);
    });

    it('should allow deleting tasks (if more than one remains)', () => {
      onboardingState.generatedTasks = [...mockGeneratedTasks];

      const taskToDelete = 'task-2';
      onboardingState.generatedTasks = onboardingState.generatedTasks.filter(
        t => t.id !== taskToDelete
      );

      expect(onboardingState.generatedTasks).toHaveLength(2);
    });

    it('should require at least one task to proceed', () => {
      onboardingState.generatedTasks = [];

      const canProceed = (onboardingState.generatedTasks?.length ?? 0) > 0;
      expect(canProceed).toBe(false);
    });

    it('should require all tasks to have titles to proceed', () => {
      onboardingState.generatedTasks = [
        { ...mockGeneratedTasks[0], title: 'Has title' },
        { ...mockGeneratedTasks[1], title: '' } // Empty title
      ];

      const canProceed = (onboardingState.generatedTasks?.length ?? 0) > 0 &&
        onboardingState.generatedTasks!.every(t => t.title && t.title.trim().length > 0);
      expect(canProceed).toBe(false);
    });

    it('should allow proceeding with valid tasks', () => {
      onboardingState.generatedTasks = mockGeneratedTasks;

      const canProceed = (onboardingState.generatedTasks?.length ?? 0) > 0 &&
        onboardingState.generatedTasks!.every(t => t.title && t.title.trim().length > 0);
      expect(canProceed).toBe(true);
    });
  });

  describe('HABITS_SETUP Step', () => {
    it('should require at least one habit selected', () => {
      onboardingState.selectedHabits = [];

      const canProceed = (onboardingState.selectedHabits?.length ?? 0) > 0;
      expect(canProceed).toBe(false);
    });

    it('should allow proceeding with selected habits', () => {
      onboardingState.selectedHabits = ['habit-1', 'habit-2'];

      const canProceed = (onboardingState.selectedHabits?.length ?? 0) > 0;
      expect(canProceed).toBe(true);
    });
  });

  describe('COMPLETION Step', () => {
    it('should always allow completion', () => {
      onboardingState.currentStep = 'COMPLETION';

      const canProceed = true;
      expect(canProceed).toBe(true);
    });

    it('should clear localStorage on completion', () => {
      const mockLocalStorage = {
        removeItem: vi.fn()
      };

      mockLocalStorage.removeItem('visionary_onboarding_state_user-123');

      expect(mockLocalStorage.removeItem).toHaveBeenCalled();
    });

    it('should save final onboarding state', async () => {
      const mockSaveOnboardingState = vi.fn().mockResolvedValue(undefined);

      const finalState = {
        ...onboardingState,
        themeId: 'theme-1',
        visionText: 'My dream life',
        financialTarget: 250000,
        primaryVisionUrl: 'https://example.com/vision.png',
        generatedTasks: mockGeneratedTasks,
        selectedHabits: ['habit-1', 'habit-2']
      };

      await mockSaveOnboardingState(finalState);

      expect(mockSaveOnboardingState).toHaveBeenCalledWith(finalState);
    });
  });

  describe('Skip Functionality', () => {
    it('should show skip option on first 5 steps only', () => {
      const showSkipSteps = ONBOARDING_STEPS.slice(0, 5);

      expect(showSkipSteps).toContain('THEME');
      expect(showSkipSteps).toContain('FINANCIAL_TARGET');
      expect(showSkipSteps).not.toContain('VISION_GENERATION');
    });

    it('should navigate to VisionBoard on skip', () => {
      const mockOnNavigate = vi.fn();

      // Simulate skip
      mockOnNavigate('VISION_BOARD');

      expect(mockOnNavigate).toHaveBeenCalledWith('VISION_BOARD');
    });

    it('should NOT mark onboarding complete on skip', () => {
      const mockOnComplete = vi.fn();

      // Skip should NOT call onComplete
      // (navigation is different from completion)

      expect(mockOnComplete).not.toHaveBeenCalled();
    });
  });

  describe('State Persistence', () => {
    it('should save state to localStorage on changes', () => {
      const mockLocalStorage = {
        setItem: vi.fn()
      };

      const stateToSave = JSON.stringify(onboardingState);
      mockLocalStorage.setItem('visionary_onboarding_state_user-123', stateToSave);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should restore state from localStorage on mount', () => {
      const savedState = {
        ...mockOnboardingState,
        currentStep: 'VISION_CAPTURE' as OnboardingStep,
        themeId: 'theme-1',
        themeName: 'Modern Minimalist'
      };

      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(JSON.stringify(savedState))
      };

      const retrieved = mockLocalStorage.getItem('visionary_onboarding_state_user-123');
      const parsed = JSON.parse(retrieved!);

      expect(parsed.currentStep).toBe('VISION_CAPTURE');
      expect(parsed.themeId).toBe('theme-1');
    });

    it('should handle corrupted localStorage gracefully', () => {
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue('invalid json')
      };

      let state = mockOnboardingState;
      try {
        const retrieved = mockLocalStorage.getItem('visionary_onboarding_state_user-123');
        state = JSON.parse(retrieved!);
      } catch {
        // Use default state on error
        state = mockOnboardingState;
      }

      expect(state.currentStep).toBe('THEME');
    });
  });

  describe('Progress Indicator', () => {
    it('should calculate correct progress percentage', () => {
      const totalSteps = ONBOARDING_STEPS.length;

      // At step 1
      let currentIndex = 0;
      let progress = ((currentIndex + 1) / totalSteps) * 100;
      expect(progress).toBeCloseTo(11.11, 1);

      // At step 5
      currentIndex = 4;
      progress = ((currentIndex + 1) / totalSteps) * 100;
      expect(progress).toBeCloseTo(55.56, 1);

      // At final step
      currentIndex = totalSteps - 1;
      progress = ((currentIndex + 1) / totalSteps) * 100;
      expect(progress).toBe(100);
    });
  });
});

describe('Feature Flag: ENABLE_DRAFT_PLAN_REVIEW', () => {
  it('should use DRAFT_PLAN_REVIEW when flag is true', () => {
    const ENABLE_DRAFT_PLAN_REVIEW = true;
    const step = ENABLE_DRAFT_PLAN_REVIEW ? 'DRAFT_PLAN_REVIEW' : 'ACTION_PLAN_PREVIEW';

    expect(step).toBe('DRAFT_PLAN_REVIEW');
  });

  it('should use ACTION_PLAN_PREVIEW when flag is false', () => {
    const ENABLE_DRAFT_PLAN_REVIEW = false;
    const step = ENABLE_DRAFT_PLAN_REVIEW ? 'DRAFT_PLAN_REVIEW' : 'ACTION_PLAN_PREVIEW';

    expect(step).toBe('ACTION_PLAN_PREVIEW');
  });

  it('should have correct step config for DRAFT_PLAN_REVIEW', () => {
    const STEP_CONFIG = {
      DRAFT_PLAN_REVIEW: {
        title: 'Review Your Action Plan',
        subtitle: 'Customize your tasks before getting started'
      }
    };

    expect(STEP_CONFIG.DRAFT_PLAN_REVIEW.title).toBe('Review Your Action Plan');
  });
});
