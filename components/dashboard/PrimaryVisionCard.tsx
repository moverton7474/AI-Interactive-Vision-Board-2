import React from 'react';

interface Props {
  visionUrl?: string;
  visionTitle?: string;
  onClick?: () => void;
}

const PrimaryVisionCard: React.FC<Props> = ({ visionUrl, visionTitle, onClick }) => {
  if (!visionUrl) {
    return (
      <button
        onClick={onClick}
        className="w-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl p-8 border-2 border-dashed border-gray-300 hover:border-navy-400 transition-colors group"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:shadow-md transition-shadow">
            <span className="text-3xl">🖼️</span>
          </div>
          <p className="font-semibold text-gray-700 mb-1">Create Your Vision</p>
          <p className="text-sm text-gray-500">Visualize your ideal future</p>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full relative rounded-2xl overflow-hidden group shadow-lg hover:shadow-xl transition-shadow"
    >
      <img
        src={visionUrl}
        alt={visionTitle || 'Your vision'}
        className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4 text-white text-left">
        <p className="text-xs text-white/70 mb-1">Your Vision</p>
        <p className="font-bold text-lg line-clamp-2">{visionTitle || 'My Future Life'}</p>
      </div>

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-navy-900/0 group-hover:bg-navy-900/20 transition-colors flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-2">
            <span className="text-navy-900 font-medium text-sm">View Gallery</span>
          </div>
        </div>
      </div>
    </button>
  );
};

export default PrimaryVisionCard;
