import { Meal } from "../data/meals";
import { getUserId } from "./identity";
import { upsertProfilePreferences, upsertLearnedWeights, upsertRecentlySeen } from "./supabase-profile";

export type HistoryEntry = {
  meal: Meal;
  chosenAt: string; // ISO timestamp
};

export type UserPreferences = {
  cuisines: string[];
  dislikedFoods: string[];
  spiceLevel: "mild" | "medium" | "hot" | "any";
  cookOrOrder: "cook" | "order" | "either";
  kidFriendly: boolean | null;
};

export type TasteProfile = {
  likedTags: Record<string, number>;      // tag → cumulative positive signal
  dislikedTags: Record<string, number>;   // tag → cumulative negative signal
  likedCategories: Record<string, number>; // category → cumulative positive signal
  interactionCount: number;               // total pass + save + choose events
  // Phase 1B — used by getDecayedTasteProfile() to apply time-decay at read-time.
  // Written on every updateTasteProfile() call; never sent to scoring in raw form.
  lastUpdatedAt?: string;                 // ISO timestamp of last write
};

// ── Phase 2 — Archetype tracking ─────────────────────────────────────────────
//
// Tracks the (cuisine × category × key-tags) fingerprint of every chosen meal
// so Zone 1 of the deck can suppress recently-overused meal archetypes even when
// the specific meal ID hasn't been chosen before.

/** One chosen-meal archetype entry. Stored without importing scoring.ts (no circular dep). */
export type ArchetypeEntry = {
  mealId: string;
  cuisine: string;    // primary cuisine from MEAL_CUISINES, provided by caller
  category: string;   // meal.category
  keyTags: string[];  // first 2 tags sorted — fingerprint component
  chosenAt: string;   // ISO timestamp
};

export type ArchetypeHistory = {
  entries: ArchetypeEntry[]; // newest first, capped at 20
};

/**
 * Optional deeper preference layer set via the Full Flavor Profile flow.
 * Collected separately from quick onboarding — never required.
 */
export type FlavorProfile = {
  adventurousness: "familiar" | "balanced" | "adventurous";
  timeAvailable: "quick" | "normal" | "relaxed";
  energyLevel: "low" | "medium" | "high";
  budgetSensitivity: "frugal" | "moderate" | "generous";
  cookingConfidence: "beginner" | "intermediate" | "confident";
};

/** A meal the user has bookmarked, optionally marked as a favorite. */
export type SavedMeal = {
  meal: Meal;
  isFavorite: boolean;
  savedAt: string; // ISO timestamp
};

const SAVED_KEY = "wwe_saved_meals";
const HISTORY_KEY = "wwe_history";
const PREFS_KEY = "wwe_preferences";
const ONBOARDING_KEY = "wwe_onboarding_done";
const TASTE_KEY = "wwe_taste_profile";
const SEEN_KEY = "wwe_seen_sessions";
const FLAVOR_KEY = "wwe_flavor_profile";
// Legacy key — only read during one-time migration, never written again.
const FAVORITES_KEY = "wwe_favorites";
const LAST_DECIDE_KEY = "wwe_last_decide_pick";
// Phase 2 — archetype suppression history
const ARCHETYPE_KEY = "wwe_archetype_history";
// Phase 4C — challenger mode session counter
const CHALLENGER_KEY = "wwe_challenger_count";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Returns all saved meals with metadata. Runs a one-time migration on first
 * call: detects the old Meal[] format (root `id` field) and merges the legacy
 * FAVORITES_KEY into the unified SavedMeal[] format.
 */
export function getSavedMealsEnriched(): SavedMeal[] {
  if (typeof window === "undefined") return [];

  const raw = read<unknown[]>(SAVED_KEY, []);

  // Detect old Meal[] format: elements have `id` at root, not a `meal` field.
  const isLegacyFormat =
    raw.length > 0 &&
    typeof (raw[0] as Record<string, unknown>).id === "string" &&
    !("meal" in (raw[0] as Record<string, unknown>));

  if (isLegacyFormat || raw.length === 0) {
    // Merge old saved + old favorites into new format.
    const oldSaved = raw as Meal[];
    const oldFavs = read<Meal[]>(FAVORITES_KEY, []);
    const favIds = new Set(oldFavs.map((m) => m.id));
    const savedIds = new Set(oldSaved.map((m) => m.id));

    const enriched: SavedMeal[] = oldSaved.map((meal) => ({
      meal,
      isFavorite: favIds.has(meal.id),
      savedAt: new Date().toISOString(),
    }));

    // Add any favorites that weren't already in the saved list.
    for (const meal of oldFavs) {
      if (!savedIds.has(meal.id)) {
        enriched.push({ meal, isFavorite: true, savedAt: new Date().toISOString() });
      }
    }

    localStorage.setItem(SAVED_KEY, JSON.stringify(enriched));
    localStorage.removeItem(FAVORITES_KEY);
    return enriched;
  }

  return raw as SavedMeal[];
}

