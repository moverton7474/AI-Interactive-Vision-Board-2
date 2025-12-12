import React from 'react';

interface VisionaryLogoProps {
  variant?: 'full' | 'icon' | 'text';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'light' | 'dark' | 'gold';
  className?: string;
}

/**
 * Visionary AI Logo Component
 *
 * The logo features a "V" with ascending stairs and an upward arrow,
 * symbolizing growth, ascension, and achieving one's vision.
 *
 * Variants:
 * - full: Logo icon + "VISIONARY AI" text
 * - icon: Just the V logo icon
 * - text: Just the "VISIONARY AI" text
 *
 * Themes:
 * - light: Gold icon on transparent (for dark backgrounds)
 * - dark: Dark charcoal icon (for light backgrounds)
 * - gold: Full gold gradient effect
 */
export const VisionaryLogo: React.FC<VisionaryLogoProps> = ({
  variant = 'full',
  size = 'md',
  theme = 'light',
  className = '',
}) => {
  const sizes = {
    sm: { icon: 24, text: 'text-sm', gap: 'gap-1.5' },
    md: { icon: 32, text: 'text-base', gap: 'gap-2' },
    lg: { icon: 48, text: 'text-xl', gap: 'gap-3' },
    xl: { icon: 64, text: 'text-2xl', gap: 'gap-4' },
  };

  const themes = {
    light: {
      primary: '#C5A572',
      secondary: '#D4C08A',
      accent: '#A88B5C',
      text: 'text-gold-500',
    },
    dark: {
      primary: '#1A1A2E',
      secondary: '#252538',
      accent: '#2D2D44',
      text: 'text-navy-900',
    },
    gold: {
      primary: 'url(#goldGradient)',
      secondary: '#D4C08A',
      accent: '#A88B5C',
      text: 'text-gold-500',
    },
  };

  const currentSize = sizes[size];
  const currentTheme = themes[theme];

  const LogoIcon = () => (
    <svg
      width={currentSize.icon}
      height={currentSize.icon}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
    >
      <defs>
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4C08A" />
          <stop offset="50%" stopColor="#C5A572" />
          <stop offset="100%" stopColor="#A88B5C" />
        </linearGradient>
        <linearGradient id="goldGradientDark" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8B7149" />
          <stop offset="100%" stopColor="#A88B5C" />
        </linearGradient>
      </defs>

      {/* Main V shape - left stroke */}
      <path
        d="M8 12 L28 52 L32 52 L16 18 L8 12Z"
        fill={theme === 'gold' ? 'url(#goldGradient)' : currentTheme.primary}
      />

      {/* Main V shape - right stroke base */}
      <path
        d="M32 52 L28 52 L44 18 L48 12 L56 12 L32 52Z"
        fill={theme === 'gold' ? 'url(#goldGradient)' : currentTheme.primary}
      />

      {/* Ascending stairs on right side */}
      <rect x="42" y="28" width="6" height="4" fill={theme === 'gold' ? 'url(#goldGradientDark)' : currentTheme.accent} />
      <rect x="46" y="22" width="6" height="4" fill={theme === 'gold' ? 'url(#goldGradientDark)' : currentTheme.accent} />
      <rect x="50" y="16" width="6" height="4" fill={theme === 'gold' ? 'url(#goldGradientDark)' : currentTheme.accent} />

      {/* Upward arrow at top */}
      <path
        d="M53 8 L56 14 L54 14 L54 16 L52 16 L52 14 L50 14 L53 8Z"
        fill={theme === 'gold' ? 'url(#goldGradient)' : currentTheme.primary}
      />
    </svg>
  );

  const LogoText = () => (
    <span className={`font-serif font-bold tracking-wider ${currentSize.text} ${currentTheme.text}`}>
      VISIONARY AI
    </span>
  );

  if (variant === 'icon') {
    return <LogoIcon />;
  }

  if (variant === 'text') {
    return <LogoText />;
  }

  return (
    <div className={`flex items-center ${currentSize.gap} ${className}`}>
      <LogoIcon />
      <LogoText />
    </div>
  );
};

/**
 * Simplified V icon for favicons, app icons, and small displays
 */
export const VisionaryIcon: React.FC<{
  size?: number;
  className?: string;
  color?: string;
}> = ({
  size = 24,
  className = '',
  color = '#C5A572'
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="vIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#D4C08A" />
        <stop offset="50%" stopColor="#C5A572" />
        <stop offset="100%" stopColor="#A88B5C" />
      </linearGradient>
    </defs>

    {/* Simplified V with stairs */}
    <path
      d="M3 5 L10 19 L12 19 L6 8 L3 5Z"
      fill={color === 'gradient' ? 'url(#vIconGradient)' : color}
    />
    <path
      d="M12 19 L10 19 L16 8 L18 5 L21 5 L12 19Z"
      fill={color === 'gradient' ? 'url(#vIconGradient)' : color}
    />

    {/* Mini stairs */}
    <rect x="16" y="10" width="2" height="1.5" fill={color === 'gradient' ? 'url(#vIconGradient)' : color} opacity="0.8" />
    <rect x="17.5" y="8" width="2" height="1.5" fill={color === 'gradient' ? 'url(#vIconGradient)' : color} opacity="0.8" />
    <rect x="19" y="6" width="2" height="1.5" fill={color === 'gradient' ? 'url(#vIconGradient)' : color} opacity="0.8" />

    {/* Arrow tip */}
    <path
      d="M20 3 L21.5 5.5 L20.5 5.5 L20.5 6 L19.5 6 L19.5 5.5 L18.5 5.5 L20 3Z"
      fill={color === 'gradient' ? 'url(#vIconGradient)' : color}
    />
  </svg>
);

/**
 * Ascension progress icon - represents the climb/journey
 */
export const AscensionIcon: React.FC<{
  size?: number;
  className?: string;
  progress?: number; // 0-100
}> = ({
  size = 24,
  className = '',
  progress = 0
}) => {
  const filledSteps = Math.min(4, Math.floor(progress / 25));

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Stairs - bottom to top */}
      <rect x="2" y="18" width="5" height="4" fill={filledSteps >= 1 ? '#C5A572' : '#E5E7EB'} rx="0.5" />
      <rect x="7" y="14" width="5" height="4" fill={filledSteps >= 2 ? '#C5A572' : '#E5E7EB'} rx="0.5" />
      <rect x="12" y="10" width="5" height="4" fill={filledSteps >= 3 ? '#C5A572' : '#E5E7EB'} rx="0.5" />
      <rect x="17" y="6" width="5" height="4" fill={filledSteps >= 4 ? '#C5A572' : '#E5E7EB'} rx="0.5" />

      {/* Arrow at top */}
      <path
        d="M19.5 2 L22 5 L20.5 5 L20.5 6 L18.5 6 L18.5 5 L17 5 L19.5 2Z"
        fill={progress === 100 ? '#10B981' : '#C5A572'}
      />
    </svg>
  );
};

export default VisionaryLogo;
