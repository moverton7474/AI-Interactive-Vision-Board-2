import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface AgentOnboardingProps {
  userId: string;
  onComplete?: () => void;
  onSkip?: () => void;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  features: string[];
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to AI Coach',
    description: 'Your intelligent assistant for achieving your goals and building better habits.',
    icon: 'sparkles',
    features: [
      'Get personalized action suggestions based on your goals',
      'Receive timely reminders and encouragement',
      'Track your progress with intelligent insights'
    ]
  },
  {
    id: 'actions',
    title: 'Smart Action Suggestions',
    description: 'The AI Coach analyzes your goals and habits to suggest helpful actions.',
    icon: 'lightning',
    features: [
      'Suggestions appear based on your schedule and preferences',
      'Each action is rated by risk level and confidence',
      'You control which actions are approved or auto-executed'
    ]
  },
  {
    id: 'approval',
    title: 'Action Approval System',
    description: 'Stay in control with our approval-based execution system.',
    icon: 'shield',
    features: [
      'Low-risk actions can be auto-approved (optional)',
      'Medium and high-risk actions require your approval',
      'Review, edit, or reject any suggested action'
    ]
  },
  {
    id: 'calendar',
    title: 'Calendar Integration',
    description: 'Connect your Google Calendar for smarter scheduling.',
    icon: 'calendar',
    features: [
      'AI considers your availability when suggesting times',
      'Create calendar events directly from suggestions',
      'Never double-book with smart conflict detection'
    ]
  },
  {
    id: 'feedback',
    title: 'Help AI Learn',
    description: 'Your feedback makes the AI Coach smarter over time.',
    icon: 'chat',
    features: [
      'Rate actions with thumbs up/down for quick feedback',
      'Provide detailed feedback for nuanced improvements',
      'The more feedback, the better your suggestions become'
    ]
  }
];

const AgentOnboarding: React.FC<AgentOnboardingProps> = ({
  userId,
  onComplete,
  onSkip
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkOnboardingStatus();
  }, [userId]);

  const checkOnboardingStatus = async () => {
    try {
      const { data } = await supabase
        .from('user_preferences')
        .select('agent_onboarding_completed')
        .eq('user_id', userId)
        .single();

      if (data?.agent_onboarding_completed) {
        setHasSeenOnboarding(true);
        onComplete?.();
      }
    } catch (err) {
      // User hasn't seen onboarding
    } finally {
      setLoading(false);
    }
  };

  const markComplete = async () => {
    try {
      await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          agent_onboarding_completed: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      setHasSeenOnboarding(true);
      onComplete?.();
    } catch (err) {
      console.error('Error marking onboarding complete:', err);
    }
  };

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      markComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    markComplete();
    onSkip?.();
  };

  const renderIcon = (icon: string) => {
    switch (icon) {
      case 'sparkles':
        return (
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        );
      case 'lightning':
        return (
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'shield':
        return (
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case 'calendar':
        return (
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'chat':
        return (
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return null;
  }

  if (hasSeenOnboarding) {
    return null;
  }

  const step = ONBOARDING_STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-lg w-full overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1 bg-slate-700">
          <div
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-amber-400">
              {renderIcon(step.icon)}
            </div>
          </div>

          {/* Title & Description */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">
              {step.title}
            </h2>
            <p className="text-slate-400">
              {step.description}
            </p>
          </div>

          {/* Features */}
          <div className="space-y-3 mb-8">
            {step.features.map((feature, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg"
              >
                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-slate-300">{feature}</p>
              </div>
            ))}
          </div>

          {/* Step Indicators */}
          <div className="flex justify-center gap-2 mb-6">
            {ONBOARDING_STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentStep
                    ? 'w-6 bg-amber-500'
                    : idx < currentStep
                    ? 'bg-amber-500/50'
                    : 'bg-slate-600'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <button
              onClick={handleSkip}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Skip intro
            </button>

            <div className="flex gap-3">
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {currentStep === ONBOARDING_STEPS.length - 1 ? (
                  'Get Started'
                ) : (
                  <>
                    Next
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentOnboarding;
