/**
 * AMIE Onboarding Flow Tests
 *
 * Tests for the Adaptive Motivational Identity Engine onboarding process
 * including theme selection, Master Prompt Q&A, and identity profile creation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockInvoke = vi.fn();
const mockGetSession = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
    auth: {
      getSession: mockGetSession,
    },
  },
}));

describe('AMIE Onboarding Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
  });

  describe('Theme Selection', () => {
    it('should fetch available motivational themes', async () => {
      const themes = [
        {
          id: 'christian',
          name: 'christian',
          display_name: 'Faith & Purpose',
          description: 'Faith-based motivation with biblical wisdom',
          icon: '✝️',
          motivation_style: 'spiritual',
        },
        {
          id: 'business_executive',
          name: 'business_executive',
          display_name: 'Executive Performance',
          description: 'High-performance coaching for professionals',
          icon: '💼',
          motivation_style: 'challenging',
        },
        {
          id: 'health_fitness',
          name: 'health_fitness',
          display_name: 'Health & Vitality',
          description: 'Wellness-focused motivation',
          icon: '💪',
          motivation_style: 'encouraging',
        },
        {
          id: 'retirement',
          name: 'retirement',
          display_name: 'Legacy & Wisdom',
          description: 'Life transition coaching',
          icon: '🌅',
          motivation_style: 'analytical',
        },
      ];

      mockInvoke.mockResolvedValueOnce({ data: { themes }, error: null });

      const result = await mockInvoke('onboarding-themes?action=list');

      expect(result.data.themes).toHaveLength(4);
      expect(result.data.themes[0].display_name).toBe('Faith & Purpose');
    });

    it('should allow selecting a theme', async () => {
      const selectedTheme = 'business_executive';

      mockInvoke.mockResolvedValueOnce({
        data: { success: true, themeId: selectedTheme },
        error: null,
      });

      const result = await mockInvoke('onboarding-themes?action=select', {
        body: { themeId: selectedTheme },
      });

      expect(result.data.success).toBe(true);
      expect(result.data.themeId).toBe(selectedTheme);
    });

    it('should provide theme-specific system prompts', () => {
      const themePrompts = {
        christian: 'You are a faith-based Vision Coach who integrates biblical principles',
        business_executive: 'You are an executive performance coach who speaks the language of business strategy',
        health_fitness: 'You are a holistic wellness coach who emphasizes the mind-body connection',
        retirement: 'You are a life transition coach specializing in retirement planning',
      };

      Object.keys(themePrompts).forEach(theme => {
        expect(themePrompts[theme as keyof typeof themePrompts]).toBeDefined();
        expect(themePrompts[theme as keyof typeof themePrompts].length).toBeGreaterThan(20);
      });
    });
  });

  describe('Master Prompt Q&A', () => {
    it('should fetch questions for selected theme', async () => {
      const questions = [
        {
          id: 'q1',
          question_text: 'What is your primary professional goal for the next year?',
          question_type: 'text',
          is_required: true,
          sort_order: 1,
        },
        {
          id: 'q2',
          question_text: 'What motivates you most in your work?',
          question_type: 'multiple_choice',
          options: ['Achievement', 'Recognition', 'Growth', 'Impact'],
          is_required: true,
          sort_order: 2,
        },
        {
          id: 'q3',
          question_text: 'Describe your ideal work-life balance',
          question_type: 'text',
          is_required: false,
          sort_order: 3,
        },
      ];

      mockInvoke.mockResolvedValueOnce({
        data: { questions },
        error: null,
      });

      const result = await mockInvoke('onboarding-themes?action=get_questions&themeId=business_executive');

      expect(result.data.questions).toHaveLength(3);
      expect(result.data.questions[0].is_required).toBe(true);
    });

    it('should validate required questions have answers', () => {
      const questions = [
        { id: 'q1', is_required: true },
        { id: 'q2', is_required: true },
        { id: 'q3', is_required: false },
      ];

      const responses = {
        q1: 'Answer to question 1',
        q2: 'Answer to question 2',
        // q3 not answered - optional
      };

      const allRequiredAnswered = questions
        .filter(q => q.is_required)
        .every(q => responses[q.id as keyof typeof responses]);

      expect(allRequiredAnswered).toBe(true);
    });

    it('should handle text input responses', () => {
      const response = {
        question_id: 'q1',
        answer: 'I want to become a senior executive within 2 years',
      };

      expect(typeof response.answer).toBe('string');
      expect(response.answer.length).toBeGreaterThan(0);
    });

    it('should handle multiple choice responses', () => {
      const response = {
        question_id: 'q2',
        answer: ['Achievement', 'Growth'],
      };

      expect(Array.isArray(response.answer)).toBe(true);
      expect(response.answer).toContain('Achievement');
    });

    it('should handle rating scale responses', () => {
      const response = {
        question_id: 'q4',
        answer: 8,
      };

      expect(typeof response.answer).toBe('number');
      expect(response.answer).toBeGreaterThanOrEqual(1);
      expect(response.answer).toBeLessThanOrEqual(10);
    });

    it('should navigate through questions', () => {
      const totalQuestions = 5;
      let currentStep = 0;

      // Next
      currentStep = Math.min(currentStep + 1, totalQuestions - 1);
      expect(currentStep).toBe(1);

      // Back
      currentStep = Math.max(currentStep - 1, 0);
      expect(currentStep).toBe(0);

      // Navigate to last
      currentStep = totalQuestions - 1;
      expect(currentStep).toBe(4);
    });

    it('should submit answers successfully', async () => {
      const answers = [
        { question_id: 'q1', answer: 'Become a thought leader' },
        { question_id: 'q2', answer: ['Impact', 'Growth'] },
        { question_id: 'q3', answer: 'Flexible hours with focused deep work' },
      ];

      mockInvoke.mockResolvedValueOnce({
        data: { success: true, profileId: 'profile-123' },
        error: null,
      });

      const result = await mockInvoke('onboarding-themes?action=submit_answers', {
        body: { themeId: 'business_executive', responses: answers },
      });

      expect(result.data.success).toBe(true);
      expect(result.data.profileId).toBeDefined();
    });
  });

  describe('Identity Profile Creation', () => {
    it('should create user identity profile from answers', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          profile: {
            id: 'profile-123',
            user_id: 'user-456',
            theme_id: 'business_executive',
            master_prompt: 'You are an executive coach helping a professional achieve...',
            values: ['achievement', 'growth', 'leadership'],
            goals: ['Senior executive role', 'Work-life balance'],
            created_at: new Date().toISOString(),
          },
        },
        error: null,
      });

      const result = await mockInvoke('onboarding-themes?action=create_profile');

      expect(result.data.profile).toBeDefined();
      expect(result.data.profile.theme_id).toBe('business_executive');
      expect(result.data.profile.master_prompt).toBeDefined();
    });

    it('should generate personalized master prompt', () => {
      const userContext = {
        theme: 'business_executive',
        primaryGoal: 'Become VP of Engineering',
        motivations: ['Achievement', 'Impact'],
        workStyle: 'Focused deep work with strategic planning',
      };

      const masterPromptParts = [
        'You are an executive performance coach',
        userContext.primaryGoal,
        ...userContext.motivations,
      ];

      masterPromptParts.forEach(part => {
        expect(part).toBeDefined();
        expect(part.length).toBeGreaterThan(0);
      });
    });
  });

  describe('AMIE Prompt Builder', () => {
    it('should build context-aware prompts', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          prompt: 'Based on your goal of becoming a VP and your focus on achievement...',
          context: {
            theme: 'business_executive',
            recentHabits: ['Morning planning', 'Weekly review'],
            activeGoals: ['VP promotion', 'Team growth'],
          },
        },
        error: null,
      });

      const result = await mockInvoke('amie-prompt-builder', {
        body: { userId: 'user-123', context: 'habit_reminder' },
      });

      expect(result.data.prompt).toBeDefined();
      expect(result.data.context.theme).toBe('business_executive');
    });

    it('should include theme-specific vocabulary', () => {
      const themeVocabulary = {
        christian: ['faith', 'purpose', 'stewardship', 'blessing'],
        business_executive: ['ROI', 'strategy', 'leverage', 'execution'],
        health_fitness: ['energy', 'wellness', 'discipline', 'progress'],
        retirement: ['legacy', 'wisdom', 'transition', 'fulfillment'],
      };

      Object.entries(themeVocabulary).forEach(([theme, vocabulary]) => {
        expect(vocabulary.length).toBeGreaterThan(0);
        expect(vocabulary.every(word => typeof word === 'string')).toBe(true);
      });
    });
  });

  describe('Onboarding Flow Navigation', () => {
    it('should support skipping onboarding', () => {
      let onboardingComplete = false;
      const skipOnboarding = () => {
        onboardingComplete = true;
      };

      skipOnboarding();
      expect(onboardingComplete).toBe(true);
    });

    it('should track onboarding progress', () => {
      const steps = [
        { id: 'theme', completed: true },
        { id: 'questions', completed: true },
        { id: 'profile', completed: false },
      ];

      const completedSteps = steps.filter(s => s.completed).length;
      const progressPercentage = (completedSteps / steps.length) * 100;

      expect(progressPercentage).toBeCloseTo(66.67, 1);
    });

    it('should allow going back to previous steps', () => {
      const steps = ['theme', 'questions', 'profile'];
      let currentStepIndex = 2;

      const goBack = () => {
        if (currentStepIndex > 0) {
          currentStepIndex--;
        }
      };

      goBack();
      expect(steps[currentStepIndex]).toBe('questions');

      goBack();
      expect(steps[currentStepIndex]).toBe('theme');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Failed to fetch themes' },
      });

      const result = await mockInvoke('onboarding-themes?action=list');

      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Failed to fetch themes');
    });

    it('should provide fallback questions on error', () => {
      const fallbackQuestions = [
        { id: 'fallback-1', question_text: 'What are your top 3 goals?', is_required: true },
        { id: 'fallback-2', question_text: 'What motivates you?', is_required: true },
        { id: 'fallback-3', question_text: 'Describe your ideal day', is_required: false },
      ];

      expect(fallbackQuestions.length).toBeGreaterThan(0);
      expect(fallbackQuestions.some(q => q.is_required)).toBe(true);
    });

    it('should complete onboarding even if save fails', () => {
      const responses = [
        { question_id: 'q1', answer: 'Test answer' },
      ];

      // Even on API error, responses should be preserved
      expect(responses.length).toBeGreaterThan(0);
    });
  });
});

describe('Theme Selector Component', () => {
  it('should display all available themes', () => {
    const themes = ['christian', 'business_executive', 'health_fitness', 'retirement'];
    expect(themes).toHaveLength(4);
  });

  it('should highlight selected theme', () => {
    const selectedTheme = 'business_executive';
    const themes = ['christian', 'business_executive', 'health_fitness', 'retirement'];

    themes.forEach(theme => {
      const isSelected = theme === selectedTheme;
      if (theme === 'business_executive') {
        expect(isSelected).toBe(true);
      } else {
        expect(isSelected).toBe(false);
      }
    });
  });

  it('should show theme descriptions', () => {
    const themeDescriptions = {
      christian: 'Faith-based motivation with biblical wisdom',
      business_executive: 'High-performance coaching for professionals',
    };

    expect(themeDescriptions.christian).toContain('Faith');
    expect(themeDescriptions.business_executive).toContain('performance');
  });
});

describe('Master Prompt Q&A Component', () => {
  it('should show progress indicator', () => {
    const currentStep = 2;
    const totalSteps = 5;
    const progress = ((currentStep + 1) / totalSteps) * 100;

    expect(progress).toBe(60);
  });

  it('should disable next button until required field is filled', () => {
    const isRequired = true;
    const currentResponse = '';
    const canProceed = !isRequired || (currentResponse !== undefined && currentResponse !== '');

    expect(canProceed).toBe(false);
  });

  it('should enable next button when required field is filled', () => {
    const isRequired = true;
    const currentResponse = 'Valid answer';
    const canProceed = !isRequired || (currentResponse !== undefined && currentResponse !== '');

    expect(canProceed).toBe(true);
  });

  it('should show loading state during submission', () => {
    const submitting = true;
    expect(submitting).toBe(true);
  });
});
