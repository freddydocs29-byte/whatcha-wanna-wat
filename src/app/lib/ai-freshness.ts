/**
 * Deterministic AI Freshness triggers.
 *
 * shouldGenerateAI() inspects the static ranked deck and returns whether AI
 * meal generation should be triggered, and why. It is a pure function with no
 * side effects — no fetch, no storage reads, no randomness.
 *
 * Trigger priority (first match wins):
 *   1. pantry_active  — pantry mode is on and ingredients are selected
 *   2. weak_top_tier  — fewer than STRONG_MATCH_MIN of the top 5 meals have a
 *                       real personalization signal (reason ≠ meal.whyItFits)
 *   3. stale_deck     — more than STALE_THRESHOLD of the deck was recently seen
 *
 * swipe_fatigue is handled separately in the deck component (runtime trigger
 * that fires mid-session rather than at deck-build time).
 *
 * Logging convention (dev only):
 *   [AI Freshness] triggered: weak_top_tier
 *   [AI Freshness] skipped: strong_static_deck
 *   [AI Freshness] skipped: cache_hit        ← emitted by caller, not here
 *   [AI Freshness] triggered: swipe_fatigue  ← emitted by caller
 */

import type { RankedMeal } from "./scoring";

// ── Constants ────────────────────────────────────────────────────────────────

/** Minimum number of strong-match meals required in the top 5 before AI is
 *  skipped for the weak_top_tier trigger. */
const STRONG_MATCH_MIN = 3;

/** Fraction of the deck that must be recently-seen before stale_deck fires. */
const STALE_THRESHOLD = 0.4;

/** Minimum deck size before we bother evaluating staleness / top-tier quality.
 *  If the deck is tiny, AI should likely help regardless. */
const MIN_DECK_FOR_EVAL = 5;

// ── Types ────────────────────────────────────────────────────────────────────

export type AIMealTriggerReason =
  | "pantry_active"
  | "weak_top_tier"
  | "stale_deck"
  | "swipe_fatigue";

export type AIMealTriggerResult = {
  shouldGenerate: boolean;
  reason: AIMealTriggerReason | null;
};

// ── Main function ────────────────────────────────────────────────────────────

/**
 * Determines whether AI meal generation should be triggered for the current
 * static deck. Call this after buildDeck() returns, before deciding whether
 * to call enrichDeckWithAI().
 *
 * @param deck           - The static ranked deck (output of buildDeck/rankMeals).
 * @param pantryActive   - true when pantryMode is on AND selectedIngredients.length > 0.
 * @param recentlySeenIds - Set of meal IDs seen in previous sessions (from getRecentlySeenIds()).
 * @param deckSize        - The target deck size constant (DECK_SIZE = 20).
 */
export function shouldGenerateAI(params: {
  deck: RankedMeal[];
  pantryActive: boolean;
  recentlySeenIds: Set<string>;
  deckSize: number;
}): AIMealTriggerResult {
  const { deck, pantryActive, recentlySeenIds, deckSize } = params;

  // ── 1. Pantry active ───────────────────────────────────────────────────────
  // Highest priority: user has explicitly told us what they have — AI should
  // always try to make something creative from those ingredients.
  if (pantryActive) {
    return { shouldGenerate: true, reason: "pantry_active" };
  }

  if (deck.length < MIN_DECK_FOR_EVAL) {
    // Deck is too small to evaluate meaningfully — AI can only help here.
    return { shouldGenerate: true, reason: "weak_top_tier" };
  }

  // ── 2. Weak top-tier ──────────────────────────────────────────────────────
  // A "strong match" is a meal where rankMeals fired at least one real
  // personalization signal: cuisine preference, behavioral learning, saved-meal
  // affinity, etc. This is detectable because scoreMeal sets topReason to a
  // preference-driven string; if no signal fired, the reason falls back to
  // meal.whyItFits. Checking reason !== meal.whyItFits is a reliable proxy
  // for "a personalization signal fired" without needing to re-run scoring.
  const topFive = deck.slice(0, 5);
  const strongMatchCount = topFive.filter(
    (r) => r.reason !== r.meal.whyItFits,
  ).length;

  if (strongMatchCount < STRONG_MATCH_MIN) {
    return { shouldGenerate: true, reason: "weak_top_tier" };
  }

  // ── 3. Stale deck ─────────────────────────────────────────────────────────
  // If more than 40% of the deck consists of meals the user already scrolled
  // past in a previous session, the deck will feel repetitive immediately.
  const deckSlice = deck.slice(0, deckSize);
  const staleCount = deckSlice.filter((r) =>
    recentlySeenIds.has(r.meal.id),
  ).length;
  const staleFraction = staleCount / deckSlice.length;

  if (staleFraction > STALE_THRESHOLD) {
    return { shouldGenerate: true, reason: "stale_deck" };
  }

  // ── No trigger ────────────────────────────────────────────────────────────
  return { shouldGenerate: false, reason: null };
}
