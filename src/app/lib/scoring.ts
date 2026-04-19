import { type Meal } from "../data/meals";
import { type UserPreferences, type HistoryEntry, type TasteProfile, type FlavorProfile } from "./storage";

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
  // Expansion 75
  "breakfast-burrito": ["American", "Mexican"],
  "avocado-toast": ["American"],
  "grilled-cheese": ["American"],
  "chicken-wrap": ["American"],
  "scrambled-eggs": ["American"],
  nachos: ["Mexican", "American"],
  "french-toast": ["American"],
  pancakes: ["American"],
  "veggie-wrap": ["Mediterranean"],
  "hot-dogs": ["American"],
  "bacon-egg-cheese": ["American"],
  "tuna-melt": ["American"],
  "loaded-fries": ["American"],
  "beef-stew": ["American"],
  "chicken-pot-pie": ["American"],
  meatloaf: ["American"],
  "chicken-noodle-soup": ["American"],
  "loaded-baked-potato": ["American"],
  "spaghetti-bolognese": ["Italian"],
  "potato-soup": ["American"],
  "french-onion-soup": ["French"],
  "shepherds-pie": ["American"],
  "chicken-casserole": ["American"],
  "korean-bbq-bowl": ["Korean", "Asian"],
  "tikka-masala": ["Indian"],
  "pad-thai": ["Asian"],
  "kung-pao-chicken": ["Asian"],
  "jerk-chicken": ["Caribbean"],
  bibimbap: ["Korean", "Asian"],
  "dan-dan-noodles": ["Asian"],
  "mango-curry": ["Indian", "Asian"],
  "spicy-miso-ramen": ["Japanese", "Asian"],
  "peri-peri-chicken": ["Mediterranean"],
  "teriyaki-salmon": ["Japanese", "Asian"],
  "lettuce-wrap-bowls": ["Asian"],
  "shrimp-stir-fry": ["Asian"],
  "lentil-soup": ["Mediterranean", "Middle Eastern"],
  "buddha-bowl": ["American", "Mediterranean"],
  "veggie-omelette": ["American", "Mediterranean"],
  "stuffed-peppers": ["American", "Mediterranean"],
  "baked-lemon-chicken": ["American", "Mediterranean"],
  "tuna-salad": ["American"],
  "black-bean-bowl": ["Mexican", "American"],
  "coq-au-vin": ["French"],
  "sea-bass": ["Mediterranean", "American"],
  "duck-breast": ["French"],
  "beef-tenderloin": ["American", "French"],
  "seared-scallops": ["American", "French"],
  "stuffed-mushrooms": ["Italian", "Mediterranean"],
  carbonara: ["Italian"],
  "beef-lasagna": ["Italian"],
  "chicken-piccata": ["Italian"],
  gnocchi: ["Italian"],
  "penne-arrabbiata": ["Italian"],
  bruschetta: ["Italian"],
  "greek-salad": ["Mediterranean"],
  "hummus-plate": ["Middle Eastern", "Mediterranean"],
  moussaka: ["Mediterranean"],
  tabbouleh: ["Middle Eastern", "Mediterranean"],
  "chicken-souvlaki": ["Mediterranean"],
  "spanish-tortilla": ["Mediterranean"],
  "vietnamese-spring-rolls": ["Asian"],
  "shrimp-ceviche": ["Mexican"],
  "caprese-salad": ["Italian"],
  "cold-sesame-noodles": ["Asian"],
  "mango-shrimp-bowl": ["Asian"],
  "nicoise-salad": ["French", "Mediterranean"],
  "pulled-pork-sandwich": ["American"],
  "chicken-wings": ["American"],
  "fish-tacos": ["Mexican", "American"],
  "sloppy-joes": ["American"],
  "chicken-tenders": ["American"],
  "breakfast-for-dinner": ["American"],
  "garlic-butter-shrimp": ["American", "Mediterranean"],
  "steak-frites": ["French", "American"],
};

