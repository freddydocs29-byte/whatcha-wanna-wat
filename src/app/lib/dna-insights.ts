import type { SoloDNA, CouplesDNA } from "./dna";
import { getUserId } from "./identity";

// ── Cache types ───────────────────────────────────────────────────────────────

interface InsightCache {
  insights: string[];
  generatedAt: string;
  decisionCount: number;
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

const CACHE_STALE_DAYS = 7;
const CACHE_NEW_DECISIONS_THRESHOLD = 5;

function readCache(key: string): InsightCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as InsightCache;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: InsightCache): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage quota exceeded — non-fatal
  }
}

function isCacheValid(cache: InsightCache, currentDecisionCount: number): boolean {
  if (currentDecisionCount - cache.decisionCount >= CACHE_NEW_DECISIONS_THRESHOLD) return false;
  const ageMs = Date.now() - new Date(cache.generatedAt).getTime();
  if (ageMs >= CACHE_STALE_DAYS * 24 * 60 * 60 * 1000) return false;
  return true;
}

// ── Fallback insights ─────────────────────────────────────────────────────────

function soloFallbacks(dna: SoloDNA): string[] {
  const topCuisine = dna.topCuisines[0]?.cuisine ?? "Your top cuisine";
  const topCuisinePct = dna.topCuisines[0]?.pct ?? 0;
  return [
    `${topCuisine} wins ${topCuisinePct}% of the time. The data doesn't lie.`,
    `${dna.totalDecisions} decisions made. Zero regrets.`,
    `${dna.currentStreakDays} day streak. The indecision era is over.`,
  ];
}

function couplesFallbacks(dna: CouplesDNA): string[] {
  const allTime = dna.allTimeNumber1Together;
  return [
    allTime
      ? `${dna.totalMatchesTogether} matches. ${allTime.mealName} leads the count.`
      : `${dna.totalMatchesTogether} matches together. Still counting.`,
    `${dna.totalSessionsTogether} sessions together. Still going.`,
    dna.fastestMatchTogether !== null
      ? `Your fastest match was ${dna.fastestMatchTogether} seconds. Someone knew immediately.`
      : `${dna.totalMatchesTogether} matches made. No hesitation required.`,
  ];
}

// ── AI fetch ──────────────────────────────────────────────────────────────────

async function fetchInsightsFromAI(
  type: "solo" | "couples",
  dna: SoloDNA | CouplesDNA,
  userName?: string,
  userAName?: string,
  userBName?: string
): Promise<string[] | null> {
  try {
    const res = await fetch("/api/dna-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, dna, userName, userAName, userBName }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { insights?: unknown };
    if (!Array.isArray(data.insights) || data.insights.length !== 3) return null;
    return (data.insights as unknown[]).map(String);
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns 3 personalized insights for a solo user.
 * Reads from localStorage cache; regenerates via AI when stale.
 * Falls back to template-based insights if the API call fails.
 */
export async function getSoloInsights(
  dna: SoloDNA,
  userName?: string
): Promise<string[]> {
  const userId = getUserId();
  const cacheKey = `wwe_insights_${userId}`;
  const currentDecisionCount = dna.totalDecisions;

  const cached = readCache(cacheKey);
  if (cached && isCacheValid(cached, currentDecisionCount)) {
    return cached.insights;
  }

  const aiInsights = await fetchInsightsFromAI("solo", dna, userName);
  const insights = aiInsights ?? soloFallbacks(dna);

  writeCache(cacheKey, {
    insights,
    generatedAt: new Date().toISOString(),
    decisionCount: currentDecisionCount,
  });

  return insights;
}

/**
 * Returns 3 personalized insights for a couple.
 * Reads from localStorage cache keyed by both user IDs; regenerates via AI when stale.
 * Falls back to template-based insights if the API call fails.
 *
 * @param userIdA - Current user's ID (falls back to getUserId() if omitted)
 * @param userIdB - Partner's ID (required for a stable cache key)
 */
export async function getCouplesInsights(
  dna: CouplesDNA,
  userAName?: string,
  userBName?: string,
  userIdA?: string,
  userIdB?: string
): Promise<string[]> {
  const idA = userIdA ?? getUserId();
  const idB = userIdB ?? "";
  const cacheKey = idB
    ? `wwe_insights_${idA}_${idB}`
    : `wwe_insights_${idA}_couples`;
  const currentDecisionCount = dna.totalMatchesTogether;

  const cached = readCache(cacheKey);
  if (cached && isCacheValid(cached, currentDecisionCount)) {
    return cached.insights;
  }

  const aiInsights = await fetchInsightsFromAI(
    "couples",
    dna,
    undefined,
    userAName,
    userBName
  );
  const insights = aiInsights ?? couplesFallbacks(dna);

  writeCache(cacheKey, {
    insights,
    generatedAt: new Date().toISOString(),
    decisionCount: currentDecisionCount,
  });

  return insights;
}
