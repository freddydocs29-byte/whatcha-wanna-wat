"use client";

/**
 * ProfileProvider — single initialization owner for auth + profile hydration.
 *
 * Lifecycle:
 *   1. On mount: run initializeProfile() once.
 *   2. On SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED: re-run initializeProfile().
 *   3. On SIGNED_OUT: clear all local state, reset to a fresh anon identity,
 *      then re-run initializeProfile() so the next user starts clean.
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

import { useEffect, useState } from "react";
import { getUserId, getAuthUserId, clearAllLocalState, resetAnonymousId } from "../lib/identity";
import {
  fetchOrCreateProfile,
  upsertProfilePreferences,
  upsertLearnedWeights,
  upsertRecentlySeen,
  linkAuthToProfile,
} from "../lib/supabase-profile";
import { getPreferences, savePreferences, getTasteProfile } from "../lib/storage";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────

const TASTE_KEY = "wwe_taste_profile";
const SEEN_KEY = "wwe_seen_sessions";
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

// ─── Core initialization ──────────────────────────────────────────────────────

/**
 * Resolves the current user identity, links auth if present, fetches the
 * profile from Supabase, and merges it safely with localStorage.
 *
 * This is the single source of truth for hydration. All merge rules are
 * applied here — no other code path should perform a merge.
 */
async function initializeProfile(userId: string): Promise<void> {
  if (!userId) return;

  // ── Step 1: link auth session to the anon profile (if signed in) ──────────

  const authUid = await getAuthUserId();
  if (authUid) {
    const linked = await withRetry(
      () => linkAuthToProfile(authUid, userId),
      "linkAuthToProfile",
    );
    if (!linked) {
      // Log but don't bail — the rest of the init can still proceed.
      console.error("[profile] linkAuthToProfile failed — profile not linked to auth account");
    }
  }

  // ── Step 2: fetch or create the Supabase profile row ─────────────────────

  const profile: Profile | null = await fetchOrCreateProfile(userId);
  if (!profile) return; // Supabase unavailable — leave localStorage as-is.

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
      ...(localPrefs ?? { spiceLevel: "any", cookOrOrder: "either", kidFriendly: null }),
      cuisines:            mergedCuisines,
      dietaryRestrictions: mergedDietary,
      hardNoFoods:         mergedHardNos,
    });
  } else if (hasLocalPrefs && !hasRemotePrefs) {
    // Local is already the superset AND remote is completely empty → upload.
    upsertProfilePreferences(userId, {
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
    upsertLearnedWeights(userId, localTaste).catch(() => {});
  } else if (localTaste.interactionCount > 0 && remoteHasWeights) {
    // Both have data — merge with per-key max.
    const remoteTaste = profile.learned_weights as TasteProfile;
    const merged      = mergeTasteProfiles(localTaste, remoteTaste);
    if (tasteProfileDiffersFrom(merged, localTaste)) {
      writeLocalJSON(TASTE_KEY, merged);
      upsertLearnedWeights(userId, merged).catch(() => {});
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
    upsertRecentlySeen(userId, localSeenIds).catch(() => {});
  } else if (localSeenIds.length > 0 && remoteSeenIds.length > 0) {
    const merged = [
      ...new Set([...localSeenIds, ...remoteSeenIds]),
    ].slice(0, MAX_SEEN_IDS);
    if (merged.length > localSeenIds.length) {
      writeLocalJSON(SEEN_KEY, [
        { mealIds: merged, seenAt: new Date().toISOString() },
      ]);
      upsertRecentlySeen(userId, merged).catch(() => {});
    }
  }
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

  useEffect(() => {
    // Track whether this effect is still mounted so we don't call setState
    // after an unmount (e.g. during hot-reload or strict-mode double-invoke).
    let active = true;

    async function boot() {
      setProfileReady(false);
      const userId = getUserId(); // reads or creates wwe_user_id
      try {
        await initializeProfile(userId);
      } catch (err) {
        // Never block the app on a profile init failure — log and continue.
        console.error("[profile] initializeProfile threw unexpectedly:", err);
      }
      if (active) setProfileReady(true);
    }

    // Run immediately on mount.
    void boot();

    // Subscribe to Supabase auth events so the profile stays in sync with
    // sign-in / sign-out actions, even those that happen in other tabs.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        // Wipe all user data from this device and generate a fresh anon ID
        // before re-initializing, so the next user starts completely clean.
        clearAllLocalState();
        resetAnonymousId();
        void boot();
      } else if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
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
