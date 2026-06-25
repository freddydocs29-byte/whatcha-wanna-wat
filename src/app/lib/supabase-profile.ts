/**
 * Supabase profile service.
 *
 * All functions are fire-and-forget safe: they log errors but never throw.
 * Call them without await from synchronous storage helpers.
 */

import { supabase, type Profile, type SoftAvoid, type UserBehavioralSignals } from "./supabase";

// ─── Types (mirrored from storage.ts to avoid circular imports) ───────────────

type TasteProfile = {
  likedTags: Record<string, number>;
  dislikedTags: Record<string, number>;
  likedCategories: Record<string, number>;
  interactionCount: number;
};

type PreferenceFields = {
  cuisines: string[];
  /** Dietary constraints (Vegetarian, Vegan, Gluten-free, etc.) — stored separately from hard NOs. */
  dietaryRestrictions: string[];
  /**
   * Protein / ingredient hard NOs (No pork, No seafood, No beef, etc.) already merged
   * with allergen values by storage.savePreferences() before calling this function.
   */
  hardNoFoods: string[];
};

// ─── Fetch / create ───────────────────────────────────────────────────────────

/**
 * Returns the existing profile for `userId`, or inserts an empty one and
 * returns that. Returns null if Supabase is unavailable.
 */
export async function fetchOrCreateProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[profile] fetch error:", error.message);
      return null;
    }

    if (data) return data as Profile;

    // Not found by user_id — caller may have passed an auth UUID.
    // Check whether a profile already exists with this value as auth_user_id
    // before creating a ghost row keyed by the auth UUID.
    const authLinked = await fetchProfileByAuthUserId(userId);
    if (authLinked) return authLinked;

    // Profile doesn't exist yet — create an empty row.
    const { data: created, error: insertError } = await supabase
      .from("profiles")
      .insert({ user_id: userId })
      .select()
      .single();

    if (insertError) {
      console.error("[profile] create error:", insertError.message);
      return null;
    }

    return created as Profile;
  } catch (err) {
    console.error("[profile] unexpected error:", err);
    return null;
  }
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/**
 * Fetches a profile by Supabase Auth UUID.
 * Returns null if no profile is linked to that auth user yet.
 */
export async function fetchProfileByAuthUserId(authUserId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (error) {
      console.error("[profile] fetchProfileByAuthUserId error:", error.message);
      return null;
    }
    if (data) {
      console.log("[profile] found existing profile by auth_user_id:", authUserId, "→ user_id:", (data as Profile).user_id);
      return data as Profile;
    }
    console.log("[profile] no profile found for auth_user_id:", authUserId);
    return null;
  } catch (err) {
    console.error("[profile] unexpected fetchProfileByAuthUserId error:", err);
    return null;
  }
}

/**
 * Links a newly signed-up Supabase Auth user to their existing anonymous profile.
 * Only call this on NEW signups — not on returning sign-ins.
 *
 * Strategy:
 *   1. Check whether a profile already exists for this authUserId.
 *      If found, return it immediately — do NOT overwrite any anon profile.
 *   2. Otherwise, update the anon profile (by anonUserId) to attach auth_user_id,
 *      display_name, and email.
 *   3. If no anon profile row exists for anonUserId, insert a fresh one with
 *      both IDs and empty preference arrays.
 *
 * Returns the resolved profile, or null on error. Never throws.
 */
