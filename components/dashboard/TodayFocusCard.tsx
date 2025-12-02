import React from 'react';

interface Props {
  focus?: string;
  isLoading?: boolean;
}

const TodayFocusCard: React.FC<Props> = ({ focus, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-gold-50 to-amber-50 rounded-xl p-5 border border-gold-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold-200 rounded-full animate-pulse" />
          <div className="flex-1">
            <div className="h-4 bg-gold-200 rounded w-24 animate-pulse mb-2" />
            <div className="h-4 bg-gold-200 rounded w-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-gold-50 to-amber-50 rounded-xl p-5 border border-gold-200">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-gold-500 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-xl">🎯</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gold-800 mb-1">Today's Focus</p>
          <p className="text-gold-900 font-medium">
            {focus || "Set your intention for today"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TodayFocusCard;