/**
 * Returns saved-for-later meals only (isFavorite = false).
 * Used by scoring — keeps favorites as a separate, stronger signal.
 * Do NOT use this to check whether a meal is bookmarked at all;
 * use getSavedMealsEnriched() for that.
 */
export function getSavedMeals(): Meal[] {
  return getSavedMealsEnriched()
    .filter((s) => !s.isFavorite)
    .map((s) => s.meal);
}

/** Returns only favorited meals — backwards-compatible with scoring & deck. */
export function getFavorites(): Meal[] {
  return getSavedMealsEnriched()
    .filter((s) => s.isFavorite)
    .map((s) => s.meal);
}

/** Adds a meal to the saved collection (isFavorite = false). No-op if already saved. */
export function saveMeal(meal: Meal): void {
  if (typeof window === "undefined") return;
  const current = getSavedMealsEnriched();
  if (current.some((s) => s.meal.id === meal.id)) return;
  const entry: SavedMeal = { meal, isFavorite: false, savedAt: new Date().toISOString() };
  localStorage.setItem(SAVED_KEY, JSON.stringify([...current, entry]));
}

/** Removes a meal from the saved collection entirely. */
export function removeSavedMeal(mealId: string): void {
  if (typeof window === "undefined") return;
  const updated = getSavedMealsEnriched().filter((s) => s.meal.id !== mealId);
  localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
}

/**
 * Adds a meal to saved as a favorite. If already saved, marks it as favorite.
 * Backwards-compatible replacement — callers do not need to change.
 */
export function addFavorite(meal: Meal): void {
  if (typeof window === "undefined") return;
  const current = getSavedMealsEnriched();
  const existing = current.find((s) => s.meal.id === meal.id);
  if (existing) {
    if (!existing.isFavorite) {
      const updated = current.map((s) =>
        s.meal.id === meal.id ? { ...s, isFavorite: true } : s,
      );
      localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
    }
  } else {
    const entry: SavedMeal = { meal, isFavorite: true, savedAt: new Date().toISOString() };
    localStorage.setItem(SAVED_KEY, JSON.stringify([...current, entry]));
  }
}

/**
 * Unmarks a meal as favorite (keeps it in saved).
 * Backwards-compatible replacement — callers do not need to change.
 */
export function removeFavorite(mealId: string): void {
  if (typeof window === "undefined") return;
  const updated = getSavedMealsEnriched().map((s) =>
    s.meal.id === mealId ? { ...s, isFavorite: false } : s,
  );
  localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
}

/** Toggles the isFavorite flag on a saved meal. Used by the saved page heart icon. */
export function toggleSavedFavorite(mealId: string): void {
  if (typeof window === "undefined") return;
  const updated = getSavedMealsEnriched().map((s) =>
    s.meal.id === mealId ? { ...s, isFavorite: !s.isFavorite } : s,
  );
  localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
}

export function getHistory(): HistoryEntry[] {
  return read<HistoryEntry[]>(HISTORY_KEY, []);
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_KEY);
}

export function clearTodaysPick(): void {
  if (typeof window === "undefined") return;
  const today = new Date().toLocaleDateString();
  const history = getHistory();
  const filtered = history.filter(
    (e) => new Date(e.chosenAt).toLocaleDateString() !== today,
  );
  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
}

export function addToHistory(meal: Meal): void {
  const entry: HistoryEntry = { meal, chosenAt: new Date().toISOString() };
  const current = getHistory();
  localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...current]));
}

export function getPreferences(): UserPreferences | null {
  return read<UserPreferences | null>(PREFS_KEY, null);
}

export function savePreferences(prefs: UserPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  // Fire-and-forget sync to Supabase
  upsertProfilePreferences(getUserId(), prefs).catch(() => {});
}

