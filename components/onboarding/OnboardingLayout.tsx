import React from 'react';

interface Props {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  onSkip?: () => void;
}

const OnboardingLayout: React.FC<Props> = ({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  showBack = false,
  onBack,
  onSkip
}) => {
  const progress = (step / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-white to-gold-50 relative">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-50">
        <div
          className="h-full bg-gradient-to-r from-navy-900 to-gold-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Skip Link - Always visible in top right */}
      {onSkip && (
        <button
          onClick={onSkip}
          className="fixed top-4 right-4 text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 z-50"
        >
          Skip for now
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Header */}
      <div className="pt-8 pb-4 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            {showBack && onBack ? (
              <button
                onClick={onBack}
                className="text-gray-500 hover:text-navy-900 text-sm font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            ) : (
              <div />
            )}
            <span className="text-xs text-gray-400 font-medium">
              Step {step} of {totalSteps}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-12">
        <div className="max-w-2xl mx-auto">
          {/* Title Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-navy-900 mb-2">
              {title}
            </h1>
            {subtitle && (
              <p className="text-gray-500 text-lg">{subtitle}</p>
            )}
          </div>

          {/* Step Content */}
          <div className="animate-fade-in">
            {children}
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="fixed bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-gold-100/30 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-20 right-0 w-96 h-96 bg-gradient-to-bl from-navy-100/20 to-transparent rounded-full blur-3xl pointer-events-none" />
    </div>
  );
};

export default OnboardingLayout;
