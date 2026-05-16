import { Meal } from "../data/meals";
import { getUserId } from "./identity";
import { upsertProfilePreferences, upsertLearnedWeights, upsertRecentlySeen, upsertRecentlyShown, upsertBehavioralSignals, upsertNoveltyBias, upsertLastDecidedMeal, type RecentlyShownEntry } from "./supabase-profile";
import { supabase } from "./supabase";

export type HistoryEntry = {
  meal: Meal;
  chosenAt: string; // ISO timestamp
};

export type UserPreferences = {
  cuisines: string[];
  /**
   * Dietary constraints from onboarding Step 1 (Vegetarian, Vegan, Gluten-free,
   * Dairy-free, Halal, Kosher). Maps to hardGate via DIETARY_RESTRICTION_MAP in
   * scoring.ts — kept separate from hardNoFoods because they feed different systems.
   */
  dietaryRestrictions: string[];
  /**
   * Protein / ingredient hard NOs from onboarding Step 1 (No pork, No seafood,
   * No beef) and profile-page edits. Passed directly to hardGate after label
   * normalisation via HARD_NO_LABEL_MAP in scoring.ts.
   */
  hardNoFoods: string[];
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
const SHOWN_ENTRIES_KEY = "wwe_shown_entries";
const FLAVOR_KEY = "wwe_flavor_profile";
const NOVELTY_BIAS_KEY = "wwe_novelty_bias";
// Legacy key — only read during one-time migration, never written again.
const FAVORITES_KEY = "wwe_favorites";
const LAST_DECIDE_KEY = "wwe_last_decide_pick";
/**
 * Canonical key for the current decided meal shown on the Home screen.
 * Written immediately when any match path resolves so Home never reads stale state.
 */
const DECIDED_MEAL_KEY = "watcha_decided_meal";

/**
 * The decided meal stored for the Home screen "Good call" state.
 * Extends Meal so callers can pass it directly to saveMeal / addFavorite.
 */
export type DecidedMeal = Meal & {
  decidedAt: string;
  mode: "shared" | "solo";
  sessionId?: string;
  partner?: string;
};

/**
 * Returns true if the user manually cleared their decided meal AFTER the given
 * decidedAt timestamp. Used to suppress stale restores from Supabase or localStorage.
 */
export function mealWasManuallyClearedAfter(decidedAt: string): boolean {
  if (typeof window === "undefined") return false;
  const clearedAt = localStorage.getItem('wwe_meal_cleared_at')
  console.log('[clearCheck] wwe_meal_cleared_at:', clearedAt, '| decidedAt:', decidedAt)
  if (!clearedAt) {
    console.log('[clearCheck] no cleared timestamp — returning false')
    return false
  }
  const clearedAtTime = parseInt(clearedAt, 10);
  const decidedAtTime = new Date(decidedAt).getTime();
  const result = clearedAtTime > decidedAtTime
  console.log('[clearCheck] clearedAtTime:', clearedAtTime, '> decidedAtTime:', decidedAtTime, '=', result)
  if (Number.isNaN(clearedAtTime) || Number.isNaN(decidedAtTime)) return false;
  return result;
}

/** Returns the currently decided meal, or null if none is set. */
export function getDecidedMeal(): DecidedMeal | null {
  return read<DecidedMeal | null>(DECIDED_MEAL_KEY, null);
}

/**
 * Persists a decided meal to localStorage AND profiles.last_decided_meal.
 * Single canonical write path — use this everywhere instead of direct localStorage.
 */
export function saveDecidedMeal(meal: DecidedMeal): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DECIDED_MEAL_KEY, JSON.stringify(meal));
  localStorage.removeItem('wwe_meal_cleared_at');

  const userId = getUserId();
  console.log('[decidedMeal] userId at save time:', userId);

  if (!userId) {
    console.warn('[decidedMeal] no userId — skipping Supabase write');
    return;
  }

  upsertLastDecidedMeal(userId, meal)
    .then(() => console.log('[decidedMeal] saved to Supabase:', meal.name))
    .catch((err) => console.error('[decidedMeal] Supabase write failed:', err));
}

/**
 * Clears the decided meal from localStorage AND profiles.last_decided_meal.
 * Call this whenever the user actively dismisses their current decision.
 */
