import React, { useState, useEffect } from 'react';
import { WeeklyReview } from '../types';
import { supabase } from '../lib/supabase';
import WeeklyReviewCard from './WeeklyReviewCard';
import { SparklesIcon } from './Icons';

interface Props {
  onBack?: () => void;
}

/**
 * WeeklyReviews - Full page view of weekly review history
 *
 * Displays all weekly reviews with expandable cards,
 * progress trends, and option to generate new review.
 */
const WeeklyReviews: React.FC<Props> = ({ onBack }) => {
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to view your weekly reviews');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('weekly_reviews')
        .select('*')
        .eq('user_id', session.user.id)
        .order('week_start', { ascending: false })
        .limit(12); // Last 12 weeks

      if (fetchError) {
        throw fetchError;
      }

      setReviews(data || []);

      // Auto-expand the most recent review
      if (data && data.length > 0) {
        setExpandedId(data[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching reviews:', err);
      setError(err.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const generateNewReview = async () => {
    try {
      setGenerating(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to generate a review');
      }

      const response = await supabase.functions.invoke('generate-weekly-review', {
        body: { userId: session.user.id },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to generate review');
      }

      // Refresh the list
      await fetchReviews();
    } catch (err: any) {
      console.error('Error generating review:', err);
      setError(err.message || 'Failed to generate review');
    } finally {
      setGenerating(false);
    }
  };

  const getAverageCompletionRate = () => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + (r.habit_completion_rate || 0), 0);
    return sum / reviews.length;
  };

  const getTotalWins = () => {
    return reviews.reduce((acc, r) => acc + (r.wins?.length || 0), 0);
  };

  const getStreak = () => {
    // Count consecutive weeks with reviews
    let streak = 0;
    const now = new Date();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    for (const review of reviews) {
      const weekEnd = new Date(review.week_end);
      const weeksAgo = Math.floor((now.getTime() - weekEnd.getTime()) / oneWeekMs);
      if (weeksAgo === streak) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-navy-900 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500">Loading your weekly reviews...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-navy-900">Weekly Reviews</h1>
          <p className="text-gray-500 mt-1">Track your progress and celebrate wins</p>
        </div>

        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="text-gray-500 hover:text-navy-900 font-medium transition-colors"
            >
              ← Back
            </button>
          )}
          <button
            onClick={generateNewReview}
            disabled={generating}
            className="flex items-center gap-2 bg-navy-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <SparklesIcon className="w-4 h-4" />
                Generate Review
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Stats Summary */}
      {reviews.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="text-3xl font-bold text-green-600">{getTotalWins()}</div>
            <div className="text-sm text-gray-500">Total Wins</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="text-3xl font-bold text-navy-900">
              {Math.round(getAverageCompletionRate() * 100)}%
            </div>
            <div className="text-sm text-gray-500">Avg Completion</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
            <div className="text-3xl font-bold text-gold-600">{getStreak()}</div>
            <div className="text-sm text-gray-500">Week Streak</div>
          </div>
        </div>
      )}

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-navy-900 mb-2">No Reviews Yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Weekly reviews help you reflect on progress, celebrate wins, and plan ahead.
            Generate your first review to get started.
          </p>
          <button
            onClick={generateNewReview}
            disabled={generating}
            className="inline-flex items-center gap-2 bg-navy-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-navy-800 transition-colors disabled:opacity-50"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <SparklesIcon className="w-5 h-5" />
                Generate Your First Review
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <WeeklyReviewCard
              key={review.id}
              review={review}
              isExpanded={expandedId === review.id}
              onToggle={() => setExpandedId(expandedId === review.id ? null : review.id)}
            />
          ))}
        </div>
      )}

      {/* Load More */}
      {reviews.length >= 12 && (
        <div className="text-center mt-8">
          <button className="text-navy-900 font-medium hover:text-gold-600 transition-colors">
            Load more reviews...
          </button>
        </div>
      )}
    </div>
  );
};

export default WeeklyReviews;
