interface Props {
  width?: number;
  height?: number;
}

export default function BadgeFirstBite({ width = 64, height = 64 }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={width}
      height={height}
      role="img"
      aria-label="First Bite badge"
    >
      <defs>
        <radialGradient id="fb-glow" cx="50%" cy="46%" r="50%">
          <stop offset="0%" stopColor="#E8621A" stopOpacity="0.55" />
          <stop offset="65%" stopColor="#E8621A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fb-rim" cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFD9B0" />
          <stop offset="45%" stopColor="#F0873A" />
          <stop offset="80%" stopColor="#C45013" />
          <stop offset="100%" stopColor="#7A2E08" />
        </radialGradient>
        <radialGradient id="fb-plate" cx="40%" cy="34%" r="75%">
          <stop offset="0%" stopColor="#FBF3E4" />
          <stop offset="70%" stopColor="#E6D2B2" />
          <stop offset="100%" stopColor="#C9B189" />
        </radialGradient>
        <linearGradient id="fb-util" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F58A3E" />
          <stop offset="100%" stopColor="#C45013" />
        </linearGradient>
        <filter id="fb-ds" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow
            dx="0"
            dy="1.2"
            stdDeviation="1.3"
            floodColor="#000000"
            floodOpacity="0.5"
          />
        </filter>
      </defs>
      <circle cx="32" cy="33" r="30" fill="url(#fb-glow)" />
      <g filter="url(#fb-ds)">
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="url(#fb-rim)"
          stroke="#6E2A06"
          strokeWidth="0.6"
        />
        <circle
          cx="32"
          cy="32"
          r="19.5"
          fill="url(#fb-plate)"
          stroke="#B0946A"
          strokeWidth="0.8"
        />
        <g strokeLinecap="round" strokeLinejoin="round">
          <g transform="rotate(-17 32 33)" fill="url(#fb-util)" stroke="#9A3E0E" strokeWidth="0.4">
            <rect x="24.1" y="31" width="2.6" height="15" rx="1.3" />
            <rect x="21.7" y="18" width="1.5" height="12" rx="0.75" />
            <rect x="24.6" y="18" width="1.5" height="12" rx="0.75" />
            <rect x="27.5" y="18" width="1.5" height="12" rx="0.75" />
            <path d="M21.7 29.5 h7.3 a1 1 0 0 1 1 1 v0.5 a2.4 2.4 0 0 1 -2.4 2.4 h-4.5 a2.4 2.4 0 0 1 -2.4 -2.4 v-0.5 a1 1 0 0 1 1 -1 Z" />
          </g>
          <g transform="rotate(17 32 33)" fill="url(#fb-util)" stroke="#9A3E0E" strokeWidth="0.4">
            <path d="M38 18 c3 0.5 3.4 8 2.6 13 l-2.6 0 Z" />
            <rect x="36.7" y="30" width="2.6" height="16" rx="1.3" />
          </g>
        </g>
        <ellipse cx="26" cy="21" rx="12" ry="6.5" fill="#FFFFFF" opacity="0.16" />
      </g>
    </svg>
  );
}
