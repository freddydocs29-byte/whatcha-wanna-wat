"use client";

import { motion, AnimatePresence } from "framer-motion";

const REASONS = [
  { key: "too_heavy",           emoji: "🌿", label: "Too heavy" },
  { key: "had_recently",        emoji: "🔁", label: "Had it recently" },
  { key: "not_feeling_it",      emoji: "😶", label: "Not feeling it" },
  { key: "missing_ingredients", emoji: "🛒", label: "Missing ingredients" },
] as const;

export type RejectionReason = (typeof REASONS)[number]["key"];

interface Props {
  visible: boolean;
  onSelect: (reason: RejectionReason) => void;
  onDismiss: () => void;
}

export function RejectionReasonSheet({ visible, onSelect, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop — tap outside to dismiss without capturing */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onDismiss}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-[28px] border-t border-white/[0.08] bg-[#111111] px-5 pb-10 pt-4"
          >
            {/* Drag handle */}
            <div className="mx-auto mb-6 h-1 w-8 rounded-full bg-white/15" />

            {/* Reason buttons — no title, no explanation */}
            <div className="grid gap-3">
              {REASONS.map(({ key, emoji, label }) => (
                <button
                  key={key}
                  onClick={() => onSelect(key)}
                  className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-5 py-4 text-left transition-colors duration-100 active:scale-[0.98] active:bg-white/[0.09]"
                >
                  <span className="text-xl leading-none">{emoji}</span>
                  <span className="text-base font-medium tracking-[-0.01em] text-white/75">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
