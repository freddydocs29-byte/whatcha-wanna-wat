"use client";

import { motion, AnimatePresence } from "framer-motion";
import { type Meal } from "../../data/meals";

export type V3MealActionDrawerProps = {
  meal: Meal;
  mode: "cook" | "order";
  onClose: () => void;
};

function openLink(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function isAppleDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
}

function mapsUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return isAppleDevice()
    ? `https://maps.apple.com/?q=${encoded}`
    : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function V3MealActionDrawer({ meal, mode, onClose }: V3MealActionDrawerProps) {
  const isCook = mode === "cook";
  const accentColor = isCook ? "#4A7C59" : "#E8621A";
  const accentLight = isCook ? "#6BAF7A" : "#F07840";
  const accentBg = isCook ? "rgba(74,124,89,0.12)" : "rgba(232,98,26,0.12)";
  const accentBorder = isCook ? "rgba(74,124,89,0.25)" : "rgba(232,98,26,0.25)";
  const accentGlow = isCook
    ? "0 0 20px rgba(74,124,89,0.25)"
    : "0 0 20px rgba(232,98,26,0.25)";

  const cookActions = [
    {
      label: "Find a recipe",
      sub: "Search Google for instructions",
      icon: "📖",
      onPress: () => openLink(`https://www.google.com/search?q=how+to+cook+${encodeURIComponent(meal.name)}`),
    },
    {
      label: "Watch a quick recipe",
      sub: "See it on YouTube",
      icon: "▶️",
      onPress: () => openLink(`https://www.youtube.com/results?search_query=${encodeURIComponent(meal.name + " recipe")}`),
    },
    ...(meal.ingredients && meal.ingredients.length > 0
      ? [] // ingredients shown inline — no external link
      : [
          {
            label: "Check ingredients",
            sub: "See what you'll need",
            icon: "🛒",
            onPress: () => openLink(`https://www.google.com/search?q=${encodeURIComponent(meal.name + " ingredients")}`),
          },
        ]),
  ];

  const orderActions = [
    {
      label: "Search delivery",
      sub: "Find it on DoorDash, Uber Eats & more",
      icon: "🚀",
      onPress: () => openLink(`https://www.google.com/search?q=order+${encodeURIComponent(meal.name)}+delivery`),
    },
    {
      label: "Find nearby",
      sub: "See restaurants close to you",
      icon: "📍",
      onPress: () => openLink(mapsUrl(`${meal.name} near me`)),
    },
    {
      label: "Try another option",
      sub: "Go back and keep the meal",
      icon: "↩️",
      onPress: onClose,
    },
  ];

  const actions = isCook ? cookActions : orderActions;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        {/* Backdrop */}
        <motion.div
          key="meal-action-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Sheet */}
        <motion.div
          key="meal-action-sheet"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 260 }}
          drag="y"
          dragDirectionLock
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.25 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 80 || info.velocity.y > 500) onClose();
          }}
          className="relative w-full bg-[#1C1A18] rounded-t-[28px] px-5 pt-5 pb-10 border-t border-white/[0.08]"
          style={{ maxWidth: 540 }}
        >
          {/* Grab handle */}
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center text-[#8A7F78] hover:text-white/60 transition"
            aria-label="Close"
          >
            ✕
          </button>

          {/* Accent line at top */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[28px]"
            style={{ background: accentColor }}
          />

          {/* Meal thumbnail + header */}
          <div className="flex items-center gap-3 mb-5">
            {meal.image ? (
              <div
                className="w-[52px] h-[52px] rounded-[12px] shrink-0 overflow-hidden"
                style={{ border: `1px solid ${accentBorder}` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={meal.image}
                  alt={meal.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className="w-[52px] h-[52px] rounded-[12px] shrink-0 flex items-center justify-center text-2xl"
                style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
              >
                {isCook ? "🍳" : "📱"}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p
                className="text-[10px] font-bold tracking-[2px] uppercase mb-[2px]"
                style={{ color: accentLight, fontFamily: "var(--font-manrope)" }}
              >
                {isCook ? "Cook it" : "Order it"}
              </p>
              <p
                className="text-[19px] font-black text-white leading-tight truncate"
                style={{ fontFamily: "var(--font-nunito)" }}
              >
                {meal.name}
              </p>
              <p
                className="text-xs text-[#8A7F78] mt-[2px] leading-tight"
                style={{ fontFamily: "var(--font-manrope)" }}
              >
                {isCook
                  ? `Let's turn ${meal.name} into dinner.`
                  : `Find ${meal.name} nearby and call it dinner.`}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-[10px]">
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={action.onPress}
                className="w-full flex items-center gap-3 rounded-[14px] px-4 py-[13px] transition-all active:scale-[0.98]"
                style={{
                  background: accentBg,
                  border: `1px solid ${accentBorder}`,
                }}
              >
                <span className="text-[22px] shrink-0 leading-none">{action.icon}</span>
                <div className="flex-1 text-left min-w-0">
                  <p
                    className="text-[14px] font-black text-white leading-tight"
                    style={{ fontFamily: "var(--font-nunito)" }}
                  >
                    {action.label}
                  </p>
                  <p
                    className="text-[11px] text-[#8A7F78] mt-[1px]"
                    style={{ fontFamily: "var(--font-manrope)" }}
                  >
                    {action.sub}
                  </p>
                </div>
                <span style={{ color: accentLight }} className="shrink-0">
                  <ChevronRight />
                </span>
              </button>
            ))}
          </div>

          {/* Inline ingredients for cook mode */}
          {isCook && meal.ingredients && meal.ingredients.length > 0 && (
            <div
              className="mt-4 rounded-[14px] px-4 py-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p
                className="text-[10px] font-bold tracking-[2px] uppercase mb-3"
                style={{ color: accentLight, fontFamily: "var(--font-manrope)" }}
              >
                🛒 Ingredients
              </p>
              <div className="flex flex-wrap gap-[6px]">
                {meal.ingredients.map((ing) => (
                  <span
                    key={ing}
                    className="text-[11px] text-white/80 rounded-full px-[10px] py-[4px]"
                    style={{
                      background: accentBg,
                      border: `1px solid ${accentBorder}`,
                      fontFamily: "var(--font-manrope)",
                    }}
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bottom close hint */}
          <p
            className="text-center text-[11px] text-[#5A5350] mt-5"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            Swipe down or tap outside to go back
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
