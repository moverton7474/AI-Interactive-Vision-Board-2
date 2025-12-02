import React from 'react';

interface Habit {
  id: string;
  name: string;
  icon: string;
  completedToday: boolean;
  streak: number;
}

interface Props {
  habits: Habit[];
  onToggleHabit: (habitId: string) => void;
  onViewAll: () => void;
}

const HabitStreakBar: React.FC<Props> = ({ habits, onToggleHabit, onViewAll }) => {
  const completedCount = habits.filter(h => h.completedToday).length;
  const displayHabits = habits.slice(0, 5);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔥</span>
          <h3 className="font-bold text-navy-900">Daily Habits</h3>
        </div>
        <span className="text-sm font-medium text-gray-500">
          {completedCount}/{habits.length} complete
        </span>
      </div>

      {/* Habits Grid */}
      {displayHabits.length > 0 ? (
        <div className="p-4">
          <div className="flex justify-around gap-2">
            {displayHabits.map((habit) => (
              <button
                key={habit.id}
                onClick={() => onToggleHabit(habit.id)}
                className="flex flex-col items-center gap-2 p-2 group"
              >
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl transition-all ${
                    habit.completedToday
                      ? 'bg-green-100 ring-2 ring-green-500 ring-offset-2'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {habit.icon}
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-700 truncate max-w-[60px]">
                    {habit.name}
                  </p>
                  {habit.streak > 0 && (
                    <p className="text-xs text-orange-500 font-semibold">
                      {habit.streak} 🔥
                    </p>
                  )}
                </div>
                {habit.completedToday && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: habits.length > 0 ? `${(completedCount / habits.length) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-xs font-semibold text-gray-600">
                {habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center">
          <p className="text-gray-500 mb-2">No habits set up yet</p>
          <button
            onClick={onViewAll}
            className="text-navy-600 hover:text-navy-800 text-sm font-medium"
          >
            Add habits →
          </button>
        </div>
      )}

      {/* Footer */}
      {habits.length > 5 && (
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onViewAll}
            className="text-navy-600 hover:text-navy-800 text-sm font-medium"
          >
            View all {habits.length} habits →
          </button>
        </div>
      )}
    </div>
  );
};

export default HabitStreakBar;
