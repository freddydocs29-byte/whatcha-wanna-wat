/**
 * Archetype → image pool mapping for AI-generated meals.
 *
 * Each archetype maps to a curated list of existing Supabase meal images
 * that visually match that presentation style. Selection is deterministic:
 * the same meal id always resolves to the same image.
 *
 * Only AI-generated meals use this. Static library meals keep their own images.
 */

import type { Meal } from "../data/meals";

const BASE =
  "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/";

function img(filename: string) {
  return `${BASE}${filename}`;
}

// ── Image pools by archetype ────────────────────────────────────────────────

export const ARCHETYPE_IMAGES: Record<NonNullable<Meal["archetype"]>, string[]> = {
  bowl: [
    img("sushi-bowl.jpg"),
    img("grain-bowl.jpg"),
    img("poke-bowl.jpg"),
    img("korean-bbq-bowl.jpg"),
    img("buddha-bowl.jpg"),
    img("black-bean-bowl.jpg"),
    img("chipotle-bowl.jpg"),
    img("mango-shrimp-bowl.jpg"),
    img("shrimp-avocado-bowl.jpg"),
    img("roasted-veggie-bowl.jpg"),
    img("tuna-rice-bowl.jpg"),
    img("lettuce-wrap-bowls.jpg"),
    img("bibimbap.jpg"),
  ],

  pasta: [
    img("chicken-alfredo.jpg"),
    img("pasta-pomodoro.jpg"),
    img("spaghetti-bolognese.jpg"),
    img("carbonara.jpg"),
    img("penne-arrabbiata.jpg"),
    img("gnocchi.jpg"),
    img("sausage-pasta.jpg"),
    img("seafood-linguine.jpg"),
    img("truffle-pasta.jpg"),
    img("cacio-e-pepe.jpg"),
    img("pasta-amatriciana.jpg"),
    img("puttanesca.jpg"),
    img("cheese-ravioli.jpg"),
    img("cold-sesame-noodles.jpg"),
    img("dan-dan-noodles.jpg"),
    img("pad-thai.jpg"),
    img("drunken-noodles.jpg"),
    img("cold-soba.jpg"),
    img("tuna-noodle.jpg"),
    img("beef-lasagna.jpg"),
  ],

  handheld: [
    img("tacos.jpg"),
    img("burgers.jpg"),
    img("quesadillas.jpg"),
    img("falafel-wrap.jpg"),
    img("chicken-wrap.jpg"),
    img("veggie-wrap.jpg"),
    img("hot-dogs.jpg"),
    img("tuna-melt.jpg"),
    img("grilled-cheese.jpg"),
    img("blt-sandwich.jpg"),
    img("club-sandwich.jpg"),
    img("pulled-pork-sandwich.jpg"),
    img("fish-tacos.jpg"),
    img("birria-tacos.jpg"),
    img("salmon-tacos.jpg"),
    img("cheesesteak.jpg"),
    img("egg-salad-sandwich.jpg"),
    img("chicken-salad-wrap.jpg"),
    img("meatball-subs.jpg"),
    img("sliders.jpg"),
    img("banh-mi.jpg"),
    img("fried-chicken-sandwich.jpg"),
    img("lamb-shawarma.jpg"),
    img("breakfast-burrito.jpg"),
  ],

  flatbread: [
    img("margherita-pizza.jpg"),
    img("mini-pizzas.jpg"),
    img("pizza-rolls.jpg"),
    img("lahmacun.jpg"),
    img("avocado-toast.jpg"),
    img("bruschetta.jpg"),
    img("focaccia-bread.jpg"),
  ],

  salad: [
    img("caesar-salad.jpg"),
    img("tuna-salad.jpg"),
    img("greek-salad.jpg"),
    img("caprese-salad.jpg"),
    img("nicoise-salad.jpg"),
    img("cobb-salad.jpg"),
    img("kale-chickpea-salad.jpg"),
    img("mushroom-spinach-salad.jpg"),
    img("cold-noodle-salad.jpg"),
    img("tabbouleh.jpg"),
    img("fattoush.jpg"),
    img("thai-larb.jpg"),
    img("avocado-chicken-salad.jpg"),
    img("gado-gado.jpg"),
  ],

  stir_fry: [
    img("chicken-stir-fry.jpg"),
    img("fried-rice.jpg"),
    img("kung-pao-chicken.jpg"),
    img("shrimp-stir-fry.jpg"),
    img("veggie-stir-fry.jpg"),
    img("szechuan-beef.jpg"),
  ],

  plated_protein: [
    img("grilled-salmon.jpg"),
    img("ribeye-steak.jpg"),
    img("lamb-chops.jpg"),
    img("bbq-chicken.jpg"),
    img("jerk-chicken.jpg"),
    img("baked-lemon-chicken.jpg"),
    img("peri-peri-chicken.jpg"),
    img("teriyaki-salmon.jpg"),
    img("sea-bass.jpg"),
    img("duck-breast.jpg"),
    img("beef-tenderloin.jpg"),
    img("coq-au-vin.jpg"),
    img("chicken-piccata.jpg"),
    img("chicken-marsala.jpg"),
    img("harissa-chicken.jpg"),
    img("moroccan-chicken.jpg"),
    img("pan-seared-fish.jpg"),
    img("steak-frites.jpg"),
    img("rack-of-lamb.jpg"),
    img("steak-au-poivre.jpg"),
    img("saltimbocca.jpg"),
    img("chicken-mole.jpg"),
    img("chicken-parmesan.jpg"),
    img("southern-fried-chicken.jpg"),
    img("baked-salmon-veg.jpg"),
    img("garlic-butter-shrimp.jpg"),
    img("shrimp-scampi.jpg"),
  ],

  comfort_plate: [
    img("mac-and-cheese.jpg"),
    img("chicken-pot-pie.jpg"),
    img("meatloaf.jpg"),
    img("shepherds-pie.jpg"),
    img("chicken-casserole.jpg"),
    img("beef-stew.jpg"),
    img("pot-roast.jpg"),
    img("stuffed-cabbage.jpg"),
    img("red-beans-rice.jpg"),
    img("chicken-dumplings.jpg"),
    img("mushroom-risotto.jpg"),
    img("mapo-beef.jpg"),
    img("sloppy-joes.jpg"),
    img("butter-chicken.jpg"),
    img("tikka-masala.jpg"),
    img("thai-curry.jpg"),
    img("veggie-curry.jpg"),
    img("massaman-curry.jpg"),
    img("mango-curry.jpg"),
    img("stuffed-peppers.jpg"),
  ],

  soup: [
    img("ramen.jpg"),
    img("chicken-noodle-soup.jpg"),
    img("potato-soup.jpg"),
    img("french-onion-soup.jpg"),
    img("lentil-soup.jpg"),
    img("tomato-soup.jpg"),
    img("beef-vegetable-soup.jpg"),
    img("corn-chowder.jpg"),
    img("broccoli-cheddar-soup.jpg"),
    img("white-bean-soup.jpg"),
    img("spicy-miso-ramen.jpg"),
    img("detox-chicken-soup.jpg"),
    img("chickpea-spinach-soup.jpg"),
    img("white-chicken-chili.jpg"),
    img("chili.jpg"),
    img("beef-pho.jpg"),
    img("gazpacho.jpg"),
    img("shrimp-bisque.jpg"),
    img("minestrone.jpg"),
  ],

  breakfast: [
    img("shakshuka.jpg"),
    img("french-toast.jpg"),
    img("pancakes.jpg"),
    img("scrambled-eggs.jpg"),
    img("bacon-egg-cheese.jpg"),
    img("breakfast-hash.jpg"),
    img("waffles.jpg"),
    img("hash-browns.jpg"),
    img("poached-eggs-toast.jpg"),
    img("spinach-frittata.jpg"),
    img("veggie-omelette.jpg"),
    img("spanish-tortilla.jpg"),
    img("green-shakshuka.jpg"),
    img("turkish-eggs.jpg"),
    img("foul-medames.jpg"),
    img("spinach-egg-cups.jpg"),
    img("bagel-lox.jpg"),
    img("congee.jpg"),
    img("biscuits-gravy.jpg"),
  ],

  loaded_plate: [
    img("nachos.jpg"),
    img("loaded-fries.jpg"),
    img("loaded-baked-potato.jpg"),
    img("buffalo-chicken-dip.jpg"),
    img("chicken-wings.jpg"),
    img("bbq-ribs.jpg"),
    img("shrimp-boil.jpg"),
    img("corn-dogs.jpg"),
    img("pigs-in-blankets.jpg"),
    img("chicken-tenders.jpg"),
  ],

  vegetarian: [
    img("hummus-plate.jpg"),
    img("tabbouleh.jpg"),
    img("mujaddara.jpg"),
    img("baba-ghanoush.jpg"),
    img("spanakopita.jpg"),
    img("sabich.jpg"),
    img("stuffed-mushrooms.jpg"),
    img("stuffed-peppers.jpg"),
    img("veggie-wrap.jpg"),
    img("veggie-omelette.jpg"),
    img("roasted-veggie-bowl.jpg"),
    img("buddha-bowl.jpg"),
    img("kale-chickpea-salad.jpg"),
    img("foul-medames.jpg"),
  ],
};

