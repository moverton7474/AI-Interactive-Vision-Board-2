import React from 'react';

interface Props {
  className?: string;
}

export const AscensionIcon: React.FC<Props> = ({ className = "w-12 h-12" }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Rising sun/star symbol */}
    <circle cx="24" cy="24" r="8" fill="url(#ascensionGradient)" />
    <path
      d="M24 4L26 12L24 8L22 12L24 4Z"
      fill="#C9A961"
    />
    <path
      d="M24 44L26 36L24 40L22 36L24 44Z"
      fill="#C9A961"
    />
    <path
      d="M4 24L12 22L8 24L12 26L4 24Z"
      fill="#C9A961"
    />
    <path
      d="M44 24L36 22L40 24L36 26L44 24Z"
      fill="#C9A961"
    />
    {/* Diagonal rays */}
    <path
      d="M10 10L16 14L12 12L14 16L10 10Z"
      fill="#C9A961"
      opacity="0.7"
    />
    <path
      d="M38 10L34 16L36 12L32 14L38 10Z"
      fill="#C9A961"
      opacity="0.7"
    />
    <path
      d="M10 38L16 34L12 36L14 32L10 38Z"
      fill="#C9A961"
      opacity="0.7"
    />
    <path
      d="M38 38L32 34L36 36L34 32L38 38Z"
      fill="#C9A961"
      opacity="0.7"
    />
    {/* Ascending steps */}
    <path
      d="M18 32H22V28H26V24H30V20"
      stroke="#C9A961"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    <defs>
      <radialGradient id="ascensionGradient" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#F5E6C3" />
        <stop offset="100%" stopColor="#C9A961" />
      </radialGradient>
    </defs>
  </svg>
);

export default AscensionIcon;
