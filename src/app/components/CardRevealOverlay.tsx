"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type CardRevealOverlayProps = {
  open: boolean;
  onClose: () => void;
  onShare: () => void;
  onSave?: () => void;
  sharing: boolean;
  shareError: string | null;
  /** The card component to reveal (should be mounted with a forwardRef for screenshot) */
  children: React.ReactNode;
};

type Phase = "dark" | "suspense" | "reveal" | "buttons";

export default function CardRevealOverlay({
  open,
  onClose,
  onShare,
  onSave,
  sharing,
  shareError,
  children,
}: CardRevealOverlayProps) {
  const [phase, setPhase] = useState<Phase>("dark");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  useEffect(() => {
    if (!open) {
      clearTimers();
      setPhase("dark");
      return;
    }

    clearTimers();
    setPhase("dark");

    timersRef.current = [
      setTimeout(() => setPhase("suspense"), 250),
      setTimeout(() => setPhase("reveal"), 1300),
      setTimeout(() => setPhase("buttons"), 1900),
    ];

    return clearTimers;
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "#070605" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* ── Suspense text ─────────────────────────────────────────────────── */}
          <AnimatePresence>
            {phase === "suspense" && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                  <p
                    className="font-display font-black text-xl text-white/30 tracking-widest uppercase"
                    style={{ letterSpacing: "0.2em" }}
                  >
                    Your Flavor Card
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Card + buttons (revealed together, scroll container) ──────────── */}
          <AnimatePresence>
            {(phase === "reveal" || phase === "buttons") && (
              <motion.div
                className="flex flex-col h-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                {/* Scrollable card area */}
                <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.93, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {children}
                  </motion.div>
                </div>

                {/* Action buttons */}
                <AnimatePresence>
                  {phase === "buttons" && (
                    <motion.div
                      className="px-5 pb-10 pt-3 flex flex-col gap-3 flex-shrink-0"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      <button
                        onClick={onShare}
                        disabled={sharing}
                        className="w-full font-display font-black text-sm py-4 rounded-full bg-[#E8621A] text-white disabled:opacity-60 transition-opacity"
                      >
                        {sharing ? "Making your card…" : "Share →"}
                      </button>

                      {onSave && (
                        <button
                          onClick={onSave}
                          className="w-full font-display font-black text-sm py-3.5 rounded-full border border-white/20 text-white"
                        >
                          Save image
                        </button>
                      )}

                      <button
                        onClick={onClose}
                        className="w-full font-display font-black text-sm py-3 rounded-full text-white/40"
                      >
                        Close
                      </button>

                      {shareError && (
                        <p className="font-body text-xs text-center text-[#8A7F78]">
                          {shareError}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
