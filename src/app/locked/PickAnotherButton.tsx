"use client";

import { useRouter } from "next/navigation";
import {
  getPreferences,
  getTasteProfile,
  getFlavorProfile,
  getRecentlySeenIds,
  getSavedMeals,
  getFavorites,
  getHistory,
  getLastDecidePick,
  setLastDecidePick,
  addToHistory,
} from "../lib/storage";
import { meals } from "../data/meals";
import { rankMeals } from "../lib/scoring";

type Props = { currentMealId: string };

/**
 * "Pick something else" for the decided-for-you locked screen.
 *
 * Re-runs the same scoring as "Decide for me" but suppresses the meal the user
 * just rejected. Uses router.replace so the new locked page replaces the old
 * one in the history stack — pressing Back from the new pick goes home, not
 * back to the rejected pick.
 */
export default function PickAnotherButton({ currentMealId }: Props) {
  const router = useRouter();

  function handlePickAnother() {
    const prefs = getPreferences();
    const saved = getSavedMeals();
    const favs = getFavorites();
    const history = getHistory();
    const tasteProfile = getTasteProfile();
    const flavorProfile = getFlavorProfile();
    const recentlySeen = getRecentlySeenIds();

    const ranked = rankMeals(
      meals,
      prefs,
      saved,
      history,
      false,
      tasteProfile,
      recentlySeen,
      flavorProfile ?? undefined,
      favs,
    );

    // Suppress the meal currently on screen. Also check lastDecidePick in case
    // the user taps "Pick something else" multiple times in a row.
    const lastId = getLastDecidePick();
    const avoid = new Set([currentMealId, lastId].filter((id): id is string => !!id));

    // Use a wider pool (8) than the initial pick so we reliably find a new meal.
    const pool = ranked.slice(0, 8);
    const pick = pool.find((r) => !avoid.has(r.meal.id)) ?? pool[0] ?? ranked[0];

    setLastDecidePick(pick.meal.id);
    addToHistory(pick.meal);

    // replace — not push — so Back from the new locked page returns to home,
    // not to the rejected pick (which would trap the user in a loop).
    router.replace(`/locked?mealId=${pick.meal.id}&decided=1`);
  }

  return (
    <button
      onClick={handlePickAnother}
      className="rounded-full border border-white/10 bg-white/[0.05] px-5 py-4 text-center text-base font-medium text-white/70 w-full transition active:scale-[0.99]"
    >
      Pick something else
    </button>
  );
}
