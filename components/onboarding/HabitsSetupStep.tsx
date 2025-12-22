import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface DefaultHabit {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
}

const THEME_HABITS: Record<string, DefaultHabit[]> = {
  christian: [
    { id: 'morning-prayer', name: 'Morning Prayer', icon: '🙏', description: '10 minutes of quiet prayer and reflection', category: 'spiritual' },
    { id: 'scripture-reading', name: 'Scripture Reading', icon: '📖', description: 'Read and meditate on a Bible passage', category: 'spiritual' },
    { id: 'gratitude-journal', name: 'Gratitude Journal', icon: '✍️', description: 'Write 3 things you\'re thankful for', category: 'mindset' },
    { id: 'evening-reflection', name: 'Evening Reflection', icon: '🌙', description: 'Review the day and pray', category: 'spiritual' },
    { id: 'serve-others', name: 'Act of Service', icon: '💝', description: 'Do one kind thing for someone else', category: 'action' }
  ],
  executive: [
    { id: 'morning-planning', name: 'Morning Planning', icon: '📋', description: 'Review priorities and plan your day', category: 'productivity' },
    { id: 'deep-work', name: 'Deep Work Block', icon: '🎯', description: '90 minutes of focused, uninterrupted work', category: 'productivity' },
    { id: 'inbox-zero', name: 'Inbox Zero', icon: '📧', description: 'Process all emails to zero', category: 'productivity' },
    { id: 'networking', name: 'Network Touch', icon: '🤝', description: 'Reach out to one professional contact', category: 'growth' },
    { id: 'reading', name: 'Professional Reading', icon: '📚', description: '30 minutes of business/leadership reading', category: 'growth' }
  ],
  fitness: [
    { id: 'morning-workout', name: 'Morning Workout', icon: '💪', description: '30-60 minutes of exercise', category: 'fitness' },
    { id: 'hydration', name: 'Hydration Goal', icon: '💧', description: 'Drink 8 glasses of water', category: 'health' },
    { id: 'meal-prep', name: 'Healthy Meals', icon: '🥗', description: 'Eat clean, whole foods', category: 'nutrition' },
    { id: 'sleep-schedule', name: 'Sleep Schedule', icon: '😴', description: '7-8 hours of quality sleep', category: 'recovery' },
    { id: 'stretching', name: 'Stretching/Mobility', icon: '🧘', description: '10 minutes of stretching', category: 'fitness' }
  ],
  retirement: [
    { id: 'financial-check', name: 'Financial Check-in', icon: '💰', description: 'Review investments and budgets', category: 'finance' },
    { id: 'gratitude', name: 'Gratitude Practice', icon: '🙏', description: 'Appreciate what you have', category: 'mindset' },
    { id: 'learning', name: 'Learn Something New', icon: '🎓', description: 'Spend time on a hobby or skill', category: 'growth' },
    { id: 'social-connection', name: 'Social Connection', icon: '👥', description: 'Connect with friends or family', category: 'relationships' },
    { id: 'nature-time', name: 'Time in Nature', icon: '🌳', description: 'Walk or spend time outdoors', category: 'wellness' }
  ],
  custom: [
    { id: 'morning-routine', name: 'Morning Routine', icon: '☀️', description: 'Start your day intentionally', category: 'lifestyle' },
    { id: 'exercise', name: 'Exercise', icon: '🏃', description: 'Move your body for 30 minutes', category: 'health' },
    { id: 'learning', name: 'Learning Time', icon: '📚', description: 'Read or learn something new', category: 'growth' },
    { id: 'reflection', name: 'Daily Reflection', icon: '📝', description: 'Review your day and progress', category: 'mindset' },
    { id: 'connection', name: 'Connect with Someone', icon: '💬', description: 'Meaningful conversation with someone', category: 'relationships' }
  ]
};

interface Props {
  themeId?: string;
  selectedHabits: string[];
  onHabitsChange: (habitIds: string[]) => void;
  // WOW Optimization: Micro-contract props
  userId?: string;
  onReminderScheduled?: (reminderId: string) => void;
}

