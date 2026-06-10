"use client";

import { useState } from "react";
import type { HistoryEntry } from "../../lib/storage";

type TimeOfDay = "morning" | "afternoon" | "evening" | "latenight";

interface V3ContextReadCardProps {
  timeOfDay: TimeOfDay;
  insights: string[];
  hardNos: string[];
  recentHistory: HistoryEntry[];
  onSeeTop5?: () => void;
}

// Map insight phrases (from deriveInsights) to short chip labels
const INSIGHT_CHIP_MAP: Record<string, string> = {
  "Leaning quick and comforting": "Comfort pattern",
  "Keeping things fast and easy": "Quick meals",
  "Keeping things on the lighter side": "Light meals",
  "Going for bold flavors lately": "Bold flavors",
  "Going a little fancy lately": "Elevated picks",
  "On an Italian kick lately": "Italian kick",
  "Feeling Mediterranean lately": "Mediterranean",
  "Craving something fresh": "Fresh picks",
  "Sticking to crowd pleasers": "Crowd pleasers",
  "Picking easy meals more often": "Easy meals",
  "Going for quick meals lately": "Quick meals",
  "Deciding early — breakfast person?": "Morning decider",
  "Most active around lunchtime": "Lunch regular",
  "Most active around dinner time": "Dinner regular",
  "A late-night decider": "Late night eater",
};

function toChip(insight: string): string {
  if (INSIGHT_CHIP_MAP[insight]) return INSIGHT_CHIP_MAP[insight];
  const proteinMatch = insight.match(/^Picking (\w+) often$/);
  if (proteinMatch) {
    const p = proteinMatch[1];
    return `${p.charAt(0).toUpperCase() + p.slice(1)} meals`;
  }
  const drawnMatch = insight.match(/^Drawn to (.+)$/);
  if (drawnMatch) return drawnMatch[1];
  return insight;
}

const TIME_CHIPS: Record<TimeOfDay, string> = {
  morning: "Morning pick",
  afternoon: "Afternoon pick",
  evening: "This evening",
  latenight: "Late night",
};

const EYEBROW_LABEL: Record<TimeOfDay, string> = {
  morning: "Morning read",
  afternoon: "Afternoon read",
  evening: "Tonight\u2019s read",
  latenight: "Tonight\u2019s read",
};

const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: "morning",
  afternoon: "afternoon",
  evening: "evening",
  latenight: "night",
};

function pickHeadline(timeOfDay: TimeOfDay, insights: string[], hardNos: string[]): string {
  if (timeOfDay === "latenight" && insights.length > 0) return "Late night. Comfort pattern. No repeats.";
  if (timeOfDay === "latenight") return "Late night. We\u2019ve got you.";
  const label = TIME_LABELS[timeOfDay];
  if (insights.length >= 2) return `We know what kind of ${label} this is.`;
  if (insights.length === 1 && hardNos.length > 0) return `We know what kind of ${label} this is.`;
  if (insights.length > 0) return "You\u2019ve been here before. We adjusted.";
  return `We know what kind of ${label} this is.`;
}

// Which word in the headline should be italic + orange?
// Returns the word if found, otherwise null.
function findItalicWord(headline: string): string | null {
  const words = ["night", "adjusted", "before", "you"];
  for (const w of words) {
    if (headline.toLowerCase().includes(w)) return w;
  }
  return null;
}

function renderHeadline(headline: string) {
  const italicWord = findItalicWord(headline);
  if (!italicWord) return <>{headline}</>;
  const idx = headline.toLowerCase().indexOf(italicWord);
  if (idx === -1) return <>{headline}</>;
  const before = headline.slice(0, idx);
  const word = headline.slice(idx, idx + italicWord.length);
  const after = headline.slice(idx + italicWord.length);
  return (
    <>
      {before}
      <em style={{ fontStyle: "italic", color: "#E8621A" }}>{word}</em>
      {after}
    </>
  );
}

