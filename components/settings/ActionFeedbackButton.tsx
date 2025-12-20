import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface ActionFeedbackButtonProps {
  actionId: string;
  actionType: string;
  existingFeedback?: {
    rating?: number;
    feedback_type?: string;
  };
  onFeedbackSubmitted?: () => void;
}

const ActionFeedbackButton: React.FC<ActionFeedbackButtonProps> = ({
  actionId,
  actionType,
  existingFeedback,
  onFeedbackSubmitted
}) => {
  const [showModal, setShowModal] = useState(false);
  const [rating, setRating] = useState<number | null>(existingFeedback?.rating || null);
  const [feedbackType, setFeedbackType] = useState<'thumbs_up' | 'thumbs_down' | null>(
    existingFeedback?.feedback_type as any || null
  );
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!existingFeedback);

  const handleQuickFeedback = async (type: 'thumbs_up' | 'thumbs_down') => {
    if (submitted || submitting) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('agent_action_feedback')
        .insert({
          user_id: user.id,
          action_id: actionId,
          feedback_type: type,
          rating: type === 'thumbs_up' ? 5 : 1,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      setFeedbackType(type);
      setRating(type === 'thumbs_up' ? 5 : 1);
      setSubmitted(true);
      onFeedbackSubmitted?.();
    } catch (err) {
      console.error('Feedback error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDetailedFeedback = async () => {
    if (!rating || submitting) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('agent_action_feedback')
        .insert({
          user_id: user.id,
          action_id: actionId,
          feedback_type: rating >= 4 ? 'thumbs_up' : rating <= 2 ? 'thumbs_down' : 'edited',
          rating,
          comment: comment || null,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      setSubmitted(true);
      setShowModal(false);
      onFeedbackSubmitted?.();
    } catch (err) {
      console.error('Feedback error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted && !showModal) {
    return (
      <div className="flex items-center gap-1">
        {feedbackType === 'thumbs_up' ? (
          <span className="text-green-400 text-sm" title="You liked this action">
            👍
          </span>
        ) : feedbackType === 'thumbs_down' ? (
          <span className="text-red-400 text-sm" title="You disliked this action">
            👎
          </span>
        ) : (
          <span className="text-yellow-400 text-sm" title={`Rated ${rating}/5`}>
            ★ {rating}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => handleQuickFeedback('thumbs_up')}
          disabled={submitting}
          className={`p-1 rounded transition-colors ${
            feedbackType === 'thumbs_up'
              ? 'text-green-400 bg-green-500/20'
              : 'text-slate-400 hover:text-green-400 hover:bg-green-500/10'
          }`}
          title="Helpful action"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
        </button>
        <button
          onClick={() => handleQuickFeedback('thumbs_down')}
          disabled={submitting}
          className={`p-1 rounded transition-colors ${
            feedbackType === 'thumbs_down'
              ? 'text-red-400 bg-red-500/20'
              : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
          }`}
          title="Not helpful"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
          </svg>
        </button>
        <button
          onClick={() => setShowModal(true)}
          className="p-1 text-slate-400 hover:text-white rounded transition-colors"
          title="Give detailed feedback"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        </button>
      </div>

      {/* Detailed Feedback Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>💬</span>
              Feedback for "{actionType.replace(/_/g, ' ')}"
            </h3>

            {/* Star Rating */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                How helpful was this action?
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`text-2xl transition-colors ${
                      rating && star <= rating
                        ? 'text-yellow-400'
                        : 'text-slate-600 hover:text-yellow-300'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {rating === 1 && 'Not helpful at all'}
                {rating === 2 && 'Slightly helpful'}
                {rating === 3 && 'Moderately helpful'}
                {rating === 4 && 'Very helpful'}
                {rating === 5 && 'Extremely helpful'}
              </p>
            </div>

            {/* Comment */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Additional comments (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell us more about your experience..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDetailedFeedback}
                disabled={!rating || submitting}
                className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ActionFeedbackButton;
