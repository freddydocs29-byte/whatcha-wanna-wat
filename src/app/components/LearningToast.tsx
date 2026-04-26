"use client";

/**
 * LearningToast — lightweight confirmation that the app updated its model.
 *
 * Appears as a fixed pill at the bottom of the viewport after the user
 * confirms a progressive onboarding nudge. Pointer-events-none so it never
 * interferes with card swipes or button taps. Auto-dismisses after 2.5 s.
 *
 * Placement: bottom-24 (96 px) — clears the action-button row and the
 * bottom safe area without covering any card content.
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  message: string | null;
  onDone: () => void;
}

const DURATION_MS = 2500;

export function LearningToast({ message, onDone }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, DURATION_MS);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={message}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 3 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-5"
        >
          <div className="rounded-full border border-white/[0.10] bg-[#1c1c1e] px-4 py-2.5 shadow-[0_4px_24px_rgba(0,0,0,0.55)] backdrop-blur-sm">
            <p className="text-sm font-medium tracking-[-0.01em] text-white/80">
              {message}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
