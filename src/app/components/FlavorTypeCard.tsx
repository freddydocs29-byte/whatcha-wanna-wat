"use client";

import { forwardRef } from "react";
import type { FlavorTypeResult } from "../lib/flavor-type";
import type { SoloDNA } from "../lib/dna";

// ── Props ─────────────────────────────────────────────────────────────────────

export type FlavorTypeCardProps = {
  flavorType: FlavorTypeResult;
  userName?: string;
  soloDNA: SoloDNA;
  hardNos?: string[];
};

// ── Root dispatcher ───────────────────────────────────────────────────────────

const FlavorTypeCard = forwardRef<HTMLDivElement, FlavorTypeCardProps>(
  function FlavorTypeCard(props, ref) {
    switch (props.flavorType.baseType) {
      case "night_owl":      return <NightOwlCard      {...props} ref={ref} />;
      case "wildcard":       return <WildcardCard       {...props} ref={ref} />;
      case "explorer":       return <ExplorerCard       {...props} ref={ref} />;
      case "comfort_seeker": return <ComfortSeekerCard  {...props} ref={ref} />;
      case "purist":         return <PuristCard         {...props} ref={ref} />;
      case "diplomat":       return <DiplomatCard       {...props} ref={ref} />;
      case "creature_of_habit": return <CreatureCard    {...props} ref={ref} />;
      case "anchor":         return <AnchorCard         {...props} ref={ref} />;
      default:               return <NightOwlCard       {...props} ref={ref} />;
    }
  }
);

export default FlavorTypeCard;

// ── Shared helpers ────────────────────────────────────────────────────────────

function topCuisineList(
  soloDNA: SoloDNA,
  max = 3
): { cuisine: string; pct: number }[] {
  return soloDNA.topCuisines.slice(0, max);
}

function activeTags(soloDNA: SoloDNA, max = 4): string[] {
  return soloDNA.flavorTags.filter((t) => t.active).map((t) => t.tag).slice(0, max);
}

function WatchaFooter({ color = "#ffffff40" }: { color?: string }) {
  return (
    <div className="flex items-center justify-between mt-auto pt-3">
      <span style={{ color, fontWeight: 900, fontSize: 13, letterSpacing: "-0.5px" }}>
        Watcha?
      </span>
      <span style={{ color, fontSize: 10 }}>watcha-app.com</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. NIGHT OWL — CRT terminal
// ─────────────────────────────────────────────────────────────────────────────

const NightOwlCard = forwardRef<HTMLDivElement, FlavorTypeCardProps>(
  function NightOwlCard({ flavorType, userName, soloDNA }, ref) {
    const { personalizedName, tagline } = flavorType;
    const cuisines = topCuisineList(soloDNA);
    const tags = activeTags(soloDNA, 4);
    const name = userName ? userName.toUpperCase() : "USER";

    return (
      <div
        ref={ref}
        style={{
          background: "#090C07",
          fontFamily: "'Courier New', Courier, monospace",
          position: "relative",
          overflow: "hidden",
          borderRadius: 20,
          padding: "28px 24px 24px",
          display: "flex",
          flexDirection: "column",
          minHeight: 580,
        }}
      >
        {/* Scanlines overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
        {/* Green glow bleed */}
        <div
          style={{
            position: "absolute",
            top: -60,
            left: "50%",
            transform: "translateX(-50%)",
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "rgba(57,255,20,0.06)",
            filter: "blur(40px)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", flex: 1 }}>
          {/* Terminal header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 20,
            }}
          >
            {["#FF5F57", "#FFBD2E", "#28C840"].map((c) => (
              <div
                key={c}
                style={{ width: 10, height: 10, borderRadius: "50%", background: c }}
              />
            ))}
            <span
              style={{
                marginLeft: 8,
                fontSize: 10,
                color: "#39FF14",
                opacity: 0.6,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
            >
              wwe_flavor_profile.sh
            </span>
          </div>

          {/* Boot sequence header */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ color: "#39FF14", fontSize: 10, opacity: 0.5, marginBottom: 4, letterSpacing: "0.1em" }}>
              {">"} INITIALIZING FLAVOR PROFILE...
            </p>
            <p style={{ color: "#39FF14", fontSize: 10, opacity: 0.5, marginBottom: 10, letterSpacing: "0.1em" }}>
              {">"} USER: {name} — {soloDNA.totalDecisions} DECISIONS LOGGED
            </p>
            <div
              style={{
                borderTop: "1px solid #39FF1430",
                paddingTop: 14,
              }}
            >
              <p style={{ color: "#39FF1480", fontSize: 10, letterSpacing: "0.12em", marginBottom: 6 }}>
                TYPE ASSIGNED:
              </p>
              <h1
                style={{
                  color: "#39FF14",
                  fontSize: 22,
                  fontWeight: 900,
                  lineHeight: 1.15,
                  textShadow: "0 0 18px rgba(57,255,20,0.6)",
                  letterSpacing: "-0.5px",
                  marginBottom: 6,
                }}
              >
                {personalizedName}
              </h1>
              <p
                style={{
                  color: "#39FF14",
                  opacity: 0.65,
                  fontSize: 12,
                  fontStyle: "italic",
                  lineHeight: 1.4,
                }}
              >
                "{tagline}"
              </p>
            </div>
          </div>

          {/* Separator */}
          <p style={{ color: "#39FF1430", fontSize: 11, marginBottom: 14, letterSpacing: "0.05em" }}>
            {"─".repeat(36)}
          </p>

          {/* Stats as KEY=VALUE */}
          <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 5 }}>
            {cuisines.map(({ cuisine, pct }) => (
              <div key={cuisine} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "#39FF1460", fontSize: 10, minWidth: 24 }}>{">"}</span>
                <span style={{ color: "#39FF14", fontSize: 11, flex: 1 }}>
                  CUISINE=<span style={{ color: "#39FF14CC" }}>{cuisine.toUpperCase()}</span>
                </span>
                <span
                  style={{
                    color: "#39FF14",
                    fontSize: 11,
                    fontWeight: 700,
                    textShadow: "0 0 8px rgba(57,255,20,0.5)",
                  }}
                >
                  {pct}%
                </span>
              </div>
            ))}
          </div>

          {/* Separator */}
          <p style={{ color: "#39FF1430", fontSize: 11, marginBottom: 14 }}>
            {"─".repeat(36)}
          </p>

          {/* Stats block */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {[
              { k: "DECISIONS", v: String(soloDNA.totalDecisions) },
              { k: "STREAK", v: soloDNA.currentStreakDays > 0 ? `${soloDNA.currentStreakDays}d` : "—" },
              {
                k: "TOP PICK",
                v: soloDNA.allTimeNumber1
                  ? soloDNA.allTimeNumber1.mealName.split(" ").slice(0, 2).join(" ").toUpperCase()
                  : "—",
              },
              {
                k: "PEAK TIME",
                v: soloDNA.mostActiveTimeOfDay === "latenight"
                  ? "LATE NIGHT"
                  : soloDNA.mostActiveTimeOfDay
                  ? soloDNA.mostActiveTimeOfDay.toUpperCase()
                  : "—",
              },
            ].map(({ k, v }) => (
              <div
                key={k}
                style={{
                  background: "#39FF1408",
                  border: "1px solid #39FF1420",
                  borderRadius: 6,
                  padding: "7px 10px",
                }}
              >
                <p style={{ color: "#39FF1460", fontSize: 9, letterSpacing: "0.1em", marginBottom: 2 }}>
                  {k}
                </p>
                <p style={{ color: "#39FF14", fontSize: 13, fontWeight: 700 }}>{v}</p>
              </div>
            ))}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {tags.map((t) => (
                <span
                  key={t}
                  style={{
                    background: "#39FF1412",
                    border: "1px solid #39FF1430",
                    borderRadius: 4,
                    padding: "3px 8px",
                    color: "#39FF14",
                    fontSize: 10,
                    letterSpacing: "0.08em",
                  }}
                >
                  [{t.toUpperCase()}]
                </span>
              ))}
            </div>
          )}

          {/* Blink cursor row */}
          <p style={{ color: "#39FF14", fontSize: 11, opacity: 0.5, marginBottom: 16 }}>
            {">"} PROFILE LOCKED ▮
          </p>

          <WatchaFooter color="#39FF1450" />
        </div>
      </div>
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. WILDCARD — controlled chaos
// ─────────────────────────────────────────────────────────────────────────────

