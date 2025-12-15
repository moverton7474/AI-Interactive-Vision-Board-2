import React from 'react';

interface Props {
  className?: string;
}

export const CrossIcon: React.FC<Props> = ({ className = "w-12 h-12" }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Cross with radiant glow */}
    <defs>
      <radialGradient id="crossGlow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#C9A961" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#C9A961" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="crossGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F5E6C3" />
        <stop offset="100%" stopColor="#C9A961" />
      </linearGradient>
    </defs>

    {/* Background glow */}
    <circle cx="24" cy="24" r="20" fill="url(#crossGlow)" />

    {/* Cross */}
    <rect x="21" y="8" width="6" height="32" rx="1" fill="url(#crossGradient)" />
    <rect x="10" y="16" width="28" height="6" rx="1" fill="url(#crossGradient)" />

    {/* Light rays */}
    <path
      d="M24 2L25 6L24 4L23 6L24 2Z"
      fill="#C9A961"
      opacity="0.6"
    />
    <path
      d="M24 46L25 42L24 44L23 42L24 46Z"
      fill="#C9A961"
      opacity="0.6"
    />
    <path
      d="M2 24L6 25L4 24L6 23L2 24Z"
      fill="#C9A961"
      opacity="0.6"
    />
    <path
      d="M46 24L42 25L44 24L42 23L46 24Z"
      fill="#C9A961"
      opacity="0.6"
    />
  </svg>
);

export default CrossIcon;
