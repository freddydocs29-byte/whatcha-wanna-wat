import { type Meal } from "../data/meals";
import { type UserPreferences, type HistoryEntry, type TasteProfile, type FlavorProfile } from "./storage";
import { type SoftAvoid } from "./supabase";
import { type SessionContext } from "./session-tracking";

/**
 * Rich context stored with each rejection reason. Captures which meal was on
 * screen when the rejection sheet fired so downstream scoring can apply
 * category/cuisine/tag-level penalties specific to that meal.
 */
export type RejectionEntry = {
  reason: string;        // "too_heavy" | "had_recently" | "not_feeling_it" | "missing_ingredients"
  mealId: string;
  category: string;
  cuisine: string[];
  tags: string[];
};

const PANTRY_FRIENDLY_TAGS = ["Easy", "Pantry staple", "No-cook option", "Meal-prep friendly"];
const QUICK_PANTRY_TAGS = ["15 min", "20 min", "25 min"];

export type RankedMeal = { meal: Meal; reason: string };
export type WhoFor = "solo" | "partner" | "family";
export type SessionCookMode = "cook" | "order" | "either";
export type SessionVibeMode = "mix-it-up" | "comfort-food" | "quick-easy" | "healthy" | "something-new" | "kid-friendly";

/**
 * Minimal profile data needed to score meals for one participant in a shared
 * session. Constructed from their Supabase profile row — no localStorage data
 * required so it works without the user being on the same device.
 */
export type UserProfileForScoring = {
  cuisines: string[];
  learnedWeights: TasteProfile | null;
  recentlySeen: Set<string>;
};

// ── Hard gate ─────────────────────────────────────────────────────────────────
//
// Keyword lists for each user-facing hard-NO category.
// Matching runs case-insensitively against the combined text of:
//   meal.id  +  meal.name  +  meal.ingredients (if present)
//
// Rules of thumb:
//   • Use the most specific substring that reliably identifies the ingredient.
//   • Ingredient-field matches cover ambiguous meals (e.g. "caesar-salad" has
//     "Chicken" in its ingredient list even though "chicken" isn't in the ID).
//   • ID/name keywords catch meals whose ingredient list is absent or sparse.

const HARD_NO_KEYWORDS: Record<string, string[]> = {
  Beef: [
    "beef", "steak", "burger", "meatloaf", "meatball",
    "bolognese", "ribeye", "rendang", "bourguignon", "veal",
    "osso buco", "birria", "pot roast", "cheesesteak", "sloppy joe",
    "brisket", "ground beef",
  ],
  Pork: [
    "pork", "bacon", "ham", "sausage", "pepperoni", "ribs",
    "hot dog", "prosciutto", "pancetta", "chorizo", "pig",
    "salami", "mortadella",
  ],
  Seafood: [
    "seafood", "fish", "shrimp", "salmon", "tuna", "crab", "lobster",
    "scallop", "cod", "tilapia", "halibut", "sardine", "anchovy",
    "sushi", "poke", "prawn", "clam", "oyster", "mussel", "squid",
    "octopus", "lox", "sea bass", "ceviche", "nicoise",
  ],
  Chicken: [
    "chicken", "poultry", "coq",
  ],
  Dairy: [
    "cheese", "butter", "cream", "milk", "yogurt",
    "ricotta", "mozzarella", "parmesan", "alfredo", "cheddar",
  ],
  "Gluten / Pasta": [
    "pasta", "noodle", "spaghetti", "linguine", "penne", "fettuccine",
    "lasagna", "gnocchi", "ravioli", "ramen", "udon", "soba",
    "couscous", "dumpling", "wonton", "gyoza", "pizza",
    "focaccia", "bread", "toast", "sandwich", "sub", "bagel",
    "tortilla", "burrito", "taco", "waffle", "pancake",
    "flatbread", "bun", "roll", "biscuit", "pita", "wrap",
  ],
};

/** Returns true if this meal should be removed for the given hard-NO category. */
function mealViolatesHardNO(meal: Meal, dislikedFoods: string[]): boolean {
  if (dislikedFoods.length === 0) return false;
  const searchText = [
    meal.id,
    meal.name,
    ...(meal.ingredients ?? []),
  ].join(" ").toLowerCase();

  return dislikedFoods.some((category) => {
    const keywords = HARD_NO_KEYWORDS[category];
    return keywords?.some((kw) => searchText.includes(kw)) ?? false;
  });
}

// ── Time-of-day gate ─────────────────────────────────────────────────────────
//
// Meals in BREAKFAST_ONLY_IDS are considered strictly breakfast/brunch and are
// excluded from evening and night-time decks.
//
// Buckets:
//   morning   5:00 – 14:59  (breakfast welcome)
//   dinner   15:00 –  4:59  (breakfast-only meals excluded)
//
// Flexible egg dishes (avocado toast, frittata, shakshuka, scrambled eggs,
// omelette, egg cups, turkish eggs) are intentionally NOT in this list — they
// are reasonable at any meal.  "Breakfast for Dinner" is also excluded by
// design: its name signals it is intended for evening eating.

const BREAKFAST_ONLY_IDS = new Set([
  "breakfast-burrito",
  "french-toast",
  "pancakes",
  "bacon-egg-cheese",
  "breakfast-hash",
  "waffles",
  "biscuits-gravy",
  "hash-browns",
]);

/**
 * Returns "morning" (5 am – 3 pm) or "dinner" (3 pm – 5 am).
 * Pass hourOverride (0-23) in tests to avoid depending on wall-clock time.
 */
export function getTimeBucket(hourOverride?: number): "morning" | "dinner" {
  const hour = hourOverride ?? new Date().getHours();
  return hour >= 5 && hour < 15 ? "morning" : "dinner";
}

/**
 * Hard gate — removes every meal that violates any of the user's hard-NO
 * food categories, and removes breakfast-only meals during evening/night hours.
 * Must be called BEFORE scoring so excluded meals never appear anywhere in the
 * deck.
 *
 * Fields read: meal.id, meal.name, meal.ingredients
 * Enforces:    UserPreferences.dislikedFoods + current time of day
 *
 * Shared-mode usage: call with the UNION of both users' dislikedFoods so
 * that a meal is excluded if EITHER participant has it as a hard NO.
 *
 * hourOverride (0-23) is accepted for testing; omit in production code.
 */
