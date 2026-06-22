"use client";

import { useState, useRef, useEffect } from "react";
import type { SessionVibeMode } from "../../lib/scoring";
import { trackEvent } from "../../lib/analytics";
import { EVENT_VIBE_SELECTED } from "../../lib/analytics-events";

// ── Vibe config (spec §03) — display content mapped to production SessionVibeMode keys ──
const VIBES = [
  {
    key: "comfort-food" as SessionVibeMode,
    icon: "🔥",
    phrase: "the good stuff",
    caption: "hearty, cozy, no notes",
    deck: "Comfort food",
    c: "#E8621A", cHot: "#FF8A3D", cDeep: "#B84A12",
  },
  {
    key: "quick-easy" as SessionVibeMode,
    icon: "⚡",
    phrase: "something easy",
    caption: "quick, low-effort, sure things",
    deck: "Easy wins",
    c: "#E0A52E", cHot: "#F7C54E", cDeep: "#A8761A",
  },
  {
    key: "mix-it-up" as SessionVibeMode,
    icon: "✦",
    phrase: "a wildcard",
    caption: "let us throw you a curveball",
    deck: "Wildcards",
    c: "#D8567E", cHot: "#F47AA0", cDeep: "#A23A5C",
  },
  {
    key: "healthy" as SessionVibeMode,
    icon: "🌿",
    phrase: "a fresh reset",
    caption: "lighter, brighter, virtuous",
    deck: "A reset",
    c: "#5E9E6E", cHot: "#86C796", cDeep: "#3F744F",
  },
  {
    key: "something-new" as SessionVibeMode,
    icon: "🥂",
    phrase: "a celebration",
    caption: "go big — it's a night",
    deck: "A celebration",
    c: "#9C6BE0", cHot: "#B98CF0", cDeep: "#7448B0",
  },
] as const;

