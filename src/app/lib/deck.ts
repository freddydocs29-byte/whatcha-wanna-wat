/**
 * Shared deck builder — used by the session page to create a single
 * canonical deck for both participants to swipe through.
 *
 * buildSharedDeckForSession  (async, Supabase-backed)
 *   Waits until both users have joined, fetches both Supabase profiles,
 *   combines their hard NOs and preferences, and atomically stores the
 *   resulting ordered deck on the session row. Either participant can
 *   trigger it; a DB-level guard (deck_meal_ids IS NULL) prevents
 *   duplicate generation if both clients fire at the same time.
 *
 * buildSharedDeck  (sync, localStorage-only)
 *   Legacy fallback — kept for safety but no longer called in normal flow.
 */
import { meals } from "../data/meals";
import { rankMeals, hardGate } from "./scoring";
import { supabase } from "./supabase";
import type { UserPreferences, TasteProfile } from "./storage";
import {
  getPreferences,
  getSavedMeals,
  getHistory,
  getTasteProfile,
  getRecentlySeenIds,
  getFlavorProfile,
  getFavorites,
} from "./storage";

// ── Merge helpers ─────────────────────────────────────────────────────────────

/**
 * Merges two TasteProfiles (learned weights) using element-wise max.
 * Preserves the stronger signal from either user. interactionCount is averaged.
 */
function mergeTasteProfiles(
  a: TasteProfile | null,
  b: TasteProfile | null,
): TasteProfile | null {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;

  const mergeRecord = (
    x: Record<string, number>,
    y: Record<string, number>,
  ): Record<string, number> => {
    const out: Record<string, number> = { ...x };
    for (const [key, val] of Object.entries(y)) {
      out[key] = Math.max(out[key] ?? 0, val);
    }
    return out;
  };

  return {
    likedTags: mergeRecord(a.likedTags, b.likedTags),
    dislikedTags: mergeRecord(a.dislikedTags, b.dislikedTags),
    likedCategories: mergeRecord(a.likedCategories, b.likedCategories),
    interactionCount: Math.round((a.interactionCount + b.interactionCount) / 2),
  };
}

// ── Primary shared-deck builder ───────────────────────────────────────────────

/**
 * Builds one shared deck from both users' Supabase profiles and atomically
 * persists it to sessions.deck_meal_ids.
 *
 * Safe to call from both clients simultaneously — the first write wins and
 * the losing client loads what the winner saved.
 *
 * Returns the final ordered array of meal IDs (either freshly built or the
 * already-stored deck if another client built it first).
 */
export async function buildSharedDeckForSession(
  sessionId: string,
  hostUserId: string,
  guestUserId: string,
): Promise<string[]> {
  // 1. Check whether the deck was already built (another client may have won)
  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("deck_meal_ids")
    .eq("id", sessionId)
    .single();

  const existingIds = sessionRow?.deck_meal_ids as string[] | null;
  if (existingIds?.length) return existingIds;

  // 2. Fetch both profiles in one query
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, hard_no_foods, favorite_cuisines, learned_weights, recently_seen_meal_ids")
    .in("user_id", [hostUserId, guestUserId]);

  const hostProfile = profiles?.find((p) => p.user_id === hostUserId) ?? null;
  const guestProfile = profiles?.find((p) => p.user_id === guestUserId) ?? null;

  // 3. Combine hard NOs — UNION: excluded if EITHER user has a hard NO
  const combinedHardNos: string[] = [
    ...new Set([
      ...(hostProfile?.hard_no_foods ?? []),
      ...(guestProfile?.hard_no_foods ?? []),
    ]),
  ];

  // 4. Combine cuisine preferences — UNION
  const combinedCuisines: string[] = [
    ...new Set([
      ...(hostProfile?.favorite_cuisines ?? []),
      ...(guestProfile?.favorite_cuisines ?? []),
    ]),
  ];

  // 5. Merge taste profiles: element-wise max preserves stronger signal
  const mergedTasteProfile = mergeTasteProfiles(
    (hostProfile?.learned_weights as TasteProfile | null) ?? null,
    (guestProfile?.learned_weights as TasteProfile | null) ?? null,
  );

  // 6. Combine recently seen — UNION (recency penalty for either user's recent meals)
  const combinedRecentlySeen: string[] = [
    ...new Set([
      ...(hostProfile?.recently_seen_meal_ids ?? []),
      ...(guestProfile?.recently_seen_meal_ids ?? []),
    ]),
  ];

  // 7. Build merged preferences for ranking
  const mergedPrefs: UserPreferences = {
    cuisines: combinedCuisines,
    dislikedFoods: combinedHardNos,
    spiceLevel: "any", // spice level is not stored in Supabase profiles
    cookOrOrder: "either",
    kidFriendly: null,
  };

  // 8. Hard gate — remove any meal that violates EITHER user's hard NOs
  const eligibleMeals = hardGate(meals, combinedHardNos);

  // 9. Rank with merged preferences and "partner" context
  const ranked = rankMeals(
    eligibleMeals,
    mergedPrefs,
    [],        // savedMeals not available from Supabase profiles
    [],        // history not available from Supabase profiles
    false,     // no pantry mode
    mergedTasteProfile ?? undefined,
    new Set(combinedRecentlySeen),
    undefined, // flavorProfile not available from Supabase profiles
    [],        // favorites not available from Supabase profiles
    [],        // no ingredient filter
    "partner", // shared context
    new Set(), // fresh session — nothing seen yet
    null,      // no vibe filter
  );

  const mealIds = ranked.map((r) => r.meal.id);

  // 10. Atomically save — only writes if deck_meal_ids is still NULL
  //     This prevents duplicate decks when both clients trigger simultaneously.
  const { data: updated, error: updateError } = await supabase
    .from("sessions")
    .update({ deck_meal_ids: mealIds, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .is("deck_meal_ids", null)
    .select("deck_meal_ids")
    .single();

  if (!updateError && (updated?.deck_meal_ids as string[] | null)?.length) {
    return updated!.deck_meal_ids as string[];
  }

  // Another client won the race — load what they saved
  const { data: raceWinner } = await supabase
    .from("sessions")
    .select("deck_meal_ids")
    .eq("id", sessionId)
    .single();

  return (raceWinner?.deck_meal_ids as string[]) ?? mealIds;
}

// ── Legacy sync builder (localStorage-only) ───────────────────────────────────

/** @deprecated Use buildSharedDeckForSession for all shared sessions. */
export function buildSharedDeck(): string[] {
  const prefs = getPreferences();
  const savedMeals = getSavedMeals();
  const history = getHistory();
  const recentlySeen = getRecentlySeenIds();
  const tasteProfile = getTasteProfile();
  const flavorProfile = getFlavorProfile() ?? undefined;
  const favorites = getFavorites();

  const eligibleMeals = hardGate(meals, prefs?.dislikedFoods ?? []);

  const ranked = rankMeals(
    eligibleMeals,
    prefs,
    savedMeals,
    history,
    false,
    tasteProfile,
    recentlySeen,
    flavorProfile,
    favorites,
    [],
    "partner",
    new Set(),
    null,
  );

  return ranked.map((r) => r.meal.id);
}