export function hardGate(meals: Meal[], dislikedFoods: string[], hourOverride?: number): Meal[] {
  const timeBucket = getTimeBucket(hourOverride);

  let filtered = meals.filter((m) => {
    // Time gate: exclude breakfast-only meals during dinner hours
    if (timeBucket === "dinner" && BREAKFAST_ONLY_IDS.has(m.id)) return false;
    // Dietary hard NOs
    if (dislikedFoods.length > 0 && mealViolatesHardNO(m, dislikedFoods)) return false;
    return true;
  });

  if (process.env.NODE_ENV === "development") {
    const removed = meals.length - filtered.length;
    if (removed > 0) {
      console.log(
        `[hardGate] removed ${removed} of ${meals.length} meals` +
        ` · hard NOs: [${dislikedFoods.join(", ")}] · time bucket: ${timeBucket}`
      );
    }
  }
  return filtered;
}

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
  // Expansion 100
  "blt-sandwich": ["American"],
  "club-sandwich": ["American"],
  "breakfast-hash": ["American"],
  waffles: ["American"],
  "mini-pizzas": ["Italian", "American"],
  cheesesteak: ["American"],
  "egg-salad-sandwich": ["American"],
  "chicken-salad-wrap": ["American"],
  "bagel-lox": ["American"],
  "hash-browns": ["American"],
  "miso-rice": ["Japanese", "Asian"],
  congee: ["Asian"],
  "pan-fried-gyoza": ["Japanese", "Asian"],
  "tomato-soup": ["American"],
  "pot-roast": ["American"],
  "chicken-dumplings": ["American"],
  "biscuits-gravy": ["American"],
  "beef-vegetable-soup": ["American"],
  "tuna-noodle": ["American"],
  "stuffed-cabbage": ["American"],
  "corn-chowder": ["American"],
  "sausage-pasta": ["Italian", "American"],
  "broccoli-cheddar-soup": ["American"],
  "white-bean-soup": ["Italian", "American"],
  "red-beans-rice": ["American"],
  "szechuan-beef": ["Asian"],
  "moroccan-chicken": ["Mediterranean"],
  "massaman-curry": ["Asian"],
  "birria-tacos": ["Mexican"],
  "beef-pho": ["Asian"],
  "drunken-noodles": ["Asian"],
  "harissa-chicken": ["Mediterranean"],
  "chipotle-bowl": ["Mexican", "American"],
  "mapo-beef": ["Asian"],
  "lamb-shawarma": ["Middle Eastern", "Mediterranean"],
  "chicken-mole": ["Mexican"],
  "green-shakshuka": ["Middle Eastern", "Mediterranean"],
  "beef-rendang": ["Asian"],
  "tamarind-shrimp": ["Asian"],
  "detox-chicken-soup": ["American"],
  "veggie-stir-fry": ["Asian"],
  "kale-chickpea-salad": ["Mediterranean", "American"],
  "salmon-tacos": ["Mexican", "American"],
  "chickpea-spinach-soup": ["Mediterranean"],
  "shrimp-avocado-bowl": ["American"],
  "roasted-veggie-bowl": ["American", "Mediterranean"],
  "spinach-egg-cups": ["American"],
  "tuna-rice-bowl": ["American"],
  "baked-salmon-veg": ["American"],
  "white-chicken-chili": ["American"],
  "avocado-chicken-salad": ["American"],
  "poached-eggs-toast": ["American"],
  "spinach-frittata": ["Italian", "Mediterranean"],
  "shrimp-scampi": ["Italian", "American"],
  "beef-bourguignon": ["French"],
  "pan-seared-fish": ["American", "French"],
  "chicken-marsala": ["Italian"],
  "seafood-linguine": ["Italian"],
  "steak-au-poivre": ["French"],
  "shrimp-bisque": ["French", "American"],
  "rack-of-lamb": ["Mediterranean", "French"],
  "truffle-pasta": ["Italian"],
  "seafood-cakes": ["American"],
  "cacio-e-pepe": ["Italian"],
  "pasta-amatriciana": ["Italian"],
  "osso-buco": ["Italian"],
  puttanesca: ["Italian"],
  minestrone: ["Italian"],
  saltimbocca: ["Italian"],
  "cheese-ravioli": ["Italian"],
  "focaccia-bread": ["Italian"],
  fattoush: ["Middle Eastern", "Mediterranean"],
  mujaddara: ["Middle Eastern", "Mediterranean"],
  "baba-ghanoush": ["Middle Eastern", "Mediterranean"],
  "foul-medames": ["Middle Eastern", "Mediterranean"],
  sabich: ["Middle Eastern", "Mediterranean"],
  "turkish-eggs": ["Mediterranean"],
  lahmacun: ["Mediterranean"],
  spanakopita: ["Mediterranean"],
  "banh-mi": ["Asian"],
  "prawn-cocktail": ["American"],
  gazpacho: ["Mediterranean"],
  "smoked-salmon-plate": ["American"],
  "gado-gado": ["Asian"],
  "cold-soba": ["Japanese", "Asian"],
  "thai-larb": ["Asian"],
  "cobb-salad": ["American"],
  "mushroom-spinach-salad": ["American", "Mediterranean"],
  "cold-noodle-salad": ["Asian"],
  sliders: ["American"],
  "pizza-rolls": ["Italian", "American"],
  "corn-dogs": ["American"],
  "bbq-ribs": ["American"],
  "chicken-parmesan": ["Italian", "American"],
  "meatball-subs": ["Italian", "American"],
  "buffalo-chicken-dip": ["American"],
  "southern-fried-chicken": ["American"],
  "shrimp-boil": ["American"],
  "fried-chicken-sandwich": ["American"],
  "pigs-in-blankets": ["American"],
};

