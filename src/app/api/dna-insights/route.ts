import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { SoloDNA, CouplesDNA } from "../../lib/dna";

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a food-decision data storyteller. Generate exactly 3 insights.

Rules:
- Specific not generic — use real numbers from the data
- Declarative not observational — never "You seem to prefer..."
- Conversational, slightly dry humor, never clinical
- One sentence each
- Maximum 12 words per insight
- Never make up data — only use what's in the DNA object provided
- Return exactly 3 insights as a JSON object: { "insights": ["...", "...", "..."] }

Good solo example: "Your fastest match was 47 seconds. Birria tacos. No debate."
Bad solo example: "You seem to enjoy Mexican cuisine quite frequently."

Good couples example: "Freddy goes spicy. Sade goes healthy. You find the middle."

For couples: reference both names when provided, highlight contrast, celebrate overlap, note ruts or speed records.`;

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildSoloPrompt(dna: SoloDNA, userName?: string): string {
  const nameStr = userName ? `User: ${userName}\n\n` : "";
  const data = {
    topCuisines: dna.topCuisines.slice(0, 3),
    totalDecisions: dna.totalDecisions,
    currentStreakDays: dna.currentStreakDays,
    longestStreakDays: dna.longestStreakDays,
    allTimeNumber1: dna.allTimeNumber1,
    fastestMatchSeconds: dna.fastestMatchSeconds,
    totalSessions: dna.totalSessions,
    mostActiveTimeOfDay: dna.mostActiveTimeOfDay,
    mostActiveDayType: dna.mostActiveDayType,
    firstMatchEver: dna.firstMatchEver ?? null,
    inRut: dna.inRut,
    rutType: dna.rutType,
    rutCuisine: dna.rutCuisine,
    rutCategory: dna.rutCategory,
    rutLength: dna.rutLength,
    longestRut: dna.longestRut,
    longestRutType: dna.longestRutType,
    longestRutValue: dna.longestRutValue,
  };
  return `${nameStr}Generate 3 solo insights from this DNA data:\n${JSON.stringify(data, null, 2)}\n\nReturn ONLY: { "insights": ["...", "...", "..."] }`;
}

function buildCouplesPrompt(
  dna: CouplesDNA,
  userAName?: string,
  userBName?: string
): string {
  const nameStr =
    userAName && userBName
      ? `Users: ${userAName} and ${userBName}\n\n`
      : userAName
      ? `User A: ${userAName}\n\n`
      : "";
  const data = {
    mutualCuisines: dna.mutualCuisines.slice(0, 3),
    userAOnlyCuisines: dna.userAOnlyCuisines.slice(0, 3),
    userBOnlyCuisines: dna.userBOnlyCuisines.slice(0, 3),
    allTimeNumber1Together: dna.allTimeNumber1Together,
    totalMatchesTogether: dna.totalMatchesTogether,
    totalSessionsTogether: dna.totalSessionsTogether,
    fastestMatchTogether: dna.fastestMatchTogether,
    avgMatchTimeTogether: dna.avgMatchTimeTogether,
  };
  return `${nameStr}Generate 3 couples insights from this DNA data:\n${JSON.stringify(data, null, 2)}\n\nReturn ONLY: { "insights": ["...", "...", "..."] }`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // OPENAI_API_KEY is never sent to the client — only available in server runtime.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[dna-insights] OPENAI_API_KEY is not set");
      return NextResponse.json({ insights: null, status: "failed", reason: "no_api_key" });
    }
    return NextResponse.json({ insights: null });
  }

  try {
    const body = (await req.json()) as {
      type: "solo" | "couples";
      dna: SoloDNA | CouplesDNA;
      userName?: string;
      userAName?: string;
      userBName?: string;
    };

    const { type, dna, userName, userAName, userBName } = body;

    if (!dna || (type !== "solo" && type !== "couples")) {
      return NextResponse.json({ insights: null });
    }

    const userPrompt =
      type === "solo"
        ? buildSoloPrompt(dna as SoloDNA, userName)
        : buildCouplesPrompt(dna as CouplesDNA, userAName, userBName);

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.75,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";

    let insights: string[];
    try {
      const parsed = JSON.parse(raw) as { insights?: unknown };
      if (!Array.isArray(parsed.insights) || parsed.insights.length !== 3) {
        throw new Error("Not a 3-element insights array");
      }
      insights = (parsed.insights as unknown[]).map(String);
    } catch {
      if (process.env.NODE_ENV === "development") {
        console.warn("[dna-insights] Failed to parse response:", raw.slice(0, 200));
        return NextResponse.json({ insights: null, status: "failed", reason: "json_parse_error" });
      }
      return NextResponse.json({ insights: null });
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`[dna-insights] ✓ ${insights.length} insights generated · type: ${type}`);
    }

    return NextResponse.json({ insights });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[dna-insights] Error:", err);
      return NextResponse.json({
        insights: null,
        status: "failed",
        reason: err instanceof Error ? err.message : "unknown_error",
      });
    }
    // Always return 200 — client falls back to template insights
    return NextResponse.json({ insights: null });
  }
}
