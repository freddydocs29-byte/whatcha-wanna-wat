import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { Meal } from "../../data/meals";

// ── Constants ────────────────────────────────────────────────────────────────

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&h=750&q=80";

const VALID_CATEGORIES = new Set([
  "Comfort food",
  "Quick & casual",
  "Bold flavors",
  "Fresh",
  "Healthy",
  "Elevated",
  "Mediterranean",
  "Classic Italian",
  "Quick & Easy",
  "Crowd pleaser",
]);

const VALID_TIME_TAGS = new Set([
  "15 min", "20 min", "25 min", "30 min", "35 min", "40 min", "45 min",
]);

// Hard-NO keyword map mirrors scoring.ts — used as a server-side safety check.
const HARD_NO_KEYWORDS: Record<string, string[]> = {
  Beef: ["beef", "steak", "burger", "meatloaf", "meatball", "bolognese", "ribeye", "rendang", "brisket", "ground beef", "veal"],
  Pork: ["pork", "bacon", "ham", "sausage", "pepperoni", "ribs", "hot dog", "chorizo", "prosciutto"],
  Seafood: ["seafood", "fish", "shrimp", "salmon", "tuna", "crab", "lobster", "scallop", "cod", "sushi", "poke", "ceviche", "prawn", "clam", "oyster", "lox"],
  Chicken: ["chicken", "poultry", "coq"],
  Dairy: ["cheese", "butter", "cream", "milk", "yogurt", "ricotta", "mozzarella", "parmesan", "alfredo", "cheddar"],
  "Gluten / Pasta": ["pasta", "noodle", "spaghetti", "linguine", "penne", "fettuccine", "lasagna", "gnocchi", "ramen", "pizza", "bread", "toast", "sandwich", "tortilla", "burrito", "taco", "waffle", "pancake", "flatbread", "bun", "roll", "biscuit", "pita", "wrap"],
};

function violatesHardNo(meal: Meal, hardNos: string[]): boolean {
  if (hardNos.length === 0) return false;
  const text = [meal.id, meal.name, ...(meal.ingredients ?? [])].join(" ").toLowerCase();
  return hardNos.some((cat) => HARD_NO_KEYWORDS[cat]?.some((kw) => text.includes(kw)) ?? false);
}

// ── Prompt builder ───────────────────────────────────────────────────────────

interface PromptContext {
  hardNos: string[];
  cuisines: string[];
  spiceLevel: string;
  cookOrOrder: string;
  pantryIngredients: string[];
  isEveningTime: boolean;
  vibeMode: string;
  recentlySeenNames: string[];
  count: number;
  /** Phase 4B — cuisines absent from Zones 1+2; AI should cover at least some. */
  cuisineGaps: string[];
  /** Phase 4C — if true, prompt steers toward outside-comfort-zone suggestions. */
  challengerMode: boolean;
}

