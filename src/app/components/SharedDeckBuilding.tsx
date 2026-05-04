"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Copy ──────────────────────────────────────────────────────────────────────
const MESSAGES = [
  "Bringing your tastes together…",
  "Finding your overlap…",
  "Filtering what won't work…",
  "Mixing familiar with new…",
  "Cooking up options you'll both love…",
  "Building your deck…",
];

// ── Food tags per profile ─────────────────────────────────────────────────────
// offX/offY: pixels from the center of each profile circle (32, 32 in the 64×64 wrapper)
// keep: true → tag survives the filtering phase; false → fades away
interface Tag {
  label: string;
  offX: number;
  offY: number;
  keep: boolean;
}

const LEFT_TAGS: Tag[] = [
  { label: "Comfort",  offX:  8, offY: -48, keep: true  },
  { label: "Italian",  offX: -58, offY: -20, keep: false },
  { label: "Rich",     offX: 14, offY:  46, keep: true  },
  { label: "Spicy",    offX: -54, offY:  24, keep: false },
];

const RIGHT_TAGS: Tag[] = [
  { label: "Quick",   offX: -10, offY: -48, keep: true  },
  { label: "Mexican", offX:  52, offY: -20, keep: false },
  { label: "Healthy", offX: -18, offY:  46, keep: true  },
  { label: "Bold",    offX:  50, offY:  24, keep: false },
];

// ── Animation phases ──────────────────────────────────────────────────────────
// 0 — tastes appear (circles + tags fade in)
// 1 — combining   (circles drift inward, dropped tags fade out)
// 2 — forming     (circles overlap, card stack appears)
// 3 — reveal      (cards glow, ready state)
type Phase = 0 | 1 | 2 | 3;

