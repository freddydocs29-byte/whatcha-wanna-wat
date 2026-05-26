"use client";

import { motion, AnimatePresence } from "framer-motion";
import { type Meal } from "../data/meals";

export type MealDetailDrawerContext = "solo" | "shared" | "top5" | "saved" | "history";

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

  if (!meal) return null;

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
            className="fixed inset-0 z-50 bg-black/60"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#1C1A18] rounded-t-[28px] max-h-[90vh] overflow-y-auto"
          >
            {/* Drag handle */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-5" />

            {/* Meal image */}
            <div className="relative mx-4 rounded-[16px] overflow-hidden mb-4" style={{ height: 200 }}>
              {meal.image ? (
                <img
                  src={meal.image}
                  alt={meal.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#2A2420] flex items-center justify-center text-6xl">
                  🍽️
                </div>
              )}
              {/* Bottom scrim */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)",
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
                <div className="bg-[#252525] rounded-[12px] p-3 flex items-center">
                  {cookTime && (
                    <>
                      <div className="flex-1 text-center">
                        <p className="font-display font-bold text-sm text-[#E8621A]">{cookTime}</p>
                        <p className="font-body text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Cook time</p>
                      </div>
                    </>
                  )}
                  {cookTime && effort && (
                    <div className="w-px h-8 bg-white/10" />
                  )}
                  {effort && (
                    <>
                      <div className="flex-1 text-center">
                        <p className="font-display font-bold text-sm text-[#E8621A]">{effort}</p>
                        <p className="font-body text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Effort</p>
                      </div>
                    </>
                  )}
                  {(cookTime || effort) && feel && (
                    <div className="w-px h-8 bg-white/10" />
                  )}
                  {feel && (
                    <div className="flex-1 text-center">
                      <p className="font-display font-bold text-sm text-[#E8621A]">{feel}</p>
                      <p className="font-body text-[10px] text-white/40 uppercase tracking-wider mt-0.5">Feel</p>
                    </div>
                  )}
                </div>
              )}

              {/* About this meal */}
              {meal.description && (
                <div className="bg-[#252525] rounded-[12px] p-4">
                  <p className="font-body text-[10px] text-white/40 uppercase tracking-widest mb-2">
                    ABOUT THIS MEAL
                  </p>
                  <p className="font-body text-sm text-white/75 leading-relaxed">
                    {meal.description}
                  </p>
                </div>
              )}

              {/* Main ingredients */}
              {hasIngredients && (
                <div className="bg-[#252525] rounded-[12px] p-4">
                  <p className="font-body text-[10px] text-white/40 uppercase tracking-widest mb-3">
                    MAIN INGREDIENTS
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {displayIngredients.map((ing) => (
                      <span
                        key={ing}
                        className="bg-[#1C1A18] text-white/80 text-sm px-3 py-1.5 rounded-full border border-white/10"
                      >
                        {ing}
                      </span>
                    ))}
                    {extraIngredientCount > 0 && (
                      <span className="bg-[#1C1A18] text-white/40 text-sm px-3 py-1.5 rounded-full border border-white/10">
                        +{extraIngredientCount} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Why this works tonight */}
              {hasWhyItFits && (
                <div className="bg-[#252525] rounded-[12px] p-4">
                  <p className="font-body text-[10px] text-white/40 uppercase tracking-widest mb-2">
                    WHY THIS WORKS TONIGHT
                  </p>
                  <div className="flex items-start gap-2">
                    <span className="text-[#E8621A] text-base leading-tight mt-0.5">✦</span>
                    <p className="font-body text-sm text-white/75 leading-relaxed">
                      {meal.whyItFits}
                    </p>
                  </div>
                </div>
              )}

              {/* Dietary tags */}
              {hasDietary && (
                <div className="bg-[#252525] rounded-[12px] p-4">
                  <p className="font-body text-[10px] text-white/40 uppercase tracking-widest mb-3">
                    DIETARY
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {dietaryTags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-[#2A3A2E] text-[#4A7C59] text-xs font-semibold px-3 py-1 rounded-full"
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
                    className="flex-1 bg-[#2A2420] text-[#8A7F78] font-body font-semibold text-sm rounded-full py-4 transition active:scale-[0.97]"
                  >
                    Skip
                  </button>
                  <button
                    onClick={onYes}
                    className="flex-[2] bg-[#E8621A] text-white font-body font-semibold text-sm rounded-full py-4 transition active:scale-[0.97]"
                    style={{ boxShadow: "0 0 20px rgba(232,98,26,0.3)" }}
                  >
                    Yes, this one ✓
                  </button>
                </div>
              )}

              {context === "top5" && onLockIn && (
                <button
                  onClick={onLockIn}
                  className="w-full bg-[#E8621A] text-white font-body font-semibold text-sm rounded-full py-4 transition active:scale-[0.97]"
                  style={{ boxShadow: "0 0 20px rgba(232,98,26,0.3)" }}
                >
                  Lock this in →
                </button>
              )}

              {(context === "saved" || context === "history") && (
                <button
                  onClick={onClose}
                  className="w-full bg-[#2A2420] text-[#8A7F78] font-body font-semibold text-sm rounded-full py-4 transition active:scale-[0.97]"
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
