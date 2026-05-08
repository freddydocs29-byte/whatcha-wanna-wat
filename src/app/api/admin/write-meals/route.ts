import fs from "fs";
import path from "path";
import type { Meal } from "../../../data/meals";

function formatMeal(m: Meal): string {
  const tags = JSON.stringify(m.tags);
  const ings = m.ingredients && m.ingredients.length > 0
    ? `\n    ingredients: ${JSON.stringify(m.ingredients)},`
    : "";
  return `  {
    id: "${m.id}",
    name: "${m.name}",
    cuisine: "${m.cuisine}",
    category: "${m.category}",
    description: "${m.description.replace(/"/g, '\\"')}",
    tags: ${tags},${ings}
    whyItFits: "${m.whyItFits.replace(/"/g, '\\"')}",
    image: "",
  },`;
}

export async function POST(req: Request): Promise<Response> {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }

  let meals: Meal[];
  try {
    const body = await req.json();
    if (!Array.isArray(body.meals)) {
      return Response.json({ error: "meals must be an array" }, { status: 400 });
    }
    meals = body.meals as Meal[];
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (meals.length === 0) {
    return Response.json({ error: "No meals provided" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "src/app/data/meals.ts");

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `Could not read meals.ts: ${message}` }, { status: 500 });
  }

  const insertionIdx = content.lastIndexOf("];");
  if (insertionIdx === -1) {
    return Response.json({ error: "Could not find insertion point in meals.ts" }, { status: 500 });
  }

  const newMeals = "\n" + meals.map(formatMeal).join("\n") + "\n";
  const updated = content.slice(0, insertionIdx) + newMeals + content.slice(insertionIdx);

  try {
    fs.writeFileSync(filePath, updated, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `Could not write meals.ts: ${message}` }, { status: 500 });
  }

  console.log(`[admin/write-meals] ✓ Wrote ${meals.length} meals to meals.ts`);

  return Response.json({ success: true, count: meals.length });
}
