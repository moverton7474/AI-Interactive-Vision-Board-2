import React, { useState } from 'react';

interface Props {
  financialTarget?: number;
  financialTargetLabel?: string;
  onTargetChange: (target: number | undefined, label: string) => void;
}

const PRESETS = [
  { value: 500000, label: '$500K', description: 'Comfortable retirement' },
  { value: 1000000, label: '$1M', description: 'Financial independence' },
  { value: 2000000, label: '$2M+', description: 'Wealth building' },
  { value: undefined, label: 'Not sure', description: 'Figure it out later' }
];

const FinancialTargetStep: React.FC<Props> = ({ financialTarget, financialTargetLabel, onTargetChange }) => {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(
    PRESETS.find(p => p.value === financialTarget)?.label || null
  );
  const [customAmount, setCustomAmount] = useState<string>(
    financialTarget && !PRESETS.find(p => p.value === financialTarget)
      ? financialTarget.toString()
      : ''
  );
  const [showCustom, setShowCustom] = useState(false);

  const handlePresetClick = (preset: typeof PRESETS[0]) => {
    setSelectedPreset(preset.label);
    setShowCustom(false);
    onTargetChange(preset.value, preset.label);
  };

  const handleCustomChange = (value: string) => {
    const numValue = value.replace(/[^0-9]/g, '');
    setCustomAmount(numValue);
    setSelectedPreset(null);
    const parsed = parseInt(numValue);
    if (parsed > 0) {
      onTargetChange(parsed, `$${parsed.toLocaleString()}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-gray-600">
          What's your financial target for this vision? This helps us create realistic action plans.
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Don't worry - you can adjust this anytime.
        </p>
      </div>

      {/* Preset Options */}
      <div className="grid grid-cols-2 gap-4">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePresetClick(preset)}
            className={`p-6 rounded-2xl border-2 transition-all text-left ${
              selectedPreset === preset.label && !showCustom
                ? 'border-navy-900 bg-navy-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <span className="text-2xl font-bold text-navy-900 block mb-1">
              {preset.label}
            </span>
            <span className="text-sm text-gray-500">{preset.description}</span>

            {selectedPreset === preset.label && !showCustom && (
              <div className="absolute top-3 right-3 w-5 h-5 bg-navy-900 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Custom Amount Toggle */}
      <div className="text-center">
        <button
          onClick={() => {
            setShowCustom(!showCustom);
            setSelectedPreset(null);
          }}
          className="text-navy-900 text-sm font-medium hover:underline"
        >
          {showCustom ? 'Use presets instead' : 'Enter a custom amount'}
        </button>
      </div>

      {/* Custom Amount Input */}
      {showCustom && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Target Amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
            <input
              type="text"
              value={customAmount ? parseInt(customAmount).toLocaleString() : ''}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder="1,000,000"
              className="w-full pl-8 pr-4 py-4 text-2xl font-bold text-navy-900 border border-gray-200 rounded-xl focus:ring-2 focus:ring-navy-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Context */}
      <div className="bg-gradient-to-r from-gold-50 to-amber-50 rounded-xl p-5 border border-gold-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gold-200 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-gold-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gold-800 mb-1">Why we ask</p>
            <p className="text-sm text-gold-700">
              Your financial target helps your AI coach create actionable steps
              that align with your resources and timeline. It's not about the
              exact number—it's about having a north star.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialTargetStep;
