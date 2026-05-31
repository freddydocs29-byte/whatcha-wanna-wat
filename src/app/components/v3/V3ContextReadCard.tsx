"use client";

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
  // "Picking chicken often" → "Chicken meals"
  const proteinMatch = insight.match(/^Picking (\w+) often$/);
  if (proteinMatch) {
    const p = proteinMatch[1];
    return `${p.charAt(0).toUpperCase() + p.slice(1)} meals`;
  }
  // "Drawn to X" → "X"
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

function pickHeadline(timeOfDay: TimeOfDay, insights: string[], hardNos: string[]): string {
  if (timeOfDay === "latenight" && insights.length > 0) return "Late night. Comfort pattern. No repeats.";
  if (timeOfDay === "latenight") return "Late night. We\u2019ve got you.";
  if (insights.length >= 2) return "We know what kind of night this is.";
  if (insights.length === 1 && hardNos.length > 0) return "We know what kind of night this is.";
  if (insights.length > 0) return "You\u2019ve been here before. We adjusted.";
  return "We know what kind of night this is.";
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
  const chips: string[] = [];

  chips.push(TIME_CHIPS[timeOfDay]);

  // Up to 2 insight chips
  const seenChips = new Set(chips);
  for (const insight of insights.slice(0, 2)) {
    const chip = toChip(insight);
    if (!seenChips.has(chip)) {
      chips.push(chip);
      seenChips.add(chip);
    }
  }

  // Up to 2 hard NO chips
  for (const food of hardNos.slice(0, 2)) {
    chips.push(`No ${food.toLowerCase()}`);
  }

  // Anti-repeat chip: any history within last 24 h
  const has24hHistory = recentHistory.some(
    (entry) => Date.now() - new Date(entry.chosenAt).getTime() < 24 * 60 * 60 * 1000,
  );
  if (has24hHistory) chips.push("Avoiding repeats");

  const richContext = insights.length > 0 || hardNos.length > 0 || has24hHistory;

  return (
    <div
      className="mx-[14px] mb-[14px] rounded-[20px] shrink-0 relative overflow-hidden"
      style={{
        background: "#1E1C19",
        border: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "0 4px 28px rgba(0,0,0,0.35)",
      }}
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[20px]"
        style={{
          background: "#E8621A",
          boxShadow: "0 0 12px rgba(232,98,26,0.5)",
        }}
      />

      {/* Subtle radial glow */}
      <div
        className="absolute top-0 left-0 right-0 h-[60px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(232,98,26,0.07) 0%, transparent 100%)",
        }}
      />

      <div className="px-[16px] pt-[18px] pb-[14px] relative">
        {/* Eyebrow */}
        <div
          className="text-[9px] font-bold tracking-[2.5px] uppercase mb-[6px]"
          style={{ fontFamily: "var(--font-manrope)", color: "#504844" }}
        >
          TONIGHT&apos;S READ
        </div>

        {/* Headline */}
        <div className="mb-[12px]">
          <span
            className="text-[22px] font-bold leading-[1.2] text-white"
            style={{ fontFamily: "var(--font-nunito)" }}
          >
            {headline}
          </span>
        </div>

        {/* Context chips */}
        {chips.length > 0 && (
          <div className="flex gap-[6px] mb-[12px] flex-wrap">
            {chips.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center px-[10px] py-[5px] rounded-full text-[11px] font-semibold"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#A09894",
                  fontFamily: "var(--font-manrope)",
                }}
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center">
          <span
            className="text-[10px]"
            style={{ fontFamily: "var(--font-manrope)", color: "#504844" }}
          >
            {richContext
              ? "Built from your recent picks, timing, and hard NOs."
              : "Built from timing and your preferences."}
          </span>
          <button
            onClick={onSeeTop5}
            className="text-[11px] font-semibold bg-transparent border-0 cursor-pointer"
            style={{
              fontFamily: "var(--font-manrope)",
              color: "#E8621A",
            }}
          >
            See tonight&apos;s Top 5 ›
          </button>
        </div>
      </div>
    </div>
  );
}
