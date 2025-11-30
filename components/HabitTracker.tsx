
import React, { useState, useEffect } from 'react';
import { Habit, HabitFrequency, HabitCompletion } from '../types';
import {
  getHabits,
  createHabit,
  deleteHabit,
  completeHabit,
  getTodayCompletions,
  getHabitStats,
  getHabitCompletions
} from '../services/storageService';
import {
  PlusIcon,
  FireIcon,
  TrophyIcon,
  CheckCircleIcon,
  TrashIcon,
  XMarkIcon,
  ChartBarIcon,
  CalendarIcon,
  RefreshIcon
} from './Icons';

interface HabitTrackerProps {
  onBack?: () => void;
}

const FREQUENCY_OPTIONS: { value: HabitFrequency; label: string }[] = [
  { value: 'daily', label: 'Every Day' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'weekdays', label: 'Weekdays Only' },
  { value: 'custom', label: 'Custom Days' }
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const HabitTracker: React.FC<HabitTrackerProps> = ({ onBack }) => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayCompleted, setTodayCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [stats, setStats] = useState({
    totalHabits: 0,
    totalCompletions: 0,
    longestStreak: 0,
    currentStreakTotal: 0,
    weeklyCompletionRate: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [habitsData, completedToday, statsData] = await Promise.all([
      getHabits(),
      getTodayCompletions(),
      getHabitStats()
    ]);
    setHabits(habitsData);
    setTodayCompleted(completedToday);
    setStats(statsData);
    setLoading(false);
  };

  const handleComplete = async (habitId: string) => {
    if (todayCompleted.includes(habitId)) return;

    await completeHabit(habitId);
    setTodayCompleted(prev => [...prev, habitId]);

    // Update local streak count
    setHabits(prev => prev.map(h =>
      h.id === habitId ? { ...h, current_streak: (h.current_streak || 0) + 1 } : h
    ));

    // Refresh stats
    const newStats = await getHabitStats();
    setStats(newStats);
  };

  const handleDelete = async (habitId: string) => {
    if (!confirm('Are you sure you want to delete this habit?')) return;
    await deleteHabit(habitId);
    setHabits(prev => prev.filter(h => h.id !== habitId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-orange-500 to-red-500 p-3 rounded-xl shadow-lg">
            <FireIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-serif font-bold text-navy-900">Habit Tracker</h2>
            <p className="text-gray-600">Build habits that align with your vision</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-navy-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-navy-800 transition-colors flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          New Habit
        </button>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Habits"
          value={stats.totalHabits}
          icon={<CalendarIcon className="w-5 h-5" />}
          color="bg-blue-500"
        />
        <StatCard
          label="Total Completions"
          value={stats.totalCompletions}
          icon={<CheckCircleIcon className="w-5 h-5" />}
          color="bg-green-500"
        />
        <StatCard
          label="Longest Streak"
          value={stats.longestStreak}
          icon={<FireIcon className="w-5 h-5" />}
          color="bg-orange-500"
        />
        <StatCard
          label="Weekly Rate"
          value={`${stats.weeklyCompletionRate}%`}
          icon={<ChartBarIcon className="w-5 h-5" />}
          color="bg-purple-500"
        />
      </div>

      {/* Today's Progress */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-700 rounded-2xl p-6 mb-8 text-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Today's Progress</h3>
          <button onClick={loadData} className="text-gold-400 hover:text-gold-300 transition-colors">
            <RefreshIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold text-gold-400">
            {todayCompleted.length}/{habits.length}
          </div>
          <div className="flex-1 bg-navy-800 rounded-full h-4 overflow-hidden">
            <div
              className="bg-gold-500 h-full transition-all duration-500"
              style={{ width: habits.length > 0 ? `${(todayCompleted.length / habits.length) * 100}%` : '0%' }}
            />
          </div>
          {todayCompleted.length === habits.length && habits.length > 0 && (
            <TrophyIcon className="w-8 h-8 text-gold-400 animate-bounce" />
          )}
        </div>
      </div>

      {/* Habits List */}
      {habits.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
          <FireIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-600 mb-2">No Habits Yet</h3>
          <p className="text-gray-400 mb-6">Start building habits that support your retirement vision</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-navy-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-navy-800 transition-colors"
          >
            Create Your First Habit
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {habits.map(habit => (
            <HabitCard
              key={habit.id}
              habit={habit}
              isCompletedToday={todayCompleted.includes(habit.id)}
              onComplete={() => handleComplete(habit.id)}
              onDelete={() => handleDelete(habit.id)}
              onSelect={() => setSelectedHabit(habit)}
            />
          ))}
        </div>
      )}

      {/* Create Habit Modal */}
      {showCreateModal && (
        <CreateHabitModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (newHabit) => {
            const created = await createHabit(newHabit);
            if (created) {
              setHabits(prev => [created, ...prev]);
              setStats(prev => ({ ...prev, totalHabits: prev.totalHabits + 1 }));
            }
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Habit Detail Modal */}
      {selectedHabit && (
        <HabitDetailModal
          habit={selectedHabit}
          onClose={() => setSelectedHabit(null)}
        />
      )}
    </div>
  );
};

// Stat Card Component
const StatCard: React.FC<{
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}> = ({ label, value, icon, color }) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
    <div className="flex items-center gap-3 mb-2">
      <div className={`${color} p-2 rounded-lg text-white`}>
        {icon}
      </div>
      <span className="text-sm text-gray-500">{label}</span>
    </div>
    <div className="text-2xl font-bold text-navy-900">{value}</div>
  </div>
);

// Habit Card Component
const HabitCard: React.FC<{
  habit: Habit;
  isCompletedToday: boolean;
  onComplete: () => void;
  onDelete: () => void;
  onSelect: () => void;
}> = ({ habit, isCompletedToday, onComplete, onDelete, onSelect }) => {
  const getFrequencyLabel = (freq: HabitFrequency, customDays: number[]) => {
    switch (freq) {
      case 'daily': return 'Every day';
      case 'weekly': return 'Weekly';
      case 'weekdays': return 'Mon-Fri';
      case 'custom': return customDays.map(d => DAYS_OF_WEEK[d]).join(', ');
      default: return freq;
    }
  };

  return (
    <div
      className={`bg-white rounded-xl p-4 shadow-sm border transition-all ${
        isCompletedToday ? 'border-green-200 bg-green-50/50' : 'border-gray-100 hover:shadow-md hover:border-gold-200'
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Complete Button */}
        <button
          onClick={onComplete}
          disabled={isCompletedToday}
          className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${
            isCompletedToday
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 hover:border-green-500 hover:bg-green-50'
          }`}
        >
          {isCompletedToday ? (
            <CheckCircleIcon className="w-6 h-6" />
          ) : (
            <span className="w-3 h-3 rounded-full bg-gray-300"></span>
          )}
        </button>

        {/* Habit Info */}
        <div className="flex-1 cursor-pointer" onClick={onSelect}>
          <h4 className={`font-bold text-lg ${isCompletedToday ? 'text-green-700' : 'text-navy-900'}`}>
            {habit.title}
          </h4>
          {habit.description && (
            <p className="text-sm text-gray-500 mt-0.5">{habit.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              {getFrequencyLabel(habit.frequency, habit.custom_days)}
            </span>
            {habit.reminder_time && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" />
                {habit.reminder_time}
              </span>
            )}
          </div>
        </div>

        {/* Streak */}
        <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-xl">
          <FireIcon className={`w-5 h-5 ${(habit.current_streak || 0) > 0 ? 'text-orange-500' : 'text-gray-300'}`} />
          <span className={`font-bold ${(habit.current_streak || 0) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
            {habit.current_streak || 0}
          </span>
        </div>

        {/* Delete Button */}
        <button
          onClick={onDelete}
          className="p-2 text-gray-300 hover:text-red-500 transition-colors"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// Create Habit Modal Component
const CreateHabitModal: React.FC<{
  onClose: () => void;
  onCreate: (habit: Omit<Habit, 'id' | 'user_id' | 'created_at' | 'current_streak' | 'last_completed'>) => void;
}> = ({ onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [reminderTime, setReminderTime] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      frequency,
      custom_days: frequency === 'custom' ? customDays : [],
      reminder_time: reminderTime || undefined,
      is_active: true
    });
  };

  const toggleDay = (day: number) => {
    setCustomDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-navy-900">Create New Habit</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Habit Name *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Morning meditation"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why is this habit important to you?"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none resize-none"
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as HabitFrequency)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none"
            >
              {FREQUENCY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Custom Days */}
          {frequency === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Days
              </label>
              <div className="flex gap-2">
                {DAYS_OF_WEEK.map((day, idx) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                      customDays.includes(idx)
                        ? 'bg-navy-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reminder Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reminder Time (optional)
            </label>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-navy-900 text-white rounded-lg font-bold hover:bg-navy-800 transition-colors"
            >
              Create Habit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Habit Detail Modal Component
const HabitDetailModal: React.FC<{
  habit: Habit;
  onClose: () => void;
}> = ({ habit, onClose }) => {
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompletions();
  }, [habit.id]);

  const loadCompletions = async () => {
    setLoading(true);
    const data = await getHabitCompletions(habit.id, 30);
    setCompletions(data);
    setLoading(false);
  };

  // Generate last 30 days for the calendar view
  const getLast30Days = () => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date);
    }
    return days;
  };

  const isDateCompleted = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return completions.some(c => c.completed_at.startsWith(dateStr));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-navy-900">{habit.title}</h3>
            {habit.description && (
              <p className="text-sm text-gray-500 mt-1">{habit.description}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Streak Info */}
        <div className="bg-gradient-to-r from-orange-100 to-yellow-100 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <span className="text-sm text-orange-700 font-medium">Current Streak</span>
            <div className="text-3xl font-bold text-orange-600 flex items-center gap-2">
              {habit.current_streak || 0}
              <FireIcon className="w-7 h-7" />
            </div>
          </div>
          {habit.last_completed && (
            <div className="text-right">
              <span className="text-sm text-gray-500">Last completed</span>
              <div className="text-gray-700 font-medium">
                {new Date(habit.last_completed).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>

        {/* Calendar View */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Last 30 Days</h4>
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-navy-900 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-10 gap-1">
              {getLast30Days().map((date, idx) => {
                const completed = isDateCompleted(date);
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={idx}
                    title={date.toLocaleDateString()}
                    className={`w-full aspect-square rounded transition-colors ${
                      completed
                        ? 'bg-green-500'
                        : isToday
                        ? 'bg-navy-200'
                        : 'bg-gray-100'
                    }`}
                  />
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-gray-100"></div>
              <span>Missed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-navy-200"></div>
              <span>Today</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default HabitTracker;