const WildcardCard = forwardRef<HTMLDivElement, FlavorTypeCardProps>(
  function WildcardCard({ flavorType, userName, soloDNA }, ref) {
    const { personalizedName, tagline } = flavorType;
    const cuisines = topCuisineList(soloDNA);
    const tags = activeTags(soloDNA, 5);

    return (
      <div
        ref={ref}
        style={{
          background: "#100B1A",
          borderRadius: 20,
          overflow: "hidden",
          position: "relative",
          padding: "28px 22px 24px",
          display: "flex",
          flexDirection: "column",
          minHeight: 580,
        }}
      >
        {/* Chaos blobs */}
        {[
          { top: -30, left: -30, w: 160, h: 160, color: "rgba(168,85,247,0.15)" },
          { top: 80, right: -40, w: 140, h: 140, color: "rgba(236,72,153,0.12)" },
          { bottom: 60, left: -20, w: 120, h: 120, color: "rgba(245,158,11,0.10)" },
          { bottom: -20, right: -30, w: 100, h: 100, color: "rgba(59,130,246,0.10)" },
        ].map((b, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: b.top,
              left: (b as { left?: number }).left,
              right: (b as { right?: number }).right,
              bottom: b.bottom,
              width: b.w,
              height: b.h,
              borderRadius: "50%",
              background: b.color,
              filter: "blur(35px)",
              pointerEvents: "none",
            }}
          />
        ))}

        {/* Tilted accent stripe */}
        <div
          style={{
            position: "absolute",
            top: 60,
            left: -20,
            right: -20,
            height: 2,
            background: "linear-gradient(90deg, transparent, #A855F7, #EC4899, transparent)",
            transform: "rotate(-2.5deg)",
            opacity: 0.5,
          }}
        />

        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", flex: 1 }}>
          {/* Header pill */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <span
              style={{
                background: "linear-gradient(135deg, #A855F7, #EC4899)",
                borderRadius: 30,
                padding: "4px 12px",
                fontSize: 10,
                fontWeight: 800,
                color: "#fff",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              ✦ Wildcard
            </span>
            <span
              style={{
                color: "#ffffff30",
                fontSize: 22,
                fontWeight: 900,
                transform: "rotate(12deg)",
                display: "inline-block",
              }}
            >
              ?
            </span>
          </div>

          {/* Tilted name block */}
          <div
            style={{
              background: "linear-gradient(135deg, #1E1030, #2A1040)",
              border: "1px solid #A855F730",
              borderRadius: 14,
              padding: "18px 16px",
              transform: "rotate(-1.2deg)",
              marginBottom: 16,
            }}
          >
            <h1
              style={{
                color: "#fff",
                fontSize: 23,
                fontWeight: 900,
                lineHeight: 1.15,
                letterSpacing: "-0.5px",
                marginBottom: 6,
              }}
            >
              {personalizedName}
            </h1>
            <p
              style={{
                color: "#A855F7",
                fontSize: 12,
                fontStyle: "italic",
                lineHeight: 1.4,
              }}
            >
              "{tagline}"
            </p>
          </div>

          {/* Stats grid — slightly misaligned on purpose */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 14,
              transform: "rotate(0.5deg)",
            }}
          >
            {[
              { label: "Decisions", value: String(soloDNA.totalDecisions), accent: "#A855F7" },
              { label: "Streak", value: soloDNA.currentStreakDays > 0 ? `${soloDNA.currentStreakDays}d` : "?", accent: "#EC4899" },
              {
                label: "#1 Pick",
                value: soloDNA.allTimeNumber1?.mealName.split(" ")[0] ?? "???",
                accent: "#F59E0B",
              },
              {
                label: "Top Cuisine",
                value: soloDNA.topCuisines[0]?.cuisine ?? "...",
                accent: "#3B82F6",
              },
            ].map(({ label, value, accent }) => (
              <div
                key={label}
                style={{
                  background: "#ffffff07",
                  border: `1px solid ${accent}30`,
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <p style={{ color: `${accent}99`, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>
                  {label}
                </p>
                <p style={{ color: "#fff", fontSize: 15, fontWeight: 900 }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Cuisine pills — scattered colors */}
          {cuisines.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ color: "#ffffff40", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
                ↯ Flavor Chaos
              </p>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {cuisines.map(({ cuisine, pct }, i) => {
                  const colors = ["#A855F7", "#EC4899", "#F59E0B"];
                  return (
                    <span
                      key={cuisine}
                      style={{
                        background: `${colors[i % colors.length]}18`,
                        border: `1px solid ${colors[i % colors.length]}40`,
                        borderRadius: 20,
                        padding: "4px 10px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: colors[i % colors.length],
                      }}
                    >
                      {cuisine} {pct}%
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Flavor tags */}
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 16 }}>
              {tags.map((t) => (
                <span
                  key={t}
                  style={{
                    color: "#ffffff50",
                    fontSize: 10,
                    padding: "3px 8px",
                    border: "1px solid #ffffff15",
                    borderRadius: 6,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <WatchaFooter color="#ffffff30" />
        </div>
      </div>
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. EXPLORER — worn passport
// ─────────────────────────────────────────────────────────────────────────────

const ExplorerCard = forwardRef<HTMLDivElement, FlavorTypeCardProps>(
  function ExplorerCard({ flavorType, userName, soloDNA }, ref) {
    const { personalizedName, tagline } = flavorType;
    const cuisines = topCuisineList(soloDNA, 4);
    const tags = activeTags(soloDNA, 3);
    const firstMatch = soloDNA.firstMatchEver
      ? new Date(soloDNA.firstMatchEver).getFullYear()
      : new Date().getFullYear();

    return (
      <div
        ref={ref}
        style={{
          background: "#0D1520",
          borderRadius: 20,
          overflow: "hidden",
          position: "relative",
          padding: "0",
          display: "flex",
          flexDirection: "column",
          minHeight: 580,
        }}
      >
        {/* Passport color top band */}
        <div
          style={{
            height: 6,
            background: "linear-gradient(90deg, #1B3A6B 0%, #8B3A2C 50%, #1B3A6B 100%)",
          }}
        />

        <div style={{ padding: "22px 22px 22px", display: "flex", flexDirection: "column", flex: 1 }}>
          {/* Passport header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <p
                style={{
                  color: "#B8935A",
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  marginBottom: 2,
                }}
              >
                ✦ Flavor Passport ✦
              </p>
              <p style={{ color: "#ffffff40", fontSize: 9, letterSpacing: "0.12em" }}>
                WATCHA? CULINARY AUTHORITY
              </p>
            </div>
            {/* Passport seal */}
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                border: "2px solid #B8935A50",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: "1px solid #B8935A40",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 18 }}>🌍</span>
              </div>
            </div>
          </div>

          {/* Divider line */}
          <div
            style={{
              borderTop: "1px solid #B8935A30",
              marginBottom: 16,
            }}
          />

          {/* Holder details */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <p style={{ color: "#B8935A80", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>
                  Holder
                </p>
                <p style={{ color: "#fff", fontSize: 16, fontWeight: 900, lineHeight: 1.1 }}>
                  {userName ?? "Explorer"}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ color: "#B8935A80", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>
                  Issued
                </p>
                <p style={{ color: "#B8935A", fontSize: 14, fontWeight: 700 }}>
                  {firstMatch}
                </p>
              </div>
            </div>

            <div
              style={{
                background: "#B8935A08",
                border: "1px solid #B8935A20",
                borderRadius: 10,
                padding: "14px 14px",
              }}
            >
              <p style={{ color: "#B8935A80", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
                Classification
              </p>
              <h1 style={{ color: "#fff", fontSize: 21, fontWeight: 900, lineHeight: 1.15, letterSpacing: "-0.3px", marginBottom: 5 }}>
                {personalizedName}
              </h1>
              <p style={{ color: "#B8935A", fontSize: 11, fontStyle: "italic", lineHeight: 1.4 }}>
                "{tagline}"
              </p>
            </div>
          </div>

          {/* Visa stamps */}
          <div style={{ marginBottom: 16 }}>
            <p
              style={{
                color: "#B8935A80",
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Territories Explored
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {cuisines.map(({ cuisine, pct }, i) => {
                const stampColors = ["#C0392B", "#1B3A6B", "#8B6914", "#2C6B3A"];
                const c = stampColors[i % stampColors.length];
                return (
                  <div
                    key={cuisine}
                    style={{
                      border: `2px solid ${c}`,
                      borderRadius: 8,
                      padding: "5px 10px",
                      position: "relative",
                      transform: `rotate(${[-1.5, 1.2, -0.8, 1.8][i] ?? 0}deg)`,
                    }}
                  >
                    <p style={{ color: c, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {cuisine}
                    </p>
                    <p style={{ color: `${c}99`, fontSize: 9, textAlign: "center" }}>
                      {pct}%
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Decisions", value: String(soloDNA.totalDecisions) },
              { label: "Cuisines", value: String(soloDNA.topCuisines.length) },
              { label: "Streak", value: soloDNA.currentStreakDays > 0 ? `${soloDNA.currentStreakDays}d` : "—" },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  flex: 1,
                  background: "#B8935A0A",
                  border: "1px solid #B8935A20",
                  borderRadius: 8,
                  padding: "8px 6px",
                  textAlign: "center",
                }}
              >
                <p style={{ color: "#B8935A", fontSize: 15, fontWeight: 900 }}>{value}</p>
                <p style={{ color: "#ffffff50", fontSize: 9, marginTop: 2, letterSpacing: "0.06em" }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
              {tags.map((t) => (
                <span
                  key={t}
                  style={{
                    background: "#B8935A10",
                    border: "1px solid #B8935A30",
                    borderRadius: 14,
                    padding: "3px 9px",
                    color: "#B8935A",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* MRZ-style bottom line */}
          <div
            style={{
              borderTop: "1px dashed #B8935A25",
              paddingTop: 10,
              marginTop: "auto",
            }}
          >
            <p
              style={{
                color: "#B8935A30",
                fontSize: 8,
                letterSpacing: "0.06em",
                fontFamily: "'Courier New', monospace",
              }}
            >
              WWE{(userName ?? "EXPLORER").toUpperCase().replace(/\s/g, "<").slice(0, 8).padEnd(8, "<")}&lt;&lt;{String(soloDNA.totalDecisions).padStart(4, "0")}&lt;
            </p>
            <WatchaFooter color="#B8935A40" />
          </div>
        </div>
      </div>
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. COMFORT SEEKER — laminated diner menu
// ─────────────────────────────────────────────────────────────────────────────

const ComfortSeekerCard = forwardRef<HTMLDivElement, FlavorTypeCardProps>(
  function ComfortSeekerCard({ flavorType, userName, soloDNA }, ref) {
    const { personalizedName, tagline } = flavorType;
    const cuisines = topCuisineList(soloDNA, 3);
    const tags = activeTags(soloDNA, 4);

    return (
      <div
        ref={ref}
        style={{
          background: "#1A0D08",
          borderRadius: 20,
          overflow: "hidden",
          position: "relative",
          minHeight: 580,
        }}
      >
        {/* Checkered top border */}
        <div style={{ display: "flex", height: 12 }}>
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: i % 2 === 0 ? "#C0392B" : "#F39C12",
              }}
            />
          ))}
        </div>

        <div style={{ padding: "20px 22px 20px" }}>
          {/* Diner header */}
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div
              style={{
                display: "inline-block",
                border: "2px solid #F39C12",
                borderRadius: 10,
                padding: "4px 16px",
                marginBottom: 8,
              }}
            >
              <p
                style={{
                  color: "#F39C12",
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                }}
              >
                ★ The Comfort Kitchen ★
              </p>
            </div>
            <p style={{ color: "#ffffff30", fontSize: 9, letterSpacing: "0.12em" }}>
              {userName ? `${userName}'s Order — Est. ${new Date().getFullYear()}` : `Est. ${new Date().getFullYear()}`}
            </p>
          </div>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <div style={{ flex: 1, borderTop: "1px solid #F39C1240" }} />
            <span style={{ color: "#F39C1260", fontSize: 10 }}>✦ ✦ ✦</span>
            <div style={{ flex: 1, borderTop: "1px solid #F39C1240" }} />
          </div>

          {/* Featured item box */}
          <div
            style={{
              background: "#F39C1208",
              border: "1px solid #F39C1230",
              borderRadius: 12,
              padding: "16px 14px",
              marginBottom: 16,
              position: "relative",
            }}
          >
            <p
              style={{
                position: "absolute",
                top: -8,
                left: 12,
                background: "#C0392B",
                color: "#fff",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.15em",
                padding: "2px 8px",
                borderRadius: 4,
                textTransform: "uppercase",
              }}
            >
              TODAY'S SPECIAL
            </p>
            <h1
              style={{
                color: "#fff",
                fontSize: 21,
                fontWeight: 900,
                lineHeight: 1.2,
                letterSpacing: "-0.3px",
                marginBottom: 6,
                marginTop: 4,
              }}
            >
              {personalizedName}
            </h1>
            <p
              style={{
                color: "#F39C12",
                fontSize: 12,
                fontStyle: "italic",
                lineHeight: 1.4,
              }}
            >
              "{tagline}"
            </p>
          </div>

          {/* Menu items */}
          {cuisines.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p
                style={{
                  color: "#C0392B",
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  textAlign: "center",
                  marginBottom: 10,
                }}
              >
                — Favorites —
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {cuisines.map(({ cuisine, pct }, i) => (
                  <div
                    key={cuisine}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: i < cuisines.length - 1 ? "1px dashed #ffffff12" : "none",
                      paddingBottom: i < cuisines.length - 1 ? 6 : 0,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#C0392B", fontSize: 10 }}>
                        {i === 0 ? "★" : i === 1 ? "◆" : "•"}
                      </span>
                      <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>
                        {cuisine}
                      </span>
                    </div>
                    <span
                      style={{
                        background: "#C0392B",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 900,
                        padding: "2px 7px",
                        borderRadius: 4,
                      }}
                    >
                      {pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <div style={{ flex: 1, borderTop: "1px dashed #ffffff15" }} />
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Visits", value: String(soloDNA.totalDecisions) },
              { label: "Streak", value: soloDNA.currentStreakDays > 0 ? `${soloDNA.currentStreakDays}d` : "—" },
              { label: "#1 Order", value: soloDNA.allTimeNumber1?.mealName.split(" ")[0] ?? "—" },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  flex: 1,
                  background: "#F39C1208",
                  border: "1px solid #F39C1220",
                  borderRadius: 8,
                  padding: "8px 6px",
                  textAlign: "center",
                }}
              >
                <p style={{ color: "#F39C12", fontSize: 15, fontWeight: 900 }}>{value}</p>
                <p style={{ color: "#ffffff50", fontSize: 9, marginTop: 2 }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Flavor tags */}
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
              {tags.map((t) => (
                <span
                  key={t}
                  style={{
                    background: "#C0392B12",
                    border: "1px solid #C0392B30",
                    borderRadius: 14,
                    padding: "3px 9px",
                    color: "#F39C12",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <WatchaFooter color="#F39C1250" />
        </div>

        {/* Checkered bottom border */}
        <div style={{ display: "flex", height: 12 }}>
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: i % 2 === 0 ? "#F39C12" : "#C0392B",
              }}
            />
          ))}
        </div>
      </div>
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. PURIST — stark editorial / redacted document
// ─────────────────────────────────────────────────────────────────────────────

const PuristCard = forwardRef<HTMLDivElement, FlavorTypeCardProps>(
  function PuristCard({ flavorType, userName, soloDNA, hardNos }, ref) {
    const { personalizedName, tagline } = flavorType;
    const cuisines = topCuisineList(soloDNA, 3);

    return (
      <div
        ref={ref}
        style={{
          background: "#050505",
          borderRadius: 20,
          overflow: "hidden",
          position: "relative",
          padding: "28px 24px 24px",
          display: "flex",
          flexDirection: "column",
          minHeight: 580,
          border: "1px solid #2A2A2A",
        }}
      >
        {/* Top rule */}
        <div style={{ borderTop: "3px solid #fff", marginBottom: 20 }} />

        {/* Section label */}
        <p
          style={{
            color: "#ffffff40",
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          Flavor Profile / Issue No. {soloDNA.totalDecisions}
        </p>

        {/* Big editorial name */}
        <div style={{ marginBottom: 18 }}>
          <h1
            style={{
              color: "#fff",
              fontSize: 28,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-1px",
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            {personalizedName}
          </h1>
          <div style={{ borderTop: "1px solid #ffffff20", paddingTop: 8 }}>
            <p style={{ color: "#ffffff60", fontSize: 12, lineHeight: 1.45, fontStyle: "italic" }}>
              "{tagline}"
            </p>
          </div>
        </div>

        {/* Redacted classification box */}
        <div
          style={{
            background: "#111",
            border: "1px solid #333",
            borderRadius: 8,
            padding: "14px 14px",
            marginBottom: 18,
          }}
        >
          <p style={{ color: "#ffffff40", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>
            Top Classifications
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {cuisines.map(({ cuisine, pct }) => (
              <div
                key={cuisine}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>
                  {cuisine}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 60,
                      height: 2,
                      background: "#333",
                      borderRadius: 2,
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        maxWidth: "100%",
                        height: "100%",
                        background: "#fff",
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  <span style={{ color: "#fff", fontSize: 11, fontWeight: 900, minWidth: 28 }}>
                    {pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Redacted section */}
        {(hardNos ?? []).length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <p style={{ color: "#ffffff30", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>
              Redacted — Never Served
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(hardNos ?? []).slice(0, 4).map((item) => (
                <div
                  key={item}
                  style={{
                    background: "#fff",
                    borderRadius: 3,
                    padding: "3px 10px",
                  }}
                >
                  <span style={{ color: "#050505", fontSize: 11, fontWeight: 900 }}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats — minimal */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 2,
            marginBottom: 18,
          }}
        >
          {[
            { label: "Decisions", value: String(soloDNA.totalDecisions) },
            { label: "Streak", value: soloDNA.currentStreakDays > 0 ? `${soloDNA.currentStreakDays}d` : "—" },
            {
              label: "Sessions",
              value: String(soloDNA.totalSessions),
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                background: "#111",
                padding: "10px 8px",
                textAlign: "center",
              }}
            >
              <p style={{ color: "#fff", fontSize: 16, fontWeight: 900 }}>{value}</p>
              <p style={{ color: "#ffffff40", fontSize: 8, letterSpacing: "0.08em", marginTop: 2, textTransform: "uppercase" }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* All-time #1 */}
        {soloDNA.allTimeNumber1 && (
          <div
            style={{
              borderLeft: "3px solid #fff",
              paddingLeft: 12,
              marginBottom: 18,
            }}
          >
            <p style={{ color: "#ffffff40", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>
              All-Time #1
            </p>
            <p style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>
              {soloDNA.allTimeNumber1.mealName}
            </p>
            {soloDNA.allTimeNumber1.count > 1 && (
              <p style={{ color: "#ffffff50", fontSize: 10, marginTop: 2 }}>
                Chosen {soloDNA.allTimeNumber1.count}×
              </p>
            )}
          </div>
        )}

        {/* Bottom rule */}
        <div style={{ marginTop: "auto", borderTop: "1px solid #333", paddingTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#ffffff40", fontSize: 10, fontWeight: 900, letterSpacing: "-0.3px" }}>
              Watcha?
            </span>
            <span style={{ color: "#ffffff25", fontSize: 9 }}>
              {userName ?? "—"} · {new Date().getFullYear()}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. DIPLOMAT — official resolution / treaty
// ─────────────────────────────────────────────────────────────────────────────

const DiplomatCard = forwardRef<HTMLDivElement, FlavorTypeCardProps>(
  function DiplomatCard({ flavorType, userName, soloDNA }, ref) {
    const { personalizedName, tagline } = flavorType;
    const cuisines = topCuisineList(soloDNA, 3);
    const tags = activeTags(soloDNA, 3);

    return (
      <div
        ref={ref}
        style={{
          background: "#070E1C",
          borderRadius: 20,
          overflow: "hidden",
          position: "relative",
          minHeight: 580,
        }}
      >
        {/* Gold top band */}
        <div
          style={{
            height: 4,
            background: "linear-gradient(90deg, #D4AF37, #F7E98E, #D4AF37)",
          }}
        />

        <div style={{ padding: "22px 22px 22px", display: "flex", flexDirection: "column", flex: 1 }}>
          {/* Official header */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            {/* Seal */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                border: "2px solid #D4AF3760",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 10px",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  border: "1px solid #D4AF3740",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#D4AF3708",
                }}
              >
                <span style={{ fontSize: 22 }}>⚖️</span>
              </div>
            </div>
            <p
              style={{
                color: "#D4AF37",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              Watcha? Culinary Authority
            </p>
            <p style={{ color: "#ffffff30", fontSize: 8, letterSpacing: "0.15em" }}>
              Office of Flavor Classification
            </p>
          </div>

          {/* Double border */}
          <div
            style={{
              border: "1px solid #D4AF3720",
              borderRadius: 12,
              padding: "1px",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                border: "1px solid #D4AF3715",
                borderRadius: 11,
                padding: "14px 14px",
              }}
            >
              <p
                style={{
                  color: "#D4AF3780",
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Resolution No. {soloDNA.totalDecisions} · Be It Resolved
              </p>
              <h1
                style={{
                  color: "#fff",
                  fontSize: 21,
                  fontWeight: 900,
                  lineHeight: 1.15,
                  letterSpacing: "-0.3px",
                  marginBottom: 7,
                }}
              >
                {personalizedName}
              </h1>
              <p
                style={{
                  color: "#D4AF37",
                  fontSize: 11,
                  fontStyle: "italic",
                  lineHeight: 1.45,
                }}
              >
                "{tagline}"
              </p>
            </div>
          </div>

          {/* Articles */}
          <div style={{ marginBottom: 16 }}>
            <p
              style={{
                color: "#D4AF3770",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              ⸻ Articles of Agreement
            </p>
            {cuisines.map(({ cuisine, pct }, i) => (
              <div
                key={cuisine}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  marginBottom: 8,
                  paddingBottom: 8,
                  borderBottom: i < cuisines.length - 1 ? "1px solid #D4AF3715" : "none",
                }}
              >
                <span
                  style={{
                    color: "#D4AF37",
                    fontSize: 10,
                    fontWeight: 900,
                    minWidth: 20,
                    marginTop: 1,
                  }}
                >
                  {["I.", "II.", "III."][i]}
                </span>
                <div style={{ flex: 1 }}>
                  <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>
                    {cuisine}
                  </span>
                  <span style={{ color: "#ffffff50", fontSize: 11, marginLeft: 6 }}>
                    ({pct}% of sessions)
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Decisions", value: String(soloDNA.totalDecisions) },
              { label: "Sessions", value: String(soloDNA.totalSessions) },
              { label: "Streak", value: soloDNA.currentStreakDays > 0 ? `${soloDNA.currentStreakDays}d` : "—" },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  flex: 1,
                  background: "#D4AF3708",
                  border: "1px solid #D4AF3720",
                  borderRadius: 8,
                  padding: "8px 6px",
                  textAlign: "center",
                }}
              >
                <p style={{ color: "#D4AF37", fontSize: 15, fontWeight: 900 }}>{value}</p>
                <p style={{ color: "#ffffff50", fontSize: 9, marginTop: 2, letterSpacing: "0.06em" }}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
              {tags.map((t) => (
                <span
                  key={t}
                  style={{
                    background: "#D4AF3710",
                    border: "1px solid #D4AF3730",
                    borderRadius: 14,
                    padding: "3px 9px",
                    color: "#D4AF37",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Signatory line */}
          <div style={{ marginTop: "auto", borderTop: "1px solid #D4AF3725", paddingTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ borderBottom: "1px solid #D4AF3740", paddingBottom: 2, marginBottom: 2 }}>
                  <span style={{ color: "#fff", fontSize: 11, fontStyle: "italic" }}>
                    {userName ?? "Signatory"}
                  </span>
                </div>
                <span style={{ color: "#D4AF3760", fontSize: 8, letterSpacing: "0.1em" }}>FLAVOR HOLDER</span>
              </div>
              <span style={{ color: "#D4AF3760", fontSize: 10, fontWeight: 900, letterSpacing: "-0.3px" }}>
                Watcha?
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. CREATURE OF HABIT — weekly schedule grid
// ─────────────────────────────────────────────────────────────────────────────

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

const CreatureCard = forwardRef<HTMLDivElement, FlavorTypeCardProps>(
  function CreatureCard({ flavorType, userName, soloDNA }, ref) {
    const { personalizedName, tagline } = flavorType;
    const topMeal = soloDNA.allTimeNumber1?.mealName ?? null;
    const topCuisine = soloDNA.topCuisines[0]?.cuisine ?? null;
    const tags = activeTags(soloDNA, 3);

    // Determine which days to "fill" based on streak and pattern
    const streak = soloDNA.currentStreakDays;
    const activeDays = new Set<string>();
    if (streak > 0) {
      // Fill last N days of the week
      const dayOrder = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
      for (let i = Math.max(0, 7 - streak); i < 7; i++) {
        activeDays.add(dayOrder[i]);
      }
    }

    // Preferred day type
    const prefersWeekend = soloDNA.mostActiveDayType === "weekend";
    const weekendDays = ["SAT", "SUN"];
    const weekdayDays = ["MON", "TUE", "WED", "THU", "FRI"];
    const highlightDays = new Set(
      activeDays.size > 0
        ? activeDays
        : prefersWeekend
        ? weekendDays
        : weekdayDays
    );

    return (
      <div
        ref={ref}
        style={{
          background: "#0E0C0A",
          borderRadius: 20,
          overflow: "hidden",
          position: "relative",
          padding: "26px 22px 24px",
          display: "flex",
          flexDirection: "column",
          minHeight: 580,
        }}
      >
        {/* Corner grid accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 80,
            height: 80,
            opacity: 0.04,
            backgroundImage:
              "linear-gradient(#E8621A 1px, transparent 1px), linear-gradient(90deg, #E8621A 1px, transparent 1px)",
            backgroundSize: "10px 10px",
          }}
        />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <p
              style={{
                color: "#E8621A",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Weekly Pattern
            </p>
            <h1
              style={{
                color: "#fff",
                fontSize: 20,
                fontWeight: 900,
                lineHeight: 1.15,
                letterSpacing: "-0.3px",
              }}
            >
              {personalizedName}
            </h1>
          </div>
          <div
            style={{
              background: "#E8621A",
              borderRadius: 8,
              padding: "6px 10px",
              textAlign: "center",
              flexShrink: 0,
            }}
          >
            <p style={{ color: "#fff", fontSize: 18, fontWeight: 900, lineHeight: 1 }}>
              {streak > 0 ? streak : soloDNA.totalDecisions}
            </p>
            <p style={{ color: "#ffffff80", fontSize: 8, marginTop: 1 }}>
              {streak > 0 ? "DAY\nSTREAK" : "TOTAL"}
            </p>
          </div>
        </div>

        {/* Tagline */}
        <p style={{ color: "#ffffff60", fontSize: 12, fontStyle: "italic", lineHeight: 1.4, marginBottom: 18 }}>
          "{tagline}"
        </p>

        {/* Weekly grid */}
        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              color: "#ffffff40",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Activity Pattern
          </p>
          <div style={{ display: "flex", gap: 4 }}>
            {DAYS.map((day) => {
              const active = highlightDays.has(day);
              return (
                <div
                  key={day}
                  style={{
                    flex: 1,
                    background: active ? "#E8621A" : "#2A2420",
                    borderRadius: 6,
                    padding: "8px 2px",
                    textAlign: "center",
                    border: active ? "none" : "1px solid #ffffff08",
                  }}
                >
                  <p
                    style={{
                      color: active ? "#fff" : "#ffffff40",
                      fontSize: 8,
                      fontWeight: 900,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {day}
                  </p>
                  {active && (
                    <div
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: "#fff",
                        margin: "3px auto 0",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recurring meal block */}
        {topMeal && (
          <div
            style={{
              background: "#E8621A12",
              border: "1px solid #E8621A30",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <p style={{ color: "#E8621A80", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 3 }}>
                The Usual
              </p>
              <p style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>
                {topMeal}
              </p>
            </div>
            {soloDNA.allTimeNumber1 && soloDNA.allTimeNumber1.count > 1 && (
              <div
                style={{
                  background: "#E8621A",
                  borderRadius: 8,
                  padding: "6px 10px",
                  textAlign: "center",
                }}
              >
                <p style={{ color: "#fff", fontSize: 16, fontWeight: 900 }}>
                  {soloDNA.allTimeNumber1.count}×
                </p>
                <p style={{ color: "#ffffff80", fontSize: 8 }}>TIMES</p>
              </div>
            )}
          </div>
        )}

        {/* Top cuisine */}
        {topCuisine && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ color: "#ffffff40", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
              Standing Order
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {soloDNA.topCuisines.slice(0, 3).map(({ cuisine, pct }) => (
                <div
                  key={cuisine}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#2A2420",
                    borderRadius: 8,
                    padding: "6px 10px",
                  }}
                >
                  <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{cuisine}</span>
                  <span style={{ color: "#E8621A", fontSize: 11, fontWeight: 900 }}>{pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
            {tags.map((t) => (
              <span
                key={t}
                style={{
                  background: "#E8621A10",
                  border: "1px solid #E8621A25",
                  borderRadius: 14,
                  padding: "3px 9px",
                  color: "#E8621A",
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <WatchaFooter color="#E8621A50" />
      </div>
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. ANCHOR — championship / varsity energy
// ─────────────────────────────────────────────────────────────────────────────

const AnchorCard = forwardRef<HTMLDivElement, FlavorTypeCardProps>(
  function AnchorCard({ flavorType, userName, soloDNA }, ref) {
    const { personalizedName, tagline } = flavorType;
    const cuisines = topCuisineList(soloDNA, 3);
    const tags = activeTags(soloDNA, 3);

    return (
      <div
        ref={ref}
        style={{
          background: "#08101C",
          borderRadius: 20,
          overflow: "hidden",
          position: "relative",
          minHeight: 580,
        }}
      >
        {/* Stadium arc top */}
        <div
          style={{
            height: 140,
            background: "linear-gradient(180deg, #1A2D4A 0%, #08101C 100%)",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            paddingTop: 20,
          }}
        >
          {/* Trophy */}
          <div
            style={{
              fontSize: 36,
              lineHeight: 1,
              marginBottom: 6,
              filter: "drop-shadow(0 0 16px rgba(255,215,0,0.4))",
            }}
          >
            🏆
          </div>
          <p
            style={{
              color: "#FFD700",
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
            }}
          >
            ★ Champion ★
          </p>
          {/* Side accent lines */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 2,
              background: "linear-gradient(90deg, transparent, #FFD700, transparent)",
              opacity: 0.4,
            }}
          />
        </div>

        <div style={{ padding: "20px 22px 24px", display: "flex", flexDirection: "column", flex: 1 }}>
          {/* Name block */}
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <h1
              style={{
                color: "#fff",
                fontSize: 24,
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: "-0.5px",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              {personalizedName}
            </h1>
            <p
              style={{
                color: "#FFD700",
                fontSize: 12,
                fontStyle: "italic",
                lineHeight: 1.4,
              }}
            >
              "{tagline}"
            </p>
          </div>

          {/* Varsity stats banner */}
          <div
            style={{
              display: "flex",
              gap: 0,
              marginBottom: 16,
              border: "1px solid #FFD70030",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {[
              { label: "Decisions", value: String(soloDNA.totalDecisions) },
              { label: "Streak", value: soloDNA.currentStreakDays > 0 ? `${soloDNA.currentStreakDays}d` : "—" },
              { label: "Sessions", value: String(soloDNA.totalSessions) },
            ].map(({ label, value }, i) => (
              <div
                key={label}
                style={{
                  flex: 1,
                  background: i === 0 ? "#FFD70012" : "#FFD70008",
                  borderRight: i < 2 ? "1px solid #FFD70020" : "none",
                  padding: "12px 6px",
                  textAlign: "center",
                }}
              >
                <p style={{ color: "#FFD700", fontSize: 20, fontWeight: 900 }}>{value}</p>
                <p style={{ color: "#ffffff50", fontSize: 9, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Home turf — top cuisine */}
          {cuisines.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p
                style={{
                  color: "#FFD70070",
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Home Turf
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {cuisines.map(({ cuisine, pct }, i) => {
                  const barW = Math.round((pct / (cuisines[0]?.pct ?? 1)) * 100);
                  return (
                    <div key={cuisine} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {i === 0 && (
                        <span style={{ fontSize: 12, flexShrink: 0 }}>🏅</span>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{cuisine}</span>
                          <span style={{ color: "#FFD700", fontSize: 11, fontWeight: 900 }}>{pct}%</span>
                        </div>
                        <div
                          style={{
                            height: 4,
                            background: "#1A2D4A",
                            borderRadius: 4,
                          }}
                        >
                          <div
                            style={{
                              width: `${barW}%`,
                              height: "100%",
                              background: i === 0
                                ? "linear-gradient(90deg, #FFD700, #FFA500)"
                                : "#FFD70040",
                              borderRadius: 4,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All-time #1 */}
          {soloDNA.allTimeNumber1 && (
            <div
              style={{
                background: "linear-gradient(135deg, #FFD70012, #FFA50008)",
                border: "1px solid #FFD70030",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <p style={{ color: "#FFD70070", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 3 }}>
                  Hall of Fame
                </p>
                <p style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>
                  {soloDNA.allTimeNumber1.mealName}
                </p>
              </div>
              {soloDNA.allTimeNumber1.count > 1 && (
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#FFD700", fontSize: 20, fontWeight: 900 }}>{soloDNA.allTimeNumber1.count}×</p>
                  <p style={{ color: "#ffffff50", fontSize: 8 }}>CHOSEN</p>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
              {tags.map((t) => (
                <span
                  key={t}
                  style={{
                    background: "#FFD70010",
                    border: "1px solid #FFD70030",
                    borderRadius: 14,
                    padding: "3px 9px",
                    color: "#FFD700",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: "auto", borderTop: "1px solid #FFD70020", paddingTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#FFD70060", fontSize: 10, fontWeight: 900, letterSpacing: "-0.3px" }}>
                Watcha?
              </span>
              {userName && (
                <span style={{ color: "#ffffff30", fontSize: 9 }}>
                  {userName}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
