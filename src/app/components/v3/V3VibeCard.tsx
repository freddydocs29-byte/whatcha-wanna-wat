"use client";

import { useState } from "react";

const VIBES = [
  { key: "comfort-me",    emoji: "🔥", label: "Comfort me",         scriptText: "the good stuff"           },
  { key: "keep-it-easy",  emoji: "⚡", label: "Keep it easy",       scriptText: "quick & simple"           },
  { key: "surprise-us",   emoji: "✨", label: "Surprise us",        scriptText: "something unexpected"     },
  { key: "healthy-reset", emoji: "🥗", label: "Healthy reset",      scriptText: "light & fresh"            },
  { key: "celebrate",     emoji: "🎉", label: "Celebrate something", scriptText: "special occasion energy" },
] as const;

type VibeKey = (typeof VIBES)[number]["key"];

// Per-vibe color themes — subtle and premium
const VIBE_THEMES: Record<VibeKey, {
  cardBg: string;
  glowColor: string;
  accentBar: string;
  scriptColor: string;
  activePillBg: string;
  activePillBorder: string;
}> = {
  "comfort-me": {
    cardBg: "#251F1A",
    glowColor: "rgba(232,98,26,0.07)",
    accentBar: "#E8621A",
    scriptColor: "#E8621A",
    activePillBg: "#E8621A",
    activePillBorder: "#E8621A",
  },
  "keep-it-easy": {
    cardBg: "#181D2A",
    glowColor: "rgba(58,107,200,0.07)",
    accentBar: "#3A6BC8",
    scriptColor: "#5A8AE8",
    activePillBg: "#3A6BC8",
    activePillBorder: "#4A7BD8",
  },
  "surprise-us": {
    cardBg: "#182424",
    glowColor: "rgba(42,184,168,0.07)",
    accentBar: "#2AB8A8",
    scriptColor: "#3AD8C8",
    activePillBg: "#2AB8A8",
    activePillBorder: "#35C8B8",
  },
  "healthy-reset": {
    cardBg: "#182420",
    glowColor: "rgba(61,122,84,0.07)",
    accentBar: "#3D7A54",
    scriptColor: "#5EAB78",
    activePillBg: "#3D7A54",
    activePillBorder: "#4A7C59",
  },
  "celebrate": {
    cardBg: "#251E14",
    glowColor: "rgba(200,154,58,0.07)",
    accentBar: "#C89A3A",
    scriptColor: "#E8B85A",
    activePillBg: "#C89A3A",
    activePillBorder: "#D8AA4A",
  },
};

interface V3VibeCardProps {
  isSolo?: boolean;
  onSeeTop5?: () => void;
}

export default function V3VibeCard({ isSolo = false, onSeeTop5 }: V3VibeCardProps) {
  const [activeVibe, setActiveVibe] = useState<VibeKey>("comfort-me");
  const currentVibe = VIBES.find((v) => v.key === activeVibe)!;
  const theme = VIBE_THEMES[activeVibe];

  return (
    <div
      className="mx-[14px] mb-[14px] rounded-[20px] shrink-0 relative overflow-hidden"
      style={{
        background: theme.cardBg,
        transition: "background 0.4s ease",
        border: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "0 4px 28px rgba(0,0,0,0.35)",
      }}
    >
      {/* Top accent bar — thicker, with soft glow */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[20px]"
        style={{
          background: theme.accentBar,
          transition: "background 0.4s ease",
          boxShadow: `0 0 12px ${theme.accentBar}80`,
        }}
      />

      {/* Subtle radial glow inside the card */}
      <div
        className="absolute top-0 left-0 right-0 h-[60px] pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 100% at 50% 0%, ${theme.glowColor} 0%, transparent 100%)`,
          transition: "background 0.4s ease",
        }}
      />

      <div className="px-[16px] pt-[18px] pb-[14px] relative">
        {/* Label */}
        <div
          className="text-[9px] font-bold tracking-[2.5px] uppercase mb-[6px]"
          style={{ fontFamily: "var(--font-manrope)", color: "#504844" }}
        >
          YOUR VIBE TONIGHT
        </div>

        {/* Vibe text */}
        <div className="mb-[12px]">
          <span
            className="text-[15px] font-extrabold text-white"
            style={{ fontFamily: "var(--font-nunito)" }}
          >
            We&apos;re thinking
          </span>
          <br />
          <span
            className="text-[28px] font-bold leading-[1.1]"
            style={{
              fontFamily: "'Dancing Script', cursive",
              color: theme.scriptColor,
              transition: "color 0.4s ease",
            }}
          >
            {currentVibe.scriptText}
          </span>
        </div>

        {/* Vibe buttons — horizontally scrollable/swipeable */}
        <div
          className="flex gap-[8px] mb-[12px] overflow-x-auto"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        >
          {VIBES.map((vibe) => (
            <button
              key={vibe.key}
              onClick={() => setActiveVibe(vibe.key)}
              className={`flex items-center gap-[5px] px-[12px] py-[7px] rounded-full text-[12px] font-semibold border transition-all cursor-pointer shrink-0 ${
                activeVibe === vibe.key
                  ? "text-white"
                  : "bg-transparent border-[#302C28] text-[#6A6260]"
              }`}
              style={
                activeVibe === vibe.key
                  ? {
                      background: theme.activePillBg,
                      borderColor: theme.activePillBorder,
                      transition: "background 0.25s ease, border-color 0.25s ease",
                    }
                  : {}
              }
              aria-pressed={activeVibe === vibe.key}
            >
              {vibe.emoji} {vibe.label}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center">
          <span
            className="text-[10px]"
            style={{ fontFamily: "var(--font-manrope)", color: "#504844" }}
          >
            Based on: {isSolo ? "you, tonight" : "everyone, tonight"}
          </span>
          <button
            onClick={onSeeTop5}
            className="text-[11px] font-semibold bg-transparent border-0 cursor-pointer"
            style={{
              fontFamily: "var(--font-manrope)",
              color: theme.accentBar,
              transition: "color 0.4s ease",
            }}
          >
            See tonight&apos;s Top 5 ›
          </button>
        </div>
      </div>
    </div>
  );
}
