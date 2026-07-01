interface Props {
  width?: number;
  height?: number;
}

export default function BadgeNightOwl({ width = 64, height = 64 }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={width}
      height={height}
      role="img"
      aria-label="Night Owl badge"
    >
      <defs>
        <radialGradient id="no-glow" cx="50%" cy="46%" r="50%">
          <stop offset="0%" stopColor="#7C5CC4" stopOpacity="0.5" />
          <stop offset="65%" stopColor="#7C5CC4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="no-rim" cx="36%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#E0D2F7" />
          <stop offset="45%" stopColor="#8E6FD0" />
          <stop offset="80%" stopColor="#553CA0" />
          <stop offset="100%" stopColor="#2E1F63" />
        </radialGradient>
        <linearGradient id="no-face" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#8E70CF" />
          <stop offset="55%" stopColor="#5B41A6" />
          <stop offset="100%" stopColor="#3A2778" />
        </linearGradient>
        <linearGradient id="no-star" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF3CF" />
          <stop offset="100%" stopColor="#EBC55E" />
        </linearGradient>
        <filter id="no-ds" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow
            dx="0"
            dy="1.2"
            stdDeviation="1.3"
            floodColor="#000000"
            floodOpacity="0.5"
          />
        </filter>
      </defs>
      <circle cx="32" cy="33" r="30" fill="url(#no-glow)" />
      <g filter="url(#no-ds)" strokeLinejoin="round">
        <path
          d="M43 11.6 A24 24 0 1 0 43 52.4 A21 21 0 0 1 43 11.6 Z"
          fill="url(#no-rim)"
          stroke="#281A57"
          strokeWidth="0.6"
        />
        <path
          d="M42 15.6 A20 20 0 1 0 42 48.4 A17.4 17.4 0 0 1 42 15.6 Z"
          fill="url(#no-face)"
          stroke="#3A2778"
          strokeWidth="0.5"
        />
        <g fill="url(#no-star)" stroke="#C79A3A" strokeWidth="0.3">
          <path d="M35 22 l1.1 2.5 l2.7 0.3 l-2 1.9 l0.6 2.7 l-2.4 -1.4 l-2.4 1.4 l0.6 -2.7 l-2 -1.9 l2.7 -0.3 Z" />
          <circle cx="30" cy="34" r="1.4" />
          <circle cx="37.5" cy="38" r="1" />
        </g>
        <path
          d="M17 12 A24 24 0 0 0 17 53"
          fill="none"
          stroke="#B79EE8"
          strokeWidth="1"
          strokeOpacity="0.5"
        />
      </g>
    </svg>
  );
}