/**
 * Score a single meal and return the most relevant reason to surface.
 *
 * Scores (additive):
 *   +2      cuisine match        — meal matches a preferred cuisine from onboarding (was +4)
 *   +2      saved category       — user saved a meal in the same category
 *   +1      saved tag overlap    — meal shares ≥1 tag with any saved meal
 *   +2      spice match (hot)    — user likes hot food and meal is bold/flavorful
 *   +1      spice match (medium) — user is ok with heat and meal is bold/flavorful
 *   +1      adventurous boost    — no kids at table and meal is bold/fresh/elevated
 *
 * Recency penalties (time-based; highest-priority signal):
 *   -5.0    chosen < 2 days ago
 *   -3.0    chosen < 7 days ago
 *   -1.0    chosen < 30 days ago
 *    0      chosen ≥ 30 days ago
 *   -2.5    recently seen        — meal appeared in a deck in the last 3 sessions (not chosen)
 *   -1.5    session shown        — meal was the active card during this visit (in-memory only)
 *
 * Taste profile signals (scale 0→1 over 8 interactions; activates quickly):
 *   up to +4.0 liked tag boost    — meal tags overlap with tags from saved/chosen meals (was +3)
 *   up to +2.0 liked category     — meal's category matches previously liked categories (was +1.5)
 *   up to −1.5 disliked tag       — meal tags overlap with tags from passed meals
 *
 * Full Flavor Profile signals (explicit stated preferences; active when set):
 *   ±1        adventurousness    — adventurous/familiar preference vs meal category
 *   +1.5/−0.5 time available     — quick pref boosts ≤20min meals; penalizes slow ones
 *   +1.5/−0.5 energy level       — low energy boosts easy meals; penalizes high-effort
 *   +1/−0.5   budget sensitivity — frugal/generous vs pantry vs Elegant/Elevated meals
 *   +1/−0.5   cooking confidence — beginner/confident vs Easy vs Elevated meals
 *
 * Context signals (who the meal is for; stacks with other signals):
 *   Family:  +2.5 kid-friendly/crowd-pleaser, +1.5 quick/easy, +1 comfort, −1.5 bold/elevated
 *   Partner: +1 comfort, −0.75 bold/elevated
 *   Solo:    baseline (no adjustments)
 *
 * Vibe / session nudge (lowest priority — scaled ×0.6 from raw; tracked separately as vibeScore):
 *   Max boost per meal: +0.9 pts (healthy, kid-friendly); +0.6 pts (comfort-food, quick-easy, something-new)
 *   Max penalty:        −0.6 pts (kid-friendly · bold meals)
 *   Guardrail: capped at +0.25 if pre-vibe score < 1.0 (weak-match protection)
 *
 *   comfort-food:   +1.0 comfort-food cat / +0.65 crowd-pleaser/indulgent / +0.35 classic-italian/kid;
 *                   −0.5 light/healthy/fresh, −0.25 elevated
 *   quick-easy:     +1.0 ≤20 min or no-cook / +0.5 25 min / +0.4 Easy;
 *                   −0.5 slow (≥40 min / medium effort), −0.25 35 min
 *   healthy:        base +1.0 Healthy cat / +0.75 Fresh cat / +0.4 Mediterranean;
 *                   additive (total capped at +1.5): +0.5 Nutritious / +0.35 Light / +0.25 Protein-packed or Veg;
 *                   −0.75 heavy/indulgent
 *   something-new:  +1.0 bold-flavors cat / +0.75 elevated / +0.5 mediterranean-fresh / +0.35 Flavorful;
 *                   −0.5 comfort/casual, −0.35 Kid-friendly/Crowd-pleaser
 *   kid-friendly:   +1.5 Kid-friendly tag / +1.0 Crowd pleaser / +0.6 comfort-food cat / +0.35 quick-casual;
 *                   −1.0 bold-flavors, −0.5 elevated/Flavorful
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
  selectedIngredients: string[] = [],
  context: WhoFor = "solo",
  sessionShown: Set<string> = new Set(),
  vibe: string | null = null,
  cookMode: SessionCookMode = "either",
  sessionVibeMode: SessionVibeMode = "mix-it-up"
): { score: number; reason: string; vibeScore: number; behaviorScore: number } {
  let score = 0;
  let vibeScore = 0;    // tracks session-selector contribution for dev logging
  let behaviorScore = 0; // tracks learned-behavior contribution for dev logging
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
      score += 2.0;
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
    // Scale reaches 1.0 at 8 interactions — learned behavior activates quickly so
    // real signals dominate onboarding defaults within the first session or two.
    const behaviorScale = Math.min(1, tasteProfile.interactionCount / 8);

    // Liked tag boost: +1 per matching tag, capped at +4.0
    const likedTagMatches = meal.tags.filter(
      (t) => (tasteProfile.likedTags[t] ?? 0) > 0
    ).length;
    const tagBoost = Math.min(4.0, likedTagMatches) * behaviorScale;
    score += tagBoost;
    behaviorScore += tagBoost;

    // Liked category boost: +2.0 if this category appeared in saves/chooses
    const likesCategory = (tasteProfile.likedCategories[meal.category] ?? 0) > 0;
    if (likesCategory) {
      const catBoost = 2.0 * behaviorScale;
      score += catBoost;
      behaviorScore += catBoost;
    }

    // Disliked tag penalty: floored at −1.5 (was −1) for stronger avoidance signal
    const dislikedTagMatches = meal.tags.filter(
      (t) => (tasteProfile.dislikedTags[t] ?? 0) > 0
    ).length;
    const dislikedPenalty = Math.max(-1.5, -dislikedTagMatches) * behaviorScale;
    score += dislikedPenalty;
    behaviorScore += dislikedPenalty;

    // Learned behavior reason — fires only if no stronger reason has been set yet
    if (likedTagMatches > 0) setReason("You've liked similar meals");
    else if (likesCategory) setReason("Fits your usual choices");
  }

  // ── Full Flavor Profile signals ───────────────────────────────────────────
  //
  // Explicit stated preferences from the optional deeper flow.
  // Each dimension is an independent modifier; setReason() only fires if no
  // higher-priority reason has been set yet (time/energy supply fallback context).

  // Computed once here; reused by both FlavorProfile and Vibe sections below.
  const mealMinutes = (() => {
    for (const tag of meal.tags) {
      const m = tag.match(/^(\d+)\s*min$/i);
      if (m) return parseInt(m[1]);
    }
    return null;
  })();

  if (flavorProfile) {
    const cat = meal.category.toLowerCase();
    const hasTags = (...ts: string[]) => ts.some((t) => meal.tags.includes(t));

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

  // ── Recency penalties (highest-priority signal) ───────────────────────────
  //
  // Time-based decay: meals eaten very recently get a heavy penalty that
  // fades as time passes. After 30 days there is no penalty at all.
  // This is the strongest single signal — it overrides preference matching.
  //
  //   < 2 days  → -5.0  (just had it — strongly suppress)
  //   < 7 days  → -3.0  (had it this week)
  //   < 30 days → -1.0  (ate it recently but not fresh in memory)
  //   ≥ 30 days →  0    (fair game again)
  //
  // Meals shown but not chosen get -2.5 so they rotate out meaningfully.
  // Session-shown (this visit only) gets -1.5 as a soft shuffle signal.

  const recentEntry = history.find((h) => h.meal.id === meal.id);
  if (recentEntry) {
    const daysAgo = (Date.now() - new Date(recentEntry.chosenAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo < 2) {
      score -= 5.0;
    } else if (daysAgo < 7) {
      score -= 3.0;
    } else if (daysAgo < 30) {
      score -= 1.0;
    }
    // ≥ 30 days: no penalty
  } else if (recentlySeen?.has(meal.id)) {
    score -= 2.5;
  } else if (sessionShown.has(meal.id)) {
    // Soft penalty for meals already shown as the active card this session.
    // Lighter than cross-session suppression (-2.5) so strong matches can
    // still surface, but meaningful enough to push repeated cards down a band.
    score -= 1.5;
  }

  // ── Pantry mode boost + reason ────────────────────────────────────────────
  // Only activate when the user has actually selected ingredients — toggling
  // pantry on with an empty selection should leave the deck unchanged.

  if (pantryMode && selectedIngredients.length > 0) {
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

  // ── Context adjustments ───────────────────────────────────────────────────
  //
  // Meaningful nudges based on who the meal is being decided for.
  // Family boosts are intentionally strong enough to visibly reorder the deck
  // without completely eliminating variety.
  //
  // isBold now covers "elevated" and "fresh" categories in addition to
  // "bold"/"flavorful" so adventurous meals (Beef Rendang, Dan Dan Noodles,
  // etc.) are properly caught rather than scoring as neutral.

  if (context !== "solo") {
    const isKidFriendly = meal.tags.some((t) =>
      ["kid", "crowd"].some((k) => t.toLowerCase().includes(k))
    );
    const isQuick = meal.tags.some((t) =>
      ["15 min", "20 min", "25 min", "easy"].some((k) => t.toLowerCase().includes(k))
    );
    const isComfort =
      meal.category.toLowerCase().includes("comfort") ||
      meal.tags.some((t) => t.toLowerCase().includes("indulgent"));
    // Expanded bold detection — catches elevated/fresh categories that were
    // previously missed, plus spicy tags.
    const isBold =
      ["bold", "flavorful", "elevated", "fresh"].some((t) =>
        meal.category.toLowerCase().includes(t)
      ) ||
      meal.tags.some((tag) =>
        ["bold", "flavorful", "spicy"].some((t) => tag.toLowerCase().includes(t))
      );

    if (context === "partner") {
      // Slightly favor comfort / crowd-appeal; pull back on bold/niche meals.
      if (isComfort) score += 1;
      if (isBold) score -= 0.75;
    } else if (context === "family") {
      // Strongly surface kid-friendly crowd-pleasers and quick/easy options.
      // Clearly penalize bold/adventurous meals.
      if (isKidFriendly) {
        score += 2.5;
        setReason("A crowd-pleaser everyone can enjoy");
      }
      if (isQuick) score += 1.5;
      if (isComfort) score += 1;
      if (isBold) score -= 1.5;
    }
  }

  // ── Vibe scoring (legacy `vibe` param — mirrors sessionVibeMode weights) ────
  //
  // This parameter is always null in practice (passed as null from buildDeck).
  // Weights match the sessionVibeMode section below; kept in sync for any
  // future callers. Max boost +1.5, max penalty −1.0.

  if (vibe && vibe !== "no-preference") {
    const vibecat = meal.category.toLowerCase();
    const hasTag = (...ts: string[]) =>
      ts.some((t) => meal.tags.some((tag) => tag.toLowerCase().includes(t.toLowerCase())));

    let legacyVibeScore = 0;

    if (vibe === "comfort-food") {
      const isStrongComfort = vibecat.includes("comfort food");
      const isBroadComfort  = vibecat.includes("crowd pleaser") || hasTag("Indulgent", "Crowd pleaser");
      const isMildComfort   = vibecat.includes("classic italian") || hasTag("Kid-friendly");
      const isLight         = vibecat.includes("healthy") || vibecat.includes("fresh") || hasTag("Nutritious", "Light");
      const isElevated      = vibecat.includes("elevated");
      if (isStrongComfort)     { legacyVibeScore += 1.0; setReason("Exactly what comfort food should be"); }
      else if (isBroadComfort) { legacyVibeScore += 0.65; setReason("Crowd-pleasing and familiar"); }
      else if (isMildComfort)  { legacyVibeScore += 0.35; }
      if (isLight)    legacyVibeScore -= 0.5;
      if (isElevated) legacyVibeScore -= 0.25;

    } else if (vibe === "something-new") {
      const isBoldCat     = vibecat.includes("bold flavors");
      const isElevatedCat = vibecat.includes("elevated");
      const isGlobalFresh = vibecat.includes("mediterranean") || vibecat.includes("fresh");
      const hasFlavorful  = hasTag("Flavorful");
      const isBasic       = vibecat.includes("comfort food") || vibecat.includes("quick & casual");
      const isFamiliar    = hasTag("Kid-friendly", "Crowd pleaser");
      if (isBoldCat)          { legacyVibeScore += 1.0; setReason("Bold and unexpected — exactly something new"); }
      else if (isElevatedCat) { legacyVibeScore += 0.75; setReason("A step up from the usual"); }
      else if (isGlobalFresh) { legacyVibeScore += 0.5; setReason("A global flavor worth exploring"); }
      else if (hasFlavorful)  { legacyVibeScore += 0.35; }
      if (isBasic)    legacyVibeScore -= 0.5;
      if (isFamiliar) legacyVibeScore -= 0.35;

    } else if (vibe === "quick-easy") {
      const isVeryQuick = hasTag("No-cook option") || (mealMinutes !== null && mealMinutes <= 20);
      const is25min     = mealMinutes === 25;
      const hasEasy     = hasTag("Easy");
      const isSlow      = hasTag("Medium effort") || (mealMinutes !== null && mealMinutes >= 40);
      const isModerate  = mealMinutes === 35;
      if (isVeryQuick)  { legacyVibeScore += 1.0; setReason("On the table in under 20 minutes"); }
      else if (is25min) { legacyVibeScore += 0.5; }
      else if (hasEasy) { legacyVibeScore += 0.4; setReason("Low-effort from start to finish"); }
      if (isSlow)     legacyVibeScore -= 0.5;
      if (isModerate) legacyVibeScore -= 0.25;

    } else if (vibe === "healthy") {
      const isHealthyCat  = vibecat.includes("healthy");
      const isFreshCat    = vibecat.includes("fresh");
      const isMedCat      = vibecat.includes("mediterranean");
      const hasNutritious = hasTag("Nutritious");
      const hasLight      = hasTag("Light");
      const hasProtein    = hasTag("Protein-packed");
      const hasVeg        = hasTag("Vegetarian");
      const isHeavy       = vibecat.includes("comfort food") || vibecat.includes("crowd pleaser") || hasTag("Indulgent");
      let healthyBoost = 0;
      if (isHealthyCat)    { healthyBoost += 1.0; setReason("Light and nourishing"); }
      else if (isFreshCat) { healthyBoost += 0.75; setReason("Fresh and clean"); }
      else if (isMedCat)   { healthyBoost += 0.4; }
      if (hasNutritious)   { healthyBoost += 0.5; setReason("Genuinely nutritious"); }
      else if (hasLight)   { healthyBoost += 0.35; }
      if (hasProtein) healthyBoost += 0.25;
      if (hasVeg)     healthyBoost += 0.25;
      legacyVibeScore += Math.min(1.5, healthyBoost);
      if (isHeavy) legacyVibeScore -= 0.75;

    } else if (vibe === "kid-friendly") {
      const hasKid       = hasTag("Kid-friendly");
      const hasCrowd     = hasTag("Crowd pleaser");
      const isComfortCat = vibecat.includes("comfort food");
      const isQuickCas   = vibecat.includes("quick & casual");
      const isBoldCat    = vibecat.includes("bold flavors");
      const isElevated   = vibecat.includes("elevated");
      const hasFlavorful = hasTag("Flavorful");
      if (hasKid)            { legacyVibeScore += 1.5; setReason("A sure hit with the whole table"); }
      else if (hasCrowd)     { legacyVibeScore += 1.0; setReason("Everyone will eat this without complaint"); }
      else if (isComfortCat) { legacyVibeScore += 0.6; }
      else if (isQuickCas)   { legacyVibeScore += 0.35; }
      if (isBoldCat)    legacyVibeScore -= 1.0;
      if (isElevated)   legacyVibeScore -= 0.5;
      if (hasFlavorful) legacyVibeScore -= 0.5;
    }

    legacyVibeScore *= 0.6; // kept in sync with sessionVibeMode scaling
    score += legacyVibeScore;
    vibeScore += legacyVibeScore;
  }

  // ── Cook mode + vibe nudge ────────────────────────────────────────────────
  //
  // cookMode: light style signal (±0.5–1.0 pts). Not tracked in vibeScore.
  // sessionVibeMode: secondary deck signal. Preference, behavioral, and
  //   freshness scores are primary. Vibe only reorders within bands of
  //   similar preference quality — it must never lift a weak match above a
  //   strong one. Accumulated in vibeScore for dev logging.
  //
  //   Max boost per meal: +1.5 pts (healthy, kid-friendly)
  //                       +1.0 pts (comfort-food, quick-easy, something-new)
  //   Max penalty:        −1.0 pts (kid-friendly · bold meals)

  if (cookMode !== "either") {
    const scat = meal.category.toLowerCase();
    const hasSTag = (...ts: string[]) =>
      ts.some((t) => meal.tags.some((tag) => tag.toLowerCase().includes(t.toLowerCase())));

    if (cookMode === "cook") {
      // Home-style / cookable: comfort, casual, pantry-friendly
      const isHomestyle =
        scat.includes("comfort food") || scat.includes("quick & casual") ||
        scat.includes("classic italian") || hasSTag("Pantry staple", "Easy");
      const isElevated = scat.includes("elevated");
      if (isHomestyle) score += 0.6; // was 1.0 — scaled down with session selectors
      if (isElevated)  score -= 0.3; // was -0.5
    } else if (cookMode === "order") {
      // Takeout-friendly: bold global flavors
      const isTakeoutFriendly =
        scat.includes("bold flavors") || scat.includes("fresh") ||
        scat.includes("mediterranean") || hasSTag("Flavorful");
      const isHomeOnly = hasSTag("Pantry staple");
      if (isTakeoutFriendly) score += 0.6; // was 1.0
      if (isHomeOnly)        score -= 0.3; // was -0.5
    }
  }

  if (sessionVibeMode !== "mix-it-up") {
    const scat = meal.category.toLowerCase();
    const hasVTag = (...ts: string[]) =>
      ts.some((t) => meal.tags.some((tag) => tag.toLowerCase().includes(t.toLowerCase())));

    let sessionVibeScore = 0;

    if (sessionVibeMode === "comfort-food") {
      const isStrongComfort = scat.includes("comfort food");
      const isBroadComfort  = scat.includes("crowd pleaser") || hasVTag("Indulgent", "Crowd pleaser");
      const isMildComfort   = scat.includes("classic italian") || hasVTag("Kid-friendly");
      const isLight         = scat.includes("healthy") || scat.includes("fresh") || hasVTag("Nutritious", "Light");
      const isElevated      = scat.includes("elevated");
      if (isStrongComfort)     { sessionVibeScore += 1.0; setReason("Exactly what comfort food should be"); }
      else if (isBroadComfort) { sessionVibeScore += 0.65; setReason("Crowd-pleasing and familiar"); }
      else if (isMildComfort)  { sessionVibeScore += 0.35; }
      if (isLight)    sessionVibeScore -= 0.5;
      if (isElevated) sessionVibeScore -= 0.25;

    } else if (sessionVibeMode === "quick-easy") {
      const isVeryQuick = hasVTag("No-cook option") || (mealMinutes !== null && mealMinutes <= 20);
      const is25min     = mealMinutes === 25;
      const hasEasy     = hasVTag("Easy");
      const isSlow      = hasVTag("Medium effort") || (mealMinutes !== null && mealMinutes >= 40);
      const isModerate  = mealMinutes === 35;
      if (isVeryQuick)  { sessionVibeScore += 1.0; setReason("On the table in under 20 minutes"); }
      else if (is25min) { sessionVibeScore += 0.5; }
      else if (hasEasy) { sessionVibeScore += 0.4; setReason("Low-effort from start to finish"); }
      if (isSlow)     sessionVibeScore -= 0.5;
      if (isModerate) sessionVibeScore -= 0.25;

    } else if (sessionVibeMode === "healthy") {
      // Stacking fix: compute base + additive separately, cap total boost at +1.5
      // so a meal with every healthy signal never exceeds the cap.
      const isHealthyCat  = scat.includes("healthy");
      const isFreshCat    = scat.includes("fresh");
      const isMedCat      = scat.includes("mediterranean");
      const hasNutritious = hasVTag("Nutritious");
      const hasLight      = hasVTag("Light");
      const hasProtein    = hasVTag("Protein-packed");
      const hasVeg        = hasVTag("Vegetarian");
      const isHeavy       = scat.includes("comfort food") || scat.includes("crowd pleaser") || hasVTag("Indulgent");
      let healthyBoost = 0;
      if (isHealthyCat)    { healthyBoost += 1.0; setReason("Light and nourishing"); }
      else if (isFreshCat) { healthyBoost += 0.75; setReason("Fresh and clean"); }
      else if (isMedCat)   { healthyBoost += 0.4; }
      if (hasNutritious)   { healthyBoost += 0.5; setReason("Genuinely nutritious"); }
      else if (hasLight)   { healthyBoost += 0.35; }
      if (hasProtein) healthyBoost += 0.25;
      if (hasVeg)     healthyBoost += 0.25;
      sessionVibeScore += Math.min(1.5, healthyBoost); // cap prevents stacking beyond preference tier
      if (isHeavy) sessionVibeScore -= 0.75;

    } else if (sessionVibeMode === "something-new") {
      const isBoldCat     = scat.includes("bold flavors");
      const isElevatedCat = scat.includes("elevated");
      const isGlobalFresh = scat.includes("mediterranean") || scat.includes("fresh");
      const hasFlavorful  = hasVTag("Flavorful");
      const isBasic       = scat.includes("comfort food") || scat.includes("quick & casual");
      const isFamiliar    = hasVTag("Kid-friendly", "Crowd pleaser");
      if (isBoldCat)          { sessionVibeScore += 1.0; setReason("Bold and unexpected — exactly something new"); }
      else if (isElevatedCat) { sessionVibeScore += 0.75; setReason("A step up from the usual"); }
      else if (isGlobalFresh) { sessionVibeScore += 0.5; setReason("A global flavor worth exploring"); }
      else if (hasFlavorful)  { sessionVibeScore += 0.35; }
      if (isBasic)    sessionVibeScore -= 0.5;
      if (isFamiliar) sessionVibeScore -= 0.35;

    } else if (sessionVibeMode === "kid-friendly") {
      const hasKid       = hasVTag("Kid-friendly");
      const hasCrowd     = hasVTag("Crowd pleaser");
      const isComfortCat = scat.includes("comfort food");
      const isQuickCas   = scat.includes("quick & casual");
      const isBoldCat    = scat.includes("bold flavors");
      const isElevated   = scat.includes("elevated");
      const hasFlavorful = hasVTag("Flavorful");
      if (hasKid)            { sessionVibeScore += 1.5; setReason("A sure hit with the whole table"); }
      else if (hasCrowd)     { sessionVibeScore += 1.0; setReason("Everyone will eat this without complaint"); }
      else if (isComfortCat) { sessionVibeScore += 0.6; }
      else if (isQuickCas)   { sessionVibeScore += 0.35; }
      if (isBoldCat)    sessionVibeScore -= 1.0;
      if (isElevated)   sessionVibeScore -= 0.5;
      if (hasFlavorful) sessionVibeScore -= 0.5;
    }

    // Reduce all session-selector influence by ~40% so preference + learned behavior
    // dominate. Vibe reorders meals within peer score bands; it cannot define rank.
    sessionVibeScore *= 0.6;

    // Guardrail: session context cannot elevate a meal with weak preference signal
    // into top-tier ranking. If the pre-vibe score is below the weak-match threshold,
    // cap the session bonus at a trace amount so only genuine preference matches rank up.
    const WEAK_MATCH_THRESHOLD = 1.0;
    const WEAK_MATCH_CAP = 0.25;
    if (sessionVibeScore > WEAK_MATCH_CAP && score < WEAK_MATCH_THRESHOLD) {
      sessionVibeScore = WEAK_MATCH_CAP;
    }

    score     += sessionVibeScore;
    vibeScore += sessionVibeScore;
  }

  return { score, reason: topReason ?? meal.whyItFits, vibeScore, behaviorScore };
}

/**
 * Infers a score delta for a meal based on the current time/day context.
 * Pure signal — no user input required. Derived entirely from when the user
 * opened the app (mealPeriod + dayType + effortBias from inferSessionContext).
 *
 * Adjustments:
 *   latenight weekday:  prepTime >30min −1.5; comfort/easy/quick tag +1.0; elevated/fresh/bold cat −0.5
 *   friday:             comfort/indulgent tag/cat +0.75; healthy/light tag/cat −0.25
 *   weekend:            elevated/fresh/adventurous cat +0.75; quick/easy tag −0.25
 *   sunday:             comfort/homestyle tag/cat +1.0; elevated/bold cat −0.5
 *   effortBias=low:     prepTime ≤20min +1.0; prepTime >45min −2.0
 */
