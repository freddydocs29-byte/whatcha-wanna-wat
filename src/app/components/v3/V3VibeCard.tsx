"use client";

import { useState } from "react";

const VIBES = [
  { key: "comfort", emoji: "☕", label: "Comfort", scriptText: "comfort food" },
  { key: "spicy", emoji: "🌶️", label: "Spicy", scriptText: "something spicy" },
  { key: "fresh", emoji: "🥗", label: "Fresh", scriptText: "something fresh" },
] as const;

// Per-vibe color themes — subtle and premium
const VIBE_THEMES: Record<string, {
  cardBg: string;
  accentBar: string;
  scriptColor: string;
  activePillBg: string;
  activePillBorder: string;
}> = {
  comfort: {
    cardBg: "#2A2420",
    accentBar: "#E8621A",
    scriptColor: "#E8621A",
    activePillBg: "#E8621A",
    activePillBorder: "#E8621A",
  },
  spicy: {
    cardBg: "#2D1A14",
    accentBar: "#C8400E",
    scriptColor: "#E84C14",
    activePillBg: "#C8400E",
    activePillBorder: "#C8400E",
  },
  fresh: {
    cardBg: "#1A2820",
    accentBar: "#3D7A54",
    scriptColor: "#5EAB78",
    activePillBg: "#3D7A54",
    activePillBorder: "#4A7C59",
  },
};

interface V3VibeCardProps {
  isSolo?: boolean;
  onSeeTop5?: () => void;
}

export default function V3VibeCard({ isSolo = false, onSeeTop5 }: V3VibeCardProps) {
  const [activeVibe, setActiveVibe] = useState<string>("comfort");
  const currentVibe = VIBES.find((v) => v.key === activeVibe)!;
  const theme = VIBE_THEMES[activeVibe];

  return (
    <div
      className="mx-[14px] mb-[14px] rounded-[18px] px-4 py-[14px] shrink-0 relative overflow-hidden border border-white/[0.04]"
      style={{
        background: theme.cardBg,
        transition: "background 0.35s ease",
      }}
    >
      {/* Top accent bar — shifts color per vibe */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: theme.accentBar, transition: "background 0.35s ease" }}
      />

      {/* Label */}
      <div
        className="text-[9px] font-bold tracking-[2px] uppercase text-[#5A5350] mb-[5px] mt-[2px]"
        style={{ fontFamily: "var(--font-manrope)" }}
      >
        YOUR VIBE TONIGHT
      </div>

      {/* Vibe text */}
      <div className="mb-[10px]">
        <span
          className="text-base font-extrabold text-white"
          style={{ fontFamily: "var(--font-nunito)" }}
        >
          We&apos;re thinking
        </span>
        <br />
        <span
          className="text-[26px] font-bold leading-[1.1]"
          style={{
            fontFamily: "'Dancing Script', cursive",
            color: theme.scriptColor,
            transition: "color 0.35s ease",
          }}
        >
          {currentVibe.scriptText}
        </span>
      </div>

      {/* Vibe buttons — horizontally scrollable/swipeable */}
      <div
        className="flex gap-2 mb-[10px] overflow-x-auto"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        {VIBES.map((vibe) => (
          <button
            key={vibe.key}
            onClick={() => setActiveVibe(vibe.key)}
            className={`flex items-center gap-[5px] px-[13px] py-[7px] rounded-full text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
              activeVibe === vibe.key
                ? "text-white"
                : "bg-[#1C1A18] border-[#3D3733] text-[#8A7F78]"
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
          className="text-[10px] text-[#5A5350]"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Based on: {isSolo ? "you, tonight" : "everyone, weeknight"}
        </span>
        <button
          onClick={onSeeTop5}
          className="text-[11px] font-semibold bg-transparent border-0 cursor-pointer"
          style={{ fontFamily: "var(--font-manrope)", color: theme.accentBar, transition: "color 0.35s ease" }}
        >
          See tonight&apos;s Top 5
        </button>
      </div>
    </div>
  );
}
