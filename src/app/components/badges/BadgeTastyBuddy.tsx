interface Props {
  width?: number;
  height?: number;
}

export default function BadgeTastyBuddy({ width = 64, height = 64 }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={width}
      height={height}
      role="img"
      aria-label="Tasty Buddy badge"
    >
      <defs>
        <radialGradient id="tb-glow" cx="50%" cy="46%" r="50%">
          <stop offset="0%" stopColor="#6FB35A" stopOpacity="0.5" />
          <stop offset="65%" stopColor="#6FB35A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tb-rim" cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#DCEEC4" />
          <stop offset="45%" stopColor="#7CB765" />
          <stop offset="80%" stopColor="#4A8438" />
          <stop offset="100%" stopColor="#2C5622" />
        </radialGradient>
        <linearGradient id="tb-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8FCB72" />
          <stop offset="55%" stopColor="#5C9E46" />
          <stop offset="100%" stopColor="#3C7530" />
        </linearGradient>
        <linearGradient id="tb-spoon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBF3E4" />
          <stop offset="100%" stopColor="#DCC9A6" />
        </linearGradient>
        <filter id="tb-ds" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow
            dx="0"
            dy="1.2"
            stdDeviation="1.3"
            floodColor="#000000"
            floodOpacity="0.5"
          />
        </filter>
      </defs>
      <circle cx="32" cy="33" r="30" fill="url(#tb-glow)" />
      <g filter="url(#tb-ds)" strokeLinejoin="round">
        <path
          d="M32 53 C16 42 10.5 30.5 18.5 22.5 C23.5 17.5 30 20.5 32 26 C34 20.5 40.5 17.5 45.5 22.5 C53.5 30.5 48 42 32 53 Z"
          fill="url(#tb-rim)"
          stroke="#254E1C"
          strokeWidth="0.6"
        />
        <path
          d="M32 48.6 C19.5 40 14.8 30.7 20.9 24.6 C24.7 20.8 29.6 22.9 31.4 27.2 L32 28.5 L32.6 27.2 C34.4 22.9 39.3 20.8 43.1 24.6 C49.2 30.7 44.5 40 32 48.6 Z"
          fill="url(#tb-face)"
          stroke="#3C7530"
          strokeWidth="0.5"
        />
        <g stroke="#C3AF8A" strokeWidth="0.4">
          <g transform="rotate(-20 32 34)">
            <ellipse cx="27" cy="27.5" rx="3.4" ry="4.4" fill="url(#tb-spoon)" />
            <rect x="25.8" y="31" width="2.4" height="10" rx="1.2" fill="url(#tb-spoon)" />
          </g>
          <g transform="rotate(20 32 34)">
            <ellipse cx="37" cy="27.5" rx="3.4" ry="4.4" fill="url(#tb-spoon)" />
            <rect x="35.8" y="31" width="2.4" height="10" rx="1.2" fill="url(#tb-spoon)" />
          </g>
        </g>
        <ellipse cx="26" cy="24" rx="11" ry="6" fill="#FFFFFF" opacity="0.18" />
      </g>
    </svg>
  );
}
