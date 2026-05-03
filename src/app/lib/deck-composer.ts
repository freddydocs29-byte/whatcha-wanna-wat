/**
 * deck-composer.ts — Phase 3 three-zone deck construction.
 *
 * Replaces the flat `rankMeals() → bandShuffle → spreadByCuisine` pipeline
 * with a deliberate zone-based layout:
 *
 *   Zone 1 (positions 0–4)   — 5 high-confidence anchor meals
 *   Zone 2 (positions 5–13)  — 9 familiar-variety meals (cuisine-budgeted)
 *   Zone 3 (positions 14+)   — exploration tail, filled by AI in page.tsx
 *
 * Feature flag: THREE_ZONE_DECK in feature-flags.ts.
 * Revert: set THREE_ZONE_DECK = false → buildDeck() uses legacy rankMeals().
 *
 * Files that depend on this:
 *   • deck/page.tsx — calls composeDeck() when THREE_ZONE_DECK is on
 *   • scoring.ts    — provides ScoredMeal, getMealArchetype, MEAL_CUISINES
 *   • storage.ts    — provides getOverexposedArchetypes, getRecentlySeenWithWeights,
 *                     getLastSeenSession, getArchetypeHistory
 */

import type { Meal } from "../data/meals";
import { MEAL_CUISINES, getMealArchetype } from "./scoring";
import type { ScoredMeal, RankedMeal } from "./scoring";
import { FEATURES } from "./feature-flags";

// ── Constants ─────────────────────────────────────────────────────────────────

const ZONE1_SIZE = 5;
const ZONE2_SIZE = 9;
const MAX_CUISINE_PER_ZONE2 = 2;  // max same-cuisine meals in Zone 2
const MAX_CUISINE_ZONE1 = 2;      // max same-cuisine meals in Zone 1
const OVERLAP_THRESHOLD = 0.5;    // >50% overlap with last session triggers re-rank
const OVERLAP_PENALTY = 1.5;      // score penalty applied to overlapping meals

// Zone 1 gate thresholds (Phase 2 — archetype suppression + freshness)
const ZONE1_MAX_SEEN_WEIGHT = 0.8; // exclude meals seen with weight >= this
const BAND_SIZE = 1.0;             // score band width for band-shuffle

// ── Types ─────────────────────────────────────────────────────────────────────

