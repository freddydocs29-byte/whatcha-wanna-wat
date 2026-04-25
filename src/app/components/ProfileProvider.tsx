"use client";

/**
 * Syncs the Supabase profile with localStorage on every app load.
 *
 * Three cases are handled for each data field:
 *
 *   1. Supabase empty, local has data  → upload local to Supabase
 *   2. Local empty, Supabase has data  → hydrate local from Supabase
 *   3. Both have data                  → merge carefully (see per-field rules below)
 *        cuisines / dislikedFoods : union (never drop a preference from either side)
 *        learned_weights (TasteProfile): per-key max to prevent double-counting
 *                                        while preserving any extra signal from either side
 *        recently_seen_meal_ids  : union, deduplicated, capped at MAX_SEEN_IDS
 *
 * Rules that are NOT applied:
 *   - We never overwrite local with empty/default Supabase values.
 *   - We never silently drop a preference that exists on either side.
 *
 * All Supabase calls are fire-and-forget. Load failures are silent.
 */

import { useEffect } from "react";
import { getUserId } from "../lib/identity";
import {
  fetchOrCreateProfile,
  upsertProfilePreferences,
  upsertLearnedWeights,
  upsertRecentlySeen,
} from "../lib/supabase-profile";
import { getPreferences, savePreferences, getTasteProfile } from "../lib/storage";

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
 * Merges two tag/category count maps.
 * Strategy: per-key maximum.
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
    // Max prevents count inflation while still reflecting the richer source.
    interactionCount: Math.max(local.interactionCount, remote.interactionCount),
  };
}

/** Returns true if `merged` contains any key/value that differs from `base`. */
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

// ─── Provider ─────────────────────────────────────────────────────────────────

export default function ProfileProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;

    fetchOrCreateProfile(userId).then((profile) => {
      if (!profile) return;

      const localPrefs = getPreferences();
      const localTaste = getTasteProfile();
      const localSeenSessions = readLocalJSON<SeenSession[]>(SEEN_KEY, []);
      const localSeenIds = localSeenSessions.flatMap((s) => s.mealIds);

      const remoteHasCuisines = (profile.favorite_cuisines?.length ?? 0) > 0;
      const remoteHasWeights = (profile.learned_weights?.interactionCount ?? 0) > 0;
      const remoteSeenIds: string[] = profile.recently_seen_meal_ids ?? [];

      // ── Preferences: cuisines + dietary restrictions ──────────────────────

      if (!localPrefs && remoteHasCuisines) {
        // Local has nothing — restore from Supabase. Use safe defaults for
        // fields not stored in Supabase (spiceLevel etc.).
        savePreferences({
          cuisines: profile.favorite_cuisines,
          dislikedFoods: profile.dietary_restrictions,
          spiceLevel: "any",
          cookOrOrder: "either",
          kidFriendly: null,
        });
      } else if (localPrefs && !remoteHasCuisines) {
        // Supabase has nothing — upload local (first deploy, or sync lag).
        upsertProfilePreferences(userId, localPrefs).catch(() => {});
      } else if (localPrefs && remoteHasCuisines) {
        // Both exist — union to ensure neither side loses a preference.
        const mergedCuisines = [
          ...new Set([...localPrefs.cuisines, ...profile.favorite_cuisines]),
        ];
        const mergedDisliked = [
          ...new Set([...localPrefs.dislikedFoods, ...profile.dietary_restrictions]),
        ];

        const localChanged =
          mergedCuisines.length > localPrefs.cuisines.length ||
          mergedDisliked.length > localPrefs.dislikedFoods.length;

        if (localChanged) {
          // savePreferences writes to localStorage AND fires the Supabase sync.
          savePreferences({ ...localPrefs, cuisines: mergedCuisines, dislikedFoods: mergedDisliked });
        }
        // If local was already a superset of remote, nothing to do —
        // the next savePreferences call from onboarding/profile will keep Supabase current.
      }

      // ── Learned weights (TasteProfile) ───────────────────────────────────

      if (localTaste.interactionCount === 0 && remoteHasWeights) {
        // Local has nothing — restore from Supabase.
        writeLocalJSON(TASTE_KEY, profile.learned_weights);
      } else if (localTaste.interactionCount > 0 && !remoteHasWeights) {
        // Supabase has nothing — upload local.
        upsertLearnedWeights(userId, localTaste).catch(() => {});
      } else if (localTaste.interactionCount > 0 && remoteHasWeights) {
        // Both have data — merge with per-key max.
        const remoteTaste = profile.learned_weights as TasteProfile;
        const merged = mergeTasteProfiles(localTaste, remoteTaste);

        if (tasteProfileDiffersFrom(merged, localTaste)) {
          // Merged is richer than local — update both local and Supabase.
          writeLocalJSON(TASTE_KEY, merged);
          upsertLearnedWeights(userId, merged).catch(() => {});
        }
        // If local was already a superset, leave it alone. The next swipe
        // will keep Supabase current via the debounced sync in storage.ts.
      }

      // ── Recently seen meal IDs ────────────────────────────────────────────

      if (localSeenIds.length === 0 && remoteSeenIds.length > 0) {
        // Local has nothing — restore from Supabase as a single synthetic session.
        writeLocalJSON(SEEN_KEY, [
          { mealIds: remoteSeenIds, seenAt: new Date().toISOString() },
        ]);
      } else if (localSeenIds.length > 0 && remoteSeenIds.length === 0) {
        // Supabase has nothing — upload local.
        upsertRecentlySeen(userId, localSeenIds).catch(() => {});
      } else if (localSeenIds.length > 0 && remoteSeenIds.length > 0) {
        // Both have data — union, deduplicate, cap.
        const merged = [
          ...new Set([...localSeenIds, ...remoteSeenIds]),
        ].slice(0, MAX_SEEN_IDS);

        if (merged.length > localSeenIds.length) {
          // Remote had IDs local didn't know about — fold them into a single
          // synthetic session at the front so the recency logic sees them.
          writeLocalJSON(SEEN_KEY, [
            { mealIds: merged, seenAt: new Date().toISOString() },
          ]);
          upsertRecentlySeen(userId, merged).catch(() => {});
        }
        // If local was already a superset, leave it alone. recordSeenSession
        // in storage.ts keeps Supabase updated on the next deck build.
      }
    });
  }, []);

  return <>{children}</>;
}
