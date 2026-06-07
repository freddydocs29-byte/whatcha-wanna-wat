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
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.2 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 500) onDismiss();
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

            {/* Ember eyebrow label */}
            <div className="flex items-center gap-2 mb-5 mt-3">
              <span style={{ color: "#E8621A", filter: "drop-shadow(0 0 6px rgba(232,98,26,0.5))", fontSize: 11 }}>✦</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "2.4px", textTransform: "uppercase", color: "#E8621A" }}>
                Quick check
              </span>
            </div>

            {/* Reason buttons */}
            <div className="grid gap-2.5">
              {REASONS.map(({ key, emoji, label }) => (
                <button
                  key={key}
                  onClick={() => onSelect(key)}
                  className="flex items-center gap-4 rounded-[18px] px-5 py-4 text-left transition-all duration-100 active:scale-[0.98]"
                  style={{
                    background: "rgba(255,231,202,0.04)",
                    border: "1px solid rgba(245,237,224,0.08)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(232,98,26,0.07)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(232,98,26,0.22)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,231,202,0.04)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(245,237,224,0.08)"; }}
                >
                  <span className="text-xl leading-none flex-shrink-0">{emoji}</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 15, letterSpacing: "-0.01em", color: "#C7BDAC" }}>
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