function buildPrompt(ctx: PromptContext): string {
  const vibeDescriptions: Record<string, string> = {
    "mix-it-up": "a variety of cuisines and cooking styles",
    "comfort-food": "warm, hearty, cozy dishes",
    "quick-easy": "fast meals under 30 minutes",
    "healthy": "nutritious, light, and wholesome meals",
    "something-new": "bold, adventurous, or globally-inspired dishes",
    "kid-friendly": "simple, crowd-pleasing meals everyone will enjoy",
  };
  const vibeHint = vibeDescriptions[ctx.vibeMode] ?? "a variety of meals";

  const pantrySection =
    ctx.pantryIngredients.length > 0
      ? `PANTRY INGREDIENTS AVAILABLE: ${ctx.pantryIngredients.join(", ")}
RULE: At least 60% of your suggestions must creatively use these ingredients. Prefer combinations of 2+ ingredients (e.g., Chicken + Rice = Chicken Fried Rice, Eggs + Tortillas = Breakfast Tacos).`
      : "No specific pantry ingredients — generate a diverse set.";

  const hardNoSection =
    ctx.hardNos.length > 0
      ? `HARD NOs — NEVER include meals that contain any of: ${ctx.hardNos.join(", ")}.
This is absolute. If "Seafood" is listed: no fish, shrimp, sushi, poke, ceviche, or any ocean ingredient.
If "Beef" is listed: no burgers, steaks, ground beef, or beef-based dishes.`
      : "";

  const timeSection = ctx.isEveningTime
    ? "TIME: It is dinner/evening. Do NOT suggest breakfast-only meals (pancakes, waffles, french toast, cereal, breakfast burritos)."
    : "TIME: It is morning or lunchtime. Breakfast, brunch, and lunch ideas are welcome.";

  const recentSection =
    ctx.recentlySeenNames.length > 0
      ? `AVOID REPEATING these recently shown meals: ${ctx.recentlySeenNames.slice(0, 12).join(", ")}`
      : "";

  const cuisineSection =
    ctx.cuisines.length > 0
      ? `PREFERRED CUISINES: ${ctx.cuisines.join(", ")} — lean toward these but include some variety.`
      : "No cuisine preference — vary widely.";

  const cookSection =
    ctx.cookOrOrder === "cook"
      ? "All meals should be home-cookable."
      : ctx.cookOrOrder === "order"
      ? "Meals should be orderable from restaurants or deliverable."
      : "Mix of home cooking and takeout ideas.";

  // Phase 4B — diversifier: steer AI toward underrepresented cuisines
  const diversifierSection =
    ctx.cuisineGaps.length > 0
      ? `CUISINE DIVERSITY GOAL: The user's current deck is missing meals from these cuisines: ${ctx.cuisineGaps.join(", ")}. ` +
        `Try to include at least ${Math.min(2, ctx.cuisineGaps.length)} meals from this list — ` +
        `but only if they fit the hard NOs and other constraints above.`
      : "";

  // Phase 4C — challenger: push outside comfort zone
  const challengerSection = ctx.challengerMode
    ? `CHALLENGER MODE: This session, deliberately push the user outside their comfort zone. ` +
      `Suggest meals from cuisines or cooking styles they haven't explored recently. ` +
      `Be bold — think Korean BBQ, Ethiopian injera, Persian stew, Peruvian ceviche (if not in hard NOs). ` +
      `Avoid obvious repeats of their usual favorites.`
    : "";

  return `Generate exactly ${ctx.count} creative, specific meal suggestions. Return ONLY valid JSON — no markdown, no explanation.

CONTEXT:
- Vibe/mood: ${vibeHint}
- Spice: ${ctx.spiceLevel}
- ${cookSection}
- ${timeSection}
- ${cuisineSection}

${pantrySection}

${hardNoSection ? hardNoSection + "\n\n" : ""}${recentSection ? recentSection + "\n\n" : ""}${diversifierSection ? diversifierSection + "\n\n" : ""}${challengerSection ? challengerSection + "\n\n" : ""}QUALITY RULES:
1. Be specific, not generic. "Garlic Butter Chicken Thighs" not just "Chicken". "Banana Pancakes" not "Pancakes".
2. When pantry items are available, name the combination in the meal name.
3. Make descriptions sensory and appealing (2 sentences max).
4. Each meal must be clearly distinct — no duplicates or near-duplicates.

INGREDIENT NAMES (use these exact strings for pantry matching):
Proteins: Chicken, Ground beef, Steak, Shrimp, Salmon, Eggs, Bacon, Sausage, Tofu
Carbs: Pasta, Rice, Bread, Tortillas, Potatoes, Noodles
Vegetables: Onions, Garlic, Bell peppers, Broccoli, Spinach, Mushrooms, Tomatoes
Staples: Cheese, Butter, Beans

REQUIRED JSON STRUCTURE — return exactly this shape:
{
  "meals": [
    {
      "id": "kebab-case-unique-id",
      "name": "Specific Meal Name",
      "description": "Sensory, appealing 1-2 sentence description.",
      "category": "one of: Comfort food | Quick & casual | Bold flavors | Fresh | Healthy | Elevated | Mediterranean | Classic Italian | Quick & Easy | Crowd pleaser",
      "tags": ["20 min", "Easy"],
      "ingredients": ["Chicken", "Rice"],
      "estimatedTimeMinutes": 25,
      "cuisine": "Asian",
      "aiLabel": "Made from your pantry"
    }
  ]
}

LABEL RULE: Set "aiLabel" to "Made from your pantry" if the meal uses 2+ of the available pantry ingredients; otherwise "Fresh idea".
TIME TAG: Include exactly one time tag in tags array: "15 min", "20 min", "25 min", "30 min", "35 min", "40 min", or "45 min".`;
}

// ── Response validation ──────────────────────────────────────────────────────

type RawAIMeal = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  category?: unknown;
  tags?: unknown;
  ingredients?: unknown;
  estimatedTimeMinutes?: unknown;
  cuisine?: unknown;
  aiLabel?: unknown;
};

