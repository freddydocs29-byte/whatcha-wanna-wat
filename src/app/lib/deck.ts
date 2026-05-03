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
import { rankMeals, rankMealsForSharedSession, scoreAllMealsForSharedSession, hardGate } from "./scoring";
import type { UserProfileForScoring } from "./scoring";
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
import { composeDeck } from "./deck-composer";
import { FEATURES } from "./feature-flags";

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

// ── Shared AI meal fetcher ────────────────────────────────────────────────────

/**
 * Calls /api/generate-meals with combined preferences from both session users.
 * Returns an empty array on any failure — AI enrichment is best-effort.
 *
 * Must be called from a browser context (client component) so the relative
 * fetch URL resolves correctly.
 */
async function fetchSharedAIMeals(params: {
  hostCuisines: string[];
  guestCuisines: string[];
  combinedHardNos: string[];
  zone1Names: string[];
  recentlySeenNames: string[];
  vibeMode: string;
  count: number;
  sessionSeed: string;
}): Promise<Meal[]> {
  try {
    const resp = await fetch("/api/generate-meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preferences: {
          cuisines: params.hostCuisines,
          dislikedFoods: params.combinedHardNos,
          spiceLevel: "any",
          cookOrOrder: "either",
        },
        // Pass guest cuisines via partnerPreferences so the server unions them
        partnerPreferences: {
          cuisines: params.guestCuisines,
          dislikedFoods: [], // hard NOs already merged into combinedHardNos
        },
        isSharedSession: true,
        pantryIngredients: [],
        timeBucket: new Date().getHours() < 14 ? "morning" : "dinner",
        vibeMode: params.vibeMode,
        recentlySeenNames: params.recentlySeenNames,
        count: params.count,
        existingDeckNames: params.zone1Names,
        previousAIMealNames: [],
        sessionSeed: params.sessionSeed,
      }),
    });
    if (!resp.ok) return [];
    const data: { meals?: Meal[] } = await resp.json();
    return data.meals ?? [];
  } catch {
    return [];
  }
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
): Promise<(string | Meal)[]> {
  // 1. Check whether the deck was already built (another client may have won)
  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("deck_meal_ids, vibe")
    .eq("id", sessionId)
    .single();

  const existingDeck = sessionRow?.deck_meal_ids as (string | Meal)[] | null;
  if (existingDeck?.length) return existingDeck;

  const sessionVibeMode = (sessionRow?.vibe as string) ?? "mix-it-up";

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

  // 4. Build per-user scoring profiles (kept separate for mutual scoring)
  const hostScoringProfile: UserProfileForScoring = {
    cuisines: hostProfile?.favorite_cuisines ?? [],
    learnedWeights: (hostProfile?.learned_weights as TasteProfile | null) ?? null,
    recentlySeen: new Set(hostProfile?.recently_seen_meal_ids ?? []),
  };
  const guestScoringProfile: UserProfileForScoring = {
    cuisines: guestProfile?.favorite_cuisines ?? [],
    learnedWeights: (guestProfile?.learned_weights as TasteProfile | null) ?? null,
    recentlySeen: new Set(guestProfile?.recently_seen_meal_ids ?? []),
  };

  // 5. Hard gate — remove any meal that violates EITHER user's hard NOs
  const eligibleMeals = hardGate(meals, combinedHardNos);

  // 6. Rank using mutual-fit scoring: each user scored independently,
  //    combined via min(scoreA, scoreB) * 1.5 + overlap bonuses.
  //    Phase 5: when SHARED_THREE_ZONE_DECK is on, feed scores into composeDeck()
  //    for zone-based layout instead of the legacy tiered sort.
  let deckEntries: (string | Meal)[];

  if (FEATURES.SHARED_THREE_ZONE_DECK) {
    const scoredMeals = scoreAllMealsForSharedSession(
      eligibleMeals,
      hostScoringProfile,
      guestScoringProfile,
    );

    // Build a union of recently-seen IDs from both users for Zone 1 freshness gates.
    // Stored as flat weight 0.9 (high but below the 1.0 cap) since Supabase profiles
    // don't carry timestamps — this is conservative but correct.
    const combinedSeenWeights = new Map<string, number>();
    const allRecentlySeenIds = [
      ...(hostProfile?.recently_seen_meal_ids ?? []),
      ...(guestProfile?.recently_seen_meal_ids ?? []),
    ];
    for (const id of allRecentlySeenIds) {
      combinedSeenWeights.set(id, 0.9);
    }

    const composed = composeDeck(scoredMeals, {
      overexposedArchetypes: new Set(), // archetype history is localStorage-only
      recentlyChosenIds: new Set(),     // history not stored in profiles table
      recentlySeenWeights: combinedSeenWeights,
      lastSessionTopTen: [],            // cross-session overlap check is solo-only
    });

    // ── AI enrichment: Zone 1 stays static, AI fills Zone 2+ ─────────────────
    const ZONE1_SIZE = 5;
    const ZONE2_SIZE = 9;

    const zone1 = composed.slice(0, ZONE1_SIZE);
    const zone1Ids = new Set(zone1.map((r) => r.meal.id));
    const zone1Names = zone1.map((r) => r.meal.name);

    // Recently seen names from both users — soft avoidance hint for AI
    const recentlySeenNames = [...new Set(allRecentlySeenIds)]
      .map((id) => meals.find((m) => m.id === id)?.name)
      .filter((n): n is string => !!n)
      .slice(0, 12);

    // Deterministic seed derived from session ID so retries get the same seed
    const sessionSeed = sessionId.slice(0, 8);

    const rawAIMeals = await fetchSharedAIMeals({
      hostCuisines: hostProfile?.favorite_cuisines ?? [],
      guestCuisines: guestProfile?.favorite_cuisines ?? [],
      combinedHardNos,
      zone1Names,
      recentlySeenNames,
      vibeMode: sessionVibeMode,
      count: 14,
      sessionSeed,
    });

    // Assign stable IDs so both users get the same meal IDs for match detection
    const aiMeals: Meal[] = rawAIMeals.map((meal, i) => ({
      ...meal,
      id: `shared-ai-${sessionId.slice(0, 8)}-${i}`,
      aiGenerated: true as const,
    }));

    // Zone 2: AI-first (up to 9 slots), static mutual matches backfill remainder
    const aiZone2 = aiMeals.slice(0, ZONE2_SIZE);
    const aiZone2Ids = new Set(aiZone2.map((m) => m.id));

    const staticZone2 = composed
      .slice(ZONE1_SIZE, ZONE1_SIZE + ZONE2_SIZE)
      .filter((r) => !zone1Ids.has(r.meal.id) && !aiZone2Ids.has(r.meal.id))
      .slice(0, ZONE2_SIZE - aiZone2.length);

    // Zone 3: remaining AI overflow + static tail
    const aiZone3 = aiMeals.slice(ZONE2_SIZE);
    const zone2AllIds = new Set([
      ...aiZone2.map((m) => m.id),
      ...staticZone2.map((r) => r.meal.id),
    ]);
    const staticZone3 = composed
      .slice(ZONE1_SIZE + ZONE2_SIZE)
      .filter((r) => !zone1Ids.has(r.meal.id) && !zone2AllIds.has(r.meal.id));

    deckEntries = [
      ...zone1.map((r) => r.meal.id),       // Zone 1: static mutual matches (string IDs)
      ...aiZone2,                             // Zone 2: AI meals (Meal objects)
      ...staticZone2.map((r) => r.meal.id),  // Zone 2 backfill: static (string IDs)
      ...aiZone3,                             // Zone 3: AI overflow (Meal objects)
      ...staticZone3.map((r) => r.meal.id),  // Zone 3 tail: static (string IDs)
    ];
  } else {
    const ranked = rankMealsForSharedSession(
      eligibleMeals,
      hostScoringProfile,
      guestScoringProfile,
    );
    deckEntries = ranked.map((r) => r.meal.id);
  }

  // 7. Atomically save — only writes if deck_meal_ids is still NULL
  //     This prevents duplicate decks when both clients trigger simultaneously.
  const { data: updated, error: updateError } = await supabase
    .from("sessions")
    .update({ deck_meal_ids: deckEntries, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .is("deck_meal_ids", null)
    .select("deck_meal_ids")
    .single();

  if (!updateError && (updated?.deck_meal_ids as (string | Meal)[] | null)?.length) {
    return updated!.deck_meal_ids as (string | Meal)[];
  }

  // Another client won the race — load what they saved
  const { data: raceWinner } = await supabase
    .from("sessions")
    .select("deck_meal_ids")
    .eq("id", sessionId)
    .single();

  return (raceWinner?.deck_meal_ids as (string | Meal)[]) ?? deckEntries;
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
