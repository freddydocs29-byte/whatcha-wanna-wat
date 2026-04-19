import { Meal } from "../data/meals";

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

  localStorage.setItem(TASTE_KEY, JSON.stringify(profile));
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
 * Record a batch of meal IDs as "seen" in a new deck session.
 * Keeps the last 5 sessions so the recency penalty covers enough
 * history to prevent the same meals from dominating across visits.
 */
export function recordSeenSession(mealIds: string[]): void {
  if (typeof window === "undefined") return;
  const sessions = read<SeenSession[]>(SEEN_KEY, []);
  const entry: SeenSession = { mealIds, seenAt: new Date().toISOString() };
  localStorage.setItem(SEEN_KEY, JSON.stringify([entry, ...sessions].slice(0, 5)));
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
