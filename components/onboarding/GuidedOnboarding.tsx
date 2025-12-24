import React, { useState, useCallback, useEffect, useRef } from 'react';
import { OnboardingStep, OnboardingState, ActionTask, AppView, MasterPromptResponse } from '../../types';
import OnboardingLayout from './OnboardingLayout';
import ThemeSelectorStep from './ThemeSelectorStep';
import CoachIntroStep from './CoachIntroStep';
import MasterPromptQnA from '../MasterPromptQnA';
import VisionCaptureStep from './VisionCaptureStep';
import PhotoUploadStep from './PhotoUploadStep';
import FinancialTargetStep from './FinancialTargetStep';
import VisionGenerationStep from './VisionGenerationStep';
import ActionPlanPreviewStep from './ActionPlanPreviewStep';
import DraftPlanReviewStep from './DraftPlanReviewStep';
import HabitsSetupStep from './HabitsSetupStep';
// PrintOfferStep removed - users can access print from Dashboard
import CompletionStep from './CompletionStep';

// Feature flag for draft plan review (v1.7)
const ENABLE_DRAFT_PLAN_REVIEW = true;

// Feature flag for background vision generation (v1.8 WOW optimization)
const ENABLE_BACKGROUND_GENERATION = true;

interface Props {
  userId: string;
  onComplete: (state: OnboardingState) => void;
  onNavigate: (view: AppView) => void;
  // AI Functions
  generateVisionImage: (prompt: string, photoRef?: string, onStatusChange?: (status: string) => void) => Promise<{ id: string; url: string }>;
  generateActionPlan: (context: { vision: string; target?: number; theme?: string }) => Promise<ActionTask[]>;
  // Storage Functions
  uploadPhoto: (file: File) => Promise<string>;
  // Persistence
  saveOnboardingState: (state: Partial<OnboardingState>) => Promise<void>;
}

// Steps array - use DRAFT_PLAN_REVIEW when feature flag is enabled
const STEPS: OnboardingStep[] = [
  'THEME',
  'COACH_INTRO',
  'MASTER_PROMPT_QNA',
  'VISION_CAPTURE',
  'PHOTO_UPLOAD',
  'FINANCIAL_TARGET',
  'VISION_GENERATION',
  ENABLE_DRAFT_PLAN_REVIEW ? 'DRAFT_PLAN_REVIEW' : 'ACTION_PLAN_PREVIEW',
  'HABITS_SETUP',
  // 'PRINT_OFFER', // Removed - users can access print from Dashboard
  'COMPLETION'
];

const STEP_CONFIG: Record<OnboardingStep, { title: string; subtitle: string }> = {
  THEME: {
    title: 'Choose Your Coaching Style',
    subtitle: 'Select the approach that resonates with your values'
  },
  COACH_INTRO: {
    title: 'Meet Your Coach',
    subtitle: 'Your personalized guide for this journey'
  },
  MASTER_PROMPT_QNA: {
    title: 'Tell Us About Yourself',
    subtitle: 'Help us personalize your coaching experience'
  },
  VISION_CAPTURE: {
    title: 'Capture Your Vision',
    subtitle: 'Describe your ideal future in your own words'
  },
  PHOTO_UPLOAD: {
    title: 'Add a Reference Photo',
    subtitle: 'Optional: Include yourself in your vision'
  },
  FINANCIAL_TARGET: {
    title: 'Set Your Financial Goal',
    subtitle: 'What are you working toward?'
  },
  VISION_GENERATION: {
    title: 'Creating Your Vision',
    subtitle: 'Our AI is bringing your dream to life'
  },
  ACTION_PLAN_PREVIEW: {
    title: 'Your Action Plan',
    subtitle: 'Personalized steps to achieve your vision'
  },
  DRAFT_PLAN_REVIEW: {
    title: 'Review Your Action Plan',
    subtitle: 'Customize your tasks before getting started'
  },
  HABITS_SETUP: {
    title: 'Daily Habits',
    subtitle: 'Build the routines that support your goals'
  },
  PRINT_OFFER: {
    title: 'Make It Real',
    subtitle: 'Print your vision and keep it visible'
  },
  COMPLETION: {
    title: 'Welcome to Visionary!',
    subtitle: 'Your journey starts now'
  }
};

