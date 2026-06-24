"use client";

/**
 * ProfileProvider — single initialization owner for auth + profile hydration.
 *
 * Lifecycle:
 *   1. On mount: run initializeProfile() once.
 *   2. On SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED: re-run initializeProfile().
 *   3. On SIGNED_OUT: clear all local state, reset to a fresh anon identity,
 *      unblock the UI, and navigate to "/". Does NOT re-run initializeProfile —
 *      SIGNED_IN handles that when the next user logs in.
 *   4. Children are not rendered until initialization completes (profileReady).
 *      This prevents any page from reading stale localStorage before the
 *      Supabase ↔ local merge has finished.
 *
 * Merge rules (Fix 6):
 *   - Arrays (cuisines, dietary_restrictions, hard_no_foods, recently_seen_meal_ids):
 *       union of both sides — never erase a value that exists on either side.
 *   - learned_weights: per-key maximum — prevents double-counting when Supabase
 *       is a stale copy of local, while preserving genuine cross-device signal.
 *   - Strings (display_name, avatar_url): read-only in this provider; the profile
 *       page manages them directly.
 *   - Empty / null remote values NEVER overwrite non-empty local values.
 *   - Empty local defaults NEVER overwrite non-empty Supabase values.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserId, getAuthUserId, clearAllLocalState, resetAnonymousId } from "../lib/identity";
import {
  fetchOrCreateProfile,
  fetchProfileByAuthUserId,
  upsertProfilePreferences,
  upsertLearnedWeights,
  upsertRecentlySeen,
  linkAuthToProfile,
} from "../lib/supabase-profile";
import { getPreferences, savePreferences, getTasteProfile, restoreDecidedMealFromProfile, mealWasManuallyClearedAfter, saveDecidedMeal, saveMeal, addToHistory, getHistory, setOnboardingDoneLocal, type DecidedMeal } from "../lib/storage";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────

const TASTE_KEY = "wwe_taste_profile";
const SEEN_KEY = "wwe_seen_sessions";
const DECIDED_MEAL_KEY = "watcha_decided_meal";
const PENDING_GUEST_MEAL_KEY = "wwe_pending_guest_meal";
/** Hard cap on the flat seen-IDs list stored in Supabase. */
const MAX_SEEN_IDS = 120;

// ─── Local types (mirrors storage.ts to avoid circular imports) ───────────────

type TasteProfile = {
  likedTags: Record<string, number>;
  dislikedTags: Record<string, number>;
  likedCategories: Record<string, number>;
  interactionCount: number;
};

type SeenSession = { mealIds: string[]; seenAt: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readLocalJSON<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage unavailable — ignore.
  }
}

/**
 * Merges two tag/category count maps using per-key maximum.
 *
 * Why max instead of sum?
 * In the normal single-device flow, Supabase is a recent snapshot of local —
 * summing would double-count every interaction. Taking the max keeps the higher
 * of the two for each key, which is safe whether the remote is a stale copy
 * (max == local) or genuinely has extra signal from another device (max
 * preserves that signal without inflation).
 */
function mergeCountMap(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = { ...a };
  for (const [key, val] of Object.entries(b)) {
    result[key] = Math.max(result[key] ?? 0, val);
  }
  return result;
}

function mergeTasteProfiles(local: TasteProfile, remote: TasteProfile): TasteProfile {
  return {
    likedTags: mergeCountMap(local.likedTags, remote.likedTags),
    dislikedTags: mergeCountMap(local.dislikedTags, remote.dislikedTags),
    likedCategories: mergeCountMap(local.likedCategories, remote.likedCategories),
    interactionCount: Math.max(local.interactionCount, remote.interactionCount),
  };
}

