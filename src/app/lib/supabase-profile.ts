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
  /** Protein / ingredient hard NOs (No pork, No seafood, No beef, etc.) */
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