/**
 * Score a single meal and return the most relevant reason to surface.
 *
 * Scores (additive):
 *   +3      cuisine match        — meal matches a preferred cuisine from onboarding
 *   +2      saved category       — user saved a meal in the same category
 *   +1      saved tag overlap    — meal shares ≥1 tag with any saved meal
 *   +2      spice match (hot)    — user likes hot food and meal is bold/flavorful
 *   +1      spice match (medium) — user is ok with heat and meal is bold/flavorful
 *   +1      adventurous boost    — no kids at table and meal is bold/fresh/elevated
 *   -4      recent history       — meal was chosen in the last 8 sessions
 *   -2.5    recently seen        — meal appeared in a deck in the last 3 sessions (but wasn't chosen)
 *
 * Taste profile signals (scale 0→1 over 20 interactions; zero effect early on):
 *   up to +2  liked tag boost    — meal tags overlap with tags from saved/chosen meals
 *   up to +1  liked category     — meal's category matches previously liked categories
 *   up to −1  disliked tag       — meal tags overlap with tags from passed meals
 *
 * Full Flavor Profile signals (explicit stated preferences; active when set):
 *   ±1        adventurousness    — adventurous/familiar preference vs meal category
 *   +1.5/−0.5 time available     — quick pref boosts ≤20min meals; penalizes slow ones
 *   +1.5/−0.5 energy level       — low energy boosts easy meals; penalizes high-effort
 *   +1/−0.5   budget sensitivity — frugal/generous vs pantry vs Elegant/Elevated meals
 *   +1/−0.5   cooking confidence — beginner/confident vs Easy vs Elevated meals
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
  pantryMode = false,
  tasteProfile?: TasteProfile,
  recentlySeen?: Set<string>,
  flavorProfile?: FlavorProfile,
  favorites: Meal[] = [],
  selectedIngredients: string[] = []
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

  // Favorites signals — stronger than saved; checked first so reason priority is higher
  // +4 for category match, +2 for tag overlap (vs saved's +2 / +1), capped at +5 total
  if (favorites.length > 0) {
    let favBoost = 0;
    if (favorites.some((f) => f.category === meal.category)) {
      favBoost += 4;
      setReason("Similar to meals you love");
    }
    const favTagSet = new Set(favorites.flatMap((f) => f.tags));
    if (meal.tags.some((t) => favTagSet.has(t))) {
      favBoost += 2;
      setReason("Similar to meals you love");
    }
    score += Math.min(5, favBoost);
  }

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

  // ── Taste profile signals (learned behavior) ─────────────────────────────
  //
  // Influence scales from 0 → 1 over 20 interactions so onboarding signals
  // dominate early and learned behavior gradually gains weight.

  if (tasteProfile && tasteProfile.interactionCount > 0) {
    const behaviorScale = Math.min(1, tasteProfile.interactionCount / 20);

    // Liked tag boost: +1 per matching tag, capped at +2
    const likedTagMatches = meal.tags.filter(
      (t) => (tasteProfile.likedTags[t] ?? 0) > 0
    ).length;
    score += Math.min(2, likedTagMatches) * behaviorScale;

    // Liked category boost: +1 if this category appeared in saves/chooses
    if ((tasteProfile.likedCategories[meal.category] ?? 0) > 0) {
      score += 1 * behaviorScale;
    }

    // Disliked tag penalty: −1 per matching tag, floored at −1
    const dislikedTagMatches = meal.tags.filter(
      (t) => (tasteProfile.dislikedTags[t] ?? 0) > 0
    ).length;
    score += Math.max(-1, -dislikedTagMatches) * behaviorScale;
  }

  // ── Full Flavor Profile signals ───────────────────────────────────────────
  //
  // Explicit stated preferences from the optional deeper flow.
  // Each dimension is an independent modifier; setReason() only fires if no
  // higher-priority reason has been set yet (time/energy supply fallback context).

  if (flavorProfile) {
    const cat = meal.category.toLowerCase();
    const hasTags = (...ts: string[]) => ts.some((t) => meal.tags.includes(t));
    const mealMinutes = (() => {
      for (const tag of meal.tags) {
        const m = tag.match(/^(\d+)\s*min$/i);
        if (m) return parseInt(m[1]);
      }
      return null;
    })();

    // Adventurousness
    const isAdventurous = ["bold flavors", "fresh", "elevated", "mediterranean"].some((c) => cat.includes(c));
    const isFamiliar = ["comfort food", "classic italian", "crowd pleaser", "quick & casual"].some((c) => cat.includes(c));

    if (flavorProfile.adventurousness === "adventurous" && isAdventurous) {
      score += 1;
      setReason("A good pick for an adventurous night");
    } else if (flavorProfile.adventurousness === "familiar") {
      if (isFamiliar) score += 1;
      if (isAdventurous) score -= 0.5;
    }

    // Time available
    const isVeryQuick = hasTags("No-cook option") || (mealMinutes !== null && mealMinutes <= 20);
    const isSlow = hasTags("Medium effort") || (mealMinutes !== null && mealMinutes >= 35);

    if (flavorProfile.timeAvailable === "quick") {
      if (isVeryQuick) {
        score += 1.5;
        setReason("Quick, for when time is tight");
      } else if (isSlow) score -= 0.5;
    } else if (flavorProfile.timeAvailable === "relaxed") {
      if (cat.includes("elevated") || hasTags("Elegant", "Medium effort")) score += 1;
    }

    // Energy level
    const isLowEffort = hasTags("Easy", "No-cook option", "Pantry staple") ||
      ["comfort food", "quick & casual"].some((c) => cat.includes(c));

    if (flavorProfile.energyLevel === "low") {
      if (isLowEffort) {
        score += 1.5;
        setReason("Easy enough for a low-energy night");
      }
      if (isSlow) score -= 0.5;
    } else if (flavorProfile.energyLevel === "high") {
      if (cat.includes("elevated") || hasTags("Medium effort")) score += 1;
    }

    // Budget sensitivity
    const isPremium = hasTags("Elegant") || cat.includes("elevated");
    const isBudgetFriendly = hasTags("Pantry staple") ||
      ["quick & casual", "classic italian", "comfort food"].some((c) => cat.includes(c));

    if (flavorProfile.budgetSensitivity === "frugal") {
      if (isBudgetFriendly) score += 1;
      if (isPremium) score -= 0.5;
    } else if (flavorProfile.budgetSensitivity === "generous") {
      if (isPremium) score += 1;
    }

    // Cooking confidence
    if (flavorProfile.cookingConfidence === "beginner") {
      if (hasTags("Easy")) score += 1;
      if (cat.includes("elevated") || hasTags("Medium effort")) score -= 0.5;
    } else if (flavorProfile.cookingConfidence === "confident") {
      if (cat.includes("elevated")) score += 1;
      if (hasTags("Medium effort")) score += 0.5;
    }
  }

  // ── History / seen penalties ──────────────────────────────────────────────
  //
  // Chosen meals get -4 to strongly suppress recently-eaten meals.
  // Looking back 8 entries ensures suppression lasts several sessions, not
  // just the next visit. Meals shown but not chosen get -2.5 so they rotate
  // out meaningfully — strong enough to break the "same 5 meals" cycle.

  const recentChosenIds = new Set(history.slice(0, 8).map((h) => h.meal.id));
  if (recentChosenIds.has(meal.id)) {
    score -= 4;
  } else if (recentlySeen?.has(meal.id)) {
    score -= 2.5;
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

  // ── Ingredient boost ──────────────────────────────────────────────────────
  if (selectedIngredients.length > 0 && meal.ingredients) {
    let pantryScore = 0;
    let matchCount = 0;
    for (const ing of selectedIngredients) {
      if (meal.ingredients.includes(ing)) {
        pantryScore += 2;
        matchCount++;
      }
    }
    if (matchCount >= 2) pantryScore += 2;
    score += Math.min(pantryScore, 6);
  }

  return { score, reason: topReason ?? meal.whyItFits };
}

/**
 * Score, sort, and present a list of meals with controlled variety.
 *
 * Algorithm:
 *   1. Score every meal (personalization + freshness penalties).
 *   2. Sort all meals descending by score — no hard pool cap.
 *   3. Shuffle within 1-point score bands so the deck order feels fresh each
 *      session without reordering clearly better matches above worse ones.
 *   4. Spread by cuisine: walk the shuffled list and, whenever the same
 *      cuisine has appeared twice in the last 4 slots, pull forward the next
 *      eligible meal from a different cuisine. This prevents 3+ same-cuisine
 *      meals running back-to-back while keeping the best match in each
 *      cuisine near the front.
 *
 * The result is smart and personal — preferences, favorites, and learned
 * behavior all drive scores — but the deck surfaces a broader range of
 * strong options rather than letting the same few dominate every pass.
 *
 * Call this once when a filter is selected — not on every render.
 */
