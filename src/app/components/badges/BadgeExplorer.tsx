interface Props {
  width?: number;
  height?: number;
}

export default function BadgeExplorer({ width = 64, height = 64 }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={width}
      height={height}
      role="img"
      aria-label="Explorer badge"
    >
      <defs>
        <radialGradient id="ex-glow" cx="50%" cy="46%" r="50%">
          <stop offset="0%" stopColor="#E0A93C" stopOpacity="0.5" />
          <stop offset="65%" stopColor="#E0A93C" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ex-rim" cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#FFF0C6" />
          <stop offset="45%" stopColor="#E4B34C" />
          <stop offset="80%" stopColor="#B47F26" />
          <stop offset="100%" stopColor="#754A12" />
        </radialGradient>
        <radialGradient id="ex-face" cx="42%" cy="36%" r="72%">
          <stop offset="0%" stopColor="#5C4A2A" />
          <stop offset="70%" stopColor="#3C2E16" />
          <stop offset="100%" stopColor="#281C0C" />
        </radialGradient>
        <linearGradient id="ex-nN" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0873A" />
          <stop offset="100%" stopColor="#C13B18" />
        </linearGradient>
        <linearGradient id="ex-nS" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBF3E4" />
          <stop offset="100%" stopColor="#D8C4A0" />
        </linearGradient>
        <filter id="ex-ds" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow
            dx="0"
            dy="1.2"
            stdDeviation="1.3"
            floodColor="#000000"
            floodOpacity="0.5"
          />
        </filter>
      </defs>
      <circle cx="32" cy="33" r="30" fill="url(#ex-glow)" />
      <g filter="url(#ex-ds)" strokeLinejoin="round">
        <path
          d="M41.57 8.9 L55.1 22.43 L55.1 41.57 L41.57 55.1 L22.43 55.1 L8.9 41.57 L8.9 22.43 L22.43 8.9 Z"
          fill="url(#ex-rim)"
          stroke="#6A430F"
          strokeWidth="0.6"
        />
        <path
          d="M40.2 13.2 L50.8 23.8 L50.8 40.2 L40.2 50.8 L23.8 50.8 L13.2 40.2 L13.2 23.8 L23.8 13.2 Z"
          fill="url(#ex-face)"
          stroke="#8A5A16"
          strokeWidth="0.8"
        />
        <g fill="#E9C264" stroke="none">
          <circle cx="32" cy="16.5" r="1" />
          <circle cx="47.5" cy="32" r="1" />
          <circle cx="32" cy="47.5" r="1" />
          <circle cx="16.5" cy="32" r="1" />
        </g>
        <path
          d="M32 18 L36 32 L32 30 L28 32 Z"
          fill="url(#ex-nN)"
          stroke="#9A2E12"
          strokeWidth="0.3"
        />
        <path
          d="M32 46 L36 32 L32 34 L28 32 Z"
          fill="url(#ex-nS)"
          stroke="#B9A47E"
          strokeWidth="0.3"
        />
        <circle
          cx="32"
          cy="32"
          r="2.6"
          fill="url(#ex-rim)"
          stroke="#6A430F"
          strokeWidth="0.5"
        />
        <ellipse cx="26" cy="21" rx="10" ry="5.5" fill="#FFFFFF" opacity="0.12" />
      </g>
    </svg>
  );
}