const HabitsSetupStep: React.FC<Props> = ({
  themeId = 'custom',
  selectedHabits,
  onHabitsChange,
  userId,
  onReminderScheduled
}) => {
  const habits = THEME_HABITS[themeId] || THEME_HABITS.custom;

  // WOW Optimization: AMIE Micro-Contract state
  const [showMicroContract, setShowMicroContract] = useState(false);
  const [reminderSet, setReminderSet] = useState(false);
  const [isSchedulingReminder, setIsSchedulingReminder] = useState(false);
  const [hasShownMicroContract, setHasShownMicroContract] = useState(false);

  // Pre-select first 3 habits by default
  useEffect(() => {
    if (selectedHabits.length === 0 && habits.length > 0) {
      onHabitsChange(habits.slice(0, 3).map(h => h.id));
    }
  }, [themeId]);

  // Show micro-contract when first habit is selected (if not shown before)
  useEffect(() => {
    if (selectedHabits.length > 0 && !hasShownMicroContract && !reminderSet && userId) {
      // Small delay to let the selection animation complete
      const timer = setTimeout(() => {
        setShowMicroContract(true);
        setHasShownMicroContract(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedHabits.length, hasShownMicroContract, reminderSet, userId]);

  // Handle accepting the reminder
  const handleAcceptReminder = async () => {
    if (!userId) return;

    setIsSchedulingReminder(true);
    try {
      // Schedule SMS for tomorrow 7 AM
      const tomorrow7am = new Date();
      tomorrow7am.setDate(tomorrow7am.getDate() + 1);
      tomorrow7am.setHours(7, 0, 0, 0);

      const firstHabit = habits.find(h => selectedHabits.includes(h.id));
      const habitName = firstHabit?.name || 'your morning routine';

      const { data, error } = await supabase.functions.invoke('schedule-notification', {
        body: {
          user_id: userId,
          type: 'habit_reminder',
          channel: 'sms',
          scheduled_for: tomorrow7am.toISOString(),
          message: `Good morning! Time for ${habitName}. You've got this! - AMIE`
        }
      });

      if (!error && data?.id) {
        setReminderSet(true);
        onReminderScheduled?.(data.id);
      }
    } catch (err) {
      console.error('Failed to schedule reminder:', err);
    } finally {
      setIsSchedulingReminder(false);
      setShowMicroContract(false);
    }
  };

  const handleDeclineReminder = () => {
    setShowMicroContract(false);
  };

  const toggleHabit = (habitId: string) => {
    if (selectedHabits.includes(habitId)) {
      onHabitsChange(selectedHabits.filter(id => id !== habitId));
    } else {
      onHabitsChange([...selectedHabits, habitId]);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      spiritual: 'bg-purple-100 text-purple-700',
      productivity: 'bg-blue-100 text-blue-700',
      fitness: 'bg-green-100 text-green-700',
      health: 'bg-emerald-100 text-emerald-700',
      nutrition: 'bg-orange-100 text-orange-700',
      recovery: 'bg-indigo-100 text-indigo-700',
      growth: 'bg-yellow-100 text-yellow-700',
      finance: 'bg-green-100 text-green-700',
      mindset: 'bg-pink-100 text-pink-700',
      relationships: 'bg-red-100 text-red-700',
      wellness: 'bg-teal-100 text-teal-700',
      action: 'bg-amber-100 text-amber-700',
      lifestyle: 'bg-gray-100 text-gray-700'
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-gray-600">
          Select the daily habits you want to track. These will appear on your dashboard.
        </p>
        <p className="text-sm text-gray-400 mt-1">
          You can always add or change habits later.
        </p>
      </div>

      {/* Habit List */}
      <div className="space-y-3">
        {habits.map((habit) => {
          const isSelected = selectedHabits.includes(habit.id);
          return (
            <button
              key={habit.id}
              onClick={() => toggleHabit(habit.id)}
              className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-left flex items-start gap-4 ${
                isSelected
                  ? 'border-navy-900 bg-navy-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {/* Checkbox */}
              <div className={`w-6 h-6 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                isSelected
                  ? 'bg-navy-900 border-navy-900'
                  : 'border-gray-300'
              }`}>
                {isSelected && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              {/* Icon */}
              <span className="text-2xl flex-shrink-0">{habit.icon}</span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900">{habit.name}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(habit.category)}`}>
                    {habit.category}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{habit.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Reminder Confirmation */}
      {reminderSet && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-green-800">Reminder set for 7:00 AM tomorrow!</p>
            <p className="text-sm text-green-600">AMIE will text you to start your day right.</p>
          </div>
        </div>
      )}

      {/* Selection Summary */}
      <div className="bg-navy-50 rounded-xl p-4 border border-navy-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-navy-900">
              {selectedHabits.length} habit{selectedHabits.length !== 1 ? 's' : ''} selected
            </p>
            <p className="text-sm text-navy-600">
              {selectedHabits.length === 0
                ? 'Select at least one habit to track'
                : 'These will be tracked daily on your dashboard'}
            </p>
          </div>
          {selectedHabits.length > 0 && (
            <div className="flex -space-x-2">
              {habits
                .filter(h => selectedHabits.includes(h.id))
                .slice(0, 5)
                .map(h => (
                  <span key={h.id} className="text-xl bg-white rounded-full w-8 h-8 flex items-center justify-center border border-gray-200">
                    {h.icon}
                  </span>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* AMIE Micro-Contract Modal */}
      {showMicroContract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-gold-400 to-gold-600 rounded-full flex items-center justify-center mb-3">
                <span className="text-3xl">🤖</span>
              </div>
              <h3 className="text-lg font-bold text-navy-900">Quick question!</h3>
            </div>

            <p className="text-gray-600 text-center mb-6">
              I can text you tomorrow at <span className="font-semibold">7:00 AM</span> to remind you about your morning habits. Want me to set that up?
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleDeclineReminder}
                disabled={isSchedulingReminder}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                No thanks
              </button>
              <button
                onClick={handleAcceptReminder}
                disabled={isSchedulingReminder}
                className="flex-1 px-4 py-3 bg-navy-900 text-white rounded-xl font-medium hover:bg-navy-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSchedulingReminder ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Setting up...
                  </>
                ) : (
                  'Yes, remind me!'
                )}
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center mt-4">
              You can manage reminders in settings anytime.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default HabitsSetupStep;