export function rankMeals(
  meals: Meal[],
  prefs: UserPreferences | null,
  savedMeals: Meal[],
  history: HistoryEntry[],
  pantryMode = false,
  tasteProfile?: TasteProfile,
  recentlySeen?: Set<string>,
  flavorProfile?: FlavorProfile,
  favorites: Meal[] = [],
  selectedIngredients: string[] = []
): RankedMeal[] {
  if (meals.length === 0) return [];

  // 1. Score every meal
  const scored = meals.map((meal) => {
    const { score, reason } = scoreMeal(
      meal, prefs, savedMeals, history, pantryMode, tasteProfile, recentlySeen, flavorProfile, favorites, selectedIngredients
    );
    return { meal, score, reason };
  });

  // 2. Sort by score descending — all meals ranked, no artificial cutoff
  scored.sort((a, b) => b.score - a.score);

  // 3. Shuffle within 1-point score bands to vary the deck each session
  const shuffled = bandShuffle(scored);

  // 4. Spread cuisines so no single cuisine dominates consecutive slots
  const diversified = spreadByCuisine(shuffled);

  return diversified.map((s) => ({ meal: s.meal, reason: s.reason }));
}

/**
 * Within each 1-point score band, randomly reorder meals.
 * A meal scoring 7.6 will still appear before a meal scoring 5.1,
 * but two meals both scoring ~7.x may swap positions each session.
 * This creates session-to-session variety without overriding genuine differences.
 */