export type DeckCompositionOptions = {
  /** Archetype fingerprints that have been chosen too often recently. */
  overexposedArchetypes: Set<string>;
  /** Meal IDs chosen by the user (from history), not just seen. */
  recentlyChosenIds: Set<string>;
  /** Map<mealId, weight> where weight ∈ (0, 1] — from getRecentlySeenWithWeights(). */
  recentlySeenWeights: Map<string, number>;
  /** Ordered list of meal IDs in the last session's deck (for overlap check). */
  lastSessionTopTen: string[];
  /** Optional size overrides (mostly for testing). */
  zone1Size?: number;
  zone2Size?: number;
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compose a three-zone deck from a pre-scored meal list.
 *
 * Input:  `scoredMeals` — full output of `scoreAllMeals()`, unsorted or sorted.
 * Output: `RankedMeal[]` in zone order: Zone 1 anchors, Zone 2 variety, Zone 3 tail.
 *
 * Zone 3 is the tail of scored-but-unselected meals. The caller (deck/page.tsx)
 * replaces or extends Zone 3 with AI-generated meals via enrichDeckWithAI().
 *
 * When DECK_OVERLAP_CHECK is on and >50% of the top-10 overlaps with
 * lastSessionTopTen, all overlapping meals receive a -1.5 score penalty and the
 * composition runs once more (single re-run, no infinite loop).
 */
export function composeDeck(
  scoredMeals: ScoredMeal[],
  options: DeckCompositionOptions,
): RankedMeal[] {
  const zone1Size = options.zone1Size ?? ZONE1_SIZE;
  const zone2Size = options.zone2Size ?? ZONE2_SIZE;

  // Phase 6 — deck-level overlap check (single re-run allowed)
  if (
    FEATURES.DECK_OVERLAP_CHECK &&
    options.lastSessionTopTen.length > 0
  ) {
    const top10Ids = new Set(
      scoredMeals
        .slice()
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((s) => s.meal.id),
    );
    const overlapCount = options.lastSessionTopTen
      .slice(0, 10)
      .filter((id) => top10Ids.has(id)).length;
    const overlapFraction =
      overlapCount / Math.min(10, options.lastSessionTopTen.length);

    if (overlapFraction > OVERLAP_THRESHOLD) {
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[composeDeck] overlap ${(overlapFraction * 100).toFixed(0)}% — applying ${OVERLAP_PENALTY} penalty, re-composing`,
        );
      }
      const overlapSet = new Set(options.lastSessionTopTen.slice(0, 10));
      const penalized = scoredMeals.map((s) =>
        overlapSet.has(s.meal.id)
          ? { ...s, score: s.score - OVERLAP_PENALTY }
          : s,
      );
      // Re-run without overlap check to prevent infinite loop
      return composeDeck(penalized, { ...options, lastSessionTopTen: [] });
    }
  }

  // Sort full pool descending by score
  const sorted = scoredMeals.slice().sort((a, b) => b.score - a.score);

  const zone1 = buildZone1(sorted, options, zone1Size);
  const zone1Ids = new Set(zone1.map((s) => s.meal.id));

  const afterZone1 = sorted.filter((s) => !zone1Ids.has(s.meal.id));
  const zone2 = buildZone2(afterZone1, zone2Ids(zone1Ids), zone2Size);
  const zone2IdSet = new Set(zone2.map((s) => s.meal.id));

  const zone3 = afterZone1.filter((s) => !zone2IdSet.has(s.meal.id));

  // Band-shuffle within Zone 1 and Zone 2 independently for session variety
  const shuffledZ1 = bandShuffle(zone1);
  const shuffledZ2 = bandShuffle(zone2);

  if (process.env.NODE_ENV === "development") {
    console.log("[composeDeck] Zone 1:", shuffledZ1.map((s) => s.meal.name));
    console.log("[composeDeck] Zone 2:", shuffledZ2.map((s) => s.meal.name));
    console.log("[composeDeck] Zone 3 tail size:", zone3.length);
  }

  const all = [...shuffledZ1, ...shuffledZ2, ...zone3];
  return all.map((s) => ({ meal: s.meal, reason: s.reason }));
}

// ── Zone builders ─────────────────────────────────────────────────────────────

/**
 * Zone 1 — 5 high-confidence anchor meals.
 *
 * Gates (Phase 2 — ARCHETYPE_SUPPRESSION):
 *   1. Strict: not recently chosen + archetype not overexposed + seen weight ≤ 0.8
 *   2. Relax archetype gate (allow overexposed archetypes)
 *   3. Relax seen gate (allow any seen weight)
 *   4. No gates (score order only)
 *
 * Max 2 same-cuisine meals in Zone 1.
 */
function buildZone1(
  sorted: ScoredMeal[],
  options: DeckCompositionOptions,
  size: number,
): ScoredMeal[] {
  const { overexposedArchetypes, recentlyChosenIds, recentlySeenWeights } =
    options;

  // Try progressively relaxed gate sets until we fill Zone 1
  const gateLevels = FEATURES.ARCHETYPE_SUPPRESSION
    ? [
        // Level 0: strict — all gates active
        (s: ScoredMeal) =>
          !recentlyChosenIds.has(s.meal.id) &&
          !overexposedArchetypes.has(getMealArchetype(s.meal)) &&
          (recentlySeenWeights.get(s.meal.id) ?? 0) < ZONE1_MAX_SEEN_WEIGHT,

        // Level 1: relax archetype suppression
        (s: ScoredMeal) =>
          !recentlyChosenIds.has(s.meal.id) &&
          (recentlySeenWeights.get(s.meal.id) ?? 0) < ZONE1_MAX_SEEN_WEIGHT,

        // Level 2: relax seen weight (still exclude recently chosen)
        (s: ScoredMeal) => !recentlyChosenIds.has(s.meal.id),

        // Level 3: no gates — pure score order
        (_s: ScoredMeal) => true,
      ]
    : [(_s: ScoredMeal) => true]; // ARCHETYPE_SUPPRESSION off → no gates

  for (const gate of gateLevels) {
    const candidates = sorted.filter(gate);
    const zone1 = fillWithCuisineBudget(candidates, size, MAX_CUISINE_ZONE1);
    if (zone1.length >= size) {
      return zone1.slice(0, size);
    }
    // Fell short — try next gate level
  }

  // Final fallback: score order, no gate
  return fillWithCuisineBudget(sorted, size, MAX_CUISINE_ZONE1).slice(0, size);
}

/**
 * Zone 2 — 9 variety meals, max 2 per cuisine.
 *
 * Greedy fill in score order with per-cuisine budget.
 * `alreadyUsedIds` is the set of Zone 1 meal IDs to skip.
 */
function buildZone2(
  sorted: ScoredMeal[],
  _alreadyUsedIds: Set<string>,  // Zone 1 meals already removed from `sorted`
  size: number,
): ScoredMeal[] {
  return fillWithCuisineBudget(sorted, size, MAX_CUISINE_PER_ZONE2);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Greedy fill up to `size` meals, respecting `maxPerCuisine` budget. */
function fillWithCuisineBudget(
  candidates: ScoredMeal[],
  size: number,
  maxPerCuisine: number,
): ScoredMeal[] {
  const result: ScoredMeal[] = [];
  const cuisineCounts: Record<string, number> = {};
  const skippedNames: string[] = [];

  for (const s of candidates) {
    if (result.length >= size) break;
    const cuisine = primaryCuisine(s.meal);
    const count = cuisineCounts[cuisine] ?? 0;
    if (count < maxPerCuisine) {
      result.push(s);
      cuisineCounts[cuisine] = count + 1;
    } else {
      skippedNames.push(`${s.meal.name} (${cuisine})`);
    }
  }

  // If cuisine budget left us short, fill remainder from any cuisine
  if (result.length < size) {
    const usedIds = new Set(result.map((s) => s.meal.id));
    for (const s of candidates) {
      if (result.length >= size) break;
      if (!usedIds.has(s.meal.id)) {
        result.push(s);
        usedIds.add(s.meal.id);
      }
    }
  }

  if (process.env.NODE_ENV === "development" && skippedNames.length > 0) {
    const cappedCuisines = Object.entries(cuisineCounts)
      .filter(([, count]) => count >= maxPerCuisine)
      .map(([cuisine, count]) => `${cuisine}(${count}/${maxPerCuisine})`);
    console.log(
      `[deck] Cuisine cap (max ${maxPerCuisine}/cuisine): capped [${cappedCuisines.join(", ")}]` +
        ` — skipped ${skippedNames.length} meals: ${skippedNames.slice(0, 5).join(", ")}${skippedNames.length > 5 ? "…" : ""}`,
    );
  }

  return result;
}

/**
 * Fisher-Yates shuffle within 1-point score bands.
 * Meals in different bands stay in score order; meals within the same band
 * are randomized so the deck feels fresh each session.
 */
function bandShuffle<T extends { score: number }>(sorted: T[]): T[] {
  if (sorted.length === 0) return sorted;

  const result: T[] = [];
  let i = 0;

  while (i < sorted.length) {
    const bandTop = sorted[i].score;
    const bandFloor = bandTop - BAND_SIZE;
    const band: T[] = [];

    while (i < sorted.length && sorted[i].score > bandFloor) {
      band.push(sorted[i]);
      i++;
    }

    for (let k = band.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      [band[k], band[r]] = [band[r], band[k]];
    }

    result.push(...band);
  }

  return result;
}

function primaryCuisine(meal: Meal): string {
  return MEAL_CUISINES[meal.id]?.[0] ?? "Other";
}

/** Returns an empty set — Zone 2 receives a pre-filtered list from the caller. */
function zone2Ids(zone1Ids: Set<string>): Set<string> {
  return zone1Ids;
}

// ── Cuisine gap computation ───────────────────────────────────────────────────

/**
 * Returns the list of cuisine names that are underrepresented in Zones 1+2.
 *
 * "Underrepresented" = cuisine has 0 meals in the composed top 14 but is
 * present in the full scored pool. Used by AI diversifier (Phase 4B) to
 * prompt the model to fill cuisine gaps.
 *
 * @param composedDeck - The full output of composeDeck() (all zones)
 * @param scoredPool   - All scored meals before zone filtering
 * @param zone1Size    - How many meals are in Zone 1 (default 5)
 * @param zone2Size    - How many meals are in Zone 2 (default 9)
 */
export function computeCuisineGaps(
  composedDeck: RankedMeal[],
  scoredPool: ScoredMeal[],
  zone1Size = ZONE1_SIZE,
  zone2Size = ZONE2_SIZE,
): string[] {
  const staticZone = composedDeck.slice(0, zone1Size + zone2Size);
  const staticCuisines = new Set(
    staticZone.map((r) => primaryCuisine(r.meal)),
  );

  const poolCuisines = new Set(
    scoredPool.map((s) => primaryCuisine(s.meal)),
  );

  const gaps: string[] = [];
  for (const cuisine of poolCuisines) {
    if (!staticCuisines.has(cuisine)) {
      gaps.push(cuisine);
    }
  }

  return gaps;
}
