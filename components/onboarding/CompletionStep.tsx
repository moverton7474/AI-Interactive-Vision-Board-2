import React, { useEffect, useState } from 'react';

interface Props {
  themeName?: string;
  visionImageUrl?: string;
  tasksCount: number;
  habitsCount: number;
  onComplete: () => void;
  // WOW Optimization: Background generation status
  visionGenerationStatus?: 'idle' | 'pending' | 'complete' | 'error';
  pendingVisionPromise?: Promise<{ id: string; url: string }> | null;
}

const CompletionStep: React.FC<Props> = ({
  themeName = 'Custom Coach',
  visionImageUrl,
  tasksCount,
  habitsCount,
  onComplete,
  visionGenerationStatus,
  pendingVisionPromise
}) => {
  const [showConfetti, setShowConfetti] = useState(false);
  const [isWaitingForVision, setIsWaitingForVision] = useState(
    visionGenerationStatus === 'pending' && !visionImageUrl
  );

  // Wait for vision generation if still pending
  useEffect(() => {
    if (visionGenerationStatus === 'pending' && pendingVisionPromise && !visionImageUrl) {
      setIsWaitingForVision(true);
      pendingVisionPromise
        .then(() => {
          setIsWaitingForVision(false);
        })
        .catch(() => {
          // Proceed even on error - user can still complete onboarding
          setIsWaitingForVision(false);
        });
    } else if (visionGenerationStatus === 'complete' || visionImageUrl) {
      setIsWaitingForVision(false);
    }
  }, [visionGenerationStatus, pendingVisionPromise, visionImageUrl]);

  useEffect(() => {
    // Trigger confetti animation only when not waiting
    if (!isWaitingForVision) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isWaitingForVision]);

  // Show loading state if vision is still generating
  if (isWaitingForVision) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">✨</span>
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-navy-900 mb-2">
            Finalizing Your Vision...
          </h2>
          <p className="text-gray-500">
            Just a few more seconds while we perfect your personalized vision board
          </p>
        </div>
        <div className="flex gap-2">
          <div className="w-2 h-2 bg-navy-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-navy-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-navy-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-center">
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                backgroundColor: ['#FFD700', '#1E3A5F', '#10B981', '#8B5CF6', '#EC4899'][Math.floor(Math.random() * 5)]
              }}
            />
          ))}
        </div>
      )}

      {/* Success Icon */}
      <div className="relative w-24 h-24 mx-auto">
        <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20" />
        <div className="relative w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      {/* Heading */}
      <div>
        <h2 className="text-2xl font-bold text-navy-900 mb-2">
          You're All Set! 🎉
        </h2>
        <p className="text-gray-600">
          Your personalized vision journey begins now.
        </p>
      </div>

      {/* Vision Preview */}
      {visionImageUrl && (
        <div className="mx-auto max-w-xs">
          <div className="relative rounded-2xl overflow-hidden shadow-xl">
            <img
              src={visionImageUrl}
              alt="Your vision"
              className="w-full aspect-square object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-white text-left">
              <p className="text-sm font-medium opacity-80">Your Vision</p>
              <p className="text-lg font-bold">Ready to Manifest</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-navy-50 rounded-xl p-4">
          <div className="text-2xl font-bold text-navy-900">1</div>
          <div className="text-xs text-navy-600">Vision Created</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <div className="text-2xl font-bold text-green-700">{tasksCount}</div>
          <div className="text-xs text-green-600">Action Tasks</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <div className="text-2xl font-bold text-purple-700">{habitsCount}</div>
          <div className="text-xs text-purple-600">Daily Habits</div>
        </div>
      </div>

      {/* Coach Message */}
      <div className="bg-gradient-to-br from-navy-900 to-navy-800 rounded-2xl p-6 text-white text-left">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gold-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">🎯</span>
          </div>
          <div>
            <p className="font-bold mb-1">Your {themeName} Coach</p>
            <p className="text-navy-200 text-sm">
              "Welcome to your journey! I'm here to guide you every step of the way.
              Check your dashboard daily — I'll have personalized insights and reminders
              to keep you on track. Let's make this vision a reality together!"
            </p>
          </div>
        </div>
      </div>

      {/* What's Next */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-left">
        <h3 className="font-bold text-navy-900 mb-4">What's Next?</h3>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-navy-900 text-xs font-bold">1</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Explore your Dashboard</p>
              <p className="text-sm text-gray-500">Your daily command center for progress</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-navy-900 text-xs font-bold">2</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Complete your first task</p>
              <p className="text-sm text-gray-500">Small wins build momentum</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-navy-900 text-xs font-bold">3</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Talk to your Coach</p>
              <p className="text-sm text-gray-500">Get personalized guidance anytime</p>
            </div>
          </li>
        </ul>
      </div>

      {/* CTA Button */}
      <button
        onClick={onComplete}
        className="w-full py-4 bg-gradient-to-r from-navy-900 to-navy-800 text-white font-bold rounded-xl hover:from-navy-800 hover:to-navy-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
      >
        Go to My Dashboard →
      </button>

      {/* Subtle footer */}
      <p className="text-xs text-gray-400">
        You can always access onboarding settings from your profile.
      </p>

      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          width: 10px;
          height: 10px;
          animation: confetti 3s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
};

export default CompletionStep;
