/**
 * AICoachDrawer - AI Coaching Guidance Drawer (v1.8)
 *
 * Provides AI-powered coaching suggestions for goal setting and management.
 * Uses best-practice frameworks like SMART, OKR, and identity-aligned themes.
 */

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { GoalPlan, ActionTask } from '../../types';

// Icons
const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SendIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const LightBulbIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const TargetIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  suggestions?: AISuggestion[];
}

interface AISuggestion {
  id: string;
  type: 'smart_goal' | 'okr' | 'metric' | 'improvement';
  title: string;
  description: string;
  accepted?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentPlan?: GoalPlan | null;
  currentGoals?: ActionTask[];
  onAcceptSuggestion?: (suggestion: AISuggestion) => void;
  onUpdatePlanInsights?: (insights: GoalPlan['aiInsights']) => void;
}

// Coaching frameworks
const COACHING_FRAMEWORKS = {
  SMART: {
    name: 'SMART Goals',
    description: 'Specific, Measurable, Achievable, Relevant, Time-bound',
    prompts: [
      'How can I make this goal more specific?',
      'What metrics can I use to measure progress?',
      'Is this goal realistically achievable?',
      'How does this align with my vision?',
      'What is the target date for this goal?'
    ]
  },
  OKR: {
    name: 'OKRs',
    description: 'Objectives and Key Results',
    prompts: [
      'What is the main objective I want to achieve?',
      'What are 3 measurable key results?',
      'How will I know when I\'ve succeeded?'
    ]
  },
  IDENTITY: {
    name: 'Identity-Aligned',
    description: 'Goals aligned with who you want to become',
    prompts: [
      'What type of person achieves this goal?',
      'What daily habits would that person have?',
      'How does this goal reflect my values?'
    ]
  }
};

const AICoachDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  currentPlan,
  currentGoals = [],
  onAcceptSuggestion,
  onUpdatePlanInsights
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<keyof typeof COACHING_FRAMEWORKS>('SMART');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize with welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'assistant',
        content: `Hi! I'm AMIE, your AI Coach. I'll help you set and refine your goals using proven frameworks like SMART goals and OKRs.\n\n${
          currentGoals.length > 0
            ? `I see you have ${currentGoals.length} goals. Would you like me to analyze them and suggest improvements?`
            : 'Let\'s start by discussing your vision and creating meaningful goals.'
        }`,
        timestamp: new Date(),
        suggestions: currentGoals.length > 0 ? [
          {
            id: 'analyze',
            type: 'improvement',
            title: 'Analyze My Goals',
            description: 'Get AI-powered suggestions to improve your current goals'
          }
        ] : []
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, currentGoals.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string = inputValue) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Build context from current goals
      const goalsContext = currentGoals.map(g => ({
        title: g.title,
        type: g.type,
        priority: g.priority,
        completed: g.isCompleted,
        dueDate: g.dueDate
      }));

      const planContext = currentPlan ? {
        visionText: currentPlan.visionText,
        financialTarget: currentPlan.financialTarget,
        aiInsights: currentPlan.aiInsights
      } : null;

      // Call Gemini proxy for AI coaching
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: {
          action: 'coaching',
          message: content,
          context: {
            goals: goalsContext,
            plan: planContext,
            framework: selectedFramework,
            frameworkDescription: COACHING_FRAMEWORKS[selectedFramework]
          }
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      // Parse AI response
      const aiResponse = data?.response || data?.message ||
        'I understand. Let me think about that and provide some guidance.';

      // Extract suggestions if present
      const suggestions: AISuggestion[] = [];
      if (data?.suggestions && Array.isArray(data.suggestions)) {
        data.suggestions.forEach((s: any, index: number) => {
          suggestions.push({
            id: `suggestion-${Date.now()}-${index}`,
            type: s.type || 'improvement',
            title: s.title,
            description: s.description
          });
        });
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        suggestions
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update plan insights if provided
      if (data?.insights && onUpdatePlanInsights) {
        onUpdatePlanInsights(data.insights);
      }

    } catch (err: any) {
      console.error('AI Coach error:', err);

      // Fallback response
      const fallbackMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: generateFallbackResponse(content, selectedFramework, currentGoals),
        timestamp: new Date(),
        suggestions: generateFallbackSuggestions(selectedFramework)
      };

      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptSuggestion = (suggestion: AISuggestion) => {
    // Mark suggestion as accepted
    setMessages(prev => prev.map(msg => ({
      ...msg,
      suggestions: msg.suggestions?.map(s =>
        s.id === suggestion.id ? { ...s, accepted: true } : s
      )
    })));

    // Notify parent
    if (onAcceptSuggestion) {
      onAcceptSuggestion(suggestion);
    }

    // Add confirmation message
    const confirmMessage: Message = {
      id: `system-${Date.now()}`,
      role: 'system',
      content: `Great choice! I've noted your interest in: "${suggestion.title}". Let's work on implementing this.`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, confirmMessage]);
  };

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <SparklesIcon />
            </div>
            <div>
              <h2 className="font-semibold">AI Coach</h2>
              <p className="text-xs text-white/80">Goal Setting Guidance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Framework Selector */}
        <div className="mt-4 flex gap-2">
          {Object.entries(COACHING_FRAMEWORKS).map(([key, framework]) => (
            <button
              key={key}
              onClick={() => setSelectedFramework(key as keyof typeof COACHING_FRAMEWORKS)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedFramework === key
                  ? 'bg-white text-purple-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {framework.name}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 ${
              message.role === 'user'
                ? 'bg-purple-600 text-white'
                : message.role === 'system'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-gray-100 text-gray-800'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>

              {/* Suggestions */}
              {message.suggestions && message.suggestions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className={`bg-white rounded-lg p-3 border ${
                        suggestion.accepted ? 'border-green-300 bg-green-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            {suggestion.type === 'smart_goal' && <TargetIcon />}
                            {suggestion.type === 'metric' && <LightBulbIcon />}
                            <span className="font-medium text-sm text-gray-900">{suggestion.title}</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{suggestion.description}</p>
                        </div>
                        {!suggestion.accepted ? (
                          <button
                            onClick={() => handleAcceptSuggestion(suggestion)}
                            className="flex-shrink-0 px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-200 transition-colors"
                          >
                            Accept
                          </button>
                        ) : (
                          <span className="flex-shrink-0 px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium flex items-center gap-1">
                            <CheckIcon /> Accepted
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs opacity-60 mt-2">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="px-4 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {COACHING_FRAMEWORKS[selectedFramework].prompts.slice(0, 3).map((prompt, index) => (
            <button
              key={index}
              onClick={() => handleQuickPrompt(prompt)}
              className="flex-shrink-0 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs hover:bg-purple-100 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask about goal setting..."
            className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none"
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={isLoading || !inputValue.trim()}
            className="p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
};

// Fallback response generator
function generateFallbackResponse(
  userMessage: string,
  framework: keyof typeof COACHING_FRAMEWORKS,
  goals: ActionTask[]
): string {
  const message = userMessage.toLowerCase();

  if (message.includes('analyze') || message.includes('review')) {
    const completedCount = goals.filter(g => g.isCompleted).length;
    const highPriority = goals.filter(g => g.priority === 'high' && !g.isCompleted).length;

    return `Looking at your ${goals.length} goals:\n\n` +
      `- ${completedCount} completed\n` +
      `- ${highPriority} high-priority items pending\n\n` +
      `Based on the ${COACHING_FRAMEWORKS[framework].name} framework, here are some suggestions to improve your goals.`;
  }

  if (message.includes('smart') || message.includes('specific')) {
    return `Great question! Using the SMART framework:\n\n` +
      `- **Specific**: Clearly define what you want to achieve\n` +
      `- **Measurable**: Add metrics to track progress\n` +
      `- **Achievable**: Ensure it's realistic\n` +
      `- **Relevant**: Align with your vision\n` +
      `- **Time-bound**: Set a deadline\n\n` +
      `Would you like me to help make one of your goals SMART?`;
  }

  if (message.includes('okr') || message.includes('objective')) {
    return `OKRs are a powerful framework:\n\n` +
      `**Objective**: What you want to achieve (qualitative)\n` +
      `**Key Results**: How you'll measure success (quantitative)\n\n` +
      `For example:\n` +
      `- Objective: Achieve financial independence\n` +
      `- KR1: Save $10,000 in emergency fund\n` +
      `- KR2: Increase monthly passive income to $500\n` +
      `- KR3: Reduce monthly expenses by 15%\n\n` +
      `Would you like help creating OKRs for your goals?`;
  }

  return `I understand you're interested in improving your goals. The ${COACHING_FRAMEWORKS[framework].name} framework is excellent for this.\n\n` +
    `${COACHING_FRAMEWORKS[framework].description}\n\n` +
    `Would you like me to:\n` +
    `1. Analyze your current goals\n` +
    `2. Help create new SMART goals\n` +
    `3. Suggest metrics and KPIs`;
}

// Fallback suggestions generator
function generateFallbackSuggestions(framework: keyof typeof COACHING_FRAMEWORKS): AISuggestion[] {
  if (framework === 'SMART') {
    return [
      {
        id: 'smart-1',
        type: 'smart_goal',
        title: 'Add Specific Metrics',
        description: 'Define measurable outcomes for each goal'
      },
      {
        id: 'smart-2',
        type: 'smart_goal',
        title: 'Set Target Dates',
        description: 'Add deadlines to make goals time-bound'
      }
    ];
  }

  if (framework === 'OKR') {
    return [
      {
        id: 'okr-1',
        type: 'okr',
        title: 'Define Key Results',
        description: 'Add 3-5 measurable key results per objective'
      }
    ];
  }

  return [
    {
      id: 'identity-1',
      type: 'improvement',
      title: 'Align with Your Identity',
      description: 'Connect goals to the person you want to become'
    }
  ];
}

export default AICoachDrawer;
