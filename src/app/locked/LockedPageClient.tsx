"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type Meal } from "../data/meals";
import {
  getSavedMealsEnriched,
  saveMeal,
  removeSavedMeal,
  clearDecidedMeal,
} from "../lib/storage";
import { trackEvent } from "../lib/analytics";
import BottomNav from "../components/BottomNav";
import { getAuthUserId } from "../lib/identity";
import V3PostMatchHome from "../components/v3/V3PostMatchHome";
import V3LockedMealCard from "../components/v3/V3LockedMealCard";
import V3MealActionRows from "../components/v3/V3MealActionRows";

type Props = {
  meal: Meal;
  recipeQuery: string;
  pickedForYou: boolean;
};

export default function LockedPageClient({ meal, recipeQuery, pickedForYou }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [savedJustNow, setSavedJustNow] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    setSaved(getSavedMealsEnriched().some((s) => s.meal.id === meal.id));
    getAuthUserId().then((uid) => setIsGuest(uid === null));
  }, [meal.id]);

  function toggleSave() {
    if (saved) {
      removeSavedMeal(meal.id);
      setSaved(false);
      setSavedJustNow(false);
    } else {
      saveMeal(meal);
      setSaved(true);
      setSavedJustNow(true);
      setTimeout(() => setSavedJustNow(false), 2000);
    }
  }

  function handleNewDeck() {
    trackEvent("change_mind_clicked", { mealId: meal.id });
    if (isGuest) {
      // Clear the active decided meal before navigating so the deck starts fresh.
      // Without this, watcha_decided_meal would remain set in localStorage and
      // could cause stale state across the new deck session.
      clearDecidedMeal();
      router.push("/deck");
    } else {
      router.push("/");
    }
  }

  function handleCook() {
    trackEvent("cook_clicked", { mealId: meal.id });
    window.open(
      `https://www.google.com/search?q=${recipeQuery}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function handleOrder() {
    trackEvent("order_clicked", { mealId: meal.id });
    window.open(
      `https://www.google.com/maps/search/${encodeURIComponent(meal.name + " near me")}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const headline = pickedForYou ? "Decided\nfor you." : "Tonight's pick\nis locked in.";
  const sub = `You chose ${meal.name}.`;
  const matchScore = pickedForYou ? "Decided for you" : "Your pick";

  const saveAction = isGuest
    ? {
        icon: "⭐",
        title: "Sign up to save",
        sub: "Create an account to keep your favorites.",
        onClick: () => router.push("/auth?mode=signup"),
      }
    : {
        icon: "⭐",
        title: saved ? `Saved — ${meal.name}` : `Save ${meal.name}`,
        sub: saved ? "Tap to remove from favorites." : "Add to your favorites.",
        onClick: toggleSave,
      };

  return (
    <main
      className="relative min-h-screen text-white overflow-hidden flex flex-col"
      style={{ background: "#0B0805" }}
    >
      {/* Ambient top glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 28% at 50% 0%, rgba(232,98,26,0.13) 0%, transparent 60%)",
        }}
      />

      <div className="relative flex-1 overflow-y-auto flex flex-col pt-12 pb-6">
        <V3PostMatchHome
          mealName={meal.name}
          headline={headline}
          sub={sub}
          mealImage={meal.image || undefined}
          avatars={[]}
        />

        <V3LockedMealCard
          mealName={meal.name}
          tags={[meal.cuisine, meal.category].filter(Boolean).join(" • ")}
          cookTime={meal.tags.find((t) => /\d+\s*min/i.test(t)) ?? "—"}
          spice={meal.tags.some((t) => /spic/i.test(t)) ? "🌶️🌶️" : "Mild"}
          matchScore={matchScore}
          onClear={handleNewDeck}
          onSave={isGuest ? () => router.push("/auth?mode=signup") : toggleSave}
          isSaved={saved}
          savedJustNow={savedJustNow}
          onCook={handleCook}
          onOrder={handleOrder}
        />

        <V3MealActionRows
          mealName={meal.name}
          actions={[
            {
              icon: "🔄",
              title: "Changed your mind?",
              sub: "Start a new deck any time.",
              onClick: handleNewDeck,
            },
            saveAction,
          ]}
        />
      </div>

      {!isGuest && <BottomNav activeHref="/" />}
    </main>
  );
}
