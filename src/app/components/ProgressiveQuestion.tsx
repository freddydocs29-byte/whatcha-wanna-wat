"use client";

/**
 * ProgressiveQuestion — inline onboarding nudge.
 *
 * A lightweight bottom sheet that slides up between swipes to ask a single
 * contextual question based on observed swipe behavior. It never interrupts
 * the swipe flow — the deck shows it only after a card exit animation
 * completes and the next card is already visible.
 *
 * The component is fully self-contained: it manages its own AnimatePresence
 * and auto-dismiss timer. The parent only supplies the active nudge and an
 * onAnswer callback.
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { NudgeTrigger } from "../lib/session-signals";

interface Props {
  nudge: NudgeTrigger | null;
  onAnswer: (yes: boolean) => void;
}

/** Milliseconds before the sheet auto-dismisses with a "not always" response. */
const AUTO_DISMISS_MS = 9000;

export function ProgressiveQuestion({ nudge, onAnswer }: Props) {
  // Auto-dismiss so the question never lingers indefinitely.
  useEffect(() => {
    if (!nudge) return;
    const t = setTimeout(() => onAnswer(false), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [nudge, onAnswer]);

  return (
    <AnimatePresence>
      {nudge && (
        <>
          {/* Scrim — tap to dismiss */}
          <motion.div
            key="pq-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => onAnswer(false)}
            className="fixed inset-0 z-40 bg-black/40"
          />

          {/* Sheet */}
          <motion.div
            key="pq-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            drag="y"
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.25 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 500) onAnswer(false);
            }}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-[28px] px-5 pb-10 pt-4"
            style={{
              background: "linear-gradient(180deg, rgba(255,231,202,0.07) 0%, rgba(18,13,9,0.98) 6%, #120D09 100%)",
              borderTop: "1px solid rgba(245,237,224,0.085)",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
              backdropFilter: "blur(24px)",
            }}
          >
            {/* Drag handle */}
            <div className="mx-auto mb-2 h-1 w-10 rounded-full" style={{ background: "rgba(245,237,224,0.15)" }} />

            {/* Eyebrow */}
            <div className="flex items-center gap-2 mb-4 mt-3">
              <span style={{ color: "#E8621A", filter: "drop-shadow(0 0 6px rgba(232,98,26,0.5))", fontSize: 11 }}>✦</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "2.4px", textTransform: "uppercase", color: "#E8621A" }}>
                Quick question
              </span>
            </div>

            {/* Question */}
            <p style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 20, lineHeight: 1.2, letterSpacing: "-0.01em", color: "#F6EEE2" }}>
              {nudge.question}
            </p>

            {/* Sub-copy */}
            <p className="mt-2 text-sm leading-5" style={{ color: "#897E73" }}>
              {nudge.type === "avoid"
                ? "We'll dial it back — not cut it out completely."
                : "We'll prioritize it in your next deck."}
            </p>

            {/* Actions */}
            <div className="mt-6 flex flex-col items-center gap-3">
              <button
                onClick={() => onAnswer(true)}
                className="w-full rounded-full py-3.5 text-sm font-black text-white transition active:scale-[0.97]"
                style={{
                  fontFamily: "'Quicksand', sans-serif",
                  fontWeight: 700,
                  background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 50%, #B84A12 100%)",
                  boxShadow: "0 1px 0 rgba(255,224,188,0.5) inset, 0 -2px 0 rgba(120,52,0,0.35) inset, 0 12px 26px rgba(232,98,26,0.4), 0 0 0 1px rgba(232,98,26,0.28)",
                  color: "#1c0c03",
                }}
              >
                Yeah, dial it back
              </button>
              <button
                onClick={() => onAnswer(false)}
                className="text-sm transition active:scale-[0.97] py-1"
                style={{ color: "#897E73" }}
              >
                Just not tonight
              </button>
            </div>

            {/* Reversibility hint */}
            <p className="mt-4 text-center text-[11px]" style={{ color: "rgba(245,237,224,0.18)" }}>
              You can always adjust this in settings
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