// Chip types
type ChipKind = "time" | "insight" | "hardno" | "avoidrepeat";

interface Chip {
  label: string;
  kind: ChipKind;
}

export default function V3ContextReadCard({
  timeOfDay,
  insights,
  hardNos,
  recentHistory,
  onSeeTop5,
}: V3ContextReadCardProps) {
  const headline = pickHeadline(timeOfDay, insights, hardNos);

  // Build chips from available data only — no invented data
  const chips: Chip[] = [];
  chips.push({ label: TIME_CHIPS[timeOfDay], kind: "time" });

  const seenLabels = new Set(chips.map((c) => c.label));
  for (const insight of insights.slice(0, 2)) {
    const label = toChip(insight);
    if (!seenLabels.has(label)) {
      chips.push({ label, kind: "insight" });
      seenLabels.add(label);
    }
  }

  for (const food of hardNos.slice(0, 2)) {
    chips.push({ label: `No ${food.toLowerCase()}`, kind: "hardno" });
  }

  const has24hHistory = recentHistory.some(
    (entry) => Date.now() - new Date(entry.chosenAt).getTime() < 24 * 60 * 60 * 1000,
  );
  if (has24hHistory) chips.push({ label: "Avoiding repeats", kind: "avoidrepeat" });

  const richContext = insights.length > 0 || hardNos.length > 0 || has24hHistory;

  // Local visual-only toggle for reasoning chips.
  // Does NOT affect scoring, deck generation, or Supabase.
  const [activeChips, setActiveChips] = useState<Set<string>>(
    new Set(chips.filter((c) => c.kind !== "hardno").map((c) => c.label))
  );
  const toggleChip = (label: string) => {
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div
      className="mx-[14px] mb-[14px] shrink-0 relative"
      style={{ margin: "26px 14px 6px" }}
    >
      {/* Halo — radial orange bloom behind the card top */}
      <div
        className="absolute pointer-events-none"
        style={{
          inset: "-2px -2px auto -2px",
          height: 60,
          borderRadius: 24,
          background: "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(232,98,26,0.4), transparent 70%)",
          filter: "blur(10px)",
          zIndex: 0,
        }}
      />

      {/* Card */}
      <div
        className="relative overflow-hidden"
        style={{
          zIndex: 1,
          borderRadius: 24,
          padding: "22px 22px 18px",
          background:
            "linear-gradient(180deg, rgba(255,231,202,0.085) 0%, rgba(255,231,202,0.025) 24%, rgba(255,231,202,0.012) 100%)",
          border: "1px solid rgba(245,237,224,0.16)",
          boxShadow:
            "0 24px 50px rgba(0,0,0,0.45), 0 0 40px rgba(232,98,26,0.05), inset 0 1px 0 rgba(255,255,255,0.07)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        {/* Glowing top edge — uses a div since ::before isn't available in JSX */}
        <div
          className="absolute candlelight-animate"
          style={{
            left: 18,
            right: 18,
            top: 0,
            height: 1.5,
            borderRadius: 2,
            background:
              "linear-gradient(90deg, transparent, #FF8A3D 30%, #E8621A 50%, #FF8A3D 70%, transparent)",
            boxShadow: "0 0 14px rgba(232,98,26,0.5)",
            animation: "candlelight-edge 5s ease-in-out infinite",
          }}
        />

        {/* Corner glow — top-right */}
        <div
          className="absolute pointer-events-none"
          style={{
            right: -30,
            top: -30,
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(232,98,26,0.18), transparent 62%)",
          }}
        />

        {/* Eyebrow — spark glyph + mono label */}
        <div
          className="flex items-center"
          style={{ gap: 9, marginBottom: 13 }}
        >
          {/* Spark: two crossed bars */}
          <span
            className="relative flex-shrink-0"
            style={{ width: 13, height: 13 }}
            aria-hidden="true"
          >
            <span
              className="absolute"
              style={{
                left: 5,
                top: 0,
                width: 3,
                height: 13,
                background: "#E8621A",
                borderRadius: 1,
                boxShadow: "0 0 6px rgba(232,98,26,0.5)",
              }}
            />
            <span
              className="absolute"
              style={{
                left: 0,
                top: 5,
                width: 13,
                height: 3,
                background: "#E8621A",
                borderRadius: 1,
                boxShadow: "0 0 6px rgba(232,98,26,0.5)",
              }}
            />
          </span>
          <span
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 10,
              letterSpacing: "2.6px",
              color: "#E8621A",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {EYEBROW_LABEL[timeOfDay]}
          </span>
        </div>

        {/* Headline — Instrument Serif with italic orange accent word */}
        <div style={{ marginBottom: 16 }}>
          <span
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontWeight: 400,
              fontSize: 30,
              lineHeight: 1.02,
              letterSpacing: "-0.01em",
              color: "#F6EEE2",
              maxWidth: 300,
              display: "block",
            }}
          >
            {renderHeadline(headline)}
          </span>
        </div>

        {/* Reasoning chips — local visual toggle, no scoring impact */}
        {chips.length > 0 && (
          <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 18 }}>
            {chips.map((chip) => {
              const isHardNo = chip.kind === "hardno";
              const isActive = activeChips.has(chip.label);
              return (
                <button
                  key={chip.label}
                  onClick={() => toggleChip(chip.label)}
                  className="inline-flex items-center transition-all active:scale-[0.94]"
                  style={{
                    gap: 7,
                    padding: "8px 13px",
                    borderRadius: 100,
                    background: isActive && !isHardNo
                      ? "rgba(232,98,26,0.10)"
                      : "rgba(255,231,202,0.05)",
                    border: isHardNo
                      ? "1px dashed rgba(245,237,224,0.085)"
                      : isActive
                      ? "1px solid rgba(232,98,26,0.26)"
                      : "1px solid rgba(245,237,224,0.085)",
                    fontFamily: "var(--font-sans, Inter, system-ui)",
                    fontWeight: 500,
                    fontSize: 12,
                    color: isHardNo ? "#C7BDAC" : "#F6EEE2",
                    cursor: "pointer",
                    transition: "background 0.2s, border-color 0.2s",
                  }}
                >
                  {/* Dot indicator */}
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: isHardNo
                        ? "#897E73"
                        : "#E8621A",
                      boxShadow: isHardNo
                        ? "none"
                        : isActive
                        ? "0 0 7px rgba(232,98,26,0.5)"
                        : "none",
                      opacity: isActive ? 1 : 0.45,
                    }}
                  />
                  {chip.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Footer — hairline separator + source text + Top 5 pill */}
        <div
          className="flex items-center justify-between"
          style={{
            paddingTop: 15,
            marginTop: 18,
            borderTop: "1px solid rgba(245,237,224,0.085)",
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-sans, Inter, system-ui)",
              fontWeight: 300,
              fontSize: 11,
              lineHeight: 1.45,
              color: "#897E73",
              maxWidth: 170,
            }}
          >
            {richContext
              ? "Built from your recent picks, timing, and hard NOs."
              : "Built from timing and your preferences."}
          </span>
          <button
            onClick={onSeeTop5}
            className="inline-flex items-center flex-shrink-0 transition-all hover:bg-[rgba(232,98,26,0.16)]"
            style={{
              gap: 7,
              padding: "9px 14px",
              borderRadius: 100,
              background: "rgba(232,98,26,0.08)",
              border: "1px solid rgba(232,98,26,0.26)",
              fontFamily: "var(--font-sans, Inter, system-ui)",
              fontWeight: 600,
              fontSize: 12.5,
              color: "#E8621A",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            See Top 5 <span style={{ display: "inline-block", transition: "transform 0.2s" }}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