function tasteProfileDiffersFrom(merged: TasteProfile, base: TasteProfile): boolean {
  if (merged.interactionCount !== base.interactionCount) return true;
  for (const [key, val] of Object.entries(merged.likedTags)) {
    if ((base.likedTags[key] ?? 0) !== val) return true;
  }
  for (const [key, val] of Object.entries(merged.dislikedTags)) {
    if ((base.dislikedTags[key] ?? 0) !== val) return true;
  }
  for (const [key, val] of Object.entries(merged.likedCategories)) {
    if ((base.likedCategories[key] ?? 0) !== val) return true;
  }
  return false;
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

/**
 * Calls `fn` up to `maxAttempts` times, returning on the first non-null result.
 * Uses a short exponential-ish backoff between attempts.
 * Logs a warning if all attempts fail.
 */
async function withRetry<T>(
  fn: () => Promise<T | null>,
  label: string,
  maxAttempts = 3,
  baseDelayMs = 400,
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await fn();
    if (result !== null) return result;
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
    }
  }
  console.warn(`[profile] ${label} failed after ${maxAttempts} attempts`);
  return null;
}

// ─── Pending guest meal ───────────────────────────────────────────────────────

/**
 * Applies wwe_pending_guest_meal to watcha_decided_meal after all profile
 * restores are complete, preventing a returning user's Supabase
 * last_decided_meal from overwriting a guest match result.
 *
 * Written by guest-home before navigating to auth (belt-and-suspenders copy
 * also made by auth/page.tsx at submit time). Cleared immediately after use.
 * Only applied when the pending meal is at least as new as the current meal.
 *
 * Returns true if a pending meal was applied.
 */
function applyPendingGuestMeal(): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(PENDING_GUEST_MEAL_KEY);
  if (!raw) return false;
  // Always clear the key — we either apply it now or it's invalid.
  localStorage.removeItem(PENDING_GUEST_MEAL_KEY);
  try {
    const pending = JSON.parse(raw) as DecidedMeal;
    if (!pending?.decidedAt) return false;
    const currentRaw = localStorage.getItem(DECIDED_MEAL_KEY);
    if (currentRaw) {
      const current = JSON.parse(currentRaw) as { decidedAt?: string };
      const pendingTime = new Date(pending.decidedAt).getTime();
      const currentTime = new Date(current?.decidedAt ?? 0).getTime();
      // Keep whichever meal is newer; discard the pending meal if older.
      if (pendingTime < currentTime) return false;
    }
    // Write to localStorage (immediate visual state).
    localStorage.setItem(DECIDED_MEAL_KEY, raw);
    console.log("[profile] applied pending guest meal:", pending.decidedAt);

    // Persist to Supabase so the meal survives page refresh and future logins.
    // saveDecidedMeal uses getUserId() which is already updated to the authenticated
    // user's profile user_id by the time applyPendingGuestMeal() runs (Step 1 of
    // initializeProfile updates wwe_user_id in localStorage for returning users).
    saveDecidedMeal(pending);

    // Add to history, guarding against duplicate entries for the signup path where
    // deck/page.tsx already wrote the anon user's history to Supabase. Only skip if
    // this exact meal was recorded within the last 2 hours (same session).
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const pendingDecidedTime = new Date(pending.decidedAt).getTime();
    const alreadyInHistory = getHistory().some(
      (h) =>
        h.meal.id === pending.id &&
        Math.abs(new Date(h.chosenAt).getTime() - pendingDecidedTime) < TWO_HOURS,
    );
    if (!alreadyInHistory) {
      addToHistory(pending);
    }

    // Notify the home page so it updates React state immediately without waiting
    // for the next full render cycle triggered by setProfileReady(true).
    window.dispatchEvent(new Event("decidedMealRestored"));

    return true;
  } catch {
    return false;
  }
}

// ─── Restore helper ───────────────────────────────────────────────────────────

/**
 * Unconditionally writes profile fields to localStorage.
 * Called on SIGNED_IN (after logout has already cleared localStorage) and on
 * initial mount when an auth session already exists.
 * Does NOT check whether localStorage is already populated — post-logout it is
 * always empty, so the unconditional write is safe.
 */
