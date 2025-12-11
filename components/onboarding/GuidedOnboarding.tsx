import React, { useState, useCallback, useEffect } from 'react';
import { OnboardingStep, OnboardingState, ActionTask, AppView } from '../../types';
import OnboardingLayout from './OnboardingLayout';
import ThemeSelectorStep from './ThemeSelectorStep';
import CoachIntroStep from './CoachIntroStep';
import VisionCaptureStep from './VisionCaptureStep';
import PhotoUploadStep from './PhotoUploadStep';
import FinancialTargetStep from './FinancialTargetStep';
import VisionGenerationStep from './VisionGenerationStep';
import ActionPlanPreviewStep from './ActionPlanPreviewStep';
import HabitsSetupStep from './HabitsSetupStep';
// PrintOfferStep removed - users can access print from Dashboard
import CompletionStep from './CompletionStep';

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

const STEPS: OnboardingStep[] = [
  'THEME',
  'COACH_INTRO',
  'VISION_CAPTURE',
  'PHOTO_UPLOAD',
  'FINANCIAL_TARGET',
  'VISION_GENERATION',
  'ACTION_PLAN_PREVIEW',
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

  const updateState = useCallback((updates: Partial<OnboardingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const goToStep = useCallback((step: OnboardingStep) => {
    setState(prev => ({ ...prev, currentStep: step }));
  }, []);

  const goNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      goToStep(STEPS[nextIndex]);
    }
  }, [currentStepIndex, goToStep]);

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

      case 'HABITS_SETUP':
        return (
          <HabitsSetupStep
            themeId={state.themeId}
            selectedHabits={state.selectedHabits || []}
            onHabitsChange={(habits) => updateState({ selectedHabits: habits })}
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

  return (
    <OnboardingLayout
      currentStep={currentStepIndex + 1}
      totalSteps={STEPS.length}
      title={stepConfig.title}
      subtitle={stepConfig.subtitle}
      onBack={showBackButton ? goBack : undefined}
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