const EASE_EXPO: [number, number, number, number] = [0.19, 1, 0.22, 1];

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  /** True once deck data has loaded (or errored gracefully). */
  isReady: boolean;
  /** Called when the screen should dismiss and reveal the actual deck. */
  onComplete: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function SharedDeckBuilding({ isReady, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const [minElapsed, setMinElapsed] = useState(false);

  // Drive phase sequence and enforce min/max display time
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 2000),
      setTimeout(() => setPhase(2), 4000),
      setTimeout(() => setPhase(3), 5800),
      setTimeout(() => setMinElapsed(true), 6500),
      setTimeout(() => onComplete(), 28000), // hard fallback
    ];
    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Dismiss once deck is ready AND minimum time has elapsed
  useEffect(() => {
    if (isReady && minElapsed) onComplete();
  }, [isReady, minElapsed, onComplete]);

  // Rotate messages
  useEffect(() => {
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % MESSAGES.length), 2700);
    return () => clearInterval(id);
  }, []);

  // Circle x-offsets from container center (pixels)
  // Phase 0: far apart; Phase 1+: close together with slight overlap
  const leftX  = phase >= 1 ? -22 : -88;
  const rightX = phase >= 1 ?  22 :  88;

  // Card stack glow intensifies on reveal
  const cardGlow = phase >= 3 ? "0 0 24px rgba(255,255,255,0.14)" : "none";

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-[#080808] text-white overflow-hidden select-none"
      aria-live="polite"
      aria-label="Building your shared deck"
    >
      {/* ── Label ─────────────────────────────────────────────────────────── */}
      <motion.p
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 0.3, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="mb-8 text-xs tracking-widest uppercase text-white/30"
      >
        You &amp; your partner
      </motion.p>

      {/* ── Animation stage ───────────────────────────────────────────────── */}
      {/*
        All elements are absolutely positioned relative to this container.
        The container is 320×280 — large enough so floating tags don't clip.
        Circles are anchored at left:50% top:50% and shifted with translateX.
      */}
      <div className="relative" style={{ width: 320, height: 280 }}>

        {/* ── Left profile circle ─────────────────────────────────────────── */}
        <ProfileCircle
          side="left"
          phase={phase}
          xOffset={leftX}
          tags={LEFT_TAGS}
          gradientFrom="rgba(255,190,90,0.22)"
          gradientTo="rgba(255,130,50,0.06)"
          glowColor="rgba(255,180,80,0.18)"
        />

        {/* ── Right profile circle ────────────────────────────────────────── */}
        <ProfileCircle
          side="right"
          phase={phase}
          xOffset={rightX}
          tags={RIGHT_TAGS}
          gradientFrom="rgba(120,200,255,0.18)"
          gradientTo="rgba(60,160,255,0.05)"
          glowColor="rgba(100,180,255,0.16)"
        />

        {/* ── Center merge glow (phase 1+) ────────────────────────────────── */}
        <AnimatePresence>
          {phase >= 1 && (
            <motion.div
              key="merge-glow"
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 56,
                height: 56,
                left: "50%",
                top: "50%",
                marginLeft: -28,
                marginTop: -28,
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 70%)",
              }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: phase >= 2 ? 1.4 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: EASE_EXPO }}
            />
          )}
        </AnimatePresence>

        {/* ── Card stack (phase 2+) ───────────────────────────────────────── */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              key="card-stack"
              className="absolute"
              style={{ bottom: 8, left: "50%", marginLeft: -44 }}
              initial={{ opacity: 0, y: 28, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, ease: EASE_EXPO }}
            >
              {/* Three overlapping card silhouettes */}
              {([
                { rotate: -6, xOff: -10, yOff: 4,  opacity: 0.35 },
                { rotate:  4, xOff:  8,  yOff: 2,  opacity: 0.45 },
                { rotate:  0, xOff:  0,  yOff: 0,  opacity: 0.75 },
              ] as const).map((card, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-[10px] border border-white/[0.12]"
                  style={{
                    width: 88,
                    height: 118,
                    left: card.xOff,
                    top: card.yOff,
                    rotate: card.rotate,
                    background: `rgba(255,255,255,${card.opacity * 0.07})`,
                    boxShadow: i === 2 ? cardGlow : "none",
                    transition: "box-shadow 0.6s ease",
                  }}
                  animate={{ opacity: card.opacity }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                >
                  {/* Front card gets a subtle inner detail in reveal phase */}
                  {i === 2 && phase >= 3 && (
                    <motion.div
                      className="m-3 rounded-md"
                      style={{
                        height: 52,
                        background:
                          "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    />
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Progress bar ──────────────────────────────────────────────────── */}
      <div className="mt-10 h-px w-20 overflow-hidden rounded-full bg-white/[0.08]">
        <motion.div
          className="h-full rounded-full bg-white/25"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 7, ease: "linear" }}
        />
      </div>

      {/* ── Rotating message ──────────────────────────────────────────────── */}
      <div className="mt-5 h-5 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIdx}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="text-[13px] text-white/38"
          >
            {MESSAGES[msgIdx]}
          </motion.p>
        </AnimatePresence>
      </div>
    </main>
  );
}

// ── ProfileCircle sub-component ───────────────────────────────────────────────
interface ProfileCircleProps {
  side: "left" | "right";
  phase: Phase;
  xOffset: number;
  tags: Tag[];
  gradientFrom: string;
  gradientTo: string;
  glowColor: string;
}

function ProfileCircle({
  side,
  phase,
  xOffset,
  tags,
  gradientFrom,
  gradientTo,
  glowColor,
}: ProfileCircleProps) {
  // Initial x: start off-screen slightly
  const initX = side === "left" ? -140 : 140;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: "50%",
        top: "50%",
        // Center the 64×64 circle at the anchor point
        marginLeft: -32,
        marginTop: -32,
      }}
      initial={{ x: initX, opacity: 0 }}
      animate={{ x: xOffset, opacity: 1 }}
      transition={{
        x:       { duration: phase === 0 ? 0.75 : 1.3, ease: EASE_EXPO },
        opacity: { duration: 0.55, ease: "easeOut" },
      }}
    >
      {/* Circle */}
      <motion.div
        className="rounded-full border border-white/[0.12] flex items-center justify-center"
        style={{
          width: 64,
          height: 64,
          background: `radial-gradient(circle at 35% 35%, ${gradientFrom}, ${gradientTo} 65%, transparent)`,
        }}
        animate={{
          boxShadow: phase >= 1
            ? `0 0 28px ${glowColor}, 0 0 0 1px rgba(255,255,255,0.06)`
            : "none",
        }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        {/* Abstract person silhouette — two shapes (head + body arc) */}
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
          <circle cx="13" cy="9" r="4.5" fill="rgba(255,255,255,0.25)" />
          <path
            d="M4 23c0-4.97 4.03-9 9-9s9 4.03 9 9"
            stroke="rgba(255,255,255,0.20)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>

      {/* Tags */}
      {tags.map((tag) => (
        <motion.div
          key={tag.label}
          className="absolute whitespace-nowrap rounded-full border border-white/[0.10] bg-white/[0.05] px-2.5 py-[3px] text-[10px] font-medium tracking-wide text-white/50"
          style={{
            // Center the tag at (32 + offX, 32 + offY) within the 64×64 wrapper
            left: 32 + tag.offX,
            top: 32 + tag.offY,
            transform: "translate(-50%, -50%)",
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{
            opacity: phase >= 1 && !tag.keep ? 0 : phase === 0 ? 0.75 : 0.55,
            scale:   phase >= 1 && !tag.keep ? 0.7 : 1,
          }}
          transition={{
            duration: tag.keep ? 0.5 : 0.4,
            delay:    tag.keep ? 0 : 0.1,
            ease: "easeOut",
          }}
        >
          {tag.label}
        </motion.div>
      ))}
    </motion.div>
  );
}
