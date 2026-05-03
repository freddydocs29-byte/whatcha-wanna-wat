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
  /** Phase A — random phrase injected to break habitual patterns each session. */
  sessionSeed: string;
  /** Names of AI meals from the last 3 sessions — model avoids re-suggesting them. */
  previousAIMealNames: string[];
  /** Names of static Zone 1 meals already placed — model avoids near-duplicates. */
  existingDeckNames: string[];
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

  // ── HARD constraints (non-negotiable) ────────────────────────────────────────

  const hardNoSection =
    ctx.hardNos.length > 0
      ? `ALLERGIES / HARD NOs — never include meals containing: ${ctx.hardNos.join(", ")}.
Examples: "Seafood" excludes fish, shrimp, sushi, poke, ceviche. "Beef" excludes burgers, steak, ground beef.`
      : "";

  // ── SOFT preferences (hints, never block output) ─────────────────────────────

  const timeHint = ctx.isEveningTime
    ? "It is dinner/evening — prefer dinner-appropriate meals over breakfast-only dishes."
    : "It is morning or lunchtime — breakfast, brunch, and lunch ideas are welcome.";

  const cuisineHint =
    ctx.cuisines.length > 0
      ? `Preferred cuisines: ${ctx.cuisines.join(", ")} — lean toward these but vary across the full list.`
      : "No cuisine preference — vary widely across cuisines.";

  const cookHint =
    ctx.cookOrOrder === "cook"
      ? "Prefer home-cookable meals."
      : ctx.cookOrOrder === "order"
      ? "Prefer meals orderable from restaurants or delivery."
      : "Mix of home cooking and takeout ideas.";

  const pantrySection =
    ctx.pantryIngredients.length > 0
      ? `PANTRY AVAILABLE: ${ctx.pantryIngredients.join(", ")} — try to have at least half your suggestions creatively use these ingredients. Prefer combinations of 2+ (e.g., Chicken + Rice → Chicken Fried Rice).`
      : "";

  // Phase 4B — diversifier (soft)
  const diversifierHint =
    ctx.cuisineGaps.length > 0
      ? `For variety, try to include ${Math.min(2, ctx.cuisineGaps.length)} meal(s) from these underrepresented cuisines: ${ctx.cuisineGaps.join(", ")}.`
      : "";

  // Phase 4C — challenger (soft)
  const challengerHint = ctx.challengerMode
    ? `This session, lean toward bold or globally-inspired meals outside the user's usual comfort zone — think Korean BBQ, Ethiopian, Persian, or Peruvian styles (only if not in hard NOs).`
    : "";

  // Phase A — session seed (soft nudge)
  const seedHint = ctx.sessionSeed
    ? `Session mood: "${ctx.sessionSeed}" — let this subtly inspire the mood or ingredients of a couple suggestions. Do not mention it literally.`
    : "";

  // Recently seen (soft — try to vary, never block)
  const recentHint =
    ctx.recentlySeenNames.length > 0
      ? `Try to vary from these recently shown meals: ${ctx.recentlySeenNames.slice(0, 10).join(", ")}.`
      : "";

  // Previous AI suggestions (soft — avoid exact repeats only, never reduce count)
  const prevAIHint =
    ctx.previousAIMealNames.length > 0
      ? `Try to avoid re-suggesting these recent AI picks: ${ctx.previousAIMealNames.join(", ")}. Ignore this list if following it would result in fewer than ${ctx.count} meals.`
      : "";

  // Existing deck (soft — only block near-identical, not similar)
  const existingHint =
    ctx.existingDeckNames.length > 0
      ? `These meals are already in the user's deck — avoid exact or near-identical duplicates: ${ctx.existingDeckNames.join(", ")}. Similar-category or same-cuisine meals are fine.`
      : "";

  // Assemble soft hints block — only include non-empty lines
  const softHints = [
    timeHint,
    cuisineHint,
    cookHint,
    pantrySection,
    diversifierHint,
    challengerHint,
    seedHint,
    recentHint,
    prevAIHint,
    existingHint,
  ]
    .filter(Boolean)
    .map((h) => `- ${h}`)
    .join("\n");

  return `You are a meal suggestion engine. Return ONLY valid JSON — no markdown, no explanation.

ABSOLUTE REQUIREMENT: You must return exactly ${ctx.count} meals. Never return fewer. Never return an empty list.
If any soft guideline below conflicts with reaching ${ctx.count} meals, ignore that guideline.

CONSTRAINT PRIORITY (highest to lowest):
1. Hard NO foods / allergies — never violate these
2. Return exactly ${ctx.count} realistic meals — non-negotiable
3. Variety and freshness across cuisines and styles
4. Preference matching (cuisine, vibe, cook mode)

${hardNoSection ? hardNoSection + "\n\n" : ""}SOFT PREFERENCES (hints only — relax any of these to meet the meal count):
${softHints}

QUALITY RULES:
1. Be specific, not generic. "Garlic Butter Chicken Thighs" not "Chicken". "Banana Pancakes" not "Pancakes".
2. When pantry items are available, name the combination in the meal title.
3. Make descriptions sensory and appealing (1-2 sentences).
4. Each meal must be clearly distinct.
5. If soft preferences are too limiting, generate good alternatives from any cuisine or style.

INGREDIENT NAMES (use these exact strings for pantry matching):
Proteins: Chicken, Ground beef, Steak, Shrimp, Salmon, Eggs, Bacon, Sausage, Tofu
Carbs: Pasta, Rice, Bread, Tortillas, Potatoes, Noodles
Vegetables: Onions, Garlic, Bell peppers, Broccoli, Spinach, Mushrooms, Tomatoes
Staples: Cheese, Butter, Beans

REQUIRED JSON STRUCTURE:
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
      "aiLabel": "Fresh idea"
    }
  ]
}

LABEL RULE: Set "aiLabel" to "Made from your pantry" if the meal uses 2+ pantry ingredients; otherwise "Fresh idea".
TIME TAG: Include exactly one time tag in the tags array: "15 min", "20 min", "25 min", "30 min", "35 min", "40 min", or "45 min".`;
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
      sessionSeed = "",
      previousAIMealNames = [],
      existingDeckNames = [],
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
      sessionSeed?: string;
      previousAIMealNames?: string[];
      existingDeckNames?: string[];
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

    // Phase A: raised cap from 12 to 16 to accommodate Zone 2 (9 slots) + Zone 3 tail.
    const safeCount = Math.min(Math.max(1, Number(count) || 10), 16);

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
      sessionSeed: typeof sessionSeed === "string" ? sessionSeed : "",
      previousAIMealNames: Array.isArray(previousAIMealNames) ? previousAIMealNames : [],
      existingDeckNames: Array.isArray(existingDeckNames) ? existingDeckNames : [],
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
