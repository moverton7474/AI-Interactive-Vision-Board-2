import React, { useState, useEffect } from 'react';
import { MasterPromptQuestion, MasterPromptResponse } from '../types';
import { supabase } from '../lib/supabase';
import { SparklesIcon } from './Icons';

interface Props {
  themeId: string;
  themeName?: string;
  onComplete: (responses: MasterPromptResponse[]) => void;
  onSkip: () => void;
  onBack?: () => void;
}

/**
 * MasterPromptQnA - Identity Questionnaire Component
 *
 * Multi-step wizard that collects user responses to build their
 * personalized AMIE identity profile.
 */
const MasterPromptQnA: React.FC<Props> = ({
  themeId,
  themeName,
  onComplete,
  onSkip,
  onBack,
}) => {
  const [questions, setQuestions] = useState<MasterPromptQuestion[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuestions();
  }, [themeId]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await supabase.functions.invoke(
        `onboarding-themes?action=get_questions&themeId=${themeId}`,
        { method: 'GET' }
      );

      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch questions');
      }

      if (response.data?.questions) {
        setQuestions(response.data.questions);
      } else {
        // Fallback questions if API fails
        setQuestions(FALLBACK_QUESTIONS);
      }
    } catch (err: any) {
      console.error('Error fetching questions:', err);
      setError(err.message || 'Failed to load questions');
      setQuestions(FALLBACK_QUESTIONS);
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = (questionId: string, answer: string | string[]) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    } else if (onBack) {
      onBack();
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      // Build response array
      const formattedResponses: MasterPromptResponse[] = questions.map((q) => ({
        question_id: q.id,
        question_text: q.question_text,
        answer: responses[q.id] || '',
      }));

      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Submit to backend
        const response = await supabase.functions.invoke(
          'onboarding-themes?action=submit_answers',
          {
            body: {
              themeId,
              responses: formattedResponses,
            },
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (response.error) {
          console.error('Error submitting answers:', response.error);
          // Continue anyway
        }
      }

      onComplete(formattedResponses);
    } catch (err: any) {
      console.error('Error submitting answers:', err);
      // Still complete even if save fails
      const formattedResponses: MasterPromptResponse[] = questions.map((q) => ({
        question_id: q.id,
        question_text: q.question_text,
        answer: responses[q.id] || '',
      }));
      onComplete(formattedResponses);
    } finally {
      setSubmitting(false);
    }
  };

  const currentQuestion = questions[currentStep];
  const currentResponse = currentQuestion ? responses[currentQuestion.id] : undefined;
  const isLastQuestion = currentStep === questions.length - 1;
  const canProceed = currentQuestion?.is_required
    ? currentResponse !== undefined && currentResponse !== ''
    : true;

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500">Loading your personalized questions...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
        <p className="text-gray-500 mb-4">No questions available for this theme.</p>
        <button
          onClick={onSkip}
          className="text-navy-900 font-bold underline hover:text-gold-600"
        >
          Continue to Vision Board
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-gold-100 text-gold-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <SparklesIcon className="w-4 h-4" />
            Building Your Identity
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-navy-900 mb-2">
            Tell us about yourself
          </h1>
          <p className="text-gray-500">
            Your answers help personalize your AI coaching experience
            {themeName && <span className="text-navy-900 font-medium"> ({themeName})</span>}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Question {currentStep + 1} of {questions.length}</span>
            <span>{Math.round(((currentStep + 1) / questions.length) * 100)}% complete</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-navy-900 to-gold-500 transition-all duration-300"
              style={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <h2 className="text-xl font-bold text-navy-900 mb-6">
            {currentQuestion.question_text}
            {currentQuestion.is_required && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </h2>

          {/* Question Input */}
          <div className="space-y-3">
            {renderQuestionInput(
              currentQuestion,
              currentResponse,
              handleResponse
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={handleBack}
            className="text-gray-500 hover:text-navy-900 font-medium transition-colors"
          >
            ← {currentStep === 0 ? 'Back to Themes' : 'Previous'}
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={onSkip}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              Skip questions
            </button>

            <button
              onClick={handleNext}
              disabled={!canProceed || submitting}
              className={`px-8 py-3 rounded-full font-bold transition-all ${
                canProceed && !submitting
                  ? 'bg-navy-900 text-white hover:bg-navy-800'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : isLastQuestion ? (
                'Complete Setup →'
              ) : (
                'Next →'
              )}
            </button>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center mt-8 gap-2">
          {questions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentStep
                  ? 'w-8 bg-navy-900'
                  : index < currentStep
                  ? 'bg-gold-500'
                  : 'bg-gray-300'
              }`}
              aria-label={`Go to question ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Render appropriate input based on question type
 */
function renderQuestionInput(
  question: MasterPromptQuestion,
  currentResponse: string | string[] | undefined,
  onResponse: (questionId: string, answer: string | string[]) => void
) {
  const options = question.options || [];

  switch (question.question_type) {
    case 'single_choice':
      return (
        <div className="grid gap-3">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => onResponse(question.id, option)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                currentResponse === option
                  ? 'border-navy-900 bg-navy-50 text-navy-900'
                  : 'border-gray-200 hover:border-gold-400 hover:bg-gold-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    currentResponse === option
                      ? 'border-navy-900 bg-navy-900'
                      : 'border-gray-300'
                  }`}
                >
                  {currentResponse === option && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <span className="font-medium">{option}</span>
              </div>
            </button>
          ))}
        </div>
      );

    case 'multiple_choice':
      const selectedOptions = Array.isArray(currentResponse) ? currentResponse : [];
      return (
        <div className="grid gap-3">
          {options.map((option) => {
            const isSelected = selectedOptions.includes(option);
            return (
              <button
                key={option}
                onClick={() => {
                  const newSelection = isSelected
                    ? selectedOptions.filter((o) => o !== option)
                    : [...selectedOptions, option];
                  onResponse(question.id, newSelection);
                }}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? 'border-navy-900 bg-navy-50 text-navy-900'
                    : 'border-gray-200 hover:border-gold-400 hover:bg-gold-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      isSelected ? 'border-navy-900 bg-navy-900' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium">{option}</span>
                </div>
              </button>
            );
          })}
          <p className="text-xs text-gray-400 mt-1">Select all that apply</p>
        </div>
      );

    case 'scale':
      const scaleValue = typeof currentResponse === 'string' ? currentResponse : '';
      return (
        <div>
          <div className="flex justify-between items-center gap-2">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => onResponse(question.id, option)}
                className={`flex-1 py-4 rounded-xl border-2 font-bold text-lg transition-all ${
                  scaleValue === option
                    ? 'border-navy-900 bg-navy-900 text-white'
                    : 'border-gray-200 hover:border-gold-400 text-gray-600'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-2 px-2">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      );

    case 'text':
    default:
      const textValue = typeof currentResponse === 'string' ? currentResponse : '';
      return (
        <div>
          <textarea
            value={textValue}
            onChange={(e) => onResponse(question.id, e.target.value)}
            placeholder="Share your thoughts..."
            rows={4}
            className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-navy-900 focus:outline-none resize-none transition-colors"
          />
          <p className="text-xs text-gray-400 mt-2">
            {textValue.length} characters
          </p>
        </div>
      );
  }
}

/**
 * Fallback questions if API fails
 */
const FALLBACK_QUESTIONS: MasterPromptQuestion[] = [
  {
    id: 'fallback-1',
    theme_id: '',
    question_text: 'What is your primary motivation for using Visionary AI?',
    question_type: 'single_choice',
    options: [
      'Achieve financial goals',
      'Build better habits',
      'Plan retirement',
      'Personal growth',
      'Family planning',
    ],
    prompt_contribution: 'Primary motivation: {answer}',
    sort_order: 1,
    is_required: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'fallback-2',
    theme_id: '',
    question_text: 'How do you prefer to receive feedback?',
    question_type: 'single_choice',
    options: [
      'Direct and challenging',
      'Supportive and encouraging',
      'Data-driven and analytical',
      'Story-based and inspirational',
    ],
    prompt_contribution: 'Feedback style: {answer}',
    sort_order: 2,
    is_required: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'fallback-3',
    theme_id: '',
    question_text: 'What is your biggest obstacle to achieving your goals?',
    question_type: 'single_choice',
    options: [
      'Lack of time',
      'Lack of motivation',
      'Unclear direction',
      'Financial constraints',
      'Accountability',
    ],
    prompt_contribution: 'Primary obstacle: {answer}',
    sort_order: 3,
    is_required: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'fallback-4',
    theme_id: '',
    question_text: 'How often do you want check-ins from your AI coach?',
    question_type: 'single_choice',
    options: ['Daily', 'Every few days', 'Weekly', 'Only when I ask'],
    prompt_contribution: 'Check-in frequency: {answer}',
    sort_order: 4,
    is_required: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'fallback-5',
    theme_id: '',
    question_text: 'What does success look like for you in 5 years?',
    question_type: 'text',
    options: [],
    prompt_contribution: 'Five-year vision: {answer}',
    sort_order: 5,
    is_required: false,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export default MasterPromptQnA;
