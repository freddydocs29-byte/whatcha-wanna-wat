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
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-[28px] border-t border-white/[0.08] bg-[#111111] px-5 pb-10 pt-4"
          >
            {/* Drag handle */}
            <div className="mx-auto mb-5 h-1 w-8 rounded-full bg-white/15" />

            {/* Icon */}
            <div className="mb-3 text-xl leading-none">
              {nudge.type === "avoid" ? "🤔" : "✨"}
            </div>

            {/* Question */}
            <p className="text-[15px] font-medium leading-snug tracking-[-0.02em] text-white/85">
              {nudge.question}
            </p>

            {/* Sub-copy */}
            <p className="mt-1.5 text-xs leading-5 text-white/35">
              {nudge.type === "avoid"
                ? "We'll dial it back — not cut it out completely."
                : "We'll prioritize it in your next deck."}
            </p>

            {/* Actions */}
            <div className="mt-5 flex flex-col items-center gap-3">
              <button
                onClick={() => onAnswer(true)}
                className="w-full rounded-full bg-white py-3.5 text-sm font-semibold text-black transition hover:opacity-95 active:scale-[0.97]"
              >
                Yeah, dial it back
              </button>
              <button
                onClick={() => onAnswer(false)}
                className="text-sm text-white/40 transition hover:text-white/60 active:scale-[0.97] py-1"
              >
                Just not tonight
              </button>
            </div>

            {/* Reversibility hint */}
            <p className="mt-4 text-center text-[11px] text-white/20">
              You can always adjust this in settings
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
