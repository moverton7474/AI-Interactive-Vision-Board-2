import React, { useState, useEffect } from 'react';

interface Props {
  visionText: string;
  themeName?: string;
  photoRefId?: string;
  onVisionGenerated: (visionId: string, visionUrl: string) => void;
  generateVision: (prompt: string, photoRef?: string) => Promise<{ id: string; url: string }>;
}

const GENERATION_MESSAGES = [
  "Crafting your vision...",
  "Painting your dream future...",
  "Adding the finishing touches...",
  "Almost there...",
  "Your vision is coming to life..."
];

const VisionGenerationStep: React.FC<Props> = ({
  visionText,
  themeName,
  photoRefId,
  onVisionGenerated,
  generateVision
}) => {
  const [isGenerating, setIsGenerating] = useState(true);
  const [generatedVision, setGeneratedVision] = useState<{ id: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const [hasCalledCallback, setHasCalledCallback] = useState(false);

  useEffect(() => {
    // Cycle through messages while generating
    if (isGenerating) {
      const interval = setInterval(() => {
        setMessageIndex(prev => (prev + 1) % GENERATION_MESSAGES.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  useEffect(() => {
    const generate = async () => {
      try {
        setIsGenerating(true);
        setError(null);

        // Build enhanced prompt
        const enhancedPrompt = `Create a beautiful, inspiring vision board image that represents: ${visionText}.
Style: photorealistic, aspirational, warm lighting, lifestyle imagery.
Theme: ${themeName || 'balanced and harmonious'}.
Make it feel achievable yet inspiring.`;

        const result = await generateVision(enhancedPrompt, photoRefId);
        setGeneratedVision(result);
        if (!hasCalledCallback) {
          console.log('✅ Vision generated successfully with real image');
          onVisionGenerated(result.id, result.url);
          setHasCalledCallback(true);
        }
      } catch (err: any) {
        console.error('Vision generation error:', err);
        
        // Use placeholder on failure
        const placeholderSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
            <defs>
              <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#1e3a5f"/>
                <stop offset="50%" style="stop-color:#2d4a6f"/>
                <stop offset="100%" style="stop-color:#0d1b2a"/>
              </linearGradient>
              <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#d4af37"/>
                <stop offset="100%" style="stop-color:#f4cf47"/>
              </linearGradient>
            </defs>
            <rect fill="url(#bg)" width="800" height="600"/>
            <text x="400" y="260" font-family="Georgia,serif" font-size="64" fill="url(#gold)" text-anchor="middle" opacity="0.9">✨</text>
            <text x="400" y="320" font-family="Georgia,serif" font-size="28" fill="#ffffff" text-anchor="middle" opacity="0.9">Your Vision</text>
            <text x="400" y="360" font-family="system-ui" font-size="14" fill="#8b9dc3" text-anchor="middle" opacity="0.7">Placeholder Image</text>
          </svg>
        `;
        const placeholderUrl = 'data:image/svg+xml,' + encodeURIComponent(placeholderSvg);
        const placeholderId = `placeholder-${Date.now()}`;
        
        setGeneratedVision({ id: placeholderId, url: placeholderUrl });
        if (!hasCalledCallback) {
          console.log('⚠️ Vision generation failed, using placeholder image');
          onVisionGenerated(placeholderId, placeholderUrl);
          setHasCalledCallback(true);
        }
        setError(err.message || 'Generation is temporarily unavailable. Using a placeholder image.');
      } finally {
        setIsGenerating(false);
      }
    };

    generate();
  }, [visionText, themeName, photoRefId, generateVision, onVisionGenerated, hasCalledCallback]);

  const handleRegenerate = async () => {
    setIsGenerating(true);
    setGeneratedVision(null);
    setError(null);
    setHasCalledCallback(false);

    try {
      const enhancedPrompt = `Create a different beautiful, inspiring vision board image that represents: ${visionText}.
Style: photorealistic, aspirational, warm lighting, lifestyle imagery.
Theme: ${themeName || 'balanced and harmonious'}.
Make it feel achievable yet inspiring. Try a different perspective or composition.`;

      const result = await generateVision(enhancedPrompt, photoRefId);
      setGeneratedVision(result);
      console.log('✅ Vision regenerated successfully with real image');
      onVisionGenerated(result.id, result.url);
      setHasCalledCallback(true);
    } catch (err: any) {
      console.error('Regeneration error:', err);
      
      // Use placeholder on failure
      const placeholderSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
          <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#1e3a5f"/>
              <stop offset="50%" style="stop-color:#2d4a6f"/>
              <stop offset="100%" style="stop-color:#0d1b2a"/>
            </linearGradient>
            <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#d4af37"/>
              <stop offset="100%" style="stop-color:#f4cf47"/>
            </linearGradient>
          </defs>
          <rect fill="url(#bg)" width="800" height="600"/>
          <text x="400" y="260" font-family="Georgia,serif" font-size="64" fill="url(#gold)" text-anchor="middle" opacity="0.9">✨</text>
          <text x="400" y="320" font-family="Georgia,serif" font-size="28" fill="#ffffff" text-anchor="middle" opacity="0.9">Your Vision</text>
          <text x="400" y="360" font-family="system-ui" font-size="14" fill="#8b9dc3" text-anchor="middle" opacity="0.7">Placeholder Image</text>
        </svg>
      `;
      const placeholderUrl = 'data:image/svg+xml,' + encodeURIComponent(placeholderSvg);
      const placeholderId = `placeholder-${Date.now()}`;
      
      setGeneratedVision({ id: placeholderId, url: placeholderUrl });
      console.log('⚠️ Vision regeneration failed, using placeholder image');
      onVisionGenerated(placeholderId, placeholderUrl);
      setHasCalledCallback(true);
      setError(err.message || 'Generation is temporarily unavailable. Using a placeholder image.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (error && !generatedVision) {
    return (
      <div className="text-center space-y-6">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Generation Failed</h3>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={handleRegenerate}
            className="bg-navy-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-navy-800 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="text-center space-y-8">
        {/* Loading Animation */}
        <div className="relative w-48 h-48 mx-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-navy-200 to-gold-200 rounded-2xl animate-pulse" />
          <div className="absolute inset-4 bg-gradient-to-br from-navy-300 to-gold-300 rounded-xl animate-pulse animation-delay-100" />
          <div className="absolute inset-8 bg-gradient-to-br from-navy-400 to-gold-400 rounded-lg animate-pulse animation-delay-200" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-12 h-12 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        </div>

        {/* Status Message */}
        <div>
          <p className="text-xl font-medium text-navy-900 mb-2 transition-all">
            {GENERATION_MESSAGES[messageIndex]}
          </p>
          <p className="text-gray-500">This usually takes 15-30 seconds</p>
        </div>

        {/* Vision Preview Text */}
        <div className="bg-gray-50 rounded-xl p-4 max-w-md mx-auto">
          <p className="text-sm text-gray-600 italic line-clamp-3">"{visionText}"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Generated Vision */}
      <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden">
        <img
          src={generatedVision?.url}
          alt="Your Vision"
          className="w-full aspect-[4/3] object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <h3 className="text-2xl font-serif font-bold mb-1">Your Vision</h3>
          <p className="text-white/80 text-sm line-clamp-2">{visionText}</p>
        </div>
      </div>

      {/* Show error message if generation failed but we have placeholder */}
      {error && (
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 flex items-start gap-3">
          <div className="w-8 h-8 bg-yellow-200 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800">Generation Unavailable</p>
            <p className="text-sm text-yellow-700 mb-2">
              {error}
            </p>
            <button
              onClick={handleRegenerate}
              className="text-sm text-yellow-800 font-medium hover:text-yellow-900 underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!error && (
        <div className="flex gap-4">
          <button
            onClick={handleRegenerate}
            className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Different Style
          </button>
        </div>
      )}

      {/* Success Message */}
      {!error && (
        <div className="bg-green-50 rounded-xl p-4 border border-green-200 flex items-start gap-3">
          <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-green-800">Vision created!</p>
            <p className="text-sm text-green-700">
              This will be your primary vision on the dashboard. You can create more visions later.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisionGenerationStep;
