/**
 * Shared deck builder — used by the session page to create a single
 * canonical deck for both participants to swipe through.
 *
 * Called on the host's device so the host's preferences and history drive
 * the ranking. The resulting ordered meal IDs are persisted to the session
 * row so both users load the exact same sequence.
 */
import { meals } from "../data/meals";
import { rankMeals, hardGate } from "./scoring";
import {
  getPreferences,
  getSavedMeals,
  getHistory,
  getTasteProfile,
  getRecentlySeenIds,
  getFlavorProfile,
  getFavorites,
} from "./storage";

export function buildSharedDeck(): string[] {
  const prefs = getPreferences();
  const savedMeals = getSavedMeals();
  const history = getHistory();
  const recentlySeen = getRecentlySeenIds();
  const tasteProfile = getTasteProfile();
  const flavorProfile = getFlavorProfile() ?? undefined;
  const favorites = getFavorites();

  // Hard gate — exclude host's hard NOs before ranking.
  // Guest's hard NOs are applied on the guest's device when the deck loads.
  // Together they enforce the UNION of both users' hard NOs.
  const eligibleMeals = hardGate(meals, prefs?.dislikedFoods ?? []);

  const ranked = rankMeals(
    eligibleMeals,
    prefs,
    savedMeals,
    history,
    false,           // no pantry mode
    tasteProfile,
    recentlySeen,
    flavorProfile,
    favorites,
    [],              // no ingredient filter
    "partner",       // context — deciding with someone
    new Set(),       // fresh session, nothing seen yet
    null,            // no vibe filter — show everything ranked
  );

  return ranked.map((r) => r.meal.id);
}
