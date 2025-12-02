import React from 'react';

interface Props {
  target?: number;
  current?: number;
  targetLabel?: string;
  onClick?: () => void;
}

const FinancialProgressCard: React.FC<Props> = ({ target, current = 0, targetLabel, onClick }) => {
  const percentage = target && target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount.toLocaleString()}`;
  };

  if (!target) {
    return (
      <button
        onClick={onClick}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center hover:border-navy-200 transition-colors"
      >
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-3xl">💰</span>
        </div>
        <p className="font-semibold text-gray-700">Set Financial Goal</p>
        <p className="text-sm text-gray-500 mt-1">Track your wealth journey</p>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:border-navy-200 transition-colors"
    >
      <div className="flex items-center gap-4">
        {/* Progress Ring */}
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-24 h-24 transform -rotate-90">
            {/* Background Circle */}
            <circle
              cx="48"
              cy="48"
              r="45"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="6"
            />
            {/* Progress Circle */}
            <circle
              cx="48"
              cy="48"
              r="45"
              fill="none"
              stroke="url(#gradient)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
          </svg>
          {/* Center Text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-gray-900">{Math.round(percentage)}%</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 text-left">
          <p className="text-sm text-gray-500 mb-1">Financial Goal</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(target)}</p>
          {targetLabel && (
            <p className="text-sm text-green-600 font-medium mt-1">{targetLabel}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            {formatCurrency(current)} saved
          </p>
        </div>
      </div>
    </button>
  );
};

export default FinancialProgressCard;
