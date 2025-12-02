import React from 'react';

interface Props {
  themeName?: string;
  onClick: () => void;
}

const TalkToCoachButton: React.FC<Props> = ({ themeName = 'Your Coach', onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-all group relative overflow-hidden"
    >
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-gold-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative z-10 flex items-center gap-4">
        {/* Mic Icon */}
        <div className="w-14 h-14 bg-gold-500 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        </div>

        {/* Text */}
        <div className="flex-1 text-left">
          <p className="font-bold text-lg">Talk to {themeName}</p>
          <p className="text-navy-300 text-sm">Get personalized guidance</p>
        </div>

        {/* Arrow */}
        <svg
          className="w-6 h-6 text-navy-400 group-hover:text-white group-hover:translate-x-1 transition-all"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* Pulse Animation Ring */}
      <div className="absolute top-1/2 left-9 -translate-y-1/2">
        <div className="w-14 h-14 rounded-full border-2 border-gold-500/30 animate-ping" />
      </div>
    </button>
  );
};

export default TalkToCoachButton;