export function markOnboardingDone(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDING_KEY, "true");
}

export function hasCompletedOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

export function getTasteProfile(): TasteProfile {
  return read<TasteProfile>(TASTE_KEY, {
    likedTags: {},
    dislikedTags: {},
    likedCategories: {},
    interactionCount: 0,
  });
}

/**
 * Update the taste profile after a user interaction.
 *
 * Signal weights:
 *   pass   → +1 to each tag in dislikedTags
 *   save   → +1 to each tag in likedTags, +1 to the category in likedCategories
 *   choose → +2 to each tag in likedTags, +2 to the category in likedCategories
 */
let _tasteProfileSyncTimer: ReturnType<typeof setTimeout> | null = null;
export function updateTasteProfile(meal: Meal, signal: "pass" | "save" | "choose"): void {
  if (typeof window === "undefined") return;
  const profile = getTasteProfile();
  profile.interactionCount += 1;

  if (signal === "pass") {
    for (const tag of meal.tags) {
      profile.dislikedTags[tag] = (profile.dislikedTags[tag] ?? 0) + 1;
    }
  } else {
    const weight = signal === "choose" ? 2 : 1;
    for (const tag of meal.tags) {
      profile.likedTags[tag] = (profile.likedTags[tag] ?? 0) + weight;
    }
    profile.likedCategories[meal.category] = (profile.likedCategories[meal.category] ?? 0) + weight;
  }

  // Phase 1B — record write time so getDecayedTasteProfile() can apply decay
  profile.lastUpdatedAt = new Date().toISOString();

  localStorage.setItem(TASTE_KEY, JSON.stringify(profile));

  // Debounce Supabase sync — batch rapid swipes into a single write
  if (_tasteProfileSyncTimer) clearTimeout(_tasteProfileSyncTimer);
  const snapshot = profile;
  _tasteProfileSyncTimer = setTimeout(() => {
    upsertLearnedWeights(getUserId(), snapshot).catch(() => {});
  }, 500);
}

export function getFlavorProfile(): FlavorProfile | null {
  return read<FlavorProfile | null>(FLAVOR_KEY, null);
}

export function saveFlavorProfile(profile: FlavorProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FLAVOR_KEY, JSON.stringify(profile));
}

export function hasFlavorProfile(): boolean {
  return getFlavorProfile() !== null;
}

// ── Phase 1B — Decayed taste profile ─────────────────────────────────────────

/**
 * Returns a read-time-transformed TasteProfile with two improvements applied:
 *
 *   1. Time-decay — signals written >30 days ago are multiplied by 0.75;
 *      >90 days by 0.25.  Starts conservatively so existing users don't feel
 *      like the app "forgot" them overnight.
 *
 *   2. Logged in scoring.ts (log₂ per-tag) — this function returns the raw
 *      counts; the log transform is applied inside scoreMeal() so the same
 *      data is still useful for debug logging.
 *
 * The raw profile stored in localStorage is never modified.
 * Reverts cleanly: pass the result of getTasteProfile() instead.
 */
export function getDecayedTasteProfile(): TasteProfile {
  const raw = getTasteProfile();
  if (!raw.lastUpdatedAt) return raw; // no timestamp yet → no decay

  const ageDays =
    (Date.now() - new Date(raw.lastUpdatedAt).getTime()) / (1000 * 60 * 60 * 24);

  let multiplier = 1.0;
  if (ageDays > 90) multiplier = 0.25;
  else if (ageDays > 30) multiplier = 0.75;

  if (multiplier === 1.0) return raw; // still fresh — skip allocation

  const decay = (rec: Record<string, number>): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(rec)) out[k] = v * multiplier;
    return out;
  };

  return {
    likedTags: decay(raw.likedTags),
    dislikedTags: decay(raw.dislikedTags),
    likedCategories: decay(raw.likedCategories),
    interactionCount: raw.interactionCount,
    lastUpdatedAt: raw.lastUpdatedAt,
  };
}

// ── Seen-session helpers ──────────────────────────────────────────────────────

type SeenSession = {
  mealIds: string[];
  seenAt: string;
};

/**
 * Returns the set of meal IDs that appeared in any deck built during the
 * last `sessionCount` sessions. Used to apply a "recently seen" penalty
 * in scoring so meals that keep cycling back get suppressed more strongly.
 * Default covers 3 sessions so suppression lasts across multiple visits.
 */