// ── Safe fallback ───────────────────────────────────────────────────────────

const GENERAL_FALLBACK = img(
  "grain-bowl.jpg" // visually neutral, works for almost any meal
);

// ── Deterministic hash (djb2) ───────────────────────────────────────────────

function hashId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h, 33) ^ id.charCodeAt(i);
  }
  return Math.abs(h >>> 0); // unsigned 32-bit
}

// ── Archetype inference from meal metadata ──────────────────────────────────

type ArchetypeKey = NonNullable<Meal["archetype"]>;

/**
 * Infer an archetype from name / category / tags when the model did not
 * return one (or returned an unrecognised value).
 */
export function inferArchetype(meal: Pick<Meal, "name" | "category" | "tags">): ArchetypeKey {
  const text = [meal.name, meal.category, ...(meal.tags ?? [])].join(" ").toLowerCase();

  if (/\b(soup|chowder|bisque|stew|broth|pho|ramen|chili)\b/.test(text)) return "soup";
  if (/\b(pancake|waffle|french toast|breakfast|scrambled egg|omelette|frittata|shakshuka|hash brown|biscuit)\b/.test(text)) return "breakfast";
  if (/\b(pasta|spaghetti|fettuccine|penne|linguine|lasagna|carbonara|noodle|gnocchi|pad thai|lo mein|udon|soba)\b/.test(text)) return "pasta";
  if (/\b(bowl)\b/.test(text)) return "bowl";
  if (/\b(taco|burrito|sandwich|burger|wrap|sub|hoagie|bao|banh mi|shawarma|gyro|hot dog|slider)\b/.test(text)) return "handheld";
  if (/\b(pizza|flatbread|naan|pita|toast|bruschetta|focaccia|lahmacun)\b/.test(text)) return "flatbread";
  if (/\b(salad)\b/.test(text)) return "salad";
  if (/\b(stir.?fry|stir fry|fried rice|wok)\b/.test(text)) return "stir_fry";
  if (/\b(nacho|loaded fries|loaded|wings|ribs)\b/.test(text)) return "loaded_plate";
  if (/\b(grilled|roasted|seared|baked|pan.fried).*(chicken|salmon|steak|fish|beef|lamb|pork|shrimp)\b/.test(text)) return "plated_protein";
  if (/\b(vegan|vegetarian|veggie|plant.based)\b/.test(text)) return "vegetarian";
  if (/\b(mac.*cheese|pot pie|casserole|meatloaf|curry|masala|rendang|comfort)\b/.test(text)) return "comfort_plate";

  // category-level fallbacks
  if (meal.category === "Fresh" || meal.category === "Healthy") return "salad";
  if (meal.category === "Comfort food") return "comfort_plate";

  return "bowl"; // final safe default
}

// ── Main resolver ───────────────────────────────────────────────────────────

/**
 * Returns a stable image URL for an AI-generated meal.
 *
 * Resolution order:
 *   1. Use meal.archetype if valid
 *   2. Infer archetype from name/category/tags
 *   3. Fall back to GENERAL_FALLBACK
 *
 * The same meal.id always produces the same image (deterministic hash).
 */
export function resolveAIImage(meal: Pick<Meal, "id" | "name" | "category" | "tags" | "archetype">): string {
  const validArchetypes = new Set(Object.keys(ARCHETYPE_IMAGES) as ArchetypeKey[]);

  const archetype: ArchetypeKey =
    meal.archetype && validArchetypes.has(meal.archetype)
      ? meal.archetype
      : inferArchetype(meal);

  const pool = ARCHETYPE_IMAGES[archetype];
  if (!pool || pool.length === 0) return GENERAL_FALLBACK;

  const image = pool[hashId(meal.id) % pool.length];

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[archetype-images] "${meal.name}" · archetype=${archetype}${meal.archetype !== archetype ? ` (inferred from "${meal.archetype ?? "none"}")` : ""} · ${image.split("/").pop()}`
    );
  }

  return image;
}
