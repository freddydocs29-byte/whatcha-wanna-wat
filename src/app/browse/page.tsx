"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { meals, type Meal } from "../data/meals";
import { addToHistory, updateTasteProfile } from "../lib/storage";
import CookOrderButtons from "../locked/CookOrderButtons";
import SaveLaterButton from "../locked/SaveLaterButton";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&h=750&q=80";

function getRecipeQuery(meal: Meal): string {
  const isQuickOrEasy = meal.tags.some((t) =>
    ["easy", "15 min", "20 min", "25 min"].some((k) =>
      t.toLowerCase().includes(k)
    )
  );
  return encodeURIComponent(`${meal.name} ${isQuickOrEasy ? "easy" : "quick"} recipe`);
}

export default function BrowsePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Meal | null>(null);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  function handleImgError(id: string) {
    setImgErrors((prev) => new Set(prev).add(id));
  }

  function handleChoose(meal: Meal) {
    updateTasteProfile(meal, "choose");
    addToHistory(meal);
    router.push(`/locked?mealId=${meal.id}`);
  }

  return (
    <main className="min-h-screen bg-[#080808] safe-top text-white">
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#080808]/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-white/50 transition hover:text-white/80"
          >
            ← Back
          </button>
          <h1 className="text-sm font-medium text-white/70">All Meals</h1>
          <span className="text-sm text-white/30">{meals.length}</span>
        </div>
      </div>

      {/* ── 2-column grid ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-md px-3 pb-10 pt-3">
        <div className="grid grid-cols-2 gap-2">
          {meals.map((meal) => (
            <button
              key={meal.id}
              onClick={() => setSelected(meal)}
              className="group relative overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.03] text-left active:scale-[0.97] transition-transform"
            >
              <div className="relative aspect-[3/4]">
                <img
                  src={imgErrors.has(meal.id) ? FALLBACK_IMAGE : meal.image}
                  alt={meal.name}
                  onError={() => handleImgError(meal.id)}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={
                    imgErrors.has(meal.id)
                      ? { filter: "brightness(0.75) saturate(0.5)" }
                      : undefined
                  }
                />
                {/* gradient */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.18) 48%, transparent 100%)",
                  }}
                />
                {/* name */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-sm font-semibold leading-snug tracking-[-0.02em] text-white">
                    {meal.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/45">{meal.category}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Inline preview modal ───────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={() => setSelected(null)}
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[34px] bg-[#111]"
            >
              {/* Image */}
              <div className="relative aspect-[16/9] overflow-hidden">
                <img
                  src={imgErrors.has(selected.id) ? FALLBACK_IMAGE : selected.image}
                  alt={selected.name}
                  className="h-full w-full object-cover"
                  style={
                    imgErrors.has(selected.id)
                      ? { filter: "brightness(0.75) saturate(0.5)" }
                      : undefined
                  }
                />
                {/* fade into sheet bg */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(17,17,17,1) 0%, rgba(17,17,17,0.35) 42%, transparent 100%)",
                  }}
                />
                {/* Close button */}
                <button
                  onClick={() => setSelected(null)}
                  className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/70 backdrop-blur-sm transition hover:text-white active:scale-90"
                  aria-label="Close"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M1 1l10 10M11 1L1 11"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="px-5 pb-8 pt-4">
                {/* Meal info + save button */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-3">
                    <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">
                      {selected.name}
                    </h2>
                    <p className="mt-1.5 text-sm leading-6 text-white/55">
                      {selected.whyItFits}
                    </p>
                  </div>
                  <SaveLaterButton meal={selected} />
                </div>

                {/* Actions */}
                <div className="mt-5 grid gap-3">
                  {/* Primary: commit to this meal */}
                  <button
                    onClick={() => handleChoose(selected)}
                    className="w-full rounded-full bg-white py-4 text-base font-semibold text-black"
                    style={{
                      boxShadow:
                        "0 0 24px rgba(255,255,255,0.12), 0 2px 8px rgba(0,0,0,0.4)",
                    }}
                  >
                    Choose this
                  </button>

                  {/* Secondary: cook / order links */}
                  <CookOrderButtons
                    meal={selected}
                    recipeQuery={getRecipeQuery(selected)}
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
