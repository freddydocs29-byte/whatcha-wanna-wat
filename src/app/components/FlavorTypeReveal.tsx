"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type FlavorTypeRevealProps = {
  typeName: string;
  tagline: string;
  onDismiss: () => void;
  onViewProfile: () => void;
};

export default function FlavorTypeReveal({
  typeName,
  tagline,
  onDismiss,
  onViewProfile,
}: FlavorTypeRevealProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 800);
    const t2 = setTimeout(() => setPhase(2), 1600);
    const t3 = setTimeout(() => {
      setPhase(3);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    }, 2400);
    const t4 = setTimeout(() => setPhase(4), 3200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0A0908] overflow-hidden">
      {/* Pulsing orange glow — always rendered */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(232,98,26,0.18) 0%, transparent 70%)",
          animation: "pulse 2s ease-in-out infinite",
        }}
      />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
      `}</style>

      <div className="relative flex flex-col items-center justify-center w-full max-w-sm px-8 gap-6">
        {/* Phase 1 — "WE FIGURED YOU OUT" */}
        <AnimatePresence>
          {phase >= 1 && (
            <motion.p
              key="eyebrow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="text-[#8A7F78] text-xs font-semibold tracking-widest uppercase text-center"
            >
              WE FIGURED YOU OUT
            </motion.p>
          )}
        </AnimatePresence>

        {/* Phase 2 — type name slams in */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.h1
              key="type-name"
              initial={{ opacity: 0, scale: 0.6, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="font-display font-black text-5xl text-[#E8621A] text-center leading-tight"
            >
              {typeName}
            </motion.h1>
          )}
        </AnimatePresence>

        {/* Phase 3 — tagline fades in */}
        <AnimatePresence>
          {phase >= 3 && (
            <motion.p
              key="tagline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="font-body text-base text-white/70 text-center px-8"
            >
              {tagline}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Phase 4 — buttons */}
        <AnimatePresence>
          {phase >= 4 && (
            <motion.div
              key="buttons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center gap-4 w-full mt-2"
            >
              <button
                onClick={onViewProfile}
                className="w-full bg-[#E8621A] text-white font-display font-black text-base py-4 rounded-full"
                style={{ boxShadow: "0 0 24px rgba(232,98,26,0.4)" }}
              >
                See my full profile →
              </button>
              <button
                onClick={onDismiss}
                className="text-[#8A7F78] font-body text-sm py-2"
              >
                Got it
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
