/**
 * Session-scoped behavior signals for progressive onboarding.
 *
 * Signals are tracked in-memory (via refs in the deck component) and
 * never persisted — they reset each time the user opens the deck.
 * Only the cooldown timestamps are written to localStorage so the same
 * nudge doesn't fire across multiple sessions within the cooldown window.
 *
 * Signal flow:
 *   1. Each swipe extracts signals from the meal (food type / cuisine).
 *   2. Counts accumulate in passSignalsRef / likeSignalsRef.
 *   3. checkTriggers() returns a NudgeTrigger once a threshold is crossed.
 *   4. The deck component queues the trigger and shows it after the animation.
 *   5. On "Yes" the profile is updated; on "Not always" we just dismiss.
 */

import { type Meal } from "../data/meals";
import { MEAL_CUISINES } from "./scoring";

// ── Avoid signals (food types → hard_no_foods) ────────────────────────────────
//
// We watch only the four most common avoidances so the nudge is always
// actionable. Dairy and Gluten are intentionally omitted — those are
// stricter dietary needs better set during onboarding.

const AVOID_KEYWORDS: Record<string, string[]> = {
  Beef: [
    "beef", "steak", "burger", "meatloaf", "meatball",
    "bolognese", "ribeye", "rendang", "brisket", "ground beef",
  ],
  Pork: [
    "pork", "bacon", "ham", "sausage", "pepperoni",
    "ribs", "hot dog", "prosciutto", "chorizo",
  ],
  Seafood: [
    "seafood", "fish", "shrimp", "salmon", "tuna",
    "crab", "lobster", "scallop", "sushi", "poke", "ceviche",
  ],
  Chicken: ["chicken", "poultry", "coq"],
};

// ── Prefer signals (cuisines → favorite_cuisines) ─────────────────────────────
//
// Only specific cuisines are tracked — overly broad labels ("American",
// "Asian") are excluded because adding them to favorites would surface too
// many meals and dilute the signal.

const PREFERRED_CUISINES = new Set([
  "Italian", "Mexican", "Japanese", "Indian", "Mediterranean",
  "Korean", "Thai", "Chinese", "Middle Eastern", "Greek", "French",
]);

// ── Types ─────────────────────────────────────────────────────────────────────

export type NudgeTrigger = {
  type: "avoid" | "prefer";
  /** The category / cuisine name used for the profile update. */
  signal: string;
  /** Human-readable question shown to the user. */
  question: string;
};

/**
 * A candidate for the cross-session avoid nudge.
 * Built on session start by querying analytics_events.
 */
export type NudgeCandidate = {
  signal: string;
  /** Number of distinct sessions in the last 30 days where this was passed on. */
  crossSessionCount: number;
};

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Legacy in-session threshold (still used for prefer/cuisine nudges). */
export const TRIGGER_THRESHOLD = 3;
/**
 * Minimum in-session passes before the cross-session avoid nudge can fire.
 * Higher than TRIGGER_THRESHOLD — the user needs to be clearly in browsing
 * mode, not just being selective on a couple of cards.
 */
export const CROSS_SESSION_IN_SESSION_THRESHOLD = 4;

// ── Signal extraction ─────────────────────────────────────────────────────────

/**
 * Returns the food-type avoid-signal categories present in a meal.
 * Matches against the combined meal id + name + ingredients text,
 * same strategy as hardGate() in scoring.ts.
 */
export function getAvoidSignals(meal: Meal): string[] {
  const text = [meal.id, meal.name, ...(meal.ingredients ?? [])]
    .join(" ")
    .toLowerCase();
  return Object.entries(AVOID_KEYWORDS)
    .filter(([, kws]) => kws.some((kw) => text.includes(kw)))
    .map(([cat]) => cat);
}

/**
 * Returns specific cuisine signals for a meal (filtered to the trackable
 * set). Used to detect "prefer more of X" patterns from saves/likes.
 */
export function getPreferSignals(meal: Meal): string[] {
  return (MEAL_CUISINES[meal.id] ?? []).filter((c) => PREFERRED_CUISINES.has(c));
}