function restoreProfileLocalState(profile: Profile): void {
  // Hydrate the onboarding-done flag from Supabase so that post-OAuth sessions
  // (where localStorage was absent) correctly skip the slow-path check.
  // Read-only — does NOT trigger a Supabase write back.
  if (profile.onboarding_completed_at) {
    setOnboardingDoneLocal();
  }

  if (profile.saved_meals?.length) {
    localStorage.setItem('wwe_saved_meals', JSON.stringify(profile.saved_meals));
    console.log('[restore] saved meals restored:', profile.saved_meals.length);
  }

  if (profile.meal_history?.length) {
    localStorage.setItem('wwe_history', JSON.stringify(profile.meal_history));
    console.log('[restore] meal history restored:', profile.meal_history.length);
  }

  if (profile.last_decided_meal) {
    localStorage.setItem('watcha_decided_meal', JSON.stringify(profile.last_decided_meal));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('decidedMealRestored'));
    }
  }

  // avatar_url is fetched directly from Supabase on each home page load —
  // no localStorage cache needed, and a global (non-user-scoped) cache key
  // would leak a previous user's avatar URL to a new account on the same device.
}

// ─── Pending save meal ────────────────────────────────────────────────────────

/**
 * After a guest signs up/in via the save-button flow, applies the deferred save.
 * Written by the guest-home save button before navigating to /auth.
 * Cleared immediately after use.
 */
function applyPendingSaveMeal(): void {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem("wwe_pending_save_meal");
  if (!raw) return;
  localStorage.removeItem("wwe_pending_save_meal");
  try {
    const meal = JSON.parse(raw);
    if (!meal?.id) return;
    saveMeal(meal);
    console.log("[profile] applied pending save meal:", meal.id);
  } catch {
    // non-fatal — ignore
  }
}

// ─── Core initialization ──────────────────────────────────────────────────────

/**
 * Resolves the current user identity, links auth if present, fetches the
 * profile from Supabase, and merges it safely with localStorage.
 *
 * This is the single source of truth for hydration. All merge rules are
 * applied here — no other code path should perform a merge.
 *
 * Sign-in vs sign-up distinction:
 *   - Returning sign-in: fetchProfileByAuthUserId finds an existing profile →
 *     we use that profile's user_id and update localStorage. No linking occurs.
 *   - New sign-up: no auth-linked profile found → linkAuthToProfile stamps the
 *     auth_user_id onto the current device's anon profile.
 */
