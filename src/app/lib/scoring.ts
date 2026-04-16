import { type Meal } from "../data/meals";
import { type UserPreferences, type HistoryEntry } from "./storage";

const PANTRY_FRIENDLY_TAGS = ["Easy", "Pantry staple", "No-cook option", "Meal-prep friendly"];
const QUICK_PANTRY_TAGS = ["15 min", "20 min", "25 min"];

export type RankedMeal = { meal: Meal; reason: string };

/**
 * Maps each meal ID to the cuisine(s) it belongs to.
 * Used to match against the user's preferred cuisines from onboarding.
 */
export const MEAL_CUISINES: Record<string, string[]> = {
  // Original 8
  "chicken-alfredo": ["Italian"],
  tacos: ["Mexican"],
  "sushi-bowl": ["Japanese", "Asian"],
  burgers: ["American"],
  "pasta-pomodoro": ["Italian"],
  "thai-curry": ["Asian"],
  "grain-bowl": ["Mediterranean"],
  "grilled-salmon": ["Mediterranean", "American"],
  // New 17
  "mac-and-cheese": ["American"],
  quesadillas: ["Mexican"],
  ramen: ["Japanese", "Asian"],
  "butter-chicken": ["Indian"],
  shakshuka: ["Middle Eastern", "Mediterranean"],
  "poke-bowl": ["Japanese", "Asian"],
  "margherita-pizza": ["Italian"],
  "fried-rice": ["Asian"],
  "falafel-wrap": ["Middle Eastern"],
  "ribeye-steak": ["American"],
  "chicken-stir-fry": ["Asian"],
  "mushroom-risotto": ["Italian"],
  "lamb-chops": ["Mediterranean"],
  chili: ["American"],
  "veggie-curry": ["Indian", "Asian"],
  "caesar-salad": ["American"],
  "bbq-chicken": ["American"],
};

/**
 * Score a single meal and return the most relevant reason to surface.
 *
 * Scores (additive):
 *   +3  cuisine match        — meal matches a preferred cuisine from onboarding
 *   +2  saved category       — user saved a meal in the same category
 *   +1  saved tag overlap    — meal shares ≥1 tag with any saved meal
 *   +2  spice match (hot)    — user likes hot food and meal is bold/flavorful
 *   +1  spice match (medium) — user is ok with heat and meal is bold/flavorful
 *   +1  adventurous boost    — no kids at table and meal is bold/fresh/elevated
 *   -3  recent history       — meal was chosen in the last 5 sessions
 *
 * Reason priority (first match wins):
 *   1. Cuisine match
 *   2. Saved category affinity
 *   3. Spice (hot) + bold category
 *   4. Saved tag overlap (quick / healthy / crowd / generic)
 *   5. Adventurous boost
 *   6. Spice (medium) + bold category
 *   7. Fallback → meal.whyItFits
 */
