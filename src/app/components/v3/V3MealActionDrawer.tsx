"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type Meal } from "../../data/meals";
import { MealImageFallback } from "../MealImageFallback";

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

function ChevronRight({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function ShoppingBagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function DeliveryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export default function V3MealActionDrawer({ meal, mode, onClose }: V3MealActionDrawerProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const isCook = mode === "cook";
  const accentColor = isCook ? "#4A7C59" : "#E8621A";
  const accentLight = isCook ? "#6BAF7A" : "#F07840";
  const accentBg = isCook ? "rgba(74,124,89,0.08)" : "rgba(232,98,26,0.08)";
  const accentBorder = isCook ? "rgba(74,124,89,0.22)" : "rgba(232,98,26,0.22)";
  const accentGlow = isCook
    ? "0 0 20px rgba(74,124,89,0.18)"
    : "0 0 20px rgba(232,98,26,0.18)";
  const gradientTop = isCook
    ? "linear-gradient(135deg, #6BAF7A 0%, #4A7C59 60%, #3A6347 100%)"
    : "linear-gradient(135deg, #F07840 0%, #E8621A 60%, #C94E10 100%)";

  const cookActions = [
    {
      label: "Find a recipe",
      sub: "Search Google for instructions",
      Icon: SearchIcon,
      onPress: () => openLink(`https://www.google.com/search?q=how+to+cook+${encodeURIComponent(meal.name)}`),
    },
    {
      label: "Watch a quick recipe",
      sub: "See it on YouTube",
      Icon: PlayIcon,
      onPress: () => openLink(`https://www.youtube.com/results?search_query=${encodeURIComponent(meal.name + " recipe")}`),
    },
    ...(meal.ingredients && meal.ingredients.length > 0
      ? []
      : [
          {
            label: "Check ingredients",
            sub: "See what you'll need",
            Icon: ShoppingBagIcon,
            onPress: () => openLink(`https://www.google.com/search?q=${encodeURIComponent(meal.name + " ingredients")}`),
          },
        ]),
  ];

  const orderActions = [
    {
      label: "Search delivery",
      sub: "Find it on DoorDash, Uber Eats & more",
      Icon: DeliveryIcon,
      onPress: () => openLink(`https://www.google.com/search?q=order+${encodeURIComponent(meal.name)}+delivery`),
    },
    {
      label: "Find nearby",
      sub: "See restaurants close to you",
      Icon: MapPinIcon,
      onPress: () => openLink(mapsUrl(`${meal.name} near me`)),
    },
    {
      label: "Try another option",
      sub: "Go back and keep the meal",
      Icon: ArrowLeftIcon,
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
          className="relative w-full rounded-t-[28px] px-5 pt-5 pb-10"
          style={{
            maxWidth: 540,
            background:
              `radial-gradient(ellipse 80% 35% at 50% 0%, ${isCook ? "rgba(74,124,89,0.10)" : "rgba(232,98,26,0.09)"} 0%, transparent 60%), ` +
              "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%), " +
              "#211E1B",
            border: "1px solid rgba(245,237,224,0.07)",
            borderBottom: "none",
            boxShadow: `0 -8px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(245,237,224,0.07), ${accentGlow}`,
          }}
        >
          {/* Grab handle */}
          <div
            className="w-10 h-1 rounded-full mx-auto mb-5"
            style={{ background: "rgba(245,237,224,0.15)" }}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center text-[#8A7F78] hover:text-white transition"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(245,237,224,0.08)",
              borderRadius: "50%",
            }}
            aria-label="Close"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Accent top line */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[28px]"
            style={{ background: gradientTop }}
          />

          {/* Meal thumbnail + header */}
          <div className="flex items-center gap-3 mb-5">
            <div
              className="relative w-[52px] h-[52px] rounded-[12px] shrink-0 overflow-hidden"
              style={{ border: `1px solid ${accentBorder}` }}
            >
              {meal.image && !imgFailed ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={meal.image}
                  alt={meal.name}
                  className="w-full h-full object-cover"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <MealImageFallback mealName={meal.name} />
              )}
            </div>

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

          {/* Action rows */}
          <div className="flex flex-col gap-[8px]">
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={action.onPress}
                className="w-full flex items-center gap-3 rounded-[14px] px-4 py-[13px] transition-all active:scale-[0.98]"
                style={{
                  background: accentBg,
                  border: `1px solid ${accentBorder}`,
                  boxShadow: "inset 0 1px 0 rgba(245,237,224,0.04)",
                }}
              >
                <span
                  className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
                  style={{ color: accentLight, background: `${accentColor}18`, border: `1px solid ${accentBorder}` }}
                >
                  <action.Icon />
                </span>
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
                <ChevronRight color={accentLight} />
              </button>
            ))}
          </div>

          {/* Inline ingredients for cook mode */}
          {isCook && meal.ingredients && meal.ingredients.length > 0 && (
            <div
              className="mt-4 rounded-[14px] px-4 py-4"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(245,237,224,0.07)",
              }}
            >
              <p
                className="text-[10px] font-bold tracking-[2px] uppercase mb-3"
                style={{ color: accentLight, fontFamily: "var(--font-manrope)" }}
              >
                Ingredients
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