export function getContextScore(meal: Meal, ctx: SessionContext): number {
  let delta = 0;
  const cat = meal.category.toLowerCase();
  const hasTags = (...ts: string[]) =>
    ts.some((t) => meal.tags.some((tag) => tag.toLowerCase().includes(t.toLowerCase())));

  // Parse prep time from tags like "20 min"
  let mealMinutes: number | null = null;
  for (const tag of meal.tags) {
    const m = tag.match(/^(\d+)\s*min$/i);
    if (m) { mealMinutes = parseInt(m[1]); break; }
  }

  // Late-night weekday — people want low-effort, comforting food
  if (ctx.mealPeriod === "latenight" && ctx.dayType === "weekday") {
    if (mealMinutes !== null && mealMinutes > 30) delta -= 1.5;
    if (hasTags("comfort", "easy", "quick") || cat.includes("comfort")) delta += 1.0;
    if (["elevated", "fresh", "bold"].some((t) => cat.includes(t))) delta -= 0.5;
  }

  // Friday — treat yourself mood
  if (ctx.dayType === "friday") {
    if (hasTags("comfort", "indulgent") || cat.includes("comfort") || cat.includes("indulgent")) delta += 0.75;
    if (hasTags("healthy", "light") || ["healthy", "fresh"].some((t) => cat.includes(t))) delta -= 0.25;
  }

  // Weekend — they have time; favor ambitious or fresh options
  if (ctx.dayType === "weekend") {
    if (["elevated", "fresh", "adventurous"].some((t) => cat.includes(t)) ||
        hasTags("elevated", "fresh", "adventurous")) delta += 0.75;
    if (hasTags("quick", "easy")) delta -= 0.25; // they have time — deprioritize speed shortcuts
  }

  // Sunday — comfort / homestyle cooking energy
  if (ctx.dayType === "sunday") {
    if (hasTags("comfort", "homestyle") || cat.includes("comfort")) delta += 1.0;
    if (["elevated", "bold"].some((t) => cat.includes(t))) delta -= 0.5;
  }

  // Low effort bias (latenight weekday) — strongly deprioritize long cooks
  if (ctx.effortBias === "low") {
    if (mealMinutes !== null && mealMinutes <= 20) delta += 1.0;
    if (mealMinutes !== null && mealMinutes > 45) delta -= 2.0;
  }

  return delta;
}

