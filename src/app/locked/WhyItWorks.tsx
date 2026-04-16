"use client";

import { useEffect, useState } from "react";
import { type Meal } from "../data/meals";
import { getPreferences, getSavedMeals, type UserPreferences } from "../lib/storage";
import { MEAL_CUISINES } from "../lib/scoring";

function buildReasons(
  meal: Meal,
  prefs: UserPreferences | null,
  savedMeals: Meal[],
  pantryMode: boolean,
): string[] {
  const reasons: string[] = [];

  function add(r: string) {
    if (reasons.length < 3) reasons.push(r);
  }

  // 1. Pantry mode — most actionable, surfaces first
  if (pantryMode) {
    if (meal.tags.includes("Pantry staple")) {
      add("Built around ingredients you likely already have");
    } else {
      add("Uses ingredients you already have");
    }
  }

  // 2. Cuisine match — personal and specific
  if (prefs && reasons.length < 3) {
    const mealCuisines = MEAL_CUISINES[meal.id] ?? [];
    const matched = mealCuisines.find((c) => prefs.cuisines.includes(c));
    if (matched) add(`Matches your ${matched} preference`);
  }

  // 3. Kid-friendly preference
  if (prefs?.kidFriendly === true && reasons.length < 3) {
    const isKidFriendly = meal.tags.some((t) =>
      ["kid", "crowd"].some((k) => t.toLowerCase().includes(k))
    );
    if (isKidFriendly) add("Works for the whole table");
  }

  // 4. Time / effort tags
  if (reasons.length < 3) {
    const hasNoCook = meal.tags.includes("No-cook option");
    const isQuick = meal.tags.some((t) =>
      ["15 min", "20 min", "25 min"].includes(t)
    );
    const isEasy = meal.tags.includes("Easy");

    if (hasNoCook) {
      add("No cooking required — minimal effort tonight");
    } else if (isQuick && isEasy) {
      add("Quick and low effort for tonight");
    } else if (isQuick) {
      add("Fast — on the table in under 30 minutes");
    } else if (isEasy) {
      add("Low effort with a reliable result");
    }
  }

  // 5. Saved behavior — category affinity
  if (reasons.length < 3) {
    const savedSameCategory = savedMeals.some((s) => s.category === meal.category);
    if (savedSameCategory) add("Fits the style of meals you tend to save");
  }

  // 6. Category vibe — generic but contextual
  if (reasons.length < 3) {
    const cat = meal.category.toLowerCase();
    const isIndulgent = meal.tags.some((t) => t.toLowerCase().includes("indulgent"));
    if (cat.includes("comfort")) {
      add("Familiar and satisfying — solid pick for tonight");
    } else if (cat.includes("crowd")) {
      add("Crowd-pleasing and hard to get wrong");
    } else if (cat.includes("fresh")) {
      add("Light and fresh without feeling like a compromise");
    } else if (isIndulgent || cat.includes("indulgent")) {
      add("Worth the indulgence — treat yourself energy");
    }
  }

  // 7. Meal-prep tag
  if (reasons.length < 3 && meal.tags.includes("Meal-prep friendly")) {
    add("Good for leftovers if you want to batch cook");
  }

  // Fallback — ensure at least 2 reasons
  if (reasons.length < 2) add(meal.whyItFits);

  return reasons;
}

type Props = {
  meal: Meal;
  pantryMode: boolean;
};

export default function WhyItWorks({ meal, pantryMode }: Props) {
  const [reasons, setReasons] = useState<string[]>([]);

  useEffect(() => {
    const prefs = getPreferences();
    const savedMeals = getSavedMeals();
    setReasons(buildReasons(meal, prefs, savedMeals, pantryMode));
  }, [meal, pantryMode]);

  if (reasons.length === 0) return null;

  return (
    <div className="mt-6 border-t border-white/[0.07] pt-6">
      <p className="text-[11px] uppercase tracking-[0.08em] text-white/35">
        Why this works
      </p>
      <ul className="mt-3 space-y-2.5">
        {reasons.map((reason, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full bg-white/20" />
            <span className="text-sm leading-6 text-white/65">{reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
