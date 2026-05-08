import OpenAI from "openai";
import type { Meal } from "../../../data/meals";

type RawMeal = {
  id?: unknown;
  name?: unknown;
  cuisine?: unknown;
  category?: unknown;
  description?: unknown;
  tags?: unknown;
  ingredients?: unknown;
  whyItFits?: unknown;
  image?: unknown;
};

function isValidMeal(m: RawMeal): m is {
  id: string;
  name: string;
  cuisine: string;
  category: string;
  description: string;
  tags: string[];
  ingredients?: unknown[];
  whyItFits: string;
} {
  return (
    typeof m.id === "string" && m.id.trim() !== "" &&
    typeof m.name === "string" && m.name.trim() !== "" &&
    typeof m.cuisine === "string" && m.cuisine.trim() !== "" &&
    typeof m.category === "string" && m.category.trim() !== "" &&
    typeof m.description === "string" && m.description.trim() !== "" &&
    Array.isArray(m.tags) && m.tags.length > 0 &&
    typeof m.whyItFits === "string" && m.whyItFits.trim() !== ""
  );
}

export async function POST(req: Request): Promise<Response> {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
  }

  let cuisine: string;
  let count: number;
  try {
    const body = await req.json();
    cuisine = String(body.cuisine ?? "").trim();
    count = Math.min(Math.max(1, Number(body.count) || 10), 20);
    if (!cuisine) {
      return Response.json({ error: "cuisine is required" }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const systemMessage =
    "You generate meal data for a food recommendation app. Always respond with valid JSON only.";

  const userPrompt = `Generate ${count} authentic ${cuisine} meals.

Every meal must be genuinely ${cuisine} cuisine.
No fusion unless it is a defining characteristic of that cuisine.

Use only these categories:
Quick & casual, Comfort food, Bold flavors, Healthy, Elevated, Classic Italian, Mediterranean, Fresh, Crowd pleaser

Tags rules:
- First tag MUST be prep time — one of: 15 min, 20 min, 25 min, 30 min, 35 min, 40 min, 45 min, 60 min
- Add 2-3 more tags from: Easy, Kid-friendly, Pantry staple, Flavorful, Medium effort, High effort, Vegetarian, Vegan, Comfort, Light, Fresh, Bold, Elevated, Nutritious, Meal-prep friendly

Ingredients: 3-6 items, Title Case, coarse (e.g. Chicken not chicken breast)

description: 1-2 sentences, casual, sells it
whyItFits: 4-8 words, punchy one-liner — must reference something specific and authentic about the dish, not generic praise. Bad: "A crowd pleasing dish everyone loves". Good: "The char siu pork alone is worth making this".
id: kebab-case slug

Respond with JSON: { meals: [...] }

Each meal: {
  id, name,
  cuisine: "${cuisine}",
  category, description, tags,
  ingredients, whyItFits,
  image: ""
}`;

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.85,
      max_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";

    let parsed: { meals?: unknown[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("[admin/generate-meals] Failed to parse response:", raw.slice(0, 200));
      return Response.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    const rawMeals = Array.isArray(parsed.meals) ? (parsed.meals as RawMeal[]) : [];
    const validated: Meal[] = rawMeals
      .filter(isValidMeal)
      .map((m) => ({
        id: m.id.trim(),
        name: m.name.trim(),
        cuisine: m.cuisine.trim(),
        category: m.category.trim(),
        description: m.description.trim(),
        tags: (m.tags as string[]).map((t) => t.trim()),
        ingredients: Array.isArray(m.ingredients)
          ? (m.ingredients as unknown[]).filter((i): i is string => typeof i === "string")
          : [],
        whyItFits: m.whyItFits.trim(),
        image: "",
      }));

    console.log(`[admin/generate-meals] ✓ ${validated.length}/${rawMeals.length} meals valid · cuisine: ${cuisine}`);

    return Response.json({ meals: validated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn("[admin/generate-meals] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