/**
 * Computes a score delta for a meal based on rejection reasons captured this
 * session. Called after rankMeals so the adjustment is additive on top of the
 * existing preference + behavior score — existing weights are not changed.
 *
 * Reasons and their effects:
 *   too_heavy          → −2.0 for heavy/rich/indulgent/creamy meals; +1.0 for light/fresh
 *   had_recently       → −2.0 additional if meal appears in the last 14 days of history
 *                        (wider window than the default 8-entry cap in scoreMeal)
 *   missing_ingredients → +1.5 for pantry-friendly/easy; −1.0 for complex/elaborate meals
 *   not_feeling_it     → −1.0 if meal's category matches the most common of the last
 *                        2–3 passed meal categories (recentlyRejectedCategories)
 *
 * Multiple reasons stack. Delta is purely additive; existing scoring is untouched.
 */
export function getSessionRejectionAdjustment(
  meal: Meal,
  rejectionEntries: RejectionEntry[],
  history: HistoryEntry[],
): number {
  if (rejectionEntries.length === 0) return 0;

  let delta = 0;
  const cat = meal.category.toLowerCase();
  const hasTag = (...ts: string[]) =>
    ts.some((t) => meal.tags.some((tag) => tag.toLowerCase().includes(t.toLowerCase())));

  const reasons = rejectionEntries.map((e) => e.reason);

  if (reasons.includes("too_heavy")) {
    const isHeavy =
      hasTag("heavy", "rich", "indulgent", "creamy") ||
      ["comfort food", "rich", "indulgent", "creamy"].some((t) => cat.includes(t));
    const isLight =
      hasTag("light", "fresh", "lean", "salad", "nutritious") ||
      ["healthy", "fresh", "light"].some((t) => cat.includes(t));
    if (isHeavy) delta -= 2.0;
    if (isLight) delta += 1.0;
  }

  if (reasons.includes("had_recently")) {
    // Recency penalty handles this signal — no additional adjustment needed
    // (scoreMeal's time-based recency logic already penalises recently-eaten meals)
  }

  if (reasons.includes("missing_ingredients")) {
    const isPantryFriendly = hasTag(
      "pantry-friendly", "pantry staple", "easy", "minimal", "no-cook option",
    );
    const isComplex = hasTag("complex", "elaborate", "requires-shopping", "medium effort");
    if (isPantryFriendly) delta += 1.5;
    if (isComplex) delta -= 1.0;
  }

  // not_feeling_it: apply -0.75 for each entry whose rejected meal's category,
  // cuisine, or tags overlap with this meal. Each entry represents a distinct
  // "mood" rejection so penalties can stack (capped by session CAP of 3 entries).
  const mealCuisines = MEAL_CUISINES[meal.id] ?? [];
  for (const entry of rejectionEntries) {
    if (entry.reason !== "not_feeling_it") continue;
    const catMatch = meal.category === entry.category;
    const cuisineMatch = entry.cuisine.some((c) => mealCuisines.includes(c));
    const tagMatch = entry.tags.some((t) => meal.tags.includes(t));
    if (catMatch || cuisineMatch || tagMatch) delta -= 0.75;
  }

  return delta;
}