export function getRecentlySeenIds(sessionCount = 3): Set<string> {
  const sessions = read<SeenSession[]>(SEEN_KEY, []);
  const ids = new Set<string>();
  sessions.slice(0, sessionCount).forEach((s) => s.mealIds.forEach((id) => ids.add(id)));
  return ids;
}

/**
 * Phase 1A — Returns a weight map (meal ID → 0.0–1.0) based on how recently
 * each meal appeared in a past session.  Weights decay with session age so
 * last-night's deck is penalised harder than last-month's.
 *
 * Weight schedule:
 *   < 1 day   → 1.0  (very recent — full -2.5 penalty in scoreMeal)
 *   < 7 days  → 0.65
 *   < 30 days → 0.25
 *   ≥ 30 days → omitted (no entry in map, no penalty)
 *
 * Reverts cleanly: scoreMeal() falls back to the flat Set<string> path when
 * recentlySeenWeights is undefined.
 */
export function getRecentlySeenWithWeights(sessionCount = 5): Map<string, number> {
  const sessions = read<SeenSession[]>(SEEN_KEY, []);
  const weights = new Map<string, number>();
  const now = Date.now();

  sessions.slice(0, sessionCount).forEach((s) => {
    const ageDays = (now - new Date(s.seenAt).getTime()) / (1000 * 60 * 60 * 24);

    let weight: number;
    if (ageDays < 1) weight = 1.0;
    else if (ageDays < 7) weight = 0.65;
    else if (ageDays < 30) weight = 0.25;
    else return; // too old — no weight

    s.mealIds.forEach((id) => {
      // Keep the highest weight if a meal appeared in multiple sessions
      if ((weights.get(id) ?? 0) < weight) weights.set(id, weight);
    });
  });

  return weights;
}

/**
 * Phase 6 — Returns the most recent SeenSession entry, or null.
 * Used by the deck-level overlap check to compare the new deck's top-10
 * against last session's top-10 before finalising composition.
 */
export function getLastSeenSession(): SeenSession | null {
  const sessions = read<SeenSession[]>(SEEN_KEY, []);
  return sessions[0] ?? null;
}

// ── Phase 2 — Archetype history ───────────────────────────────────────────────

export function getArchetypeHistory(): ArchetypeHistory {
  return read<ArchetypeHistory>(ARCHETYPE_KEY, { entries: [] });
}

/**
 * Records the archetype of a chosen meal.
 * Call this alongside addToHistory() whenever the user confirms a choice.
 *
 * @param meal        - The chosen meal (used for category + tags).
 * @param mealCuisine - Primary cuisine string from MEAL_CUISINES[meal.id];
 *                      provided by the caller (deck/page.tsx) to avoid a
 *                      circular import between storage.ts and scoring.ts.
 */
export function addToArchetypeHistory(meal: Meal, mealCuisine: string): void {
  if (typeof window === "undefined") return;
  const history = getArchetypeHistory();
  const entry: ArchetypeEntry = {
    mealId: meal.id,
    cuisine: mealCuisine,
    category: meal.category,
    keyTags: [...meal.tags].sort().slice(0, 2),
    chosenAt: new Date().toISOString(),
  };
  const updated = [entry, ...history.entries].slice(0, 20);
  localStorage.setItem(ARCHETYPE_KEY, JSON.stringify({ entries: updated }));
}

/**
 * Returns the set of archetype fingerprints that were chosen more than
 * `threshold` times within the last `windowDays` days.
 *
 * Fingerprint format: "cuisine|category|tag1+tag2"
 *
 * Used by composeDeck() to gate meals out of Zone 1 when their style has
 * been over-represented in recent sessions.
 */
export function getOverexposedArchetypes(
  windowDays = 7,
  threshold = 2,
): Set<string> {
  const { entries } = getArchetypeHistory();
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const counts: Record<string, number> = {};

  for (const e of entries) {
    if (new Date(e.chosenAt).getTime() < cutoff) continue;
    const fp = `${e.cuisine}|${e.category}|${e.keyTags.join("+")}`;
    counts[fp] = (counts[fp] ?? 0) + 1;
  }

  return new Set(
    Object.entries(counts)
      .filter(([, n]) => n > threshold)
      .map(([fp]) => fp),
  );
}

// ── Phase 4C — Challenger session counter ─────────────────────────────────────

