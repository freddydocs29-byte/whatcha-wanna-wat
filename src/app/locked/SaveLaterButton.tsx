"use client";

import { useEffect, useState } from "react";
import type { Meal } from "../data/meals";
import { getSavedMealsEnriched, saveMeal, removeSavedMeal } from "../lib/storage";

function BookmarkIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ) : (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function SaveLaterButton({ meal }: { meal: Meal }) {
  const [saved, setSaved] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setSaved(getSavedMealsEnriched().some((s) => s.meal.id === meal.id));
  }, [meal.id]);

  function toggle() {
    if (saved) {
      removeSavedMeal(meal.id);
      setSaved(false);
      setShowConfirm(false);
    } else {
      saveMeal(meal);
      setSaved(true);
      setShowConfirm(true);
      setTimeout(() => setShowConfirm(false), 2200);
    }
  }

  return (
    <div className="relative flex flex-col items-end">
      <button
        onClick={toggle}
        className={`flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-[0.92] ${
          saved
            ? "border-white/20 bg-white/[0.12] text-white"
            : "border-white/[0.09] bg-white/[0.04] text-white/40 hover:border-white/15 hover:text-white/65"
        }`}
        aria-label={saved ? "Remove from saved" : "Save for later"}
      >
        <BookmarkIcon filled={saved} />
      </button>

      {/* Inline confirmation label — fades in/out below the icon */}
      <span
        className={`absolute top-full mt-2 right-0 whitespace-nowrap rounded-full border border-white/[0.08] bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/55 backdrop-blur-sm transition-all duration-300 ${
          showConfirm ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-1"
        }`}
      >
        Saved for later
      </span>
    </div>
  );
}