function bandShuffle<T extends { score: number }>(sorted: T[]): T[] {
  if (sorted.length === 0) return sorted;

  const BAND_SIZE = 1.0;
  const result: T[] = [];
  let i = 0;

  while (i < sorted.length) {
    const bandTop = sorted[i].score;
    const bandFloor = bandTop - BAND_SIZE;

    const band: T[] = [];
    while (i < sorted.length && sorted[i].score > bandFloor) {
      band.push(sorted[i]);
      i++;
    }

    // Fisher-Yates shuffle within this score band
    for (let k = band.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      [band[k], band[r]] = [band[r], band[k]];
    }

    result.push(...band);
  }

  return result;
}

/**
 * Reorders meals so no cuisine appears more than twice in any 4-slot window.
 *
 * When the top candidate would violate the window constraint, the function
 * scans forward for the next highest-scoring meal from an eligible cuisine
 * and promotes it. This preserves intent — the best Italian meal still
 * comes before the second-best Italian meal — but breaks up same-cuisine
 * runs so the deck surfaces broader variety from the full meal pool.
 *
 * If every cuisine in the remaining list is window-saturated (edge case with
 * a very small or same-cuisine pool), falls back to score order.
 */
function spreadByCuisine<T extends { meal: Meal }>(sorted: T[]): T[] {
  if (sorted.length <= 3) return sorted;

  const primaryCuisine = (meal: Meal): string =>
    MEAL_CUISINES[meal.id]?.[0] ?? "Other";

  const result: T[] = [];
  const remaining = [...sorted];
  const recentCuisines: string[] = [];

  const WINDOW = 4;
  const MAX_SAME = 2;

  while (remaining.length > 0) {
    let pickedIdx = 0;

    const bestCuisine = primaryCuisine(remaining[0].meal);
    const recentSameCount = recentCuisines
      .slice(-WINDOW)
      .filter((c) => c === bestCuisine).length;

    if (recentSameCount >= MAX_SAME) {
      // Best candidate would create a same-cuisine run — find the next eligible
      for (let i = 1; i < remaining.length; i++) {
        const cuisine = primaryCuisine(remaining[i].meal);
        const sameCount = recentCuisines
          .slice(-WINDOW)
          .filter((c) => c === cuisine).length;
        if (sameCount < MAX_SAME) {
          pickedIdx = i;
          break;
        }
      }
      // If nothing is eligible, pickedIdx stays 0 (score order wins)
    }

    const [chosen] = remaining.splice(pickedIdx, 1);
    result.push(chosen);
    recentCuisines.push(primaryCuisine(chosen.meal));
  }

  return result;
}
