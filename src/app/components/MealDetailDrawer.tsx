"use client";

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trackEvent } from "../lib/analytics";
import { EVENT_MEAL_DETAIL_VIEWED } from "../lib/analytics-events";
import { type Meal } from "../data/meals";
import { MealImageFallback } from "./MealImageFallback";

export type MealDetailDrawerContext = "solo" | "shared" | "top5" | "saved" | "history" | "home-win";

export type MealDetailDrawerProps = {
  meal: Meal | null;
  isOpen: boolean;
  onClose: () => void;
  onYes?: () => void;
  onSkip?: () => void;
  onLockIn?: () => void;
  context: MealDetailDrawerContext;
};

const DIETARY_KEYWORDS = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "gluten free",
  "dairy-free",
  "dairy free",
  "keto",
  "low-carb",
  "low carb",
  "halal",
  "kosher",
  "nut-free",
  "nut free",
  "paleo",
  "plant-based",
  "plant based",
  "whole30",
];

function parseCookTime(tags: string[]): string | null {
  for (const tag of tags) {
    if (
      /\d+\s*min/i.test(tag) ||
      /\d+\s*hr/i.test(tag) ||
      /\d+\s*hour/i.test(tag) ||
      /<\s*\d+/.test(tag)
    ) {
      return tag;
    }
  }
  return null;
}

function parseEffort(tags: string[]): string | null {
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    if (lower === "easy" || lower === "medium" || lower === "hard") return tag;
  }
  return null;
}

function parseFeel(category: string, tags: string[]): string | null {
  const cat = category.toLowerCase();
  if (cat.includes("comfort")) return "Comfort";
  if (
    cat.includes("fresh") ||
    cat.includes("salad") ||
    cat.includes("light")
  )
    return "Light";
  if (cat.includes("quick") || cat.includes("casual")) return "Light";
  if (cat.includes("hearty") || cat.includes("heavy")) return "Hearty";
  for (const tag of tags) {
    const t = tag.toLowerCase();
    if (t === "light") return "Light";
    if (t === "hearty") return "Hearty";
    if (t === "comfort") return "Comfort";
  }
  return null;
}

function getDietaryTags(tags: string[]): string[] {
  return tags.filter((tag) =>
    DIETARY_KEYWORDS.some((kw) => tag.toLowerCase().includes(kw))
  );
}