export function clearDecidedMeal(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DECIDED_MEAL_KEY);
  const userId = getUserId();
  if (userId) {
    upsertLastDecidedMeal(userId, null).catch(() => {});
  }
}

/**
 * Restores the decided meal from a Supabase profile into localStorage.
 *
 * Rules:
 * - If localStorage is empty and profile has a meal → restore from profile.
 * - If both exist → keep whichever has the newer decidedAt timestamp.
 * - Never overwrite a newer local meal with an older remote one.
 *
 * Call this after profile hydration in ProfileProvider so the last decided
 * meal is available on the Home screen after login.
 */
export function restoreDecidedMealFromProfile(
  profile: { last_decided_meal?: { decidedAt: string } | null },
): void {
  if (typeof window === "undefined") return;
  const remote = profile.last_decided_meal;
  if (!remote) return;

  // Never restore a meal the user already cleared this session
  if (mealWasManuallyClearedAfter(remote.decidedAt)) return;

  const local = getDecidedMeal();
  if (!local) {
    // Nothing in localStorage — restore from profile.
    localStorage.setItem(DECIDED_MEAL_KEY, JSON.stringify(remote));
    return;
  }

  // Both exist — keep the newer one.
  const localTime = new Date(local.decidedAt).getTime();
  const remoteTime = new Date(remote.decidedAt).getTime();
  if (remoteTime > localTime) {
    localStorage.setItem(DECIDED_MEAL_KEY, JSON.stringify(remote));
  }
}

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

/** Fire-and-forget sync of the full saved list to Supabase. */
function syncSavedToSupabase(saved: SavedMeal[]): void {
  const userId = getUserId();
  if (!userId) return;
  supabase
    .from('profiles')
    .update({ saved_meals: saved })
    .eq('user_id', userId)
    .then(({ error }) => {
      if (error) console.error('[saved] sync failed:', error.message);
      else console.log('[saved] synced to Supabase');
    });
}

/** Adds a meal to the saved collection (isFavorite = false). No-op if already saved. */
export function saveMeal(meal: Meal): void {
  if (typeof window === "undefined") return;
  const current = getSavedMealsEnriched();
  if (current.some((s) => s.meal.id === meal.id)) return;
  const entry: SavedMeal = { meal, isFavorite: false, savedAt: new Date().toISOString() };
  const updated = [...current, entry];
  localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
  syncSavedToSupabase(updated);
}

/** Removes a meal from the saved collection entirely. */
export function removeSavedMeal(mealId: string): void {
  if (typeof window === "undefined") return;
  const updated = getSavedMealsEnriched().filter((s) => s.meal.id !== mealId);
  localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
  syncSavedToSupabase(updated);
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
      syncSavedToSupabase(updated);
    }
  } else {
    const entry: SavedMeal = { meal, isFavorite: true, savedAt: new Date().toISOString() };
    const updated = [...current, entry];
    localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
    syncSavedToSupabase(updated);
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
  syncSavedToSupabase(updated);
}

/** Toggles the isFavorite flag on a saved meal. Used by the saved page heart icon. */
export function toggleSavedFavorite(mealId: string): void {
  if (typeof window === "undefined") return;
  const updated = getSavedMealsEnriched().map((s) =>
    s.meal.id === mealId ? { ...s, isFavorite: !s.isFavorite } : s,
  );
  localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
  syncSavedToSupabase(updated);
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
  const updated = [entry, ...current].slice(0, 50); // keep last 50
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));

  // Sync recently_chosen timestamps to Supabase so shared sessions can apply
  // time-based recency penalties (< 2 days, < 7 days, < 30 days).
  const recentlyChosen = updated.slice(0, 30).map((h) => ({
    meal_id: h.meal.id,
    chosen_at: h.chosenAt,
  }));
  upsertBehavioralSignals(getUserId(), { recentlyChosen }).catch(() => {});

  // Sync full history to Supabase so it survives logout/login.
  const userId = getUserId();
  if (userId) {
    supabase
      .from('profiles')
      .update({ meal_history: updated })
      .eq('user_id', userId)
      .then(({ error }) => {
        if (error) console.error('[history] sync failed:', error.message);
        else console.log('[history] synced to Supabase');
      });
  }
}

