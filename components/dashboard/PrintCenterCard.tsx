import React from 'react';

interface Props {
  hasPrimaryVision: boolean;
  onClick: () => void;
}

const PrintCenterCard: React.FC<Props> = ({ hasPrimaryVision, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-200 hover:border-amber-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
          <span className="text-2xl">🖼️</span>
        </div>

        {/* Content */}
        <div className="flex-1 text-left">
          <p className="font-bold text-amber-900">Print Center</p>
          <p className="text-sm text-amber-700">
            {hasPrimaryVision
              ? 'Print your vision board, journals & more'
              : 'Create a vision first to unlock prints'}
          </p>
        </div>

        {/* Badge */}
        {hasPrimaryVision && (
          <div className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            NEW
          </div>
        )}
      </div>
    </button>
  );
};

export default PrintCenterCard;
