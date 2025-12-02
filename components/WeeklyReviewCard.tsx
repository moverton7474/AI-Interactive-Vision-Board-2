import React from 'react';
import { WeeklyReview } from '../types';

interface Props {
  review: WeeklyReview;
  isExpanded?: boolean;
  onToggle?: () => void;
}

/**
 * WeeklyReviewCard - Displays a single weekly review
 *
 * Shows wins, blockers, next steps, and key metrics
 * from the AI-generated weekly review.
 */
const WeeklyReviewCard: React.FC<Props> = ({ review, isExpanded = false, onToggle }) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getCompletionColor = (rate: number) => {
    if (rate >= 0.8) return 'text-green-600 bg-green-50';
    if (rate >= 0.5) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getMoodEmoji = (mood?: number) => {
    if (!mood) return null;
    if (mood >= 4.5) return { emoji: '😊', label: 'Great' };
    if (mood >= 3.5) return { emoji: '🙂', label: 'Good' };
    if (mood >= 2.5) return { emoji: '😐', label: 'Okay' };
    if (mood >= 1.5) return { emoji: '😔', label: 'Low' };
    return { emoji: '😢', label: 'Tough' };
  };

  const mood = getMoodEmoji(review.mood_average);

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden transition-all hover:shadow-lg">
      {/* Header */}
      <div
        className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-navy-900">
              Week of {formatDate(review.week_start)} - {formatDate(review.week_end)}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {review.tasks_completed} of {review.tasks_total} tasks completed
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Habit Completion Rate */}
            <div className={`px-3 py-1 rounded-full text-sm font-bold ${getCompletionColor(review.habit_completion_rate)}`}>
              {Math.round(review.habit_completion_rate * 100)}% habits
            </div>

            {/* Mood */}
            {mood && (
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <span className="text-xl">{mood.emoji}</span>
                <span className="hidden sm:inline">{mood.label}</span>
              </div>
            )}

            {/* Expand/Collapse Arrow */}
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-5 pb-5 border-t border-gray-100">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 py-4 border-b border-gray-100">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{review.wins?.length || 0}</div>
              <div className="text-xs text-gray-500">Wins</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{review.blockers?.length || 0}</div>
              <div className="text-xs text-gray-500">Blockers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{review.next_steps?.length || 0}</div>
              <div className="text-xs text-gray-500">Next Steps</div>
            </div>
          </div>

          {/* Wins */}
          {review.wins?.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-bold text-green-700 flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Wins This Week
              </h4>
              <ul className="space-y-2">
                {review.wins.map((win, i) => (
                  <li key={i} className="text-sm text-gray-700 pl-4 border-l-2 border-green-200">
                    {win}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Blockers */}
          {review.blockers?.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-bold text-red-700 flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                Blockers to Address
              </h4>
              <ul className="space-y-2">
                {review.blockers.map((blocker, i) => (
                  <li key={i} className="text-sm text-gray-700 pl-4 border-l-2 border-red-200">
                    {blocker}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Steps */}
          {review.next_steps?.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-bold text-blue-700 flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Focus for Next Week
              </h4>
              <ul className="space-y-2">
                {review.next_steps.map((step, i) => (
                  <li key={i} className="text-sm text-gray-700 pl-4 border-l-2 border-blue-200">
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Insights */}
          {review.ai_insights && (
            <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl">
              <h4 className="text-sm font-bold text-purple-700 flex items-center gap-2 mb-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Coach Insights
              </h4>
              <p className="text-sm text-gray-700 leading-relaxed">
                {review.ai_insights}
              </p>
            </div>
          )}

          {/* Video Review Link */}
          {review.video_url && (
            <div className="mt-4">
              <a
                href={review.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-navy-900 font-medium hover:text-gold-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4zM3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
                Watch Video Review
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WeeklyReviewCard;
