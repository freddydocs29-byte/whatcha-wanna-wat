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

const SAVED_KEY = "wwe_saved_meals";
const HISTORY_KEY = "wwe_history";
const PREFS_KEY = "wwe_preferences";
const TASTE_KEY = "wwe_taste_profile";
const SEEN_KEY = "wwe_seen_sessions";
const FLAVOR_KEY = "wwe_flavor_profile";
const FAVORITES_KEY = "wwe_favorites";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

export function getSavedMeals(): Meal[] {
  return read<Meal[]>(SAVED_KEY, []);
}

export function saveMeal(meal: Meal): void {
  const current = getSavedMeals();
  if (current.some((m) => m.id === meal.id)) return;
  localStorage.setItem(SAVED_KEY, JSON.stringify([...current, meal]));
}

export function removeSavedMeal(mealId: string): void {
  const updated = getSavedMeals().filter((m) => m.id !== mealId);
  localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
}

export function getFavorites(): Meal[] {
  return read<Meal[]>(FAVORITES_KEY, []);
}

export function addFavorite(meal: Meal): void {
  if (typeof window === "undefined") return;
  const current = getFavorites();
  if (current.some((m) => m.id === meal.id)) return;
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...current, meal]));
}

export function removeFavorite(mealId: string): void {
  if (typeof window === "undefined") return;
  const updated = getFavorites().filter((m) => m.id !== mealId);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
}

export function getHistory(): HistoryEntry[] {
  return read<HistoryEntry[]>(HISTORY_KEY, []);
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_KEY);
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

export function hasCompletedOnboarding(): boolean {
  return getPreferences() !== null;
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