function transformMeal(raw: RawAIMeal, hardNos: string[]): Meal | null {
  if (typeof raw.name !== "string" || !raw.name.trim()) return null;
  if (typeof raw.description !== "string" || !raw.description.trim()) return null;

  // Normalize ID — generate from name if missing or invalid
  const rawId = typeof raw.id === "string" ? raw.id.trim() : "";
  const id = rawId || raw.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const category =
    typeof raw.category === "string" && VALID_CATEGORIES.has(raw.category)
      ? raw.category
      : "Quick & casual";

  const rawTags = Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === "string") : [];
  // Ensure exactly one valid time tag is present
  const hasTimeTag = rawTags.some((t) => VALID_TIME_TAGS.has(t));
  const tags: string[] = hasTimeTag ? rawTags : ["30 min", ...rawTags];

  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients.filter((i): i is string => typeof i === "string")
    : [];

  const rawLabel = typeof raw.aiLabel === "string" ? raw.aiLabel : "";
  const aiLabel: Meal["aiLabel"] =
    rawLabel === "Made from your pantry" ? "Made from your pantry" : "Fresh idea";

  const meal: Meal = {
    id,
    name: raw.name.trim(),
    description: raw.description.trim(),
    category,
    tags,
    ingredients,
    whyItFits: typeof raw.cuisine === "string" && raw.cuisine ? `${raw.cuisine} inspired` : "Fresh idea for tonight",
    image: FALLBACK_IMAGE,
    aiGenerated: true,
    aiLabel,
  };

  // Server-side hard-NO safety pass
  if (violatesHardNo(meal, hardNos)) return null;

  return meal;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // OPENAI_API_KEY is never sent to the client — only available in server runtime.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[generate-meals] OPENAI_API_KEY is not set");
    }
    return NextResponse.json({ meals: [] });
  }

  try {
    const body = await req.json();
    const {
      preferences = {},
      partnerPreferences = null,
      pantryIngredients = [],
      timeBucket = "dinner",
      cookMode = "either",
      vibeMode = "mix-it-up",
      recentlySeenNames = [],
      count = 10,
      cuisineGaps = [],
      challengerMode = false,
    } = body as {
      preferences?: { cuisines?: string[]; dislikedFoods?: string[]; spiceLevel?: string; cookOrOrder?: string };
      partnerPreferences?: { cuisines?: string[]; dislikedFoods?: string[] } | null;
      pantryIngredients?: string[];
      timeBucket?: "morning" | "dinner";
      cookMode?: string;
      vibeMode?: string;
      recentlySeenNames?: string[];
      count?: number;
      cuisineGaps?: string[];
      challengerMode?: boolean;
    };

    // Union both users' hard NOs so neither partner sees a blocked ingredient
    const hardNos = [
      ...new Set([
        ...(preferences.dislikedFoods ?? []),
        ...(partnerPreferences?.dislikedFoods ?? []),
      ]),
    ];

    const cuisines = [
      ...new Set([
        ...(preferences.cuisines ?? []),
        ...(partnerPreferences?.cuisines ?? []),
      ]),
    ];

    const safeCount = Math.min(Math.max(1, Number(count) || 10), 12);

    const promptContext: PromptContext = {
      hardNos,
      cuisines,
      spiceLevel: preferences.spiceLevel ?? "any",
      cookOrOrder: preferences.cookOrOrder ?? cookMode ?? "either",
      pantryIngredients: Array.isArray(pantryIngredients) ? pantryIngredients : [],
      isEveningTime: timeBucket === "dinner",
      vibeMode,
      recentlySeenNames: Array.isArray(recentlySeenNames) ? recentlySeenNames : [],
      count: safeCount,
      cuisineGaps: Array.isArray(cuisineGaps) ? cuisineGaps : [],
      challengerMode: Boolean(challengerMode),
    };

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.85,
      max_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a creative meal suggestion engine. Return only valid JSON with no markdown or explanation.",
        },
        { role: "user", content: buildPrompt(promptContext) },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";

    let parsed: { meals?: unknown[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (process.env.NODE_ENV === "development") {
        console.warn("[generate-meals] Failed to parse OpenAI response:", raw.slice(0, 200));
      }
      return NextResponse.json({ meals: [] });
    }

    const rawMeals = Array.isArray(parsed.meals) ? parsed.meals : [];
    const meals: Meal[] = rawMeals
      .map((m) => transformMeal(m as RawAIMeal, hardNos))
      .filter((m): m is Meal => m !== null);

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[generate-meals] ✓ ${meals.length}/${rawMeals.length} meals generated` +
          ` · pantry: [${pantryIngredients.join(", ")}]` +
          ` · hardNos: [${hardNos.join(", ")}]` +
          ` · vibe: ${vibeMode}`
      );
    }

    return NextResponse.json({ meals });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[generate-meals] Error:", err);
    }
    // Always return 200 with empty meals — client handles empty gracefully
    return NextResponse.json({ meals: [] });
  }
}
