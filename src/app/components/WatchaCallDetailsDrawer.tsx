"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type Meal } from "../data/meals";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&h=750&q=80";

type WatchaCallDetailsDrawerProps = {
  meal: Meal | null;
  isOpen: boolean;
  onClose: () => void;
  onLockIn: () => void;
  mode: "shared" | "solo";
  tierReason: string;
  lockingInProgress?: boolean;
};

export function WatchaCallDetailsDrawer({
  meal,
  isOpen,
  onClose,
  onLockIn,
  mode,
  tierReason,
  lockingInProgress,
}: WatchaCallDetailsDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atScrollTop, setAtScrollTop] = useState(true);

  const helperCopy =
    mode === "shared"
      ? "This was the best read from what both of you showed us."
      : "This was the strongest read from tonight\u2019s deck.";

  return (
    <AnimatePresence>
      {isOpen && meal && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            drag={atScrollTop ? "y" : false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.2 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 500) onClose();
            }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] max-h-[88vh]"
            style={{
              background:
                "radial-gradient(ellipse 80% 30% at 50% 0%, rgba(232,98,26,0.08) 0%, transparent 55%), " +
                "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%), " +
                "#1C1A18",
              border: "1px solid rgba(245,237,224,0.07)",
              borderBottom: "none",
              boxShadow:
                "0 -8px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(245,237,224,0.07)",
            }}
          >
            <div
              ref={scrollRef}
              onScroll={(e) =>
                setAtScrollTop(e.currentTarget.scrollTop === 0)
              }
              className="overflow-y-auto max-h-[88vh]"
            >
              {/* Drag handle */}
              <div
                className="w-10 h-1 rounded-full mx-auto mt-3 mb-4"
                style={{ background: "rgba(245,237,224,0.15)" }}
              />

              {/* Meal image */}
              <div
                className="relative mx-4 rounded-[16px] overflow-hidden mb-4"
                style={{ height: 200 }}
              >
                <img
                  src={meal.image || FALLBACK_IMAGE}
                  alt={meal.name}
                  className="w-full h-full object-cover"
                />
                {/* Scrim */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.22) 50%, transparent 100%)",
                  }}
                />
                {/* Ember spotlight */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(232,98,26,0.10) 0%, transparent 70%)",
                  }}
                />
                {/* Name overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h2
                    style={{
                      fontFamily: "'Quicksand', sans-serif",
                      fontWeight: 700,
                      fontSize: 22,
                      color: "#F6EEE2",
                      lineHeight: 1.1,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {meal.name}
                  </h2>
                  {(meal.cuisine || meal.category) && (
                    <p
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 12,
                        color: "rgba(255,255,255,0.55)",
                        marginTop: 3,
                      }}
                    >
                      {[meal.category, meal.cuisine].filter(Boolean).join(" \u00b7 ")}
                    </p>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="px-4 pb-6 flex flex-col gap-4">
                {/* Tags row */}
                {meal.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {meal.tags.slice(0, 6).map((tag) => (
                      <span
                        key={tag}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 10px",
                          borderRadius: 100,
                          background: "rgba(255,231,202,0.05)",
                          border: "1px solid rgba(245,237,224,0.09)",
                          fontFamily: "'Inter', sans-serif",
                          fontWeight: 500,
                          fontSize: 11,
                          color: "#C7BDAC",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Why this one? */}
                <div
                  style={{
                    borderRadius: 14,
                    padding: "14px 16px",
                    background: "rgba(232,98,26,0.07)",
                    border: "1px solid rgba(232,98,26,0.14)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      color: "#E8621A",
                    }}
                  >
                    Why this one?
                  </div>
                  <p
                    style={{
                      fontFamily: "'Instrument Serif', Georgia, serif",
                      fontStyle: "italic",
                      fontSize: 16,
                      lineHeight: 1.4,
                      color: "#F6EEE2",
                      margin: 0,
                    }}
                  >
                    {tierReason}
                  </p>
                  <p
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 300,
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      color: "#C7BDAC",
                      margin: 0,
                    }}
                  >
                    {helperCopy}
                  </p>
                </div>

                {/* Description */}
                {meal.description && (
                  <div
                    style={{
                      borderRadius: 14,
                      padding: "14px 16px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(245,237,224,0.07)",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 300,
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: "#C7BDAC",
                        margin: 0,
                      }}
                    >
                      {meal.description}
                    </p>
                  </div>
                )}

                {/* Lock it in CTA */}
                <button
                  onClick={onLockIn}
                  disabled={lockingInProgress}
                  style={{
                    marginTop: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: 16,
                    borderRadius: 100,
                    border: "none",
                    width: "100%",
                    fontFamily: "'Quicksand', sans-serif",
                    fontWeight: 700,
                    fontSize: 15.5,
                    letterSpacing: "-0.01em",
                    cursor: lockingInProgress ? "default" : "pointer",
                    color: "#1c0c03",
                    background:
                      "linear-gradient(180deg,#FF8A3D,#E8621A 48%,#B84A12)",
                    boxShadow:
                      "0 1px 0 rgba(255,224,188,0.6) inset, 0 -2px 0 rgba(120,52,0,0.4) inset, 0 14px 30px rgba(232,98,26,0.4), 0 0 0 1px rgba(232,98,26,0.3)",
                    opacity: lockingInProgress ? 0.7 : 1,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  {lockingInProgress ? "Locking in\u2026" : "Lock it in"}
                </button>

                {/* Close */}
                <button
                  onClick={onClose}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "'Quicksand', sans-serif",
                    fontWeight: 600,
                    fontSize: 14,
                    color: "#897E73",
                    padding: "6px 0",
                    textAlign: "center",
                    width: "100%",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