export function scoreMeal(
  meal: Meal,
  prefs: UserPreferences | null,
  savedMeals: Meal[],
  history: HistoryEntry[],
  pantryMode = false
): { score: number; reason: string } {
  let score = 0;
  let topReason: string | null = null;

  function setReason(r: string) {
    if (!topReason) topReason = r;
  }

  // ── Preference signals ────────────────────────────────────────────────────

  if (prefs) {
    // Cuisine match (+3) — highest reason priority
    const mealCuisines = MEAL_CUISINES[meal.id] ?? [];
    const matchedCuisine = mealCuisines.find((c) => prefs.cuisines.includes(c));
    if (matchedCuisine) {
      score += 3;
      setReason(`You listed ${matchedCuisine} as a favorite`);
    }

    // Spice / bold flavor match (+2 for hot, +1 for medium)
    const boldTerms = ["bold", "flavorful"];
    const isBold =
      boldTerms.some((t) => meal.category.toLowerCase().includes(t)) ||
      meal.tags.some((tag) => boldTerms.some((t) => tag.toLowerCase().includes(t)));

    if (isBold && (prefs.spiceLevel === "hot" || prefs.spiceLevel === "medium")) {
      score += prefs.spiceLevel === "hot" ? 2 : 1;
      // Reason set below, after saved signals, to respect priority order
    }

    // Adventurous boost — scored here, reason set later at lower priority
    if (prefs.kidFriendly === false) {
      const adventurousTerms = ["bold flavors", "fresh", "elevated"];
      if (adventurousTerms.some((t) => meal.category.toLowerCase().includes(t))) {
        score += 1;
      }
    }
  }

  // ── Behavioral signals ────────────────────────────────────────────────────

  // Saved category affinity (+2) — reason priority 2
  if (savedMeals.some((s) => s.category === meal.category)) {
    score += 2;
    setReason("Similar to meals you've saved");
  }

  // Saved tag overlap (+1) — reason priority 4
  const savedTagSet = new Set(savedMeals.flatMap((s) => s.tags));
  const matchingTags = meal.tags.filter((t) => savedTagSet.has(t));
  if (matchingTags.length > 0) {
    score += 1;
    const isQuick = matchingTags.some((t) =>
      ["easy", "15 min", "20 min", "25 min"].some((k) => t.toLowerCase().includes(k))
    );
    const isHealthy = matchingTags.some((t) =>
      ["nutritious", "light"].some((k) => t.toLowerCase().includes(k))
    );
    const isCrowd = matchingTags.some((t) =>
      ["kid-friendly", "crowd"].some((k) => t.toLowerCase().includes(k))
    );
    if (isQuick) setReason("Quick, like meals you tend to save");
    else if (isHealthy) setReason("On the lighter side, like your saves");
    else if (isCrowd) setReason("Crowd-pleasing, like your saves");
    else setReason("Fits your saved meal patterns");
  }

  // ── Deferred reason-setting for lower-priority preference signals ─────────

  if (prefs) {
    const boldTerms = ["bold", "flavorful"];
    const isBold =
      boldTerms.some((t) => meal.category.toLowerCase().includes(t)) ||
      meal.tags.some((tag) => boldTerms.some((t) => tag.toLowerCase().includes(t)));

    // Adventurous boost reason — priority 5
    if (prefs.kidFriendly === false) {
      const adventurousTerms = ["bold flavors", "fresh", "elevated"];
      if (adventurousTerms.some((t) => meal.category.toLowerCase().includes(t))) {
        setReason("A good pick for an adults-only table");
      }
    }

    // Spice (hot) reason — priority 3, after saved signals
    if (isBold && prefs.spiceLevel === "hot") {
      setReason("You're into bold flavors — this delivers");
    }

    // Spice (medium) reason — priority 6
    if (isBold && prefs.spiceLevel === "medium") {
      setReason("Fits your heat preference");
    }
  }

  // ── History penalty ───────────────────────────────────────────────────────

  const recentIds = new Set(history.slice(0, 5).map((h) => h.meal.id));
  if (recentIds.has(meal.id)) {
    score -= 3;
  }

  // ── Pantry mode boost + reason ────────────────────────────────────────────

  if (pantryMode) {
    const hasPantryTag = meal.tags.some((t) => PANTRY_FRIENDLY_TAGS.includes(t));
    const isQuick = meal.tags.some((t) => QUICK_PANTRY_TAGS.includes(t));
    if (hasPantryTag) score += 2;
    else if (isQuick) score += 1;

    if (meal.tags.includes("Pantry staple")) {
      setReason("Uses what you likely already have");
    } else if (hasPantryTag) {
      setReason("Good pantry-friendly option tonight");
    } else {
      setReason("Good for a pantry night");
    }
  }

  return { score, reason: topReason ?? meal.whyItFits };
}

/**
 * Score, sort, and lightly shuffle a list of meals.
 * Returns each meal paired with its personalized reason string.
 *
 * Meals within a 2-point score band are shuffled together so the top of the
 * deck rotates between sessions instead of always showing the same faces.
 * Call this once when a filter is selected — not on every render.
 */
export function rankMeals(
  meals: Meal[],
  prefs: UserPreferences | null,
  savedMeals: Meal[],
  history: HistoryEntry[],
  pantryMode = false
): RankedMeal[] {
  if (meals.length === 0) return [];

  // 1. Score every meal and carry the reason
  const scored = meals.map((meal) => {
    const { score, reason } = scoreMeal(meal, prefs, savedMeals, history, pantryMode);
    return { meal, score, reason };
  });

  // 2. Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // 3. Shuffle within 2-point bands so top results rotate between sessions
  const result: RankedMeal[] = [];
  let i = 0;

  while (i < scored.length) {
    const bandTop = scored[i].score;
    let j = i + 1;
    while (j < scored.length && bandTop - scored[j].score < 2) j++;

    // Fisher-Yates shuffle the band [i, j)
    const band = scored.slice(i, j);
    for (let k = band.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      [band[k], band[r]] = [band[r], band[k]];
    }

    result.push(...band.map((s) => ({ meal: s.meal, reason: s.reason })));
    i = j;
  }

  return result;
}