async function initializeProfile(deviceUserId: string): Promise<void> {
  if (!deviceUserId) return;

  // ── Step 1: resolve the canonical app user_id for this auth session ────────
  //
  // For returning users (signed in on another device before), we MUST use their
  // existing profile's user_id — not the current device's anon UUID. Otherwise
  // every new device creates a duplicate profile row.

  let resolvedUserId = deviceUserId;
  // Tracks whether Step 1 already ran the decided-meal check so Step 2b can
  // skip the duplicate restoreDecidedMealFromProfile call (while still
  // dispatching decidedMealRestored for paths where Step 1 was skipped).
  let decidedMealHandledByStep1 = false;

  const authUid = await getAuthUserId();
  if (authUid) {
    // First: look for an existing profile already linked to this auth account.
    const existingAuthProfile = await fetchProfileByAuthUserId(authUid);

    if (existingAuthProfile) {
      // Returning user — use the profile they already have.
      resolvedUserId = existingAuthProfile.user_id;
      if (resolvedUserId !== deviceUserId) {
        // Update localStorage so all subsequent reads use the correct ID.
        localStorage.setItem("wwe_user_id", resolvedUserId);
        console.log("[profile] returning user: resolved user_id from auth →", resolvedUserId);
      }

      console.log('[restore] existingAuthProfile found:', {
        userId: existingAuthProfile.user_id,
        mealHistoryCount: existingAuthProfile.meal_history?.length ?? 0,
        savedMealsCount: existingAuthProfile.saved_meals?.length ?? 0,
        hasLastDecidedMeal: !!existingAuthProfile.last_decided_meal,
        hasAvatarUrl: !!existingAuthProfile.avatar_url,
      });

      // Restore all profile fields to localStorage.
      // Unconditional: after logout clearAllLocalState() wiped everything, so
      // whatever Supabase has is the correct source of truth to write back.
      restoreProfileLocalState(existingAuthProfile);

      // Mark that Step 1 handled the decided-meal check so Step 2b skips the
      // duplicate restoreDecidedMealFromProfile call for returning users.
      decidedMealHandledByStep1 = true;
    } else {
      // No auth-linked profile yet → this is a new signup on this device.
      // Link the current anon profile to the auth account.
      const linked = await withRetry(
        () => linkAuthToProfile(authUid, deviceUserId),
        "linkAuthToProfile",
      );
      if (!linked) {
        console.error("[profile] linkAuthToProfile failed — continuing with device user_id");
      } else {
        resolvedUserId = linked.user_id;
      }
    }
  }

  // ── Step 2: fetch or create the Supabase profile row ─────────────────────

  const profile: Profile | null = await fetchOrCreateProfile(resolvedUserId);
  if (!profile) return; // Supabase unavailable — leave localStorage as-is.

  // ── Step 2b: restore decided meal from profile if localStorage is empty ───
  //
  // Covers anon users and new signups — Step 1 is skipped for them because
  // there is no existingAuthProfile. For returning users, Step 1 already ran
  // the restore with stricter guards (6-hour expiry, manual-clear check), so
  // we skip the restoreDecidedMealFromProfile call here to avoid duplication.
  // The decidedMealRestored event is always dispatched so the home page is
  // unblocked regardless of whether a meal was actually found.
  if (profile.last_decided_meal) {
    if (mealWasManuallyClearedAfter(profile.last_decided_meal.decidedAt)) {
      console.log('[ProfileProvider] meal was cleared — not restoring')
    } else {
      if (!decidedMealHandledByStep1) {
        restoreDecidedMealFromProfile(profile);
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("decidedMealRestored"));
      }
    }
  } else {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("decidedMealRestored"));
    }
  }

  // ── Step 3: merge preferences (cuisines, dietary, hardNos) ───────────────
  //
  // Rules:
  //   - Compute the union of each array field independently.
  //   - If the union differs from local → write the union to local
  //     (savePreferences also fires a Supabase upsert, so remote stays current).
  //   - If local has data and remote is empty → upload local to Supabase.
  //   - If local is already a superset of remote → do nothing
  //     (the next savePreferences call will keep Supabase current).
  //   - Empty / null values on either side NEVER erase the other side.

  const localPrefs = getPreferences();
  const localCuisines = localPrefs?.cuisines ?? [];
  const localDietary  = localPrefs?.dietaryRestrictions ?? [];
  const localHardNos  = localPrefs?.hardNoFoods ?? [];

  // Use ?? [] defensively: Supabase types say string[] but the column can be
  // null in practice if it was never written.
  const remoteCuisines = profile.favorite_cuisines ?? [];
  const remoteDietary  = profile.dietary_restrictions ?? [];
  const remoteHardNos  = profile.hard_no_foods ?? [];

  const mergedCuisines = [...new Set([...localCuisines, ...remoteCuisines])];
  const mergedDietary  = [...new Set([...localDietary,  ...remoteDietary])];
  const mergedHardNos  = [...new Set([...localHardNos,  ...remoteHardNos])];

  const hasLocalPrefs  = localCuisines.length > 0 || localDietary.length > 0 || localHardNos.length > 0;
  const hasRemotePrefs = remoteCuisines.length > 0 || remoteDietary.length > 0 || remoteHardNos.length > 0;

  const mergedDiffersFromLocal =
    mergedCuisines.length !== localCuisines.length ||
    mergedDietary.length  !== localDietary.length  ||
    mergedHardNos.length  !== localHardNos.length;

  if (mergedDiffersFromLocal) {
    // Remote had items local didn't (or local was empty and remote wasn't).
    // savePreferences writes to localStorage AND fires the Supabase sync.
    savePreferences({
      ...(localPrefs ?? { spiceLevel: "any", cookOrOrder: "either", kidFriendly: null, allergens: [] }),
      cuisines:            mergedCuisines,
      dietaryRestrictions: mergedDietary,
      hardNoFoods:         mergedHardNos,
    });
  } else if (hasLocalPrefs && !hasRemotePrefs) {
    // Local is already the superset AND remote is completely empty → upload.
    upsertProfilePreferences(resolvedUserId, {
      cuisines:            localCuisines,
      dietaryRestrictions: localDietary,
      hardNoFoods:         localHardNos,
    }).catch(() => {});
  }
  // If local == merged (local is superset of remote) and remote has some data,
  // do nothing — the next savePreferences call will keep Supabase current.

  // ── Step 4: merge learned weights (TasteProfile) ─────────────────────────

  const localTaste     = getTasteProfile();
  const remoteHasWeights = (profile.learned_weights?.interactionCount ?? 0) > 0;

  if (localTaste.interactionCount === 0 && remoteHasWeights) {
    // Local has no signal — restore from Supabase.
    writeLocalJSON(TASTE_KEY, profile.learned_weights);
  } else if (localTaste.interactionCount > 0 && !remoteHasWeights) {
    // Supabase has nothing — upload local.
    upsertLearnedWeights(resolvedUserId, localTaste).catch(() => {});
  } else if (localTaste.interactionCount > 0 && remoteHasWeights) {
    // Both have data — merge with per-key max.
    const remoteTaste = profile.learned_weights as TasteProfile;
    const merged      = mergeTasteProfiles(localTaste, remoteTaste);
    if (tasteProfileDiffersFrom(merged, localTaste)) {
      writeLocalJSON(TASTE_KEY, merged);
      upsertLearnedWeights(resolvedUserId, merged).catch(() => {});
    }
    // If local was already a superset, leave it alone. The next swipe
    // will keep Supabase current via the debounced sync in storage.ts.
  }

  // ── Step 5: merge recently seen meal IDs ─────────────────────────────────

  const localSeenSessions = readLocalJSON<SeenSession[]>(SEEN_KEY, []);
  const localSeenIds      = localSeenSessions.flatMap((s) => s.mealIds);
  const remoteSeenIds: string[] = profile.recently_seen_meal_ids ?? [];

  if (localSeenIds.length === 0 && remoteSeenIds.length > 0) {
    writeLocalJSON(SEEN_KEY, [
      { mealIds: remoteSeenIds, seenAt: new Date().toISOString() },
    ]);
  } else if (localSeenIds.length > 0 && remoteSeenIds.length === 0) {
    upsertRecentlySeen(resolvedUserId, localSeenIds).catch(() => {});
  } else if (localSeenIds.length > 0 && remoteSeenIds.length > 0) {
    const merged = [
      ...new Set([...localSeenIds, ...remoteSeenIds]),
    ].slice(0, MAX_SEEN_IDS);
    if (merged.length > localSeenIds.length) {
      writeLocalJSON(SEEN_KEY, [
        { mealIds: merged, seenAt: new Date().toISOString() },
      ]);
      upsertRecentlySeen(resolvedUserId, merged).catch(() => {});
    }
  }

  // ── Apply pending guest meal (must run last, after all profile restores) ──
  //
  // Protects the decided meal a guest locked during a shared session from
  // being overwritten by this user's Supabase last_decided_meal. Written by
  // guest-home (and backed up by auth/page.tsx) before the auth flow starts.
  // Cleared here after first use so it never affects subsequent boots.
  applyPendingGuestMeal();

  // ── Apply pending save meal (deferred save from guest save-button flow) ──
  //
  // Written by the guest-home bookmark button before navigating to /auth.
  // Cleared here after first use. Runs after profile restores so saveMeal
  // writes to the correct user_id.
  applyPendingSaveMeal();
}

