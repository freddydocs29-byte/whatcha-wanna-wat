/**
 * Pantry ingredient ordering.
 *
 * Reads per-ingredient use counts from the profiles table and returns
 * three frequency tiers for reordering the ingredient selection sheet.
 * Never throws — returns empty tiers on any error so the caller can
 * fall back to the default category order silently.
 */

import { supabase } from "./supabase";

export type PantryIngredientTiers = {
  /** Used 3+ times — shown first */
  tier1: string[];
  /** Used 1–2 times — shown second */
  tier2: string[];
  /** Never used — shown last */
  tier3: string[];
};

const EMPTY_TIERS: PantryIngredientTiers = { tier1: [], tier2: [], tier3: [] };

/**
 * Returns frequency-ordered tiers for the given ingredient list.
 *
 * @param userId       The local UUID for this user.
 * @param allIngredients  Flat list of all selectable ingredients (display order
 *                     determines tie-breaking within each tier).
 */
export async function getPantryIngredientOrder(
  userId: string,
  allIngredients: string[],
): Promise<PantryIngredientTiers> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("pantry_ingredient_counts")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[pantry] read ingredient counts error:", error.message);
      return EMPTY_TIERS;
    }

    const counts = (data?.pantry_ingredient_counts as Record<string, number> | null) ?? {};
    if (Object.keys(counts).length === 0) return EMPTY_TIERS;

    const tier1: string[] = [];
    const tier2: string[] = [];
    const tier3: string[] = [];

    for (const ing of allIngredients) {
      const count = counts[ing] ?? 0;
      if (count >= 3) tier1.push(ing);
      else if (count >= 1) tier2.push(ing);
      else tier3.push(ing);
    }

    return { tier1, tier2, tier3 };
  } catch {
    return EMPTY_TIERS;
  }
}