// ── Cooldown ──────────────────────────────────────────────────────────────────

const COOLDOWN_KEY = "wwe_nudge_cooldown";
/** How long before the same nudge can fire again (48 hours). */
const COOLDOWN_MS = 48 * 60 * 60 * 1000;

function getCooldowns(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(COOLDOWN_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** Returns true if this signal fired recently and should be suppressed. */
export function isOnCooldown(signal: string): boolean {
  const ts = getCooldowns()[signal];
  return !!ts && Date.now() - ts < COOLDOWN_MS;
}

/** Records the current timestamp as the last fire time for this signal. */
export function markNudgeFired(signal: string): void {
  if (typeof window === "undefined") return;
  const cd = getCooldowns();
  cd[signal] = Date.now();
  localStorage.setItem(COOLDOWN_KEY, JSON.stringify(cd));
}

// ── Trigger check ─────────────────────────────────────────────────────────────

/**
 * Evaluates current session signal counts and returns the first trigger
 * that should fire, or null if nothing qualifies.
 *
 * Rules enforced here:
 *   • Only one trigger fires per session (firedThisSession.size > 0 → skip).
 *   • Per-signal cooldown prevents the same nudge from repeating across
 *     sessions for 48 hours.
 *   • Avoid signals (passes) are checked before prefer signals (likes) so
 *     dietary avoidances surface first — they have higher immediate value.
 */
export function checkTriggers(
  passSignals: Record<string, number>,
  likeSignals: Record<string, number>,
  firedThisSession: Set<string>,
): NudgeTrigger | null {
  // One trigger per session
  if (firedThisSession.size > 0) return null;

  // Avoid — passes by food type
  for (const [signal, count] of Object.entries(passSignals)) {
    if (count >= TRIGGER_THRESHOLD && !isOnCooldown(signal)) {
      return {
        type: "avoid",
        signal,
        question: `Looks like you're not into ${signal.toLowerCase()}. Avoid it going forward?`,
      };
    }
  }

  // Prefer — likes/saves by cuisine
  for (const [signal, count] of Object.entries(likeSignals)) {
    if (count >= TRIGGER_THRESHOLD && !isOnCooldown(signal)) {
      return {
        type: "prefer",
        signal,
        question: `You keep going for ${signal} options. Want more of it?`,
      };
    }
  }

  return null;
}

// ── Cross-session avoid nudge ─────────────────────────────────────────────────

/**
 * Evaluates whether the cross-session avoid nudge should fire.
 *
 * Unlike checkTriggers, this does NOT use in-session thresholds as the sole
 * gate. It requires:
 *   1. The user has passed 4+ times on this signal in the current session
 *      (they're clearly not in the mood, not just being picky).
 *   2. The signal appears as a nudgeCandidate — meaning it was passed on
 *      across 3+ different sessions in the last 30 days (a real pattern).
 *   3. No nudge has fired yet this session.
 *
 * Returns the strongest candidate (highest crossSessionCount) that qualifies,
 * or null if nothing qualifies.
 *
 * No cooldown check — cross-session recurrence is self-managed by soft avoids
 * and session deduplication.
 */
export function checkCrossSessionNudge(
  passSignals: Record<string, number>,
  nudgeCandidates: NudgeCandidate[],
  firedThisSession: Set<string>,
): NudgeTrigger | null {
  // One nudge per session
  if (firedThisSession.size > 0) return null;
  if (nudgeCandidates.length === 0) return null;

  // Find the strongest qualifying candidate
  let best: NudgeCandidate | null = null;
  for (const candidate of nudgeCandidates) {
    const inSessionCount = passSignals[candidate.signal] ?? 0;
    if (inSessionCount < CROSS_SESSION_IN_SESSION_THRESHOLD) continue;
    if (!best || candidate.crossSessionCount > best.crossSessionCount) {
      best = candidate;
    }
  }

  if (!best) return null;

  return {
    type: "avoid",
    signal: best.signal,
    question: `Not really feeling ${best.signal.toLowerCase()} lately?`,
  };
}