export function getPreferences(): UserPreferences | null {
  const raw = read<Record<string, unknown> | null>(PREFS_KEY, null);
  if (!raw) return null;

  // Migrate old format: single dislikedFoods array → separate dietaryRestrictions + hardNoFoods.
  // Old values (Seafood, Dairy, Gluten / Pasta, etc.) were all hard-NO style labels,
  // so they migrate into hardNoFoods. dietaryRestrictions starts empty.
  if ("dislikedFoods" in raw && !("hardNoFoods" in raw)) {
    const migrated: UserPreferences = {
      cuisines: (raw.cuisines as string[]) ?? [],
      dietaryRestrictions: [],
      hardNoFoods: (raw.dislikedFoods as string[]) ?? [],
      spiceLevel: (raw.spiceLevel as UserPreferences["spiceLevel"]) ?? "any",
      cookOrOrder: (raw.cookOrOrder as UserPreferences["cookOrOrder"]) ?? "either",
      kidFriendly: (raw.kidFriendly as boolean | null) ?? null,
    };
    if (typeof window !== "undefined") {
      localStorage.setItem(PREFS_KEY, JSON.stringify(migrated));
    }
    return migrated;
  }

  return raw as UserPreferences;
}

export function savePreferences(prefs: UserPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  // Fire-and-forget sync to Supabase — dietary_restrictions and hard_no_foods are
  // written as separate columns so the two systems stay distinct.
  upsertProfilePreferences(getUserId(), {
    cuisines: prefs.cuisines,
    dietaryRestrictions: prefs.dietaryRestrictions,
    hardNoFoods: prefs.hardNoFoods,
  }).catch(() => {});
}

/** Returns the user's novelty bias (0–1). Defaults to 0.5 (mix of both) if not set. */
export function getNoveltyBias(): number {
  return read<number>(NOVELTY_BIAS_KEY, 0.5);
}

/** Persists the novelty bias from onboarding Step 3 to localStorage and Supabase. */
export function saveNoveltyBias(value: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOVELTY_BIAS_KEY, JSON.stringify(value));
  upsertNoveltyBias(getUserId(), value).catch(() => {});
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

  localStorage.setItem(TASTE_KEY, JSON.stringify(profile));

  // Debounce Supabase sync — batch rapid swipes into a single write
  if (_tasteProfileSyncTimer) clearTimeout(_tasteProfileSyncTimer);
  const snapshot = profile;
  _tasteProfileSyncTimer = setTimeout(() => {
    const uid = getUserId();
    upsertLearnedWeights(uid, snapshot).catch(() => {});
    // Also write to consolidated behavioral signals table for cross-device shared sessions
    upsertBehavioralSignals(uid, {
      likedTags: snapshot.likedTags,
      dislikedTags: snapshot.dislikedTags,
      likedCategories: snapshot.likedCategories,
    }).catch(() => {});
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

type SeenSession = {
  mealIds: string[];
  seenAt: string;
};

export type ShownEntry = RecentlyShownEntry; // { mealId: string; shownAt: string }

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
 *
 * Also appends timestamped impression entries to recently_shown (capped at 50,
 * deduplicated by mealId keeping the newest shownAt) for hard exclusion in scoring.
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
  // Append timestamped impression entries; deduplicate by mealId (newest wins); cap at 50
  const now = new Date().toISOString();
  const newEntries: ShownEntry[] = mealIds.map((id) => ({ mealId: id, shownAt: now }));
  const existingEntries = read<ShownEntry[]>(SHOWN_ENTRIES_KEY, []);
  const seenIds = new Set<string>();
  const mergedEntries = [...newEntries, ...existingEntries]
    .filter((e) => {
      if (seenIds.has(e.mealId)) return false;
      seenIds.add(e.mealId);
      return true;
    })
    .slice(0, 50);
  localStorage.setItem(SHOWN_ENTRIES_KEY, JSON.stringify(mergedEntries));
  upsertRecentlyShown(getUserId(), mergedEntries).catch(() => {});
}

/**
 * Returns the set of meal IDs shown to the user within the last `withinDays` days.
 * Used by scoring to hard-exclude recently shown meals from the deck entirely.
 */
export function getRecentlyShownIds(withinDays = 7): Set<string> {
  if (typeof window === "undefined") return new Set();
  const entries = read<ShownEntry[]>(SHOWN_ENTRIES_KEY, []);
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;
  return new Set(
    entries
      .filter((e) => new Date(e.shownAt).getTime() > cutoff)
      .map((e) => e.mealId),
  );
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
