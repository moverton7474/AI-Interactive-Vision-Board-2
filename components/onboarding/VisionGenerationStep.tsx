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

// Shared placeholder SVG to avoid duplication
const createPlaceholderImage = () => {
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
      <text x="400" y="360" font-family="system-ui" font-size="14" fill="#8b9dc3" text-anchor="middle" opacity="0.7">Temporarily unavailable</text>
    </svg>
  `;
  return {
    id: `placeholder-${Date.now()}`,
    url: 'data:image/svg+xml,' + encodeURIComponent(placeholderSvg)
  };
};

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
  const [usedPlaceholder, setUsedPlaceholder] = useState(false);
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
        setUsedPlaceholder(false);

        // Build enhanced prompt
        const enhancedPrompt = `Create a beautiful, inspiring vision board image that represents: ${visionText}.
Style: photorealistic, aspirational, warm lighting, lifestyle imagery.
Theme: ${themeName || 'balanced and harmonious'}.
Make it feel achievable yet inspiring.`;

        console.log('[VisionGenerationStep] Starting vision generation...');
        const result = await generateVision(enhancedPrompt, photoRefId);
        setGeneratedVision(result);
        
        // Check if result is a placeholder (data URI)
        const isPlaceholder = result.url.startsWith('data:image/svg+xml');
        setUsedPlaceholder(isPlaceholder);
        
        if (isPlaceholder) {
          console.log('[VisionGenerationStep] Using placeholder image (real generation failed)');
        } else {
          console.log('[VisionGenerationStep] Successfully generated real vision image');
        }
        
        // Call callback once
        if (!hasCalledCallback) {
          onVisionGenerated(result.id, result.url);
          setHasCalledCallback(true);
        }
      } catch (err: any) {
        console.error('[VisionGenerationStep] Vision generation error:', err);
        
        // Use shared placeholder creation
        const placeholder = createPlaceholderImage();
        
        console.log('[VisionGenerationStep] Using fallback placeholder due to error');
        setGeneratedVision(placeholder);
        setUsedPlaceholder(true);
        setError('Generation is temporarily unavailable. Using a placeholder image.');
        
        // Call callback once with placeholder
        if (!hasCalledCallback) {
          onVisionGenerated(placeholder.id, placeholder.url);
          setHasCalledCallback(true);
        }
      } finally {
        setIsGenerating(false);
      }
    };

    generate();
    // Intentionally exclude hasCalledCallback from dependencies to prevent re-running effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visionText, themeName, photoRefId, generateVision, onVisionGenerated]);

  const handleRegenerate = async () => {
    setIsGenerating(true);
    setGeneratedVision(null);
    setError(null);
    setUsedPlaceholder(false);
    setHasCalledCallback(false);

    try {
      const enhancedPrompt = `Create a different beautiful, inspiring vision board image that represents: ${visionText}.
Style: photorealistic, aspirational, warm lighting, lifestyle imagery.
Theme: ${themeName || 'balanced and harmonious'}.
Make it feel achievable yet inspiring. Try a different perspective or composition.`;

      console.log('[VisionGenerationStep] Regenerating vision...');
      const result = await generateVision(enhancedPrompt, photoRefId);
      setGeneratedVision(result);
      
      // Check if result is a placeholder
      const isPlaceholder = result.url.startsWith('data:image/svg+xml');
      setUsedPlaceholder(isPlaceholder);
      
      if (isPlaceholder) {
        console.log('[VisionGenerationStep] Regeneration used placeholder (real generation failed)');
      } else {
        console.log('[VisionGenerationStep] Successfully regenerated real vision image');
      }
      
      onVisionGenerated(result.id, result.url);
      setHasCalledCallback(true);
    } catch (err: any) {
      console.error('[VisionGenerationStep] Regeneration error:', err);
      
      // Use shared placeholder creation
      const placeholder = createPlaceholderImage();
      
      console.log('[VisionGenerationStep] Using fallback placeholder after regeneration error');
      setGeneratedVision(placeholder);
      setUsedPlaceholder(true);
      setError('Generation is temporarily unavailable. Using a placeholder image.');
      
      onVisionGenerated(placeholder.id, placeholder.url);
      setHasCalledCallback(true);
    } finally {
      setIsGenerating(false);
    }
  };

  // Error state now shows placeholder with retry option instead of blocking
  // This allows the flow to continue while giving user option to retry

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

      {/* Actions */}
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

      {/* Success or Fallback Message */}
      {!usedPlaceholder ? (
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
      ) : (
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 flex items-start gap-3">
          <div className="w-8 h-8 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-amber-800">Using placeholder image</p>
            <p className="text-sm text-amber-700">
              Image generation is temporarily unavailable. You can continue and try regenerating from your dashboard later, or retry now.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisionGenerationStep;
