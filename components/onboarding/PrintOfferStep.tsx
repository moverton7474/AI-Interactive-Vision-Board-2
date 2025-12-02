import React from 'react';

interface Props {
  visionImageUrl?: string;
  onViewPrintOptions: () => void;
  onSkip: () => void;
}

const PrintOfferStep: React.FC<Props> = ({ visionImageUrl, onViewPrintOptions, onSkip }) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <p className="text-gray-600">
          Make your vision tangible. Print it and place it where you'll see it every day.
        </p>
      </div>

      {/* Vision Preview */}
      {visionImageUrl && (
        <div className="relative mx-auto max-w-sm">
          {/* Frame mockup */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-4 rounded-lg shadow-2xl">
            <div className="bg-white p-2 rounded">
              <img
                src={visionImageUrl}
                alt="Your vision"
                className="w-full rounded aspect-[3/4] object-cover"
              />
            </div>
          </div>
          {/* Decorative shadow */}
          <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-3/4 h-4 bg-black/10 rounded-full blur-md" />
        </div>
      )}

      {/* Print Options */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-gold-500 to-gold-600 px-6 py-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            🖼️ Premium Vision Prints
          </h3>
          <p className="text-gold-100 text-sm">High-quality prints to manifest your dreams</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Option 1: Canvas */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg flex items-center justify-center">
              <span className="text-3xl">🎨</span>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">Gallery Canvas</h4>
              <p className="text-sm text-gray-500">Museum-quality stretched canvas</p>
            </div>
            <span className="text-navy-900 font-bold">$79</span>
          </div>

          {/* Option 2: Framed */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
              <span className="text-3xl">🖼️</span>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">Framed Poster</h4>
              <p className="text-sm text-gray-500">Premium frame with glass</p>
            </div>
            <span className="text-navy-900 font-bold">$59</span>
          </div>

          {/* Option 3: Poster */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
              <span className="text-3xl">📜</span>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">Premium Poster</h4>
              <p className="text-sm text-gray-500">Archival quality paper</p>
            </div>
            <span className="text-navy-900 font-bold">$29</span>
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 pb-6">
          <button
            onClick={onViewPrintOptions}
            className="w-full py-4 bg-gradient-to-r from-gold-500 to-gold-600 text-white font-bold rounded-xl hover:from-gold-600 hover:to-gold-700 transition-all shadow-lg hover:shadow-xl"
          >
            View Print Options
          </button>
        </div>
      </div>

      {/* Testimonial */}
      <div className="bg-navy-50 rounded-xl p-4 border border-navy-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-navy-200 rounded-full flex items-center justify-center text-lg">
            💬
          </div>
          <div>
            <p className="text-sm text-navy-700 italic">
              "Having my vision board printed and hanging in my office changed everything.
              I see it every morning and it keeps me focused on what matters."
            </p>
            <p className="text-xs text-navy-500 mt-2">— Sarah M., Visionary User</p>
          </div>
        </div>
      </div>

      {/* Skip Option */}
      <div className="text-center">
        <button
          onClick={onSkip}
          className="text-gray-500 hover:text-gray-700 text-sm underline"
        >
          Skip for now — I'll explore print options later
        </button>
      </div>
    </div>
  );
};

export default PrintOfferStep;
