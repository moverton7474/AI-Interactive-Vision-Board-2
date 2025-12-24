import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ProgressPrediction } from '../../types';

interface Props {
  userId: string;
}

/**
 * ProgressPredictionWidget - Shows user's goal progress predictions
 *
 * Fetches from progress_predictions table and displays:
 * - Current pace indicator (on track, at risk, ahead)
 * - Predicted completion date
 * - Confidence score
 * - AI-generated recommendations
 */
const ProgressPredictionWidget: React.FC<Props> = ({ userId }) => {
  const [predictions, setPredictions] = useState<ProgressPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('progress_predictions')
          .select('*')
          .eq('user_id', userId)
          .order('calculated_at', { ascending: false })
          .limit(5);

        if (fetchError) {
          console.error('Error fetching predictions:', fetchError);
          setError('Could not load predictions');
          return;
        }

        setPredictions(data || []);
      } catch (err) {
        console.error('Prediction fetch error:', err);
        setError('Failed to load predictions');
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchPredictions();
    }
  }, [userId]);

  // Get status based on current pace
  const getStatus = (pace: number): { label: string; color: string; bgColor: string; icon: string } => {
    if (pace >= 1.0) {
      return {
        label: 'On Track',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        icon: '✓'
      };
    } else if (pace >= 0.7) {
      return {
        label: 'Slightly Behind',
        color: 'text-amber-700',
        bgColor: 'bg-amber-100',
        icon: '⚠'
      };
    } else {
      return {
        label: 'At Risk',
        color: 'text-red-700',
        bgColor: 'bg-red-100',
        icon: '!'
      };
    }
  };

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Calculate days until target
  const getDaysUntil = (dateStr: string): number => {
    const target = new Date(dateStr);
    const now = new Date();
    const diff = target.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900">Loading Predictions...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <span className="text-xl">📊</span>
          </div>
          <h3 className="font-semibold text-gray-900">Progress Predictions</h3>
        </div>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <span className="text-xl">📊</span>
          </div>
          <h3 className="font-semibold text-gray-900">Progress Predictions</h3>
        </div>
        <div className="text-center py-4">
          <p className="text-gray-500 text-sm mb-2">No predictions yet</p>
          <p className="text-gray-400 text-xs">
            As you work on your goals and habits, AI will generate progress predictions
          </p>
        </div>
      </div>
    );
  }

  // Show the most recent prediction as the primary
  const primaryPrediction = predictions[0];
  const primaryStatus = getStatus(primaryPrediction.current_pace);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">📊</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Progress Predictions</h3>
              <p className="text-xs text-gray-500">AI-powered goal tracking</p>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${primaryStatus.bgColor} ${primaryStatus.color}`}>
            {primaryStatus.icon} {primaryStatus.label}
          </div>
        </div>
      </div>

      {/* Primary Prediction */}
      <div className="p-4">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{primaryPrediction.goal_type}</span>
            <span className="text-xs text-gray-500">
              Target: {formatDate(primaryPrediction.target_date)}
            </span>
          </div>

          {/* Pace Progress Bar */}
          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${
                primaryPrediction.current_pace >= 1.0
                  ? 'bg-green-500'
                  : primaryPrediction.current_pace >= 0.7
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(primaryPrediction.current_pace * 100, 100)}%` }}
            />
            {/* Target marker */}
            <div className="absolute right-0 top-0 h-full w-px bg-gray-400" />
          </div>

          {/* Pace Labels */}
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>{Math.round(primaryPrediction.current_pace * 100)}% of target pace</span>
            <span>{getDaysUntil(primaryPrediction.target_date)} days left</span>
          </div>
        </div>

        {/* Predicted Completion */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Predicted Completion</span>
            <span className="text-sm font-medium text-gray-900">
              {formatDate(primaryPrediction.predicted_completion_date)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">Confidence</span>
            <span className="text-xs font-medium text-gray-700">
              {Math.round(primaryPrediction.confidence_score * 100)}%
            </span>
          </div>
        </div>

        {/* Recommendations */}
        {primaryPrediction.recommendations && primaryPrediction.recommendations.length > 0 && (
          <div>
            <button
              onClick={() => setExpandedId(expandedId === primaryPrediction.id ? null : primaryPrediction.id)}
              className="w-full flex items-center justify-between text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <span className="font-medium">
                💡 {primaryPrediction.recommendations.length} Recommendations
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${expandedId === primaryPrediction.id ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedId === primaryPrediction.id && (
              <ul className="mt-3 space-y-2">
                {primaryPrediction.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-indigo-500 mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Other Predictions (if more than one) */}
      {predictions.length > 1 && (
        <div className="border-t border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase mb-3">Other Goals</p>
          <div className="space-y-2">
            {predictions.slice(1).map((prediction) => {
              const status = getStatus(prediction.current_pace);
              return (
                <div
                  key={prediction.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm text-gray-700">{prediction.goal_type}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                    {Math.round(prediction.current_pace * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center">
          Updated {formatDate(primaryPrediction.calculated_at)}
        </p>
      </div>
    </div>
  );
};

export default ProgressPredictionWidget;
