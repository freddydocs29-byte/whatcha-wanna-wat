"use client";

import { forwardRef } from "react";
import type { FlavorTypeResult } from "../lib/flavor-type";
import { getBaseTypeLabel } from "../lib/flavor-type";

export type FlameCardProps = {
  mode: "solo" | "couples";
  userName?: string;
  partnerName?: string;
  flavorType?: FlavorTypeResult;
  data: {
    totalDecisions?: number;
    totalSessions?: number;
    totalMatchesTogether?: number;
    topCuisine?: string;
    topCuisinePct?: number;
    cuisineBreakdown?: Array<{ cuisine: string; count: number; pct: number }>;
    flavorTags?: string[];
    hardNos?: string[];
    allTimeNumber1?: {
      mealName: string;
      count?: number;
    };
    fastestMatchSeconds?: number | null;
    currentStreak?: number;
    insights?: string[];
  };
};

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

const FlameCard = forwardRef<HTMLDivElement, FlameCardProps>(function FlameCard(
  { mode, userName, partnerName, flavorType, data },
  ref
) {
  const {
    totalDecisions = 0,
    totalSessions = 0,
    totalMatchesTogether = 0,
    topCuisine,
    topCuisinePct,
    cuisineBreakdown = [],
    flavorTags = [],
    hardNos = [],
    allTimeNumber1,
    fastestMatchSeconds,
    currentStreak = 0,
    insights = [],
  } = data;

  // Title
  const title =
    mode === "couples"
      ? userName && partnerName
        ? `${userName} × ${partnerName}'s Flame`
        : "Your Flame Together"
      : userName
      ? `${userName}'s Flame`
      : "Your Flame";

  // Hero headline (used only when no flavorType is provided)
  const heroLine = topCuisine
    ? `${topCuisine} runs the table`
    : "Your taste runs deep";

  // Top 3 cuisines for bars
  const topThree = cuisineBreakdown.slice(0, 3);
  const maxPct = topThree[0]?.pct ?? 1;

  return (
    <div
      ref={ref}
      className="w-full max-w-sm mx-auto rounded-[24px] overflow-hidden"
      style={{ background: "#1C1A18", fontFamily: "inherit" }}
    >
      {/* ── Gradient accent bar ────────────────────────────────────────────── */}
      <div
        className="h-1 w-full"
        style={{ background: "linear-gradient(90deg, #E8621A 0%, #c4440e 100%)" }}
      />

      <div className="px-6 py-7 flex flex-col gap-6">
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span
              className="font-display font-black text-lg tracking-tight"
              style={{ color: "#E8621A" }}
            >
              Watcha?
            </span>
            <span
              className="text-[10px] font-semibold tracking-widest uppercase"
              style={{ color: "#8A7F78" }}
            >
              FLAVOR PROFILE
            </span>
          </div>
          <h1
            className="font-display font-black text-2xl leading-tight"
            style={{ color: "#FFFFFF" }}
          >
            {title}
          </h1>
        </div>

        {/* ── Hero stat ─────────────────────────────────────────────────────── */}
        <div
          className="rounded-[16px] px-5 py-5"
          style={{ background: "#2A2420" }}
        >
          {flavorType ? (
            <>
              <p
                className="font-display font-black text-3xl leading-tight"
                style={{ color: "#FFFFFF" }}
              >
                {flavorType.personalizedName}
              </p>
              <p
                className="font-body text-xs mt-1"
                style={{ color: "#E8621A" }}
              >
                {getBaseTypeLabel(flavorType.baseType)}
              </p>
              <p
                className="font-body text-sm mt-1.5"
                style={{ color: "#8A7F78" }}
              >
                {flavorType.tagline}
              </p>
            </>
          ) : (
            <>
              <p
                className="font-display font-black text-3xl leading-tight"
                style={{ color: "#FFFFFF" }}
              >
                {heroLine}
              </p>
              {topCuisinePct != null && topCuisinePct > 0 && (
                <p
                  className="font-body text-sm mt-1.5"
                  style={{ color: "#8A7F78" }}
                >
                  {topCuisinePct}% of your decisions
                </p>
              )}
            </>
          )}
        </div>

        {/* ── Cuisine bars ──────────────────────────────────────────────────── */}
        {topThree.length > 0 && (
          <div>
            <p
              className="text-[10px] font-semibold tracking-widest uppercase mb-3"
              style={{ color: "#8A7F78" }}
            >
              TOP CUISINES
            </p>
            <div className="flex flex-col gap-2.5">
              {topThree.map(({ cuisine, pct }) => {
                const barW = Math.round((pct / maxPct) * 100);
                return (
                  <div key={cuisine}>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="font-body text-sm font-semibold"
                        style={{ color: "#FFFFFF" }}
                      >
                        {cuisine}
                      </span>
                      <span
                        className="font-display font-bold text-sm"
                        style={{ color: "#E8621A" }}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div
                      className="h-1.5 w-full rounded-full overflow-hidden"
                      style={{ background: "#3D3733" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${barW}%`,
                          background: "linear-gradient(90deg, #E8621A, #c4440e)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Flavor tags ───────────────────────────────────────────────────── */}
        {(flavorTags.length > 0 || hardNos.length > 0) && (
          <div>
            {flavorTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {flavorTags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="font-body text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{
                      background: "#4A7C5920",
                      color: "#4A7C59",
                      border: "1px solid #4A7C5940",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {hardNos.length > 0 && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span
                  className="font-body text-xs"
                  style={{ color: "#8A7F78" }}
                >
                  Never showing:
                </span>
                {hardNos.map((item) => (
                  <span
                    key={item}
                    className="font-body text-xs px-2.5 py-1 rounded-full line-through"
                    style={{
                      background: "#3D3733",
                      color: "#8A7F78",
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── All-time #1 ───────────────────────────────────────────────────── */}
        {allTimeNumber1 && (
          <div
            className="rounded-[14px] px-4 py-4 border"
            style={{ background: "#2A2420", borderColor: "#E8621A30" }}
          >
            <p
              className="text-[10px] font-semibold tracking-widest uppercase mb-1"
              style={{ color: "#E8621A" }}
            >
              ALL-TIME #1
            </p>
            <p
              className="font-display font-black text-lg leading-tight"
              style={{ color: "#FFFFFF" }}
            >
              {allTimeNumber1.mealName}
            </p>
            {allTimeNumber1.count != null && allTimeNumber1.count > 1 && (
              <p
                className="font-body text-xs mt-0.5"
                style={{ color: "#8A7F78" }}
              >
                Chosen {allTimeNumber1.count}×
              </p>
            )}
          </div>
        )}

        {/* ── Stats row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2">
          {mode === "solo" ? (
            <>
              <StatCell
                label="Decisions"
                value={totalDecisions > 0 ? String(totalDecisions) : "—"}
              />
              <StatCell
                label="Sessions"
                value={totalSessions > 0 ? String(totalSessions) : "—"}
              />
              <StatCell
                label="Fastest"
                value={
                  fastestMatchSeconds != null
                    ? formatSeconds(fastestMatchSeconds)
                    : "—"
                }
              />
              <StatCell
                label="Streak"
                value={currentStreak > 0 ? `${currentStreak}d` : "—"}
              />
            </>
          ) : (
            <>
              <StatCell
                label="Matches"
                value={totalMatchesTogether > 0 ? String(totalMatchesTogether) : "—"}
              />
              <StatCell
                label="Sessions"
                value={totalSessions > 0 ? String(totalSessions) : "—"}
              />
              <StatCell
                label="Fastest"
                value={
                  fastestMatchSeconds != null
                    ? formatSeconds(fastestMatchSeconds)
                    : "—"
                }
              />
              <StatCell
                label="#1 Together"
                value={allTimeNumber1?.mealName?.split(" ")[0] ?? "—"}
              />
            </>
          )}
        </div>

        {/* ── Insights ──────────────────────────────────────────────────────── */}
        {insights.length > 0 && (
          <div>
            <p
              className="text-[10px] font-semibold tracking-widest uppercase mb-3"
              style={{ color: "#8A7F78" }}
            >
              WHAT THE DATA SAYS
            </p>
            <div className="flex flex-col gap-2">
              {insights.slice(0, 3).map((text, i) => (
                <p
                  key={i}
                  className="font-body text-sm leading-snug"
                  style={{ color: "#FFFFFF" }}
                >
                  {text}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div
          className="pt-4 border-t flex items-center justify-between"
          style={{ borderColor: "#3D3733" }}
        >
          <span
            className="font-display font-black text-sm"
            style={{ color: "#E8621A" }}
          >
            Watcha?
          </span>
          <span className="font-body text-xs" style={{ color: "#8A7F78" }}>
            Dinner decisions, finally settled.
          </span>
        </div>
      </div>
    </div>
  );
});

export default FlameCard;

// ── Sub-component ─────────────────────────────────────────────────────────────

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-[12px] px-2 py-3 flex flex-col items-center justify-center text-center"
      style={{ background: "#2A2420" }}
    >
      <span
        className="font-display font-black text-lg leading-none"
        style={{ color: "#E8621A" }}
      >
        {value}
      </span>
      <span
        className="font-body text-[10px] leading-tight mt-1"
        style={{ color: "#8A7F78" }}
      >
        {label}
      </span>
    </div>
  );
}