export function MealDetailDrawer({
  meal,
  isOpen,
  onClose,
  onYes,
  onSkip,
  onLockIn,
  context,
}: MealDetailDrawerProps) {
  const isSwipeContext = context === "solo" || context === "shared";
  const showHint = isSwipeContext;
  const isTop5 = context === "top5";

  const scrollRef = useRef<HTMLDivElement>(null);
  const [atScrollTop, setAtScrollTop] = useState(true);
  // Track which meal ID had an image load failure — auto-resets when meal changes
  const [imgFailedId, setImgFailedId] = useState<string | null>(null);

  const trackedMealIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || !meal) {
      trackedMealIdRef.current = null;
      return;
    }
    if (trackedMealIdRef.current === meal.id) return;
    trackedMealIdRef.current = meal.id;
    trackEvent(EVENT_MEAL_DETAIL_VIEWED, {
      mealId: meal.id,
      source_screen: context,
    });
  }, [isOpen, meal?.id, context]);

  if (!meal) return null;

  const imgFailed = imgFailedId === meal.id;

  const cookTime = parseCookTime(meal.tags);
  const effort = parseEffort(meal.tags);
  const feel = parseFeel(meal.category, meal.tags);
  const dietaryTags = getDietaryTags(meal.tags);

  const hasIngredients = meal.ingredients && meal.ingredients.length > 0;
  const hasWhyItFits = !!meal.whyItFits;
  const hasDietary = dietaryTags.length > 0;
  const hasQuickStats = cookTime || effort || feel;

  const displayIngredients = hasIngredients
    ? meal.ingredients!.slice(0, 8)
    : [];
  const extraIngredientCount =
    hasIngredients && meal.ingredients!.length > 8
      ? meal.ingredients!.length - 8
      : 0;

  // Top5 uses the warm parchment surface — keep its existing treatment
  const darkSurface = {
    sheet: {
      background:
        "radial-gradient(ellipse 80% 30% at 50% 0%, rgba(232,98,26,0.07) 0%, transparent 55%), " +
        "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%), " +
        "#1C1A18",
      border: "1px solid rgba(245,237,224,0.06)",
      borderBottom: "none",
      boxShadow: "0 -8px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(245,237,224,0.06)",
    },
    card: {
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(245,237,224,0.07)",
    },
    handle: "rgba(245,237,224,0.15)",
    label: "rgba(245,237,224,0.35)",
    value: "rgba(255,255,255,0.80)",
    divider: "rgba(245,237,224,0.07)",
    pill: {
      background: "rgba(255,231,202,0.06)",
      border: "1px solid rgba(245,237,224,0.10)",
      color: "#C7BDAC",
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
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
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            drag={atScrollTop ? "y" : false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            dragMomentum={false}
            dragDirectionLock={true}
            onDragEnd={(_, info) => {
              if (info.offset.y > 50 || info.velocity.y > 300) onClose();
            }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] max-h-[90vh]"
            style={darkSurface.sheet}
          >
            <div
              ref={scrollRef}
              onScroll={(e) => setAtScrollTop(e.currentTarget.scrollTop === 0)}
              className="overflow-y-auto max-h-[90vh] overscroll-contain"
              style={{ touchAction: atScrollTop ? "none" : "pan-y" }}
            >
              {/* Drag handle */}
              <div
                className="w-10 h-1 rounded-full mx-auto mt-3 mb-5"
                style={{
                  background: darkSurface.handle,
                }}
              />

              {/* Meal image */}
              <div className="relative mx-4 rounded-[16px] overflow-hidden mb-4" style={{ height: 200 }}>
                {meal.image && !imgFailed ? (
                  <img
                    src={meal.image}
                    alt={meal.name}
                    className="w-full h-full object-cover"
                    onError={() => setImgFailedId(meal.id)}
                  />
                ) : (
                  <MealImageFallback mealName={meal.name} />
                )}
                {/* Bottom scrim */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.25) 50%, transparent 100%)",
                  }}
                />
                {/* Subtle spotlight at center-top */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(232,98,26,0.10) 0%, transparent 70%)",
                  }}
                />
                {/* AI badge */}
                {meal.aiGenerated && (
                  <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white/70 text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full border border-white/15">
                    ✦ FRESH PICK
                  </div>
                )}
                {/* Meal name overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h2 className="font-display font-black text-2xl text-white leading-tight">
                    {meal.name}
                  </h2>
                  <p className="font-body text-sm text-white/60 mt-0.5">
                    {[meal.category, meal.cuisine].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>

              <div className="px-4 flex flex-col gap-3 pb-2">
                {/* Quick stats bar */}
                {hasQuickStats && (
                  <div
                    className="rounded-[14px] p-3 flex items-center"
                    style={darkSurface.card}
                  >
                    {cookTime && (
                      <div className="flex-1 text-center">
                        <p className="font-display font-bold text-sm text-[#E8621A]">{cookTime}</p>
                        <p
                          className="font-body text-[10px] uppercase tracking-wider mt-0.5"
                          style={{ color: darkSurface.label }}
                        >
                          Cook time
                        </p>
                      </div>
                    )}
                    {cookTime && effort && (
                      <div
                        className="w-px h-8"
                        style={{ background: darkSurface.divider }}
                      />
                    )}
                    {effort && (
                      <div className="flex-1 text-center">
                        <p className="font-display font-bold text-sm text-[#E8621A]">{effort}</p>
                        <p
                          className="font-body text-[10px] uppercase tracking-wider mt-0.5"
                          style={{ color: darkSurface.label }}
                        >
                          Effort
                        </p>
                      </div>
                    )}
                    {(cookTime || effort) && feel && (
                      <div
                        className="w-px h-8"
                        style={{ background: darkSurface.divider }}
                      />
                    )}
                    {feel && (
                      <div className="flex-1 text-center">
                        <p className="font-display font-bold text-sm text-[#E8621A]">{feel}</p>
                        <p
                          className="font-body text-[10px] uppercase tracking-wider mt-0.5"
                          style={{ color: darkSurface.label }}
                        >
                          Feel
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* About this meal */}
                {meal.description && (
                  <div
                    className="rounded-[14px] p-4"
                    style={darkSurface.card}
                  >
                    <p
                      className="font-body text-[10px] uppercase tracking-widest mb-2"
                      style={{ color: darkSurface.label }}
                    >
                      ABOUT THIS MEAL
                    </p>
                    <p
                      className="font-body text-sm leading-relaxed"
                      style={{ color: darkSurface.value }}
                    >
                      {meal.description}
                    </p>
                  </div>
                )}

                {/* Main ingredients */}
                {hasIngredients && (
                  <div
                    className="rounded-[14px] p-4"
                    style={darkSurface.card}
                  >
                    <p
                      className="font-body text-[10px] uppercase tracking-widest mb-3"
                      style={{ color: darkSurface.label }}
                    >
                      MAIN INGREDIENTS
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {displayIngredients.map((ing) => (
                        <span
                          key={ing}
                          className="text-sm px-3 py-1.5 rounded-full"
                          style={darkSurface.pill}
                        >
                          {ing}
                        </span>
                      ))}
                      {extraIngredientCount > 0 && (
                        <span
                          className="text-sm px-3 py-1.5 rounded-full"
                          style={{ ...darkSurface.pill, color: "rgba(199,189,172,0.55)" }}
                        >
                          +{extraIngredientCount} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Why this works tonight */}
                {hasWhyItFits && (
                  <div
                    className="rounded-[14px] p-4"
                    style={darkSurface.card}
                  >
                    <p
                      className="font-body text-[10px] uppercase tracking-widest mb-2"
                      style={{ color: darkSurface.label }}
                    >
                      WHY THIS WORKS TONIGHT
                    </p>
                    <div className="flex items-start gap-2">
                      <span className="text-[#E8621A] text-base leading-tight mt-0.5">✦</span>
                      <p
                        className="font-body text-sm leading-relaxed"
                        style={{ color: darkSurface.value }}
                      >
                        {meal.whyItFits}
                      </p>
                    </div>
                  </div>
                )}

                {/* Dietary tags */}
                {hasDietary && (
                  <div
                    className="rounded-[14px] p-4"
                    style={darkSurface.card}
                  >
                    <p
                      className="font-body text-[10px] uppercase tracking-widest mb-3"
                      style={{ color: darkSurface.label }}
                    >
                      DIETARY
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {dietaryTags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs font-semibold px-3 py-1 rounded-full"
                          style={darkSurface.pill}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="px-4 pt-4 pb-2">
                {isSwipeContext && onYes && onSkip && (
                  <div className="flex gap-3">
                    <button
                      onClick={onSkip}
                      className="flex-1 font-body font-semibold text-sm rounded-full py-4 transition active:scale-[0.97]"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(245,237,224,0.09)",
                        color: "#8A7F78",
                      }}
                    >
                      Skip
                    </button>
                    <button
                      onClick={onYes}
                      className="flex-[2] text-white font-body font-semibold text-sm rounded-full py-4 transition active:scale-[0.97]"
                      style={{
                        background: "linear-gradient(135deg, #F07840 0%, #E8621A 60%, #C94E10 100%)",
                        boxShadow: "0 0 20px rgba(232,98,26,0.30)",
                      }}
                    >
                      Yes, this one ✓
                    </button>
                  </div>
                )}

                {context === "top5" && onLockIn && (
                  <button
                    onClick={onLockIn}
                    className="w-full text-white font-body font-semibold text-sm rounded-full py-4 transition active:scale-[0.97]"
                    style={{
                      background: "linear-gradient(135deg, #F07840 0%, #E8621A 60%, #C94E10 100%)",
                      boxShadow: "0 0 20px rgba(232,98,26,0.30)",
                    }}
                  >
                    Lock this in →
                  </button>
                )}

                {context === "saved" && (
                  <button
                    onClick={onClose}
                    className="w-full font-body font-semibold text-sm rounded-full py-4 transition active:scale-[0.97]"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(245,237,224,0.09)",
                      color: "#8A7F78",
                    }}
                  >
                    Close
                  </button>
                )}

                {context === "history" && (
                  <div className="flex flex-col gap-3">
                    {onLockIn && (
                      <button
                        onClick={onLockIn}
                        className="w-full text-white font-body font-semibold text-sm rounded-full py-4 transition active:scale-[0.97]"
                        style={{
                          background: "linear-gradient(135deg, #F07840 0%, #E8621A 60%, #C94E10 100%)",
                          boxShadow: "0 0 20px rgba(232,98,26,0.30)",
                        }}
                      >
                        Let&apos;s eat tonight →
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="w-full font-body font-semibold text-sm rounded-full py-4 transition active:scale-[0.97]"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(245,237,224,0.09)",
                        color: "#8A7F78",
                      }}
                    >
                      Close
                    </button>
                  </div>
                )}

                {context === "home-win" && (
                  <div className="flex flex-col gap-3">
                    {onLockIn && (
                      <button
                        onClick={onLockIn}
                        className="w-full text-white font-body font-semibold text-sm rounded-full py-4 transition active:scale-[0.97]"
                        style={{
                          background: "linear-gradient(135deg, #F07840 0%, #E8621A 60%, #C94E10 100%)",
                          boxShadow: "0 0 20px rgba(232,98,26,0.30)",
                        }}
                      >
                        Let&apos;s eat →
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="w-full font-body font-semibold text-sm rounded-full py-4 transition active:scale-[0.97]"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(245,237,224,0.09)",
                        color: "#8A7F78",
                      }}
                    >
                      Close
                    </button>
                  </div>
                )}

                {isTop5 && !onLockIn && (
                  <button
                    onClick={onClose}
                    className="w-full font-body font-semibold text-sm rounded-full py-4 transition active:scale-[0.97]"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(245,237,224,0.09)",
                      color: "#8A7F78",
                    }}
                  >
                    Close
                  </button>
                )}
              </div>

              {/* Bottom hint */}
              {showHint && (
                <p className="text-center text-white/30 text-xs pb-4 pt-2">
                  Swipe to keep browsing
                </p>
              )}

              {/* Safe area spacer */}
              <div className="h-4" />
            </div>{/* end inner scroll container */}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
