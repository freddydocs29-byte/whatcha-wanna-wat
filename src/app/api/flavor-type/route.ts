import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { SoloDNA } from "../../lib/dna";
import type { BaseFlavorType } from "../../lib/flavor-type";

// ── Type descriptions ─────────────────────────────────────────────────────────

const TYPE_DESCRIPTIONS: Record<BaseFlavorType, string> = {
  anchor: "Returns to the same cuisines and meals repeatedly — very loyal eater",
  explorer: "Constantly tries new cuisines, rarely repeats meals",
  creature_of_habit: "Orders the exact same meal over and over",
  comfort_seeker: "Gravitates toward familiar, comforting foods regardless of cuisine",
  night_owl: "Makes most food decisions late at night",
  diplomat: "Mostly decides food with others, adapts to group preferences",
  wildcard: "Unpredictable eating patterns — no clear dominant behavior",
  purist: "Extremely selective, very few cuisine types, high exacting standards",
};

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a food behavior analyst specializing in naming eating personalities.

Create a unique, specific 2-5 word type name and a punchy one-line tagline for a food personality type.

Rules:
- The name MUST reference their actual behavior data, not be generic
- The name should be memorable, slightly witty, and feel earned by the data
- The tagline should be 8-12 words, declarative, slightly dry humor
- Never be clinical or generic — make it feel personal
- Return ONLY JSON: { "name": "...", "tagline": "..." }

Good examples:
- Anchor + Mexican 82% + Birria Tacos 7x + latenight → { "name": "The Midnight Birria Loyalist", "tagline": "If it ain't broke, order it again." }
- Explorer + 7 cuisines + no repeats → { "name": "The Perpetual First Timer", "tagline": "The menu is just a list of possibilities." }
- Comfort Seeker + Italian 61% + Sunday → { "name": "The Sunday Pasta Ritualist", "tagline": "Sundays are for carbs. Non-negotiable." }
- Night Owl + latenight 70% + American → { "name": "The 11pm Hunger Settler", "tagline": "Dinner decisions wait for everyone else to sleep." }`;

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[flavor-type] OPENAI_API_KEY is not set");
    }
    return NextResponse.json({ name: null, tagline: null });
  }

  try {
    const body = (await req.json()) as {
      baseType: BaseFlavorType;
      dna: SoloDNA;
      userName?: string;
    };

    const { baseType, dna, userName } = body;
    if (!baseType || !dna) {
      return NextResponse.json({ name: null, tagline: null });
    }

    const nameStr = userName ? `User name: ${userName}\n` : "";
    const top1 = dna.topCuisines[0];
    const top2 = dna.topCuisines[1];
    const top3 = dna.topCuisines[2];

    const userPrompt = `${nameStr}Base type: ${baseType} (${TYPE_DESCRIPTIONS[baseType]})

Key behavioral data:
- Top cuisine: ${top1 ? `${top1.cuisine} (${top1.pct}%)` : "unknown"}
${top2 ? `- 2nd cuisine: ${top2.cuisine} (${top2.pct}%)` : ""}
${top3 ? `- 3rd cuisine: ${top3.cuisine} (${top3.pct}%)` : ""}
- All-time #1 meal: ${dna.allTimeNumber1 ? `${dna.allTimeNumber1.mealName} (chosen ${dna.allTimeNumber1.count}×)` : "none"}
- Most active time: ${dna.mostActiveTimeOfDay ?? "unknown"}
- Most active day type: ${dna.mostActiveDayType ?? "unknown"}
- Total decisions: ${dna.totalDecisions}
- Unique cuisines tried: ${dna.topCuisines.length}

Generate a name and tagline for this person. Reference their specific data.
Return ONLY: { "name": "...", "tagline": "..." }`;

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.85,
      max_tokens: 150,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";

    let name: string | undefined;
    let tagline: string | undefined;
    try {
      const parsed = JSON.parse(raw) as { name?: unknown; tagline?: unknown };
      name = typeof parsed.name === "string" ? parsed.name : undefined;
      tagline = typeof parsed.tagline === "string" ? parsed.tagline : undefined;
    } catch {
      if (process.env.NODE_ENV === "development") {
        console.warn("[flavor-type] Failed to parse response:", raw.slice(0, 200));
      }
      return NextResponse.json({ name: null, tagline: null });
    }

    if (!name || !tagline) {
      return NextResponse.json({ name: null, tagline: null });
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`[flavor-type] ✓ Generated: "${name}" — "${tagline}"`);
    }

    return NextResponse.json({ name, tagline });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[flavor-type] Error:", err);
    }
    return NextResponse.json({ name: null, tagline: null });
  }
}