// ── Time-based recommendation (spec §08) ──────────────────────────────────────
function getRecommendation(): { index: number; reason: string } {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun … 6=Sat

  if ((day === 5 || day === 6) && hour >= 17)
    return { index: 0, reason: "Friday night energy" };     // comfort-food
  if (day === 0 && hour >= 11)
    return { index: 3, reason: "Sunday reset mode" };        // healthy
  if (hour >= 20)
    return { index: 1, reason: "Late night, keep it easy" }; // quick-easy
  return { index: 0, reason: "Based on tonight" };            // comfort-food
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface V3VibeCardProps {
  onSeeTop5?: () => void;
  onVibeChange?: (vibe: SessionVibeMode) => void;
  /** Fires whenever the selected vibe's deck label changes (e.g. "Comfort food") */
  onVibeDeckLabelChange?: (label: string) => void;
  sessionMode?: "solo" | "shared";
}

export default function V3VibeCard({
  onSeeTop5,
  onVibeChange,
  onVibeDeckLabelChange,
  sessionMode = "solo",
}: V3VibeCardProps) {
  // Compute recommendation once on mount (lazy useState initializer)
  const [{ recommendedIndex, recommendedReason }] = useState(() => {
    const rec = getRecommendation();
    return { recommendedIndex: rec.index, recommendedReason: rec.reason };
  });

  const [selectedIndex, setSelectedIndex] = useState(recommendedIndex);
  const [trackX, setTrackX] = useState(0);
  const [animating, setAnimating] = useState(false);

  const prefersReducedMotion = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef({ active: false, startX: 0, baseX: 0 });
  const isInitializedRef = useRef(false);

  const vibe = VIBES[selectedIndex];
  const isRecommended = selectedIndex === recommendedIndex;

  // ── Centering helpers ──────────────────────────────────────────────────────

  function snapTo(index: number, animate: boolean) {
    const viewport = viewportRef.current;
    const item = itemRefs.current[index];
    if (!viewport || !item) return;
    const vpW = viewport.offsetWidth;
    const x = vpW / 2 - (item.offsetLeft + item.offsetWidth / 2);
    setAnimating(animate && !prefersReducedMotion.current);
    setTrackX(x);
  }

  function goToIndex(index: number) {
    const clamped = Math.max(0, Math.min(VIBES.length - 1, index));
    if (clamped !== selectedIndex) {
      setSelectedIndex(clamped);
      onVibeChange?.(VIBES[clamped].key);
      onVibeDeckLabelChange?.(VIBES[clamped].deck);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate(8); } catch { /* ignore */ }
      }
      if (isInitializedRef.current) {
        trackEvent(EVENT_VIBE_SELECTED, {
          vibe: VIBES[clamped].key,
          session_mode: sessionMode,
          is_default: false,
        });
      }
    } else {
      // Already on this index — just snap back (rubber-band release to same item)
      snapTo(clamped, true);
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  useEffect(() => {
    prefersReducedMotion.current =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Notify parent of the initial recommendation
    onVibeChange?.(VIBES[recommendedIndex].key);
    onVibeDeckLabelChange?.(VIBES[recommendedIndex].deck);

    // Center initial item — retry after 300ms so serif font metrics are loaded
    snapTo(recommendedIndex, false);
    const t = setTimeout(() => snapTo(recommendedIndex, false), 300);
    isInitializedRef.current = true;
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Snap to the newly selected item (one tick delay — lets DOM render first)
  useEffect(() => {
    const t = setTimeout(() => snapTo(selectedIndex, true), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { active: true, startX: e.clientX, baseX: trackX };
    setAnimating(false);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current.active) return;
    const viewport = viewportRef.current;
    const firstItem = itemRefs.current[0];
    const lastItem = itemRefs.current[VIBES.length - 1];
    if (!viewport || !firstItem || !lastItem) return;

    const vpW = viewport.offsetWidth;
    const minX = vpW / 2 - (lastItem.offsetLeft + lastItem.offsetWidth / 2);
    const maxX = vpW / 2 - (firstItem.offsetLeft + firstItem.offsetWidth / 2);
    const rawX = drag.current.baseX + (e.clientX - drag.current.startX);

    let x: number;
    if (rawX > maxX) x = maxX + (rawX - maxX) * 0.35;      // rubber-band past start
    else if (rawX < minX) x = minX + (rawX - minX) * 0.35; // rubber-band past end
    else x = rawX;

    setTrackX(x);
  }

  function onPointerUp() {
    if (!drag.current.active) return;
    drag.current.active = false;

    const viewport = viewportRef.current;
    if (!viewport) return;
    const vpW = viewport.offsetWidth;
    // The visible center in track-local coordinates
    const visCenter = vpW / 2 - trackX;

    let nearest = 0;
    let minDist = Infinity;
    itemRefs.current.forEach((item, i) => {
      if (!item) return;
      const itemCenter = item.offsetLeft + item.offsetWidth / 2;
      const dist = Math.abs(itemCenter - visCenter);
      if (dist < minDist) { minDist = dist; nearest = i; }
    });

    goToIndex(nearest);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft")  { e.preventDefault(); goToIndex(selectedIndex - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); goToIndex(selectedIndex + 1); }
  }

  // ── Spring transition ──────────────────────────────────────────────────────
  const springTransition = prefersReducedMotion.current
    ? "transform 0.15s ease"
    : "transform 0.42s cubic-bezier(0.34, 1.25, 0.5, 1)";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="mx-[14px] mb-[14px] rounded-[22px] shrink-0 relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, rgba(255,231,202,0.06), rgba(255,231,202,0.018))",
        border: "1px solid rgba(245,237,224,0.085)",
        boxShadow: `0 4px 32px rgba(0,0,0,0.3), 0 0 60px ${vibe.c}18`,
      }}
    >
      {/* Top accent bar — recolors per vibe */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[22px]"
        style={{
          background: `linear-gradient(90deg, ${vibe.cHot}, ${vibe.c})`,
          boxShadow: `0 0 14px ${vibe.c}80`,
        }}
      />

      {/* Mood wash — soft radial behind the dial */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 90% 55% at 50% 45%, ${vibe.c}14 0%, transparent 70%)`,
        }}
      />

      <div className="pt-[18px] pb-[16px] relative">
        {/* ── Eyebrow + recommendation flag ─────────────────────────── */}
        <div className="flex items-center justify-between px-[18px] mb-[10px]">
          <span
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 9,
              letterSpacing: "2.4px",
              textTransform: "uppercase" as const,
              color: "#897E73",
              fontWeight: 400,
            }}
          >
            Your vibe tonight
          </span>
          <span
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 9,
              letterSpacing: "1px",
              textTransform: "uppercase" as const,
              fontWeight: 500,
              color: isRecommended ? vibe.cHot : "#C7BDAC",
              background: isRecommended
                ? `${vibe.c}20`
                : "rgba(245,237,224,0.06)",
              border: `1px solid ${isRecommended ? vibe.c + "55" : "rgba(245,237,224,0.14)"}`,
              borderRadius: 100,
              padding: "3px 9px",
            }}
          >
            {isRecommended ? "★ Our pick" : "✓ Your pick"}
          </span>
        </div>

        {/* ── Lead-in ───────────────────────────────────────────────── */}
        <div
          className="px-[18px] mb-[6px]"
          style={{
            fontFamily: "var(--font-quicksand)",
            fontWeight: 700,
            fontSize: 18,
            color: "#F6EEE2",
            lineHeight: 1,
            letterSpacing: "-0.01em",
          }}
        >
          We&apos;re thinking
        </div>

        {/* ── Dial viewport ─────────────────────────────────────────── */}
        <div className="relative" style={{ height: 54, margin: "6px 0 0" }}>
          {/* Edge-fade mask wraps the overflow-hidden viewport */}
          <div
            ref={viewportRef}
            className="absolute inset-0 overflow-hidden"
            style={{
              WebkitMaskImage:
                "linear-gradient(90deg, transparent 0%, #000 15%, #000 85%, transparent 100%)",
              maskImage:
                "linear-gradient(90deg, transparent 0%, #000 15%, #000 85%, transparent 100%)",
            }}
          >
            {/* Draggable track */}
            <div
              ref={trackRef}
              className="absolute flex items-center h-full"
              style={{
                transform: `translateX(${trackX}px)`,
                transition: animating ? springTransition : "none",
                willChange: "transform",
                userSelect: "none",
                touchAction: "none",
                cursor: drag.current.active ? "grabbing" : "grab",
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              role="radiogroup"
              aria-label="Vibe selector"
              tabIndex={0}
              onKeyDown={onKeyDown}
            >
              {VIBES.map((v, i) => {
                const isActive = i === selectedIndex;
                return (
                  <div
                    key={v.key}
                    ref={(el) => { itemRefs.current[i] = el; }}
                    className="flex items-center shrink-0"
                    style={{
                      padding: "0 22px",
                      opacity: isActive ? 1 : 0.26,
                      transform: isActive ? "scale(1)" : "scale(0.82)",
                      transition: animating
                        ? "opacity 0.35s ease, transform 0.35s ease"
                        : "none",
                      whiteSpace: "nowrap",
                    }}
                    role="radio"
                    aria-checked={isActive}
                    aria-label={v.deck}
                  >
                    {/* Animated icon — CSS class gates animation on active only */}
                    <span
                      className={isActive ? `vibe-icon-${v.key}` : ""}
                      style={{
                        fontSize: 21,
                        marginRight: 8,
                        display: "inline-block",
                        lineHeight: 1,
                      }}
                    >
                      {v.icon}
                    </span>
                    {/* Serif phrase */}
                    <span
                      style={{
                        fontFamily: "var(--font-instrument-serif)",
                        fontStyle: "italic",
                        fontWeight: 400,
                        fontSize: 33,
                        lineHeight: 1,
                        color: isActive ? v.c : "#C7BDAC",
                      }}
                    >
                      {v.phrase}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Left chevron — hidden on first vibe */}
          {selectedIndex > 0 && (
            <button
              className="absolute left-0 top-0 bottom-0 flex items-center justify-center z-10"
              style={{
                width: 44,
                background: "rgba(8,5,3,0.55)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                border: "none",
                cursor: "pointer",
                borderRadius: "0 100px 100px 0",
              }}
              onClick={() => goToIndex(selectedIndex - 1)}
              aria-label="Previous vibe"
              tabIndex={-1}
            >
              <span
                style={{
                  color: "#F6EEE2",
                  fontSize: 20,
                  lineHeight: 1,
                  pointerEvents: "none",
                  fontFamily: "var(--font-sans, system-ui)",
                }}
              >
                ‹
              </span>
            </button>
          )}

          {/* Right chevron — hidden on last vibe */}
          {selectedIndex < VIBES.length - 1 && (
            <button
              className="absolute right-0 top-0 bottom-0 flex items-center justify-center z-10"
              style={{
                width: 44,
                background: "rgba(8,5,3,0.55)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                border: "none",
                cursor: "pointer",
                borderRadius: "100px 0 0 100px",
              }}
              onClick={() => goToIndex(selectedIndex + 1)}
              aria-label="Next vibe"
              tabIndex={-1}
            >
              <span
                style={{
                  color: "#F6EEE2",
                  fontSize: 20,
                  lineHeight: 1,
                  pointerEvents: "none",
                  fontFamily: "var(--font-sans, system-ui)",
                }}
              >
                ›
              </span>
            </button>
          )}
        </div>

        {/* ── Caption ───────────────────────────────────────────────── */}
        <div
          className="px-[18px] mt-[8px] mb-[10px] text-center"
          style={{
            fontFamily: "var(--font-sans, Inter, system-ui)",
            fontSize: 12.5,
            color: "#C7BDAC",
            fontWeight: 300,
            letterSpacing: "0.01em",
          }}
        >
          {vibe.caption}
        </div>

        {/* ── Position dots ─────────────────────────────────────────── */}
        <div
          className="flex items-center justify-center mb-[12px]"
          style={{ gap: 8 }}
        >
          {VIBES.map((v, i) => {
            const isActive = i === selectedIndex;
            return (
              <button
                key={v.key}
                onClick={() => goToIndex(i)}
                aria-label={v.deck}
                style={{
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 44,
                  minHeight: 44,
                  background: "transparent",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: isActive ? 22 : 7,
                    height: isActive ? 8 : 7,
                    borderRadius: 100,
                    background: isActive
                      ? `linear-gradient(90deg, ${v.cHot}, ${v.c})`
                      : `${v.c}85`,
                    boxShadow: isActive
                      ? `0 0 10px ${v.c}80, 0 0 4px ${v.c}50`
                      : "none",
                    transition:
                      "width 0.32s cubic-bezier(0.34,1.4,0.5,1), height 0.32s cubic-bezier(0.34,1.4,0.5,1)",
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* ── Footer: reason + Top 5 link ───────────────────────────── */}
        <div className="flex justify-between items-center px-[18px]">
          <span
            style={{
              fontFamily: "var(--font-sans, Inter, system-ui)",
              fontSize: 11,
              color: "#5b5246",
              fontWeight: 400,
            }}
          >
            {isRecommended
              ? recommendedReason
              : "Tap a dot or slide back for our pick"}
          </span>
          <button
            onClick={onSeeTop5}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-sans, Inter, system-ui)",
              fontSize: 11,
              fontWeight: 600,
              color: vibe.cHot,
              padding: 0,
            }}
          >
            See tonight&apos;s Top 5 →
          </button>
        </div>
      </div>
    </div>
  );
}
