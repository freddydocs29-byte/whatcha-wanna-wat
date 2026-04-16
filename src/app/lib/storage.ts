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

const SAVED_KEY = "wwe_saved_meals";
const HISTORY_KEY = "wwe_history";
const PREFS_KEY = "wwe_preferences";

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