export async function linkAuthToProfile(
  authUserId: string,
  anonUserId: string,
  displayName?: string,
  email?: string,
): Promise<Profile | null> {
  try {
    // Step 1 — guard: a profile already exists for this auth account
    const existing = await fetchProfileByAuthUserId(authUserId);
    if (existing) {
      console.log("[profile] linkAuthToProfile: profile already linked, returning existing user_id:", existing.user_id);
      return existing;
    }

    // Step 2 — stamp auth_user_id (and optional meta) onto the anon profile
    const updates: Record<string, unknown> = {
      auth_user_id: authUserId,
      updated_at: new Date().toISOString(),
    };
    if (displayName) updates.display_name = displayName;
    if (email) updates.email = email;

    const { data: linked, error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", anonUserId)
      .select()
      .maybeSingle();

    if (updateError) {
      console.error("[profile] linkAuthToProfile update error:", updateError.message);
      return null;
    }

    if (linked) {
      console.log("[profile] linkAuthToProfile: linked anon profile", anonUserId, "→ auth_user_id", authUserId);
      return linked as Profile;
    }

    // Step 3 — anon profile row didn't exist yet; insert a complete new row
    const now = new Date().toISOString();
    const { data: created, error: insertError } = await supabase
      .from("profiles")
      .insert({
        user_id: anonUserId,
        auth_user_id: authUserId,
        display_name: displayName ?? null,
        email: email ?? null,
        favorite_cuisines: [],
        dietary_restrictions: [],
        hard_no_foods: [],
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[profile] linkAuthToProfile insert error:", insertError.message);
      return null;
    }

    console.log("[profile] linkAuthToProfile: created new profile for", anonUserId, "with auth_user_id", authUserId);
    return created as Profile;
  } catch (err) {
    console.error("[profile] unexpected linkAuthToProfile error:", err);
    return null;
  }
}

/**
 * Updates display_name and/or avatar_url for a profile row (keyed by user_id).
 * Pass only the fields you want to change.
 */
/**
 * Updates display_name and/or avatar_url for a profile row (keyed by user_id).
 * Pass only the fields you want to change.
 *
 * Returns true on success, false on any Supabase error.
 * The caller is responsible for surfacing failures to the user.
 */
export async function updateProfileMeta(
  userId: string,
  meta: { displayName?: string; avatarUrl?: string },
): Promise<boolean> {
  try {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (meta.displayName !== undefined) payload.display_name = meta.displayName;
    if (meta.avatarUrl !== undefined)   payload.avatar_url   = meta.avatarUrl;

    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("user_id", userId);

    if (error) {
      console.error("[profile] updateProfileMeta error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[profile] unexpected updateProfileMeta error:", err);
    return false;
  }
}

/**
 * Uploads an avatar image to the `avatars` Storage bucket and returns its public URL.
 * Path: avatars/{userId}/avatar.{ext}  — overwrites the previous avatar for this user.
 * Returns null on error.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      console.error("[avatar] upload error:", uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("[avatar] unexpected upload error:", err);
    return null;
  }
}

// ─── Upsert helpers ───────────────────────────────────────────────────────────

/**
 * Persists cuisine and dietary preference fields.
 * Called after onboarding or profile edits.
 */
export async function upsertProfilePreferences(
  userId: string,
  prefs: PreferenceFields,
): Promise<void> {
  try {
    const { error } = await supabase.from("profiles").upsert({
      user_id: userId,
      favorite_cuisines: prefs.cuisines,
      // dietary_restrictions and hard_no_foods are separate concepts — never write the same value to both.
      dietary_restrictions: prefs.dietaryRestrictions,
      hard_no_foods: prefs.hardNoFoods,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error("[profile] upsert prefs error:", error.message);
  } catch (err) {
    console.error("[profile] unexpected upsert prefs error:", err);
  }
}

/**
 * Persists novelty_bias from onboarding Step 3.
 * NOTE: requires a `novelty_bias float` column on the profiles table.
 * Run: ALTER TABLE profiles ADD COLUMN IF NOT EXISTS novelty_bias float;
 */
export async function upsertNoveltyBias(userId: string, value: number): Promise<void> {
  try {
    const { error } = await supabase.from("profiles").upsert({
      user_id: userId,
      novelty_bias: value,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error("[profile] upsert novelty_bias error:", error.message);
  } catch (err) {
    console.error("[profile] unexpected upsert novelty_bias error:", err);
  }
}

/**
 * Persists the full TasteProfile (learned weights from swipes).
 * Debounce before calling to avoid a Supabase write on every swipe.
 */
export async function upsertLearnedWeights(
  userId: string,
  tasteProfile: TasteProfile,
): Promise<void> {
  try {
    const { error } = await supabase.from("profiles").upsert({
      user_id: userId,
      learned_weights: tasteProfile,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error("[profile] upsert weights error:", error.message);
  } catch (err) {
    console.error("[profile] unexpected upsert weights error:", err);
  }
}

/**
 * Fetches the soft_avoids array for the given user.
 * Returns an empty array on any error so callers can treat it as safe.
 */
export async function fetchSoftAvoids(userId: string): Promise<SoftAvoid[]> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("soft_avoids")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("[profile] fetch soft_avoids error:", error.message);
      return [];
    }
    return (data?.soft_avoids as SoftAvoid[]) ?? [];
  } catch (err) {
    console.error("[profile] unexpected fetch soft_avoids error:", err);
    return [];
  }
}

/**
 * Persists the full soft_avoids array for the given user.
 * Fire-and-forget safe.
 */
export async function upsertSoftAvoids(
  userId: string,
  softAvoids: SoftAvoid[],
): Promise<void> {
  try {
    const { error } = await supabase.from("profiles").upsert({
      user_id: userId,
      soft_avoids: softAvoids,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error("[profile] upsert soft_avoids error:", error.message);
  } catch (err) {
    console.error("[profile] unexpected upsert soft_avoids error:", err);
  }
}

// ─── Behavioral signals ───────────────────────────────────────────────────────

type BehavioralSignalFields = {
  likedTags?: Record<string, number>;
  dislikedTags?: Record<string, number>;
  likedCategories?: Record<string, number>;
  recentlyChosen?: Array<{ meal_id: string; chosen_at: string }>;
};

/**
 * Upserts behavioral learning signals to user_behavioral_signals.
 * Only the fields provided are written — omitted fields are left untouched
 * via Supabase's upsert merge behaviour.
 */
export async function upsertBehavioralSignals(
  userId: string,
  signals: BehavioralSignalFields,
): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      user_id: userId,
      last_updated: new Date().toISOString(),
    };
    if (signals.likedTags !== undefined)      payload.liked_tags       = signals.likedTags;
    if (signals.dislikedTags !== undefined)   payload.disliked_tags    = signals.dislikedTags;
    if (signals.likedCategories !== undefined) payload.liked_categories = signals.likedCategories;
    if (signals.recentlyChosen !== undefined) payload.recently_chosen  = signals.recentlyChosen;

    const { error } = await supabase
      .from("user_behavioral_signals")
      .upsert(payload);
    if (error) console.error("[behavioral] upsert error:", error.message);
  } catch (err) {
    console.error("[behavioral] unexpected upsert error:", err);
  }
}

/**
 * Fetches behavioral signals for a list of user IDs.
 * Returns a map of userId → UserBehavioralSignals. Missing users are absent.
 */
export async function fetchBehavioralSignalsBatch(
  userIds: string[],
): Promise<Map<string, UserBehavioralSignals>> {
  const result = new Map<string, UserBehavioralSignals>();
  try {
    const { data, error } = await supabase
      .from("user_behavioral_signals")
      .select("user_id, liked_tags, disliked_tags, liked_categories, recently_chosen, last_updated")
      .in("user_id", userIds);
    if (error) {
      console.error("[behavioral] fetch error:", error.message);
      return result;
    }
    for (const row of data ?? []) {
      result.set(row.user_id, row as UserBehavioralSignals);
    }
  } catch (err) {
    console.error("[behavioral] unexpected fetch error:", err);
  }
  return result;
}

/**
 * Syncs the local taste profile and history into user_behavioral_signals.
 * Fire-and-forget — never throws, never blocks the user flow.
 */
export async function syncBehavioralSignalsToSupabase(userId: string): Promise<void> {
  // Step 1: upsert base signals from taste profile
  try {
    const local = localStorage.getItem("wwe_taste_profile");
    if (!local) return;

    const profile = JSON.parse(local) as {
      likedTags?: Record<string, number>;
      dislikedTags?: Record<string, number>;
      likedCategories?: Record<string, number>;
    };

    const { error } = await supabase
      .from("user_behavioral_signals")
      .upsert(
        {
          user_id: userId,
          liked_tags: profile.likedTags ?? {},
          disliked_tags: profile.dislikedTags ?? {},
          liked_categories: profile.likedCategories ?? {},
          recently_chosen: [],
          last_updated: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) console.warn("[sync] behavioral signals upsert failed:", error.message);
  } catch (err) {
    console.warn("[sync] behavioral signals upsert error:", err);
    return;
  }

  // Step 2: update recently_chosen from history (last 30 entries)
  try {
    const historyRaw = localStorage.getItem("wwe_history");
    const history = historyRaw
      ? (JSON.parse(historyRaw) as Array<{ meal: { id: string }; chosenAt: string }>)
      : [];

    const recentlyChosen = history.slice(-30).map((entry) => ({
      meal_id: entry.meal.id,
      chosen_at: entry.chosenAt,
    }));

    const { error } = await supabase
      .from("user_behavioral_signals")
      .update({
        recently_chosen: recentlyChosen,
        last_updated: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (error) console.warn("[sync] recently_chosen update failed:", error.message);
  } catch (err) {
    console.warn("[sync] recently_chosen update error:", err);
  }
}

/**
 * Persists (or clears) the last decided meal for the given user.
 * Pass null to clear the column.
 */
export async function upsertLastDecidedMeal(
  userId: string,
  mealData: object | null,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ last_decided_meal: mealData, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) throw error;
}

export type RecentlyShownEntry = { mealId: string; shownAt: string };

/**
 * Persists the flat list of recently-seen meal IDs for the recency penalty.
 * Called after each deck build.
 */
export async function upsertRecentlySeen(
  userId: string,
  mealIds: string[],
): Promise<void> {
  try {
    const { error } = await supabase.from("profiles").upsert({
      user_id: userId,
      recently_seen_meal_ids: mealIds,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error("[profile] upsert seen error:", error.message);
  } catch (err) {
    console.error("[profile] unexpected upsert seen error:", err);
  }
}

/**
 * Persists the timestamped impression log for hard exclusion in scoring.
 * Called after each deck build, alongside upsertRecentlySeen.
 */
export async function upsertRecentlyShown(
  userId: string,
  entries: RecentlyShownEntry[],
): Promise<void> {
  try {
    const { error } = await supabase.from("profiles").upsert({
      user_id: userId,
      recently_shown: entries,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error("[profile] upsert shown error:", error.message);
  } catch (err) {
    console.error("[profile] unexpected upsert shown error:", err);
  }
}

/**
 * Increments per-ingredient use counts in pantry_ingredient_counts.
 * Read-then-write (safe for solo users with no concurrent sessions).
 * Never throws — logs warning on error and returns silently.
 */
export async function upsertPantryIngredientCounts(
  userId: string,
  ingredients: string[],
): Promise<void> {
  if (ingredients.length === 0) return;
  try {
    const { data, error: readError } = await supabase
      .from("profiles")
      .select("pantry_ingredient_counts")
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) {
      console.warn("[profile] read pantry counts error:", readError.message);
      return;
    }
    const existing: Record<string, number> =
      (data?.pantry_ingredient_counts as Record<string, number>) ?? {};
    const merged = { ...existing };
    for (const ing of ingredients) {
      merged[ing] = (merged[ing] ?? 0) + 1;
    }
    const { error: writeError } = await supabase.from("profiles").upsert({
      user_id: userId,
      pantry_ingredient_counts: merged,
      updated_at: new Date().toISOString(),
    });
    if (writeError) console.warn("[profile] upsert pantry counts error:", writeError.message);
  } catch (err) {
    console.warn("[profile] unexpected pantry counts error:", err);
  }
}
