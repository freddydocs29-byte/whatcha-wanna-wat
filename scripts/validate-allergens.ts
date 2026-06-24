/**
 * Validates that every meal in meals.ts has an allergens field and that all
 * values are valid Big 9 allergen strings.
 *
 * Run with:  npm run validate:allergens
 */

import { meals } from "../src/app/data/meals";
import type { Allergen } from "../src/app/data/meals";

const VALID_ALLERGENS = new Set<Allergen>([
  "peanuts",
  "tree nuts",
  "dairy",
  "eggs",
  "wheat",
  "soy",
  "fish",
  "shellfish",
  "sesame",
]);

let errors = 0;

for (const meal of meals) {
  if (!Array.isArray(meal.allergens)) {
    console.error(`[ERROR] ${meal.id}: allergens field is missing or not an array`);
    errors++;
    continue;
  }

  for (const allergen of meal.allergens) {
    if (!VALID_ALLERGENS.has(allergen as Allergen)) {
      console.error(`[ERROR] ${meal.id}: invalid allergen value "${allergen}"`);
      errors++;
    }
  }
}

if (errors === 0) {
  console.log(`✓ All ${meals.length} meals have valid allergen tags.`);
} else {
  console.error(`\n✗ ${errors} error(s) found across ${meals.length} meals.`);
  process.exit(1);
}
