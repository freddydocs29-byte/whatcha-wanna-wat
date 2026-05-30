"use client";

import { useState } from "react";

const VIBES = [
  { key: "comfort", emoji: "☕", label: "Comfort", scriptText: "comfort food" },
  { key: "spicy", emoji: "🌶️", label: "Spicy", scriptText: "something spicy" },
  { key: "fresh", emoji: "🥗", label: "Fresh", scriptText: "something fresh" },
] as const;

interface V3VibeCardProps {
  isSolo?: boolean;
  onSeeTop5?: () => void;
}

export default function V3VibeCard({ isSolo = false, onSeeTop5 }: V3VibeCardProps) {
  const [activeVibe, setActiveVibe] = useState<string>("comfort");
  const currentVibe = VIBES.find((v) => v.key === activeVibe)!;

  return (
    <div className="mx-[14px] mb-[14px] bg-[#2A2420] rounded-[18px] px-4 py-[14px] shrink-0">
      {/* Label */}
      <div
        className="text-[9px] font-bold tracking-[2px] uppercase text-[#5A5350] mb-[5px]"
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
          className="text-[26px] font-bold text-[#E8621A] leading-[1.1]"
          style={{ fontFamily: "'Dancing Script', cursive" }}
        >
          {currentVibe.scriptText}
        </span>
      </div>

      {/* Vibe buttons */}
      <div className="flex gap-2 mb-[10px] flex-wrap">
        {VIBES.map((vibe) => (
          <button
            key={vibe.key}
            onClick={() => setActiveVibe(vibe.key)}
            className={`flex items-center gap-[5px] px-[13px] py-[7px] rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              activeVibe === vibe.key
                ? "bg-[#E8621A] border-[#E8621A] text-white"
                : "bg-[#1C1A18] border-[#3D3733] text-[#8A7F78]"
            }`}
            style={{ fontFamily: "var(--font-manrope)" }}
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
          className="text-[11px] text-[#E8621A] font-semibold bg-transparent border-0 cursor-pointer"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          See top 5 ›
        </button>
      </div>
    </div>
  );
}
