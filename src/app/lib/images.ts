/**
 * Generic food photo — last-resort fallback for AI-generated meals whose
 * category doesn't match any key in CATEGORY_FALLBACK_IMAGES.
 */
export const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&h=750&q=80";

/**
 * Per-category representative images for AI-generated meals.
 * Each URL is a known-good static meal image already hosted on the existing
 * Supabase CDN bucket — no new domains introduced.
 *
 * Keys must match the exact category strings used in meals.ts and VALID_CATEGORIES.
 */
export const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  "Comfort food":
    "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/chicken-alfredo.jpg",
  "Quick & casual":
    "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/tacos.jpg",
  "Fresh":
    "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/sushi-bowl.jpg",
  "Crowd pleaser":
    "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/burgers.jpg",
  "Classic Italian":
    "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/pasta-pomodoro.jpg",
  "Bold flavors":
    "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/thai-curry.jpg",
  "Healthy":
    "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/grain-bowl.jpg",
  "Elevated":
    "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/grilled-salmon.jpg",
  "Mediterranean":
    "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/greek-salad.jpg",
};
