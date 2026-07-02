"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BADGES, BADGE_ORDER } from "../lib/badges";
import type { BadgeProgress } from "../lib/badges";
import { computeBadges } from "../lib/badge-engine";
import { getUserId } from "../lib/identity";
import { trackEvent } from "../lib/analytics";
import { EVENT_BADGE_PAGE_VIEWED } from "../lib/analytics-events";
import BadgeSVG from "../components/badges/BadgeSVG";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BadgesPage() {
  const router = useRouter();
  const [badgeProgress, setBadgeProgress] = useState<BadgeProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const badgePageTrackedRef = useRef(false);

  useEffect(() => {
    const userId = getUserId();
    if (!userId) {
      setLoading(false);
      return;
    }
    computeBadges(userId)
      .then((result) => {
        setBadgeProgress(result.badges);
        if (!badgePageTrackedRef.current) {
          badgePageTrackedRef.current = true;
          trackEvent(EVENT_BADGE_PAGE_VIEWED, {
            earnedCount: result.badges.filter((b) => b.earned).length,
            totalBadges: BADGE_ORDER.length,
          });
        }
      })
      .catch(() => {
        // silent failure — page renders all locked
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const progressMap = new Map(badgeProgress.map((p) => [p.badgeId, p]));
  const earnedCount = BADGE_ORDER.filter(
    (id) => progressMap.get(id)?.earned === true,
  ).length;
  const firstEarnedId = BADGE_ORDER.find(
    (id) => progressMap.get(id)?.earned === true,
  );

  return (
    <div
      style={{
        background: "#0B0805",
        position: "relative",
        minHeight: "100vh",
        paddingBottom: 48,
      }}
    >
      {/* Back button */}
      <button
        onClick={() => router.back()}
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 100,
          padding: "6px 12px",
          fontFamily: "var(--font-jetbrains-mono), monospace",
          fontSize: 11,
          color: "#897E73",
          cursor: "pointer",
          letterSpacing: "0.5px",
          zIndex: 10,
        }}
      >
        ← Back
      </button>

      {/* Header */}
      <div style={{ padding: "48px 20px 0" }}>
        <p
          style={{
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontSize: 10,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            color: "#897E73",
            margin: 0,
            marginBottom: 10,
          }}
        >
          Your collection
        </p>
        <h1
          style={{
            fontFamily: "var(--font-quicksand), sans-serif",
            fontWeight: 700,
            fontSize: 32,
            color: "#F6EEE2",
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Badges.
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "#5A5248",
            lineHeight: 1.55,
            margin: "8px 0 32px",
          }}
        >
          Earned by using Watcha. No pressure — they show up when you least
          expect it.
        </p>
      </div>

      {/* Unlocked counter divider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
          padding: "0 16px",
        }}
      >
        <div
          style={{
            flex: 1,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(232,98,26,0.25))",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontSize: 9,
            color: "#E8621A",
            letterSpacing: "2px",
            whiteSpace: "nowrap",
          }}
        >
          {earnedCount} of 7 unlocked
        </span>
        <div
          style={{
            flex: 1,
            height: 1,
            background:
              "linear-gradient(90deg, rgba(232,98,26,0.25), transparent)",
          }}
        />
      </div>

      {/* Badge grid */}
      <div
        style={{
          padding: "0 16px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {!loading &&
          BADGE_ORDER.map((badgeId) => {
            const badge = BADGES[badgeId];
            const prog = progressMap.get(badgeId);
            const earned = prog?.earned === true;
            const isHero = earned && badgeId === firstEarnedId;
            const progress = prog?.progress ?? 0;
            const progressLabel = prog?.progressLabel;

            // ── Hero earned card ──────────────────────────────────────────
            if (isHero) {
              return (
                <div
                  key={badgeId}
                  style={{
                    gridColumn: "1 / -1",
                    background: "linear-gradient(145deg,#1C1208,#2A1A08)",
                    border: "1px solid rgba(232,98,26,0.3)",
                    borderRadius: 20,
                    padding: "24px 20px",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Top hairline */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 20,
                      right: 20,
                      height: 1,
                      background:
                        "linear-gradient(90deg, transparent, #E8621A, transparent)",
                    }}
                  />
                  {/* Ember pip */}
                  <div
                    style={{
                      position: "absolute",
                      top: 14,
                      right: 14,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#E8621A",
                      boxShadow:
                        "0 0 8px #E8621A, 0 0 16px rgba(232,98,26,0.6)",
                    }}
                  />
                  {/* Content */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      gap: 20,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        filter: `drop-shadow(0 0 16px ${badge.color.primary}80)`,
                        flexShrink: 0,
                      }}
                    >
                      <BadgeSVG badgeId={badgeId} size={72} locked={false} opacity={1} />
                    </div>
                    <div>
                      <p
                        style={{
                          fontFamily: "var(--font-jetbrains-mono), monospace",
                          fontSize: 9,
                          color: "#E8621A",
                          textTransform: "uppercase",
                          letterSpacing: "1.5px",
                          margin: 0,
                          marginBottom: 4,
                        }}
                      >
                        Earned
                      </p>
                      <p
                        style={{
                          fontFamily: "var(--font-quicksand), sans-serif",
                          fontWeight: 700,
                          fontSize: 16,
                          color: "#F6EEE2",
                          margin: 0,
                          marginBottom: 4,
                        }}
                      >
                        {badge.name}
                      </p>
                      <p
                        style={{
                          fontSize: 12,
                          color: "#897E73",
                          lineHeight: 1.4,
                          margin: 0,
                        }}
                      >
                        {badge.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            // ── Standard earned card ──────────────────────────────────────
            if (earned) {
              return (
                <div
                  key={badgeId}
                  style={{
                    background: "linear-gradient(145deg,#1C1208,#2A1A08)",
                    border: "1px solid rgba(232,98,26,0.3)",
                    borderRadius: 20,
                    padding: "20px 16px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: 9,
                      color: "#E8621A",
                      textTransform: "uppercase",
                      letterSpacing: "1.5px",
                      margin: 0,
                    }}
                  >
                    Earned
                  </p>
                  <BadgeSVG badgeId={badgeId} size={48} locked={false} opacity={1} />
                  <p
                    style={{
                      fontFamily: "var(--font-quicksand), sans-serif",
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#F6EEE2",
                      margin: 0,
                    }}
                  >
                    {badge.name}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: "#897E73",
                      lineHeight: 1.4,
                      margin: 0,
                    }}
                  >
                    {badge.description}
                  </p>
                </div>
              );
            }

            // ── Locked card ───────────────────────────────────────────────
            const isClose = progress > 0.4;
            return (
              <div
                key={badgeId}
                style={{
                  background: "#1C1A18",
                  borderRadius: 20,
                  padding: "20px 16px",
                  border: isClose
                    ? "1px solid rgba(232,98,26,0.15)"
                    : "1px solid rgba(245,237,224,0.05)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {isClose && (
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: 7,
                      color: "#E8621A",
                      background: "rgba(232,98,26,0.1)",
                      border: "1px solid rgba(232,98,26,0.25)",
                      borderRadius: 100,
                      padding: "2px 6px",
                      letterSpacing: "0.5px",
                    }}
                  >
                    CLOSE
                  </div>
                )}
                <BadgeSVG
                  badgeId={badgeId}
                  size={64}
                  locked={true}
                  opacity={1}
                />
                <p
                  style={{
                    fontFamily: "var(--font-quicksand), sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    color: isClose ? "#4A3828" : "#3A3530",
                    margin: "8px 0 4px",
                  }}
                >
                  {badge.name}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontSize: 9,
                    color: "#2A2520",
                    margin: 0,
                    marginBottom: 10,
                  }}
                >
                  {badge.criteria}
                </p>
                {/* Progress bar */}
                <div
                  style={{
                    height: 2,
                    background: "#111",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 1,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${progress * 100}%`,
                      background: "linear-gradient(90deg,#E8621A,#FF8A3D)",
                    }}
                  />
                </div>
                {/* Progress label */}
                <p
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontSize: 8,
                    textAlign: "right",
                    margin: 0,
                    marginTop: 4,
                    color: progress > 0 ? "#E8621A" : "#2A2520",
                  }}
                >
                  {progressLabel ?? badge.criteria}
                </p>
              </div>
            );
          })}
      </div>

      {/* Footer */}
      <div>
        <div
          style={{
            height: 1,
            background: "rgba(245,237,224,0.04)",
            margin: "28px 0 20px",
          }}
        />
        <p
          style={{
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontSize: 9,
            color: "#3A3530",
            textAlign: "center",
            letterSpacing: "0.8px",
            lineHeight: 1.7,
            padding: "0 20px",
            margin: 0,
            whiteSpace: "pre-line",
          }}
        >
          {"More badges coming as Watcha grows.\nKeep deciding together."}
        </p>
      </div>
    </div>
  );
}
