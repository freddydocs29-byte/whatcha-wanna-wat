interface Props {
  width?: number;
  height?: number;
}

export default function BadgeComfortZone({ width = 64, height = 64 }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={width}
      height={height}
      role="img"
      aria-label="Comfort Zone badge"
    >
      <defs>
        <radialGradient id="cz-glow" cx="50%" cy="52%" r="50%">
          <stop offset="0%" stopColor="#3E96A6" stopOpacity="0.5" />
          <stop offset="65%" stopColor="#3E96A6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cz-bowl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#63BECB" />
          <stop offset="45%" stopColor="#3E96A6" />
          <stop offset="100%" stopColor="#1C5766" />
        </linearGradient>
        <linearGradient id="cz-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#CFEEF2" />
          <stop offset="100%" stopColor="#5AA9B8" />
        </linearGradient>
        <radialGradient id="cz-inner" cx="50%" cy="18%" r="90%">
          <stop offset="0%" stopColor="#2A6B78" />
          <stop offset="100%" stopColor="#123E49" />
        </radialGradient>
        <linearGradient id="cz-steam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DCEEF0" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#DCEEF0" stopOpacity="0.75" />
        </linearGradient>
        <filter id="cz-ds" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow
            dx="0"
            dy="1.2"
            stdDeviation="1.3"
            floodColor="#000000"
            floodOpacity="0.5"
          />
        </filter>
      </defs>
      <circle cx="32" cy="34" r="30" fill="url(#cz-glow)" />
      <g strokeLinecap="round" fill="none" stroke="url(#cz-steam)" strokeWidth="2.4">
        <path d="M26 28 C22 24 30 20 26 15 C24 12.5 26 10 27 9" />
        <path d="M38 28 C42 24 34 20 38 15 C40 12.5 38 10 37 9" />
      </g>
      <g filter="url(#cz-ds)" strokeLinejoin="round">
        <path
          d="M12 32 L52 32 A20 20 0 0 1 12 32 Z"
          fill="url(#cz-bowl)"
          stroke="#12414C"
          strokeWidth="0.7"
        />
        <ellipse
          cx="32"
          cy="32"
          rx="20"
          ry="5.2"
          fill="url(#cz-inner)"
          stroke="#12414C"
          strokeWidth="0.7"
        />
        <ellipse
          cx="32"
          cy="31.4"
          rx="20"
          ry="4.6"
          fill="none"
          stroke="url(#cz-rim)"
          strokeWidth="1.1"
          strokeOpacity="0.8"
        />
        <rect
          x="26"
          y="50.5"
          width="12"
          height="4.5"
          rx="2.2"
          fill="url(#cz-bowl)"
          stroke="#12414C"
          strokeWidth="0.6"
        />
        <path
          d="M15 34 A18 18 0 0 0 30 48"
          fill="none"
          stroke="#BCE6EC"
          strokeWidth="1"
          strokeOpacity="0.35"
        />
      </g>
    </svg>
  );
}