// ─── Loading screen ───────────────────────────────────────────────────────────

function ProfileLoadingScreen() {
  return (
    <div className="min-h-screen bg-[#1C1A18] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-20 h-20 rounded-[22px] bg-[#E8621A] flex items-center justify-center shadow-lg"
          aria-label="Loading"
        >
          <span className="font-display font-black text-4xl text-white select-none">?</span>
        </div>
        <div className="w-5 h-5 border-2 border-white/20 border-t-[#E8621A] rounded-full animate-spin" />
      </div>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export default function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profileReady, setProfileReady] = useState(false);
  const router = useRouter();
  const bootRan = useRef(false);

  useEffect(() => {
    // Track whether this effect is still mounted so we don't call setState
    // after an unmount (e.g. during hot-reload or strict-mode double-invoke).
    let active = true;

    async function boot() {
      if (bootRan.current) {
        console.log('[ProfileProvider] boot already ran — skipping')
        return
      }
      bootRan.current = true

      const userId = getUserId(); // reads or creates wwe_user_id

      // Last-resort safety: if initializeProfile somehow hangs (e.g. Supabase
      // never resolves), force profileReady after 8 s so the app never stays
      // stuck on the loading screen forever.
      let safetyTimer: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<void>((resolve) => {
        safetyTimer = setTimeout(() => {
          console.warn("[profile] boot() safety timeout reached — forcing profileReady=true");
          resolve();
        }, 8_000);
      });

      try {
        setProfileReady(false);
        await Promise.race([initializeProfile(userId), timeoutPromise]);
      } catch (err) {
        // Never block the app on a profile init failure — log and continue.
        console.error("[profile] initializeProfile threw unexpectedly:", err);
      } finally {
        clearTimeout(safetyTimer!);
        if (active) setProfileReady(true);
      }
    }

    // Run immediately on mount.
    void boot();

    // Subscribe to Supabase auth events so the profile stays in sync with
    // sign-in / sign-out actions, even those that happen in other tabs.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        // Wipe all user data and generate a fresh anon ID, then return to the
        // splash/auth screen. Do NOT call boot() here — SIGNED_IN will trigger
        // initializeProfile() when the next user logs in.
        //
        // Reset the boot guard so boot() can run again when the next user logs in.
        // Without this, SIGNED_IN fires but boot() returns early because bootRan
        // is still true from the initial mount — blocking every restore.
        bootRan.current = false;
        clearAllLocalState();
        resetAnonymousId();
        setProfileReady(true);
        router.push("/");
      } else if (event === "SIGNED_IN") {
        // Fetch the auth-linked profile and restore localStorage directly —
        // bypassing boot() so the bootRan guard cannot skip the restore.
        // After the restore, reset the guard and run boot() for the full
        // preferences / weights / seen merge.
        console.log('[ProfileProvider] SIGNED_IN — restoring profile state directly');
        void (async () => {
          const authUid = await getAuthUserId();
          if (authUid) {
            const existingProfile = await fetchProfileByAuthUserId(authUid);
            if (existingProfile) {
              console.log('[ProfileProvider] SIGNED_IN profile found — calling restoreProfileLocalState');
              restoreProfileLocalState(existingProfile);
            } else {
              console.log('[ProfileProvider] SIGNED_IN — no existing profile found for auth uid');
            }
          }
          // Reset guard so boot() runs the full merge (prefs, weights, seen).
          bootRan.current = false;
          void boot();
        })();
      } else if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        // Re-run the full init so auth is linked and profile is re-merged.
        void boot();
      }
      // INITIAL_SESSION fires on every page load when a session already exists.
      // We intentionally skip it here because boot() already ran on mount
      // and the session was captured via getAuthUserId() / getSession() there.
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!profileReady) {
    return <ProfileLoadingScreen />;
  }

  return <>{children}</>;
}
