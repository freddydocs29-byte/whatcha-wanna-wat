import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { SoloDNA, CouplesDNA } from "../../lib/dna";
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
      dna?: SoloDNA;
      couplesDna?: CouplesDNA;
      userName?: string;
    };

    const { baseType, dna, couplesDna, userName } = body;
    if (!baseType || (!dna && !couplesDna)) {
      return NextResponse.json({ name: null, tagline: null });
    }

    const nameStr = userName ? `User name: ${userName}\n` : "";
    let userPrompt: string;

    if (couplesDna) {
      // ── Couples prompt ────────────────────────────────────────────────────
      const top1 = couplesDna.mutualCuisines[0];
      const top2 = couplesDna.mutualCuisines[1];
      const top3 = couplesDna.mutualCuisines[2];

      userPrompt = `${nameStr}Base type: ${baseType} (${TYPE_DESCRIPTIONS[baseType]})

Key behavioral data (from this couple's shared sessions):
- Top mutual cuisine: ${top1 ? `${top1.cuisine} (${top1.pct}%)` : "unknown"}
${top2 ? `- 2nd mutual cuisine: ${top2.cuisine} (${top2.pct}%)` : ""}
${top3 ? `- 3rd mutual cuisine: ${top3.cuisine} (${top3.pct}%)` : ""}
- All-time #1 together: ${couplesDna.allTimeNumber1Together ? `${couplesDna.allTimeNumber1Together.mealName} (matched ${couplesDna.allTimeNumber1Together.count}×)` : "none"}
- Total matches together: ${couplesDna.totalMatchesTogether}
- Unique cuisines explored together: ${couplesDna.mutualCuisines.length}
- Avg time to match: ${couplesDna.avgMatchTimeTogether != null ? `${couplesDna.avgMatchTimeTogether}s` : "unknown"}

This is a COUPLES eating type — name how this pair decides food together.
Return ONLY: { "name": "...", "tagline": "..." }`;
    } else if (dna) {
      // ── Solo prompt ───────────────────────────────────────────────────────
      const top1 = dna.topCuisines[0];
      const top2 = dna.topCuisines[1];
      const top3 = dna.topCuisines[2];
      // Only surface all-time #1 meal when it has been chosen 3+ times —
      // a single appearance is noise, not a pattern.
      const number1Line = dna.allTimeNumber1 && dna.allTimeNumber1.count >= 3
        ? `- All-time #1 meal: ${dna.allTimeNumber1.mealName} (chosen ${dna.allTimeNumber1.count}×)`
        : `- All-time #1 meal: none (no meal chosen 3+ times)`;
      const rutLine = dna.rutType
        ? `- Current rut: ${dna.rutType === "cuisine" ? dna.rutCuisine : dna.rutCategory} for ${dna.rutLength} decisions straight`
        : "";

      userPrompt = `${nameStr}Base type: ${baseType} (${TYPE_DESCRIPTIONS[baseType]})

Key behavioral data (aggregate across ALL decisions):
- Top cuisine: ${top1 ? `${top1.cuisine} (${top1.pct}%)` : "unknown"}
${top2 ? `- 2nd cuisine: ${top2.cuisine} (${top2.pct}%)` : ""}
${top3 ? `- 3rd cuisine: ${top3.cuisine} (${top3.pct}%)` : ""}
${number1Line}
- Most active time: ${dna.mostActiveTimeOfDay ?? "unknown"}
- Most active day type: ${dna.mostActiveDayType ?? "unknown"}
- Current streak: ${dna.currentStreakDays > 0 ? `${dna.currentStreakDays} days` : "none"}
${rutLine}
- Total decisions: ${dna.totalDecisions}
- Unique cuisines tried: ${dna.topCuisines.length}

IMPORTANT:
The name must reflect the user's OVERALL behavioral pattern across all decisions, not their most recent meal. Do not use a specific meal name unless it is the all-time #1 meal and was decided 3+ times. Prefer cuisine, behavior, time-of-day, rut, and repeated patterns over one-off meal names.

Examples:
Good:
- "The Morning Comfort Loyalist"
- "The American Breakfast Explorer"
- "The Weekday Routine Adventurer"
- "The Comfort Food Strategist"

Bad:
- "The Mac & Cheese Morning Maven" if mac & cheese only appeared once
- "The Focaccia Fanatic" if focaccia was just the latest decision

Generate a name and tagline for this person. Reference their specific aggregate data.
Return ONLY: { "name": "...", "tagline": "..." }`;
    } else {
      return NextResponse.json({ name: null, tagline: null });
    }

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