// ── Soft avoid penalty ────────────────────────────────────────────────────────

/**
 * Returns -3.0 if any non-expired soft avoid entry matches this meal's
 * ingredient/category signals; 0 otherwise.
 *
 * Matching uses the same keyword logic as getAvoidSignals in session-signals.ts
 * (meal id + name + ingredients text). A strong penalty but not an exclusion —
 * the meal can still appear if the deck is thin or other signals strongly
 * favour it.
 */
const SOFT_AVOID_KEYWORDS: Record<string, string[]> = {
  Beef: ["beef", "steak", "burger", "meatloaf", "meatball", "bolognese", "ribeye", "rendang", "brisket", "ground beef"],
  Pork: ["pork", "bacon", "ham", "sausage", "pepperoni", "ribs", "hot dog", "prosciutto", "chorizo"],
  Seafood: ["seafood", "fish", "shrimp", "salmon", "tuna", "crab", "lobster", "scallop", "sushi", "poke", "ceviche"],
  Chicken: ["chicken", "poultry", "coq"],
};

function checkSoftAvoidPenalty(meal: Meal, softAvoids: SoftAvoid[]): number {
  if (softAvoids.length === 0) return 0;
  const now = Date.now();
  const activeSoftAvoids = softAvoids.filter((sa) => new Date(sa.expiresAt).getTime() > now);
  if (activeSoftAvoids.length === 0) return 0;

  const text = [meal.id, meal.name, ...(meal.ingredients ?? [])].join(" ").toLowerCase();
  for (const sa of activeSoftAvoids) {
    const keywords = SOFT_AVOID_KEYWORDS[sa.category] ?? SOFT_AVOID_KEYWORDS[sa.ingredient];
    if (keywords?.some((kw) => text.includes(kw))) return -3.0;
  }
  return 0;
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
  selectedIngredients: string[] = [],
  context: WhoFor = "solo",
  sessionShown: Set<string> = new Set(),
  vibe: string | null = null,
  cookMode: SessionCookMode = "either",
  sessionVibeMode: SessionVibeMode = "mix-it-up",
  rejectionEntries: RejectionEntry[] = [],
  softAvoids: SoftAvoid[] = [],
  sessionContext?: SessionContext,
): RankedMeal[] {
  if (meals.length === 0) return [];

  // 1. Score every meal — behaviorScore and vibeScore tracked separately for dev logging
  const scored = meals.map((meal) => {
    const { score, reason, vibeScore, behaviorScore } = scoreMeal(
      meal, prefs, savedMeals, history, pantryMode, tasteProfile, recentlySeen, flavorProfile, favorites, selectedIngredients, context, sessionShown, vibe, cookMode, sessionVibeMode
    );
    const rejAdj = rejectionEntries.length > 0
      ? getSessionRejectionAdjustment(meal, rejectionEntries, history)
      : 0;
    const contextAdj = sessionContext ? getContextScore(meal, sessionContext) : 0;
    const softAvoidPenalty = checkSoftAvoidPenalty(meal, softAvoids);
    return { meal, score: score + rejAdj + contextAdj + softAvoidPenalty, reason, vibeScore, behaviorScore };
  });

  // 2. Sort by score descending — all meals ranked, no artificial cutoff
  scored.sort((a, b) => b.score - a.score);

  // 2b. Cuisine diversity rule: if 3+ of the top 5 share a primary cuisine,
  //     apply -0.75 to the 3rd+ occurrence in that cluster and re-sort.
  //     Prevents the deck opening with the same cuisine repeated back-to-back.
  const top5 = scored.slice(0, 5);
  const cuisineHitsTop5: Record<string, number> = {};
  for (const s of top5) {
    const c = MEAL_CUISINES[s.meal.id]?.[0] ?? "Other";
    cuisineHitsTop5[c] = (cuisineHitsTop5[c] ?? 0) + 1;
  }
  for (const [cuisine, count] of Object.entries(cuisineHitsTop5)) {
    if (count >= 3) {
      let seen = 0;
      for (const s of scored.slice(0, 5)) {
        const c = MEAL_CUISINES[s.meal.id]?.[0] ?? "Other";
        if (c === cuisine) {
          seen++;
          if (seen >= 3) s.score -= 0.75; // penalise 3rd, 4th, 5th in the cluster
        }
      }
    }
  }
  // Re-sort after diversity adjustment
  scored.sort((a, b) => b.score - a.score);

  // Dev logging — base preference, learned behavior, session selector, and final score
  // for the top 10 meals. Confirms behavior > vibe in the ranking hierarchy.
  if (process.env.NODE_ENV === "development") {
    const label = sessionVibeMode !== "mix-it-up" ? `vibe:${sessionVibeMode}` : "mix-it-up";
    console.log(`[rankMeals · ${label}] Top 10:`);
    scored.slice(0, 10).forEach((s, i) => {
      const base = +(s.score - s.behaviorScore - s.vibeScore).toFixed(2);
      const beh  = +s.behaviorScore.toFixed(2);
      const sess = +s.vibeScore.toFixed(2);
      const behSign  = beh  >= 0 ? "+" : "";
      const sessSign = sess >= 0 ? "+" : "";
      console.log(
        `  ${i + 1}. ${s.meal.name.padEnd(28)}` +
        ` base:${String(base).padStart(5)}` +
        `  behavior:${behSign}${String(beh).padStart(4)}` +
        `  session:${sessSign}${String(sess).padStart(4)}` +
        `  final:${s.score.toFixed(2)}`
      );
    });
  }

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

// ── Shared-session mutual scoring ─────────────────────────────────────────────
//
// These functions score meals for a shared deck by evaluating each user's fit
// independently and combining via a mutual-fit formula. The key insight is that
// a meal is only as good as the *less interested* person in a shared decision,
// so min(scoreA, scoreB) is the foundation rather than an average.
//
// Formula:
//   mutualScore = min(userAScore, userBScore) * 1.5
//               + sharedOverlapBonus       (both users have explicit positive signal)
//               + safeCrowdPleaserBonus    (meal inherently works for groups)
//               - bothSeenPenalty          (extra penalty when both have seen it)
//
// Solo mode is completely unaffected — rankMeals is unchanged.

/**
 * Scores a meal from one user's perspective using only the data available in
 * their Supabase profile (cuisines, learned weights, recently seen).
 * Uses "solo" context so partner/family nudges don't double-count.
 */
function scoreForUser(meal: Meal, profile: UserProfileForScoring): number {
  const prefs: UserPreferences = {
    cuisines: profile.cuisines,
    dislikedFoods: [], // already hard-gated before this is called
    spiceLevel: "any",
    cookOrOrder: "either",
    kidFriendly: null,
  };

  const { score } = scoreMeal(
    meal,
    prefs,
    [],        // savedMeals — not available in Supabase profiles
    [],        // history — not available in Supabase profiles
    false,     // no pantry mode
    profile.learnedWeights ?? undefined,
    profile.recentlySeen,
    undefined, // flavorProfile — not available in Supabase profiles
    [],        // favorites — not available in Supabase profiles
    [],        // no ingredient filter
    "solo",    // score each user independently; mutual formula handles the partnership
    new Set(), // fresh session — nothing card-shown yet
    null,      // no vibe filter in shared mode
  );

  return score;
}

/**
 * Computes a bonus for meals that both users have independently signalled they
 * enjoy. Bonuses stack but are capped per-dimension so no single dimension
 * dominates.
 *
 * Shared cuisine:        +2.0  (strongest signal — explicit preference from onboarding)
 * Shared liked tags:     +1.5  (behavioral — both have saved/chosen meals with these tags)
 * Shared liked category: +1.0  (behavioral — both have positive category history)
 */
function computeOverlapBonus(
  meal: Meal,
  profileA: UserProfileForScoring,
  profileB: UserProfileForScoring,
): { bonus: number; reasons: string[] } {
  let bonus = 0;
  const reasons: string[] = [];

  const mealCuisines = MEAL_CUISINES[meal.id] ?? [];

  // Both users listed this cuisine in their favorite_cuisines
  const sharedCuisine = mealCuisines.find(
    (c) => profileA.cuisines.includes(c) && profileB.cuisines.includes(c),
  );
  if (sharedCuisine) {
    bonus += 2.0;
    reasons.push(`both like ${sharedCuisine}`);
  }

  // Both users' learned weights have positive signal for one of the meal's tags
  const aLikedTags = new Set(
    Object.entries(profileA.learnedWeights?.likedTags ?? {})
      .filter(([, v]) => v > 0)
      .map(([k]) => k),
  );
  const bLikedTags = new Set(
    Object.entries(profileB.learnedWeights?.likedTags ?? {})
      .filter(([, v]) => v > 0)
      .map(([k]) => k),
  );
  const sharedLikedTags = meal.tags.filter((t) => aLikedTags.has(t) && bLikedTags.has(t));
  if (sharedLikedTags.length > 0) {
    bonus += 1.5;
    reasons.push(`shared liked tags: ${sharedLikedTags.slice(0, 2).join(", ")}`);
  }

  // Both users have a positive learned signal for this meal's category
  const aLikesCategory = (profileA.learnedWeights?.likedCategories[meal.category] ?? 0) > 0;
  const bLikesCategory = (profileB.learnedWeights?.likedCategories[meal.category] ?? 0) > 0;
  if (aLikesCategory && bLikesCategory) {
    bonus += 1.0;
    reasons.push(`both liked ${meal.category}`);
  }

  return { bonus, reasons };
}

/**
 * Scores a single meal for mutual fit in a shared session.
 *
 * Returns individual scores (for logging/debugging) plus the combined
 * mutualScore and overlap metadata.
 *
 * Exported so it can be unit-tested independently of the full ranking pipeline.
 */
export function scoreMealMutual(
  meal: Meal,
  profileA: UserProfileForScoring,
  profileB: UserProfileForScoring,
): {
  mutualScore: number;
  userAScore: number;
  userBScore: number;
  reason: string;
  overlapReasons: string[];
} {
  const userAScore = scoreForUser(meal, profileA);
  const userBScore = scoreForUser(meal, profileB);

  const { bonus: overlapBonus, reasons: overlapReasons } = computeOverlapBonus(
    meal,
    profileA,
    profileB,
  );

  // Safe crowd-pleaser bonus — benefits groups regardless of individual profiles
  const isCrowdPleaser =
    meal.tags.some((t) => t === "Crowd pleaser" || t === "Kid-friendly") ||
    meal.category.toLowerCase().includes("crowd pleaser");
  const crowdBonus = isCrowdPleaser ? 0.5 : 0;
  if (isCrowdPleaser && overlapReasons.length === 0) overlapReasons.push("crowd pleaser");

  // Extra penalty when BOTH users have already seen this meal recently.
  // The individual scoreForUser calls already apply -2.5 for each user who has
  // seen it; this adds a further -1.0 to push it down even more when both agree
  // they've been exposed to it.
  const bothSeenPenalty =
    profileA.recentlySeen.has(meal.id) && profileB.recentlySeen.has(meal.id)
      ? -1.0 : 0;

  const mutualScore =
    Math.min(userAScore, userBScore) * 1.5
    + overlapBonus
    + crowdBonus
    + bothSeenPenalty;

  // Derive a user-facing reason that reflects why this is a good shared pick
  let reason: string;
  const cuisineReason = overlapReasons.find((r) => r.startsWith("both like "));
  const tagReason = overlapReasons.find((r) => r.startsWith("shared liked tags"));
  const catReason = overlapReasons.find((r) => r.startsWith("both liked "));

  if (cuisineReason) {
    const cuisine = cuisineReason.replace("both like ", "");
    reason = `You both love ${cuisine} — a great pick for tonight`;
  } else if (tagReason) {
    reason = "Matches both your tastes";
  } else if (catReason) {
    reason = "You both tend to enjoy this style";
  } else {
    reason = meal.whyItFits;
  }

  return { mutualScore, userAScore, userBScore, reason, overlapReasons };
}

/**
 * Ranks meals for a shared session using mutual-fit scoring.
 *
 * Drop-in replacement for rankMeals() in shared contexts. Accepts both users'
 * profile data separately (no merging) so each user's preferences are weighted
 * fairly and independently before being combined.
 *
 * Pipeline:
 *   1. Score every eligible meal with scoreMealMutual
 *   2. Sort descending by mutualScore
 *   3. Log top 10 in development (name + per-user scores + overlap reasons)
 *   4. bandShuffle within 1-point bands — same variety as solo mode
 *   5. spreadByCuisine — prevents same-cuisine runs
 *
 * Hard gates must be applied by the caller before passing meals in.
 * Solo mode (rankMeals) is completely unaffected by this function.
 */
export function rankMealsForSharedSession(
  meals: Meal[],
  profileA: UserProfileForScoring,
  profileB: UserProfileForScoring,
): RankedMeal[] {
  if (meals.length === 0) return [];

  const scored = meals.map((meal) => {
    const { mutualScore, userAScore, userBScore, reason, overlapReasons } =
      scoreMealMutual(meal, profileA, profileB);
    return { meal, score: mutualScore, userAScore, userBScore, reason, overlapReasons };
  });

  // Sort by mutual score descending
  scored.sort((a, b) => b.score - a.score);

  // --- Deck tiering ---
  // Calibrated to: mutualScore = Math.min(userA, userB) * 1.5 + overlapBonus + crowdBonus + bothSeenPenalty
  // Overlap bonuses (post-rebalance): cuisine +2.0, liked-tags +1.5, liked-category +1.0, crowd +0.5
  //
  // HIGH_THRESHOLD (11.0): both users rate the meal ~5+ AND at least one shared overlap fires.
  //   Example: min(6, 7) * 1.5 + 2.0 cuisine + 1.5 tags = 12.5 → top tier.
  //   Example: min(5, 5) * 1.5 + 2.0 cuisine = 9.5 → still mid — needs behavior overlap too.
  // MID_THRESHOLD  (8.0):  decent mutual fit — both broadly positive, at least cuisine overlap.
  //   Example: min(4, 5) * 1.5 + 2.0 cuisine = 8.0 → mid; min(5, 5) * 1.5 = 7.5 → fallback.
  // Fallback: anything below MID_THRESHOLD that survived the hard gate.
  //
  // Meals are already sorted descending by mutualScore, so tier arrays preserve
  // score order. A light intra-tier shuffle adds session variety without mixing tiers.
  const HIGH_THRESHOLD = 11.0;
  const MID_THRESHOLD = 8.0;

  const topTier  = scored.filter((s) => s.score >= HIGH_THRESHOLD);
  const midTier  = scored.filter((s) => s.score >= MID_THRESHOLD && s.score < HIGH_THRESHOLD);
  const fallback = scored.filter((s) => s.score < MID_THRESHOLD);

  // Development logging — tier breakdown + top 10 with tier labels
  if (process.env.NODE_ENV === "development") {
    console.log(
      `[sharedDeck] Tier breakdown — top: ${topTier.length} (≥${HIGH_THRESHOLD}),` +
      ` mid: ${midTier.length} (≥${MID_THRESHOLD}),` +
      ` fallback: ${fallback.length}`,
    );
    if (topTier.length < 5) {
      console.warn(
        `[sharedDeck] ⚠ Only ${topTier.length} meal(s) met HIGH_THRESHOLD (${HIGH_THRESHOLD}).` +
        ` Filling remaining top-5 slots from mid/fallback.`,
      );
    }
    console.log("[sharedDeck] Top 10 mutual scores:");
    scored.slice(0, 10).forEach((s, i) => {
      const tier =
        s.score >= HIGH_THRESHOLD ? "top" : s.score >= MID_THRESHOLD ? "mid" : "fallback";
      const overlapStr = s.overlapReasons.length
        ? ` | overlap: ${s.overlapReasons.join(", ")}`
        : "";
      console.log(
        `  ${i + 1}. ${s.meal.name}` +
        ` | mutual: ${s.score.toFixed(2)}` +
        ` | tier: ${tier}` +
        ` | A: ${s.userAScore.toFixed(2)}` +
        ` | B: ${s.userBScore.toFixed(2)}` +
        overlapStr,
      );
    });
  }

  // Light Fisher-Yates shuffle within each tier for session-to-session variety.
  // Tiers are never mixed — top tier always leads the deck.
  const shuffleTier = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let k = a.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      [a[k], a[r]] = [a[r], a[k]];
    }
    return a;
  };

  const ordered = [
    ...shuffleTier(topTier),
    ...shuffleTier(midTier),
    ...shuffleTier(fallback),
  ];

  return ordered.map((s) => ({ meal: s.meal, reason: s.reason }));
}

