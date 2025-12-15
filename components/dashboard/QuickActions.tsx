import React from 'react';

interface Props {
  onCoachClick: () => void;
  onReviewClick: () => void;
  onSettingsClick: () => void;
}

const QuickActions: React.FC<Props> = ({
  onCoachClick,
  onReviewClick,
  onSettingsClick
}) => {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Talk to Coach */}
      <button
        onClick={onCoachClick}
        className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white text-left hover:scale-[1.02] transition-transform shadow-md"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎙️</span>
          <div>
            <h3 className="font-bold text-sm">AI Coach</h3>
            <p className="text-xs text-white/70">Get guidance</p>
          </div>
        </div>
      </button>

      {/* Weekly Review */}
      <button
        onClick={onReviewClick}
        className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white text-left hover:scale-[1.02] transition-transform shadow-md"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📅</span>
          <div>
            <h3 className="font-bold text-sm">Weekly Review</h3>
            <p className="text-xs text-white/70">Reflect & plan</p>
          </div>
        </div>
      </button>

      {/* Settings */}
      <button
        onClick={onSettingsClick}
        className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl p-4 text-white text-left hover:scale-[1.02] transition-transform shadow-md"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚙️</span>
          <div>
            <h3 className="font-bold text-sm">Settings</h3>
            <p className="text-xs text-white/70">Preferences</p>
          </div>
        </div>
      </button>
    </div>
  );
};

export default QuickActions;
