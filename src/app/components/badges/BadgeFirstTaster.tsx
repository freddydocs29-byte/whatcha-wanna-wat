interface Props {
  width?: number;
  height?: number;
}

export default function BadgeFirstTaster({ width = 64, height = 64 }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={width}
      height={height}
      role="img"
      aria-label="First Taster badge"
    >
      <defs>
        <radialGradient id="ft-glow" cx="50%" cy="46%" r="50%">
          <stop offset="0%" stopColor="#F0C24A" stopOpacity="0.55" />
          <stop offset="65%" stopColor="#F0C24A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ft-rim" cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFF3CC" />
          <stop offset="45%" stopColor="#E7B449" />
          <stop offset="80%" stopColor="#B67F22" />
          <stop offset="100%" stopColor="#7A4E12" />
        </radialGradient>
        <linearGradient id="ft-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F7CE6B" />
          <stop offset="55%" stopColor="#DAA33A" />
          <stop offset="100%" stopColor="#B27A1E" />
        </linearGradient>
        <linearGradient id="ft-star" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF8E0" />
          <stop offset="100%" stopColor="#EDB84C" />
        </linearGradient>
        <filter id="ft-ds" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow
            dx="0"
            dy="1.2"
            stdDeviation="1.3"
            floodColor="#000000"
            floodOpacity="0.5"
          />
        </filter>
      </defs>
      <circle cx="32" cy="33" r="30" fill="url(#ft-glow)" />
      <g filter="url(#ft-ds)" strokeLinejoin="round">
        <path
          d="M32 6 L39.46 13.98 L50.38 13.62 L50.02 24.54 L58 32 L50.02 39.46 L50.38 50.38 L39.46 50.02 L32 58 L24.54 50.02 L13.62 50.38 L13.98 39.46 L6 32 L13.98 24.54 L13.62 13.62 L24.54 13.98 Z"
          fill="url(#ft-rim)"
          stroke="#6E440F"
          strokeWidth="0.6"
        />
        <circle
          cx="32"
          cy="32"
          r="16.5"
          fill="url(#ft-face)"
          stroke="#8A5A16"
          strokeWidth="0.8"
        />
        <path
          d="M32 21.5 L34.9 28.2 L42.2 28.9 L36.7 33.8 L38.3 41 L32 37.1 L25.7 41 L27.3 33.8 L21.8 28.9 L29.1 28.2 Z"
          fill="url(#ft-star)"
          stroke="#C98F2C"
          strokeWidth="0.5"
        />
        <ellipse cx="27" cy="20" rx="12" ry="6.5" fill="#FFFFFF" opacity="0.2" />
      </g>
    </svg>
  );
}