const STORAGE_KEY = 'visionary_onboarding_state';

const GuidedOnboarding: React.FC<Props> = ({
  userId,
  onComplete,
  onNavigate,
  generateVisionImage,
  generateActionPlan,
  uploadPhoto,
  saveOnboardingState
}) => {
  // Load saved state from localStorage on mount
  const getInitialState = (): OnboardingState => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate it has the required structure
        if (parsed.currentStep && STEPS.includes(parsed.currentStep)) {
          return {
            ...parsed,
            selectedHabits: parsed.selectedHabits || []
          };
        }
      }
    } catch (e) {
      console.error('Error loading saved onboarding state:', e);
    }
    return {
      currentStep: 'THEME',
      selectedHabits: []
    };
  };

  const [state, setState] = useState<OnboardingState>(getInitialState);

  // Ref to track pending vision generation promise (not serializable, so use ref)
  const pendingVisionPromiseRef = useRef<Promise<{ id: string; url: string }> | null>(null);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(state));
    } catch (e) {
      console.error('Error saving onboarding state:', e);
    }
  }, [state, userId]);

  const currentStepIndex = STEPS.indexOf(state.currentStep);
  const stepConfig = STEP_CONFIG[state.currentStep];

  // Calculate effective steps for display (excludes skipped steps like VISION_GENERATION)
  const effectiveSteps = ENABLE_BACKGROUND_GENERATION
    ? STEPS.filter(step => step !== 'VISION_GENERATION')
    : STEPS;

  // Calculate effective step number for progress display
  const effectiveStepIndex = effectiveSteps.indexOf(state.currentStep);
  const displayStepNumber = effectiveStepIndex >= 0 ? effectiveStepIndex + 1 : currentStepIndex + 1;
  const displayTotalSteps = effectiveSteps.length;

  const updateState = useCallback((updates: Partial<OnboardingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const goToStep = useCallback((step: OnboardingStep) => {
    setState(prev => ({ ...prev, currentStep: step }));
  }, []);

  // Trigger background vision generation
  const triggerBackgroundGeneration = useCallback(() => {
    if (!state.visionText) {
      console.warn('Cannot trigger background generation: no vision text');
      return;
    }

    console.log('🚀 Triggering background vision generation...');
    updateState({ visionGenerationStatus: 'pending' });

    // Start generation in background
    const generationPromise = generateVisionImage(
      state.visionText,
      state.photoRefId,
      (status) => console.log('Vision generation status:', status)
    );

    // Store promise ref
    pendingVisionPromiseRef.current = generationPromise;

    // Handle resolution in background
    generationPromise
      .then((result) => {
        console.log('✅ Background vision generation complete:', result.id);
        updateState({
          primaryVisionId: result.id,
          primaryVisionUrl: result.url,
          visionGenerationStatus: 'complete'
        });
      })
      .catch((err) => {
        console.error('❌ Background vision generation failed:', err);
        updateState({
          visionGenerationStatus: 'error',
          visionGenerationError: err.message || 'Generation failed'
        });
      });
  }, [state.visionText, state.photoRefId, generateVisionImage, updateState]);

  const goNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      let targetStep = STEPS[nextIndex];

      // WOW Optimization: Trigger background generation after PHOTO_UPLOAD
      if (ENABLE_BACKGROUND_GENERATION && state.currentStep === 'PHOTO_UPLOAD') {
        triggerBackgroundGeneration();
      }

      // WOW Optimization: Skip VISION_GENERATION step if background generation is enabled
      if (ENABLE_BACKGROUND_GENERATION && targetStep === 'VISION_GENERATION') {
        // Skip to next step (DRAFT_PLAN_REVIEW or ACTION_PLAN_PREVIEW)
        const skipIndex = nextIndex + 1;
        if (skipIndex < STEPS.length) {
          targetStep = STEPS[skipIndex];
        }
      }

      goToStep(targetStep);
    }
  }, [currentStepIndex, goToStep, state.currentStep, triggerBackgroundGeneration]);

  const goBack = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      goToStep(STEPS[prevIndex]);
    }
  }, [currentStepIndex, goToStep]);

  const canProceed = useCallback(() => {
    switch (state.currentStep) {
      case 'THEME':
        return !!state.themeId;
      case 'COACH_INTRO':
        return true;
      case 'MASTER_PROMPT_QNA':
        // Q&A step auto-advances via onComplete callback
        return true;
      case 'VISION_CAPTURE':
        return !!state.visionText && state.visionText.length >= 20;
      case 'PHOTO_UPLOAD':
        return true; // Optional step
      case 'FINANCIAL_TARGET':
        // Allow proceeding if a target is selected (including 0 for "Not sure")
        return state.financialTarget !== undefined;
      case 'VISION_GENERATION':
        return !!state.primaryVisionUrl;
      case 'ACTION_PLAN_PREVIEW':
        return (state.generatedTasks?.length ?? 0) > 0;
      case 'DRAFT_PLAN_REVIEW':
        // Require at least one task with a title
        return (state.generatedTasks?.length ?? 0) > 0 &&
          state.generatedTasks!.every(t => t.title && t.title.trim().length > 0);
      case 'HABITS_SETUP':
        return (state.selectedHabits?.length ?? 0) > 0;
      case 'COMPLETION':
        return true;
      default:
        return false;
    }
  }, [state]);

  const handleComplete = useCallback(async () => {
    // Clear localStorage after completion
    try {
      localStorage.removeItem(`${STORAGE_KEY}_${userId}`);
    } catch (e) {
      console.error('Error clearing onboarding state:', e);
    }
    await saveOnboardingState(state);
    onComplete(state);
  }, [state, saveOnboardingState, onComplete, userId]);

  // Auto-advance from VISION_GENERATION when primaryVisionUrl is available
  useEffect(() => {
    if (state.currentStep === 'VISION_GENERATION' && state.primaryVisionUrl) {
      console.log('🚀 Auto-advancing from VISION_GENERATION step');
      // Small delay to allow UI to settle
      const timer = setTimeout(() => {
        goNext();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [state.currentStep, state.primaryVisionUrl, goNext]);

  const renderStep = () => {
    switch (state.currentStep) {
      case 'THEME':
        return (
          <ThemeSelectorStep
            selectedTheme={state.themeId}
            onSelectTheme={(themeId, themeName) => {
              updateState({ themeId, themeName });
            }}
          />
        );

      case 'COACH_INTRO':
        return (
          <CoachIntroStep
            themeId={state.themeId}
            themeName={state.themeName}
            motivationStyle={state.motivationStyle}
          />
        );

      case 'MASTER_PROMPT_QNA':
        return (
          <MasterPromptQnA
            themeId={state.themeId || ''}
            themeName={state.themeName}
            onComplete={(responses: MasterPromptResponse[]) => {
              updateState({ masterPromptResponses: responses });
              goNext();
            }}
            onSkip={goNext}
            onBack={goBack}
          />
        );

      case 'VISION_CAPTURE':
        return (
          <VisionCaptureStep
            visionText={state.visionText}
            onVisionChange={(text) => updateState({ visionText: text })}
          />
        );

      case 'PHOTO_UPLOAD':
        return (
          <PhotoUploadStep
            photoRefId={state.photoRefId}
            onPhotoUploaded={(photoId, url, identityDescription) => {
              updateState({ photoRefId: photoId, identityDescription });
            }}
            onSkip={goNext}
          />
        );

      case 'FINANCIAL_TARGET':
        return (
          <FinancialTargetStep
            selectedTarget={state.financialTarget}
            onSelectTarget={(target, label) => {
              updateState({ financialTarget: target, financialTargetLabel: label });
            }}
          />
        );

      case 'VISION_GENERATION':
        return (
          <VisionGenerationStep
            visionText={state.visionText || ''}
            photoRefId={state.photoRefId}
            themeName={state.themeName}
            onVisionGenerated={(id, url) => {
              updateState({ primaryVisionId: id, primaryVisionUrl: url });
            }}
            generateVision={async (prompt, photoRef, onStatusChange) => {
              const result = await generateVisionImage(prompt, photoRef, onStatusChange);
              return result;
            }}
          />
        );

      case 'ACTION_PLAN_PREVIEW':
        return (
          <ActionPlanPreviewStep
            visionText={state.visionText || ''}
            financialTarget={state.financialTarget}
            themeName={state.themeName}
            onTasksGenerated={(tasks) => updateState({ generatedTasks: tasks })}
            generateActionPlan={generateActionPlan}
          />
        );

      case 'DRAFT_PLAN_REVIEW':
        return (
          <DraftPlanReviewStep
            visionText={state.visionText || ''}
            financialTarget={state.financialTarget}
            themeName={state.themeName}
            existingTasks={state.generatedTasks}
            onTasksChanged={(tasks) => updateState({ generatedTasks: tasks })}
            generateActionPlan={generateActionPlan}
          />
        );

      case 'HABITS_SETUP':
        return (
          <HabitsSetupStep
            themeId={state.themeId}
            selectedHabits={state.selectedHabits || []}
            onHabitsChange={(habits) => updateState({ selectedHabits: habits })}
            // WOW Optimization: Micro-contract props
            userId={userId}
            onReminderScheduled={(reminderId) => updateState({ scheduledReminderId: reminderId })}
          />
        );

      case 'COMPLETION':
        return (
          <CompletionStep
            themeName={state.themeName}
            visionImageUrl={state.primaryVisionUrl}
            tasksCount={state.generatedTasks?.length ?? 0}
            habitsCount={state.selectedHabits?.length ?? 0}
            onComplete={handleComplete}
            // WOW Optimization: Pass generation status for fallback loading
            visionGenerationStatus={state.visionGenerationStatus}
            pendingVisionPromise={pendingVisionPromiseRef.current}
          />
        );

      default:
        return null;
    }
  };

  // Determine if we should show navigation buttons
  const showBackButton = currentStepIndex > 0 && state.currentStep !== 'COMPLETION';
  const showNextButton = state.currentStep !== 'VISION_GENERATION' &&
    state.currentStep !== 'COMPLETION';

  // Handler for skip - navigate to VisionBoard WITHOUT marking onboarding complete
  const handleSkip = () => {
    onNavigate(AppView.VISION_BOARD);
  };

  // Only show skip option on the first 5 steps (before AI generation)
  const showSkipOption = currentStepIndex < 5 && state.currentStep !== 'COMPLETION';

  return (
    <OnboardingLayout
      step={displayStepNumber}
      totalSteps={displayTotalSteps}
      title={stepConfig.title}
      subtitle={stepConfig.subtitle}
      showBack={showBackButton}
      onBack={goBack}
      onSkip={showSkipOption ? handleSkip : undefined}
    >
      {renderStep()}

      {/* Navigation Buttons */}
      {showNextButton && (
        <div className="mt-8 flex justify-end">
          <button
            onClick={goNext}
            disabled={!canProceed()}
            className={`px-8 py-3 rounded-xl font-semibold transition-all ${canProceed()
              ? 'bg-navy-900 text-white hover:bg-navy-800 shadow-lg hover:shadow-xl'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
          >
            {state.currentStep === 'PHOTO_UPLOAD' && !state.photoRefId ? 'Skip' : 'Continue'}
          </button>
        </div>
      )}
    </OnboardingLayout>
  );
};

export default GuidedOnboarding;
