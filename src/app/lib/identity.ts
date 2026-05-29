import { supabase } from "./supabase";

const USER_ID_KEY = "wwe_user_id";

/**
 * Returns a stable anonymous UUID for this device.
 * Generated once on first call and persisted in localStorage.
 */
export function getUserId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

/**
 * Returns the Supabase Auth user ID (uuid) for the currently signed-in user,
 * or null if the user is anonymous / not signed in.
 *
 * Uses getSession() which reads from localStorage — no network call.
 */
export async function getAuthUserId(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * All localStorage keys owned by this app.
 * Update this list whenever a new key is added to storage.ts or elsewhere.
 */
const APP_STORAGE_KEYS = [
  "wwe_user_id",
  "wwe_saved_meals",
  "wwe_history",
  "wwe_preferences",
  "wwe_onboarding_done",
  "wwe_taste_profile",
  "wwe_seen_sessions",
  "wwe_flavor_profile",
  "wwe_novelty_bias",
  "wwe_favorites",          // legacy — still clear it
  "wwe_last_decide_pick",
  "wwe_swipe_hint_seen",
  "watcha_swipe_tip_seen",
  "wwe_ritual_rejections",
  "wwe_pending_return_check",
  "wwe_nudge_cooldown",
  "watcha_decided_meal",    // cleared on logout; restored from Supabase on login
  "wwe_meal_cleared_at",   // timestamp of last manual clear — prevents stale restores
  "wwe_locked_headlines_seen", // last 15 variantIds shown in the decided-state headline
  "wwe_active_session",    // current shared session created by this device
  "wwe_drawer_hint_seen", // one-time hint pointing to the meal detail drawer
  "wwe_type_reveal_pending", // pending flavor-type reveal — cleared after shown
  "wwe_type_revealed",       // permanent marker — prevents reveal from firing again
] as const;

/**
 * Removes every app-owned key from localStorage, including dynamic AI-cache
 * entries (wwe_ai_meals_v1_*).
 *
 * Call this on sign-out to ensure no user data leaks to the next person on
 * the same device. Safe to call multiple times — idempotent.
 */
export function clearAllLocalState(): void {
  if (typeof window === "undefined") return;

  for (const key of APP_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }

  // Clear dynamic Top 5 daily cache keys (wwe_top5_{userId}_{date}).
  const top5Keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith("wwe_top5_")) top5Keys.push(k);
  }
  for (const k of top5Keys) localStorage.removeItem(k);

  // Clear dynamic AI meal cache keys (variable suffix).
  // These live in sessionStorage (see ai-meals.ts), not localStorage.
  const aiKeys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k?.startsWith("wwe_ai_meals_v1_")) aiKeys.push(k);
  }
  for (const k of aiKeys) sessionStorage.removeItem(k);

  // Clear dynamic shared session swiping completion flags (wwe_session_swiping_done_{sessionId}).
  const swipingDoneKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith("wwe_session_swiping_done_")) swipingDoneKeys.push(k);
  }
  for (const k of swipingDoneKeys) localStorage.removeItem(k);

  // Clear dynamic DNA insight cache keys (wwe_insights_{userId} and wwe_insights_{userIdA}_{userIdB}).
  const insightKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith("wwe_insights_")) insightKeys.push(k);
  }
  for (const k of insightKeys) localStorage.removeItem(k);

  // Clear dynamic flavor type cache keys (wwe_flavor_type_{userId}).
  const flavorTypeKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith("wwe_flavor_type_")) flavorTypeKeys.push(k);
  }
  for (const k of flavorTypeKeys) localStorage.removeItem(k);

}

/**
 * Generates a fresh anonymous UUID and writes it to localStorage.
 * Call after clearAllLocalState() so the next user on this device starts
 * with a clean identity unrelated to the previous session.
 *
 * Returns the new ID.
 */
export function resetAnonymousId(): string {
  if (typeof window === "undefined") return "";
  const id = crypto.randomUUID();
  localStorage.setItem(USER_ID_KEY, id);
  return id;
}
