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
import { meals, type Meal } from "../data/meals";
import { rankMeals, rankMealsForSharedSession, hardGate, allergenGate, getAllHardNos } from "./scoring";
import type { UserProfileForScoring, CookingIntent } from "./scoring";
import type { Allergen } from "../data/meals";

const ALLERGEN_VALUES = new Set<string>([
  "peanuts", "tree nuts", "dairy", "eggs", "wheat", "soy", "fish", "shellfish", "sesame",
]);
import { supabase } from "./supabase";
import type { UserPreferences, TasteProfile, HistoryEntry } from "./storage";
import {
  getPreferences,
  getSavedMeals,
  getHistory,
  getTasteProfile,
  getRecentlySeenIds,
  getFlavorProfile,
  getFavorites,
} from "./storage";
import { fetchBehavioralSignalsBatch } from "./supabase-profile";

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
  // 1. Check whether the deck was already built (another client may have won).
  //    Also read cooking_intent so deck scoring reflects the host's choice.
  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("deck_meal_ids, cooking_intent")
    .eq("id", sessionId)
    .single();

  const existingIds = sessionRow?.deck_meal_ids as string[] | null;
  if (existingIds?.length) return existingIds;

  const cookingIntent = (sessionRow?.cooking_intent as CookingIntent | null) ?? "either";

  // 2. Fetch both profiles + behavioral signals in parallel
  const [profilesResult, behavioralSignalsMap] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, dietary_restrictions, hard_no_foods, favorite_cuisines, learned_weights, recently_seen_meal_ids")
      .in("user_id", [hostUserId, guestUserId]),
    fetchBehavioralSignalsBatch([hostUserId, guestUserId]),
  ]);

  const profiles = profilesResult.data;
  const hostProfile = profiles?.find((p) => p.user_id === hostUserId) ?? null;
  const guestProfile = profiles?.find((p) => p.user_id === guestUserId) ?? null;

  // Convert recently_chosen [{meal_id, chosen_at}] → HistoryEntry[] for time-based penalties
  const toHistory = (
    chosen: Array<{ meal_id: string; chosen_at: string }> | null | undefined,
  ): HistoryEntry[] => {
    if (!chosen?.length) return [];
    const mealMap = new Map<string, Meal>(meals.map((m) => [m.id, m]));
    return chosen.flatMap((c) => {
      const m = mealMap.get(c.meal_id);
      return m ? [{ meal: m, chosenAt: c.chosen_at }] : [];
    });
  };

  const hostSignals  = behavioralSignalsMap.get(hostUserId);
  const guestSignals = behavioralSignalsMap.get(guestUserId);

  // 3. Combine hard NOs — UNION: excluded if EITHER user has a hard NO.
  //    Expand each user's dietary_restrictions through DIETARY_RESTRICTION_MAP
  //    (same logic as getAllHardNos) so e.g. "Vegetarian" gates out meat meals.
  const hostHardNos = getAllHardNos({
    dietaryRestrictions: (hostProfile?.dietary_restrictions as string[] | null) ?? [],
    hardNoFoods: (hostProfile?.hard_no_foods as string[] | null) ?? [],
  } as UserPreferences);
  const guestHardNos = getAllHardNos({
    dietaryRestrictions: (guestProfile?.dietary_restrictions as string[] | null) ?? [],
    hardNoFoods: (guestProfile?.hard_no_foods as string[] | null) ?? [],
  } as UserPreferences);
  const combinedHardNos: string[] = [...new Set([...hostHardNos, ...guestHardNos])];

  // Extract allergen values stored in hard_no_foods (lowercase, non-conflicting with HARD_NO_KEYWORDS)
  const hostAllergens = ((hostProfile?.hard_no_foods as string[] | null) ?? [])
    .filter((v) => ALLERGEN_VALUES.has(v)) as Allergen[];
  const guestAllergens = ((guestProfile?.hard_no_foods as string[] | null) ?? [])
    .filter((v) => ALLERGEN_VALUES.has(v)) as Allergen[];
  const combinedAllergens: Allergen[] = [...new Set([...hostAllergens, ...guestAllergens])] as Allergen[];

  // 4. Build per-user scoring profiles (kept separate for mutual scoring)
  const hostScoringProfile: UserProfileForScoring = {
    cuisines: hostProfile?.favorite_cuisines ?? [],
    learnedWeights: (hostProfile?.learned_weights as TasteProfile | null) ?? null,
    recentlySeen: new Set(hostProfile?.recently_seen_meal_ids ?? []),
    chosenHistory: toHistory(hostSignals?.recently_chosen),
  };
  const guestScoringProfile: UserProfileForScoring = {
    cuisines: guestProfile?.favorite_cuisines ?? [],
    learnedWeights: (guestProfile?.learned_weights as TasteProfile | null) ?? null,
    recentlySeen: new Set(guestProfile?.recently_seen_meal_ids ?? []),
    chosenHistory: toHistory(guestSignals?.recently_chosen),
  };

  // 5a. Calculate dominance weight from shared session history.
  //     dominanceA = sessions where host initiated / total sessions together.
  //     weightA = 0.5 + (dominanceA - 0.5) × 0.3, capped to [0.35, 0.65].
  //     First shared session (no history): equal weights 0.5 / 0.5.
  let weightA = 0.5;
  let weightB = 0.5;
  try {
    const [{ count: totalTogether }, { count: hostInitiated }] = await Promise.all([
      supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .neq("id", sessionId)
        .in("status", ["active", "swiping", "matched"]) // only count meaningful sessions
        .or(
          `and(host_user_id.eq.${hostUserId},guest_user_id.eq.${guestUserId}),` +
          `and(host_user_id.eq.${guestUserId},guest_user_id.eq.${hostUserId})`,
        ),
      supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .neq("id", sessionId)
        .in("status", ["active", "swiping", "matched"])
        .eq("host_user_id", hostUserId)
        .eq("guest_user_id", guestUserId),
    ]);

    if ((totalTogether ?? 0) > 0) {
      const dominanceA = (hostInitiated ?? 0) / totalTogether!;
      weightA = Math.min(0.65, Math.max(0.35, 0.5 + (dominanceA - 0.5) * 0.3));
      weightB = 1 - weightA;
    }
  } catch {
    // Non-critical — fall back to equal weights
  }

  // 5b. Hard gate then allergen gate — both run additively (allergen gate never replaces hard gate)
  const eligibleMeals = allergenGate(hardGate(meals, combinedHardNos), combinedAllergens);

  // 6. Rank using mutual-fit scoring: each user scored independently,
  //    combined via weighted average + overlap bonuses + cooking intent boosts
  const ranked = rankMealsForSharedSession(
    eligibleMeals,
    hostScoringProfile,
    guestScoringProfile,
    weightA,
    weightB,
    cookingIntent,
  );

  const mealIds = ranked.map((r) => r.meal.id);

  // 7. Atomically save — only writes if deck_meal_ids is still NULL
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

  const eligibleMeals = allergenGate(hardGate(meals, getAllHardNos(prefs)), prefs?.allergens ?? []);

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
