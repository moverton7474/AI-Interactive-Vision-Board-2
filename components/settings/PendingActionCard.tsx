/**
 * PendingActionCard Component
 *
 * Displays a pending agent action that requires user confirmation.
 * Includes confirm/cancel buttons with loading states and optional feedback.
 */

import React, { useState } from 'react';
import { PendingAgentAction, AgentActionRiskLevel } from '../../types';

interface PendingActionCardProps {
  action: PendingAgentAction;
  onConfirm: (actionId: string, feedback?: { rating?: number; comment?: string }) => Promise<boolean>;
  onCancel: (actionId: string, reason?: string) => Promise<boolean>;
  compact?: boolean;
}

const ACTION_ICONS: Record<string, string> = {
  'send_email': '📧',
  'send_sms': '💬',
  'voice_call': '📞',
  'make_voice_call': '📞',
  'create_task': '📝',
  'schedule_reminder': '⏰',
  'mark_habit_complete': '✅',
  'update_goal_progress': '🎯',
  'create_calendar_event': '📅',
  'send_email_to_contact': '📨',
};

const RISK_COLORS: Record<AgentActionRiskLevel, { bg: string; text: string; border: string }> = {
  'low': { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-700/50' },
  'medium': { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-700/50' },
  'high': { bg: 'bg-orange-900/30', text: 'text-orange-400', border: 'border-orange-700/50' },
  'critical': { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-700/50' },
};

const RISK_LABELS: Record<AgentActionRiskLevel, string> = {
  'low': 'Low Risk',
  'medium': 'Medium Risk',
  'high': 'High Risk',
  'critical': 'Critical',
};

export default function PendingActionCard({
  action,
  onConfirm,
  onCancel,
  compact = false,
}: PendingActionCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const icon = ACTION_ICONS[action.action_type] || '🤖';
  const riskColors = RISK_COLORS[action.risk_level] || RISK_COLORS['medium'];
  const riskLabel = RISK_LABELS[action.risk_level] || 'Unknown Risk';

  // Calculate time remaining
  const expiresAt = new Date(action.expires_at);
  const now = new Date();
  const minutesRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 60000));
  const isExpiringSoon = minutesRemaining < 5;

  // Format action payload for display
  const formatPayload = () => {
    const payload = action.action_payload || {};

    switch (action.action_type) {
      case 'send_email':
        return `To: ${payload.to}\nSubject: ${payload.subject}`;
      case 'send_sms':
        return `Message: "${payload.message}"`;
      case 'make_voice_call':
      case 'voice_call':
        return `Type: ${payload.call_type?.replace(/_/g, ' ')}\nMessage: "${payload.message}"`;
      case 'create_task':
        return `Task: "${payload.title}"${payload.due_date ? `\nDue: ${payload.due_date}` : ''}`;
      case 'create_calendar_event':
        return `Event: "${payload.title}"\nTime: ${payload.start_time}`;
      default:
        return JSON.stringify(payload, null, 2);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);

    const success = await onConfirm(action.id);

    if (!success) {
      setError('Failed to confirm action');
    }

    setConfirming(false);
  };

  const handleCancel = async () => {
    setCancelling(true);
    setError(null);

    const success = await onCancel(action.id, cancelReason || undefined);

    if (!success) {
      setError('Failed to cancel action');
    }

    setCancelling(false);
    setShowFeedback(false);
    setCancelReason('');
  };

  if (compact) {
    return (
      <div className={`flex items-center justify-between p-3 ${riskColors.bg} border ${riskColors.border} rounded-lg`}>
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <div>
            <div className="text-sm font-medium text-white capitalize">
              {action.action_type.replace(/_/g, ' ')}
            </div>
            <div className="text-xs text-slate-400">
              {minutesRemaining}m remaining
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            disabled={cancelling || confirming}
            className="px-3 py-1 text-xs font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors disabled:opacity-50"
          >
            {cancelling ? '...' : 'Decline'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming || cancelling}
            className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-500 rounded transition-colors disabled:opacity-50"
          >
            {confirming ? '...' : 'Approve'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${riskColors.bg} border ${riskColors.border} rounded-xl p-4 transition-all hover:border-opacity-80`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${riskColors.bg}`}>
            <span className="text-2xl">{icon}</span>
          </div>
          <div>
            <h4 className="text-base font-semibold text-white capitalize">
              {action.action_type.replace(/_/g, ' ')}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${riskColors.bg} ${riskColors.text}`}>
                {riskLabel}
              </span>
              {action.confidence_score && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-900/30 text-blue-400">
                  {Math.round(action.confidence_score * 100)}% confident
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Expiry Timer */}
        <div className={`text-right ${isExpiringSoon ? 'animate-pulse' : ''}`}>
          <div className={`text-xs font-medium ${isExpiringSoon ? 'text-red-400' : 'text-slate-400'}`}>
            {minutesRemaining > 0 ? `${minutesRemaining}m left` : 'Expiring...'}
          </div>
          <div className="text-xs text-slate-500">
            {new Date(action.created_at).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Action Details */}
      <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
        <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
          {formatPayload()}
        </pre>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-3 p-2 bg-red-900/30 border border-red-800 rounded text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Feedback Section (for cancel) */}
      {showFeedback && (
        <div className="mb-4 space-y-2">
          <label className="block text-xs text-slate-400">
            Why are you declining this action? (optional)
          </label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g., Not the right time, incorrect details..."
            className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 outline-none resize-none"
            rows={2}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {!showFeedback ? (
          <>
            <button
              onClick={() => setShowFeedback(true)}
              disabled={cancelling || confirming}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
            >
              Decline
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming || cancelling}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-500 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {confirming ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4" />
                  Approve Action
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                setShowFeedback(false);
                setCancelReason('');
              }}
              disabled={cancelling}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {cancelling ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <XIcon className="w-4 h-4" />
                  Confirm Decline
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* High Risk Warning */}
      {(action.risk_level === 'high' || action.risk_level === 'critical') && (
        <div className="mt-3 p-2 bg-orange-900/20 border border-orange-800/50 rounded text-xs text-orange-300 flex items-start gap-2">
          <WarningIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            This is a {riskLabel.toLowerCase()} action. Please review the details carefully before approving.
          </span>
        </div>
      )}
    </div>
  );
}

// Simple icon components
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}