/**
 * Derives a user-facing recommendation reason for a meal in a shared session,
 * using the current user's profile (the other user's profile is not available
 * client-side when loading the pre-built deck from the database).
 *
 * Priority:
 *   1. Cuisine match → "You both might enjoy [cuisine]"
 *   2. Learned tag match → "You've liked similar meals"
 *   3. Learned category match → "You both tend to enjoy this style"
 *   4. Crowd pleaser / kid-friendly → "A crowd-pleasing pick for tonight"
 *   5. Fallback → meal.whyItFits
 *
 * Used at line where shared deck is loaded from Supabase; replaces the
 * placeholder `reason: ""` assigned when only meal IDs are stored.
 */
export function getSharedReason(
  meal: Meal,
  cuisines: string[],
  learnedWeights: TasteProfile | null,
): string {
  const mealCuisines = MEAL_CUISINES[meal.id] ?? [];
  const matchedCuisine = mealCuisines.find((c) => cuisines.includes(c));
  if (matchedCuisine) return `You both might enjoy ${matchedCuisine}`;

  if (learnedWeights) {
    const likedTagMatches = meal.tags.filter(
      (t) => (learnedWeights.likedTags[t] ?? 0) > 0,
    ).length;
    if (likedTagMatches > 0) return "You've liked similar meals";
    if ((learnedWeights.likedCategories[meal.category] ?? 0) > 0) {
      return "You both tend to enjoy this style";
    }
  }

  if (meal.tags.some((t) => t === "Crowd pleaser" || t === "Kid-friendly")) {
    return "A crowd-pleasing pick for tonight";
  }

  return meal.whyItFits;
}
