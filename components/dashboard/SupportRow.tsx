import React from 'react';

interface CoachData {
  lastInteraction?: string;
  themeName?: string;
}

interface MdalsData {
  lastSong?: string;
  lastLesson?: string;
}

interface FinancialData {
  goalTitle?: string;
  targetAmount?: number;
  currentProgress?: number;
}

interface Props {
  coach?: CoachData;
  mdals?: MdalsData;
  financial?: FinancialData;
  onCoachClick: () => void;
  onMdalsClick: () => void;
  onFinancialClick: () => void;
}

const SupportRow: React.FC<Props> = ({
  coach,
  mdals,
  financial,
  onCoachClick,
  onMdalsClick,
  onFinancialClick
}) => {
  // Format relative time for coach interaction
  const formatRelativeTime = (dateString?: string): string => {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  // Format currency
  const formatCurrency = (amount?: number): string => {
    if (!amount) return '$0';
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  };

  // Calculate financial progress percentage
  const financialProgress = financial?.targetAmount && financial?.currentProgress
    ? Math.min(Math.round((financial.currentProgress / financial.targetAmount) * 100), 100)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Coach Card */}
      <button
        onClick={onCoachClick}
        className="bg-gradient-to-br from-navy-900 to-navy-800 rounded-2xl p-5 text-left hover:shadow-lg transition-all group relative overflow-hidden"
      >
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-gold-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="relative z-10 flex items-start gap-4">
          <div className="w-12 h-12 bg-gold-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </div>

          <div className="flex-1">
            <h3 className="font-bold text-white">
              Talk to {coach?.themeName || 'Your Coach'}
            </h3>
            <p className="text-navy-300 text-sm mt-1">
              Last check-in: {formatRelativeTime(coach?.lastInteraction)}
            </p>
          </div>

          <svg
            className="w-5 h-5 text-navy-400 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0 mt-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>

        {/* Pulse Animation */}
        <div className="absolute top-4 left-4">
          <div className="w-12 h-12 rounded-xl border border-gold-500/30 animate-ping opacity-50" />
        </div>
      </button>

      {/* MDALS Card */}
      <button
        onClick={onMdalsClick}
        className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-2xl p-5 text-left hover:shadow-lg transition-all group"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
            <span className="text-2xl">🎵</span>
          </div>

          <div className="flex-1">
            <h3 className="font-bold text-white">MDALS Engine</h3>
            <p className="text-purple-300 text-sm mt-1">
              {mdals?.lastSong
                ? `Last: ${mdals.lastSong}`
                : 'Music-driven learning sessions'}
            </p>
          </div>

          <svg
            className="w-5 h-5 text-purple-400 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0 mt-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>

        {/* Decorative music notes */}
        <div className="absolute top-2 right-2 text-purple-400/20 text-4xl">♪</div>
      </button>

      {/* Financial Snapshot Card */}
      <button
        onClick={onFinancialClick}
        className="bg-white rounded-2xl p-5 text-left hover:shadow-lg transition-all group border border-gray-100"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
            <span className="text-2xl">💰</span>
          </div>

          <div className="flex-1">
            <h3 className="font-bold text-gray-900">
              {financial?.goalTitle || 'Financial Goal'}
            </h3>

            {financial?.targetAmount ? (
              <>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {formatCurrency(financial.targetAmount)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                      style={{ width: `${financialProgress}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-500">
                    {financialProgress}%
                  </span>
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-sm mt-1">
                Set up your financial goal
              </p>
            )}
          </div>

          <svg
            className="w-5 h-5 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    </div>
  );
};

export default SupportRow;
