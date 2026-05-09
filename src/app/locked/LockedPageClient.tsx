"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type Meal } from "../data/meals";
import {
  getHistory,
  getStreak,
  getSavedMealsEnriched,
  saveMeal,
  removeSavedMeal,
} from "../lib/storage";
import { trackEvent } from "../lib/analytics";

type Props = {
  meal: Meal;
  recipeQuery: string;
  pickedForYou: boolean;
};

export default function LockedPageClient({ meal, recipeQuery, pickedForYou }: Props) {
  const router = useRouter();
  const [decisionCount, setDecisionCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [saved, setSaved] = useState(false);
  const timeLabel = "just now";

  useEffect(() => {
    const history = getHistory();
    setDecisionCount(history.length);
    setStreak(getStreak());
    setSaved(getSavedMealsEnriched().some((s) => s.meal.id === meal.id));
  }, [meal.id]);

  function toggleSave() {
    if (saved) {
      removeSavedMeal(meal.id);
      setSaved(false);
    } else {
      saveMeal(meal);
      setSaved(true);
    }
  }

  function handleNewDeck() {
    trackEvent("change_mind_clicked", { mealId: meal.id });
    router.push("/");
  }

  const decidedWith = pickedForYou ? "just for you" : "your partner";

  return (
    <main className="min-h-screen bg-[#1C1A18] px-5 pt-12 pb-10 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">

        {/* Top bar — avatar */}
        <div className="flex items-center justify-end mb-6">
          <div className="w-11 h-11 rounded-full bg-[#E8621A] flex items-center justify-center font-display font-black text-lg text-white">
            Y
          </div>
        </div>

        {/* 1. Headline block */}
        <div>
          <h1 className="font-display font-black text-4xl text-white leading-tight">
            Good call.
          </h1>
          <h1 className="font-display font-black text-4xl text-[#E8621A] leading-tight">
            Now stop thinking about it.
          </h1>
          <p className="font-body text-base text-[#8A7F78] mt-2">
            Tonight&apos;s decision is done.
          </p>
        </div>

        {/* 2. Tonight's match card */}
        <div
          className="w-full bg-[#2A2420] rounded-[20px] p-5 mt-6 border border-[#4A7C59]/30"
          style={{ boxShadow: "0 0 30px rgba(74,124,89,0.12)" }}
        >
          <p className="text-[#4A7C59] text-[11px] font-semibold tracking-widest uppercase mb-3">
            TONIGHT&apos;S MATCH
          </p>
          <div className="flex items-center gap-4">
            {/* Green checkmark */}
            <div className="w-10 h-10 rounded-full bg-[#4A7C59] flex items-center justify-center font-display font-black text-lg text-white flex-shrink-0">
              ✓
            </div>
            {/* Meal info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-xl text-white truncate">
                  🍽️ {meal.name}
                </span>
              </div>
              <p className="font-body text-xs text-[#8A7F78] mt-1">
                Decided with {decidedWith} · {timeLabel}
              </p>
            </div>
            {/* CTA */}
            <a
              href={`https://www.google.com/search?q=${recipeQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("lets_eat_clicked", { mealId: meal.id })}
              className="bg-[#4A7C59] text-white font-display font-black text-sm px-4 py-2.5 rounded-full whitespace-nowrap flex-shrink-0"
            >
              Let&apos;s eat 🙌
            </a>
          </div>
        </div>

        {/* 3. Action cards */}
        <div className="flex flex-col gap-3 mt-4">
          {/* Changed your mind? */}
          <button
            onClick={handleNewDeck}
            className="w-full bg-[#2A2420] rounded-[18px] p-4 flex items-center gap-4 text-left"
          >
            <div className="w-12 h-12 rounded-[12px] bg-[#3D3733] flex items-center justify-center text-2xl flex-shrink-0">
              🔄
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-black text-base text-white">Changed your mind?</p>
              <p className="font-body text-sm text-[#8A7F78] mt-0.5">Start a new deck any time.</p>
            </div>
            <span className="text-[#8A7F78] text-lg">→</span>
          </button>

          {/* Save meal */}
          <button
            onClick={toggleSave}
            className="w-full bg-[#2A2420] rounded-[18px] p-4 flex items-center gap-4 text-left"
          >
            <div className="w-12 h-12 rounded-[12px] bg-[#3D3733] flex items-center justify-center text-2xl flex-shrink-0">
              ⭐
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-black text-base text-white">
                {saved ? `Saved — ${meal.name}` : `Save ${meal.name}`}
              </p>
              <p className="font-body text-sm text-[#8A7F78] mt-0.5">
                {saved ? "Tap to remove from favorites." : "Add to your favorites."}
              </p>
            </div>
            <span className="text-[#8A7F78] text-lg">{saved ? "✓" : "→"}</span>
          </button>
        </div>

        {/* 4. Streak section */}
        <div className="mt-8">
          <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-3">
            YOUR STREAK
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#2A2420] rounded-[16px] p-4 flex flex-col items-center justify-center">
              <span className="font-display font-black text-3xl text-[#E8621A]">
                {decisionCount}
              </span>
              <span className="font-body text-xs text-[#8A7F78] text-center mt-1">
                Decisions made
              </span>
            </div>
            <div className="bg-[#2A2420] rounded-[16px] p-4 flex flex-col items-center justify-center">
              <span className="font-display font-black text-3xl text-[#E8621A]">
                {streak}
              </span>
              <span className="font-body text-xs text-[#8A7F78] text-center mt-1">
                Days in a row
              </span>
            </div>
            <div className="bg-[#2A2420] rounded-[16px] p-4 flex flex-col items-center justify-center">
              <span className="font-display font-black text-3xl text-[#E8621A]">
                2min
              </span>
              <span className="font-body text-xs text-[#8A7F78] text-center mt-1">
                Avg. decision time
              </span>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