/** Returns how many deck-builds have occurred since the last challenger session. */
export function getChallengerSessionCount(): number {
  return read<number>(CHALLENGER_KEY, 0);
}

/** Increments the challenger counter. Call once per deck build when not in challenger mode. */
export function incrementChallengerCount(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHALLENGER_KEY, JSON.stringify(getChallengerSessionCount() + 1));
}

/** Resets the challenger counter after challenger mode fires. */
export function resetChallengerCount(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHALLENGER_KEY, JSON.stringify(0));
}

/**
 * Record a batch of meal IDs as "seen" in a new deck session.
 * Keeps the last 5 sessions so the recency penalty covers enough
 * history to prevent the same meals from dominating across visits.
 */
export function recordSeenSession(mealIds: string[]): void {
  if (typeof window === "undefined") return;
  const sessions = read<SeenSession[]>(SEEN_KEY, []);
  const entry: SeenSession = { mealIds, seenAt: new Date().toISOString() };
  const updated = [entry, ...sessions].slice(0, 5);
  localStorage.setItem(SEEN_KEY, JSON.stringify(updated));
  // Sync flattened IDs to Supabase for cross-session recency penalty
  const allIds = updated.flatMap((s) => s.mealIds);
  upsertRecentlySeen(getUserId(), allIds).catch(() => {});
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTodaysPick(): HistoryEntry | null {
  const history = getHistory();
  if (history.length === 0) return null;
  const latest = history[0]; // newest first
  const today = toLocalDateStr(new Date());
  const entryDay = toLocalDateStr(new Date(latest.chosenAt));
  return today === entryDay ? latest : null;
}

export function getStreak(): number {
  const history = getHistory();
  if (history.length === 0) return 0;

  const days = new Set(
    history.map((e) => toLocalDateStr(new Date(e.chosenAt))),
  );

  const today = new Date();
  const todayStr = toLocalDateStr(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDateStr(yesterday);

  // Streak is only active if today or yesterday has a pick
  if (!days.has(todayStr) && !days.has(yesterdayStr)) return 0;

  const startStr = days.has(todayStr) ? todayStr : yesterdayStr;
  const cursor = new Date(startStr + "T12:00:00"); // noon local avoids DST edge cases
  let streak = 0;
  while (days.has(toLocalDateStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Returns the meal ID last chosen by "Decide for me", or null if never used. */
export function getLastDecidePick(): string | null {
  return read<string | null>(LAST_DECIDE_KEY, null);
}

/** Persists the meal ID chosen by "Decide for me" so the next tap can avoid it. */
export function setLastDecidePick(mealId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_DECIDE_KEY, JSON.stringify(mealId));
}

// ── AI Meal Name History ──────────────────────────────────────────────────────
//
// Tracks the display names of AI-generated meals across recent sessions.
// Passed back to the server as `previousAIMealNames` so the model explicitly
// avoids repeating meals it already suggested — preventing self-repetition
// that the static library suppression alone can't catch.

const AI_MEAL_NAMES_KEY = "wwe_ai_meal_names_v1";
const AI_MEAL_NAMES_MAX_SESSIONS = 3;

type AIMealNamesSession = {
  names: string[];
  recordedAt: string; // ISO timestamp
};

/**
 * Returns AI-generated meal names from recent sessions, capped at `maxNames`.
 * Newest sessions come first (flattened), so the most recent suggestions are
 * always included within the cap. Defaults to 12 — enough to prevent obvious
 * repeats without over-constraining the model's output.
 */
export function getAIMealNameHistory(maxNames = 12): string[] {
  const sessions = read<AIMealNamesSession[]>(AI_MEAL_NAMES_KEY, []);
  return sessions.flatMap((s) => s.names).slice(0, maxNames);
}

/**
 * Persist the AI-generated meal names produced in the current session.
 * Call once after AI meals are gated and validated — not on every render.
 */
export function recordAIMealNames(names: string[]): void {
  if (typeof window === "undefined" || names.length === 0) return;
  const sessions = read<AIMealNamesSession[]>(AI_MEAL_NAMES_KEY, []);
  const entry: AIMealNamesSession = { names, recordedAt: new Date().toISOString() };
  const updated = [entry, ...sessions].slice(0, AI_MEAL_NAMES_MAX_SESSIONS);
  localStorage.setItem(AI_MEAL_NAMES_KEY, JSON.stringify(updated));
}
