interface Props {
  width?: number;
  height?: number;
}

export default function BadgeOnAStreak({ width = 64, height = 64 }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={width}
      height={height}
      role="img"
      aria-label="On a Streak badge"
    >
      <defs>
        <radialGradient id="st-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E23B2B" stopOpacity="0.55" />
          <stop offset="65%" stopColor="#E23B2B" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="st-outer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF7A3D" />
          <stop offset="45%" stopColor="#E23B2B" />
          <stop offset="100%" stopColor="#8C1218" />
        </linearGradient>
        <linearGradient id="st-inner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE07A" />
          <stop offset="55%" stopColor="#FFB03C" />
          <stop offset="100%" stopColor="#F5722A" />
        </linearGradient>
        <filter id="st-ds" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow
            dx="0"
            dy="1.2"
            stdDeviation="1.3"
            floodColor="#000000"
            floodOpacity="0.55"
          />
        </filter>
      </defs>
      <circle cx="32" cy="34" r="30" fill="url(#st-glow)" />
      <g filter="url(#st-ds)" strokeLinejoin="round">
        <path
          d="M32 6 C31 17 40 20 37 31 C42 27 44 33 41.5 40 C40 49 34.5 54 32 56 C29.5 54 22.5 50 21.5 41 C20.8 34 25 32 26 27 C27 33 30.5 33 30.5 29 C29.5 21 30 13 32 6 Z"
          fill="url(#st-outer)"
          stroke="#7A0F14"
          strokeWidth="0.7"
        />
        <path
          d="M32 24 C31 30 35.5 32 34 39 C33.4 44 32 48 32 48 C29.5 46.5 26.8 43.5 26.8 39 C26.8 34 30 33 32 24 Z"
          fill="url(#st-inner)"
        />
        <ellipse
          cx="28"
          cy="22"
          rx="4.5"
          ry="8"
          fill="#FFFFFF"
          opacity="0.18"
          transform="rotate(-12 28 22)"
        />
      </g>
    </svg>
  );
}
