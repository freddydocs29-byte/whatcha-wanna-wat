import type { SoloDNA } from "./dna";
import { getUserId } from "./identity";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BaseFlavorType =
  | "anchor"
  | "explorer"
  | "creature_of_habit"
  | "comfort_seeker"
  | "night_owl"
  | "diplomat"
  | "wildcard"
  | "purist";

export type FlavorTypeResult = {
  baseType: BaseFlavorType;
  confidence: number;        // 0-1, how clearly they fit this type
  personalizedName: string;  // AI-generated unique name
  tagline: string;           // AI-generated one-line description
  signals: {                 // behavioral signals that drove this assignment
    label: string;
    value: string;
    strength: number;        // 0-1
  }[];
  assignedAt: string;        // ISO timestamp
  sessionCount: number;      // how many sessions they had when assigned
};

// ── Display label map ─────────────────────────────────────────────────────────

const BASE_TYPE_LABELS: Record<BaseFlavorType, string> = {
  anchor: "Anchor",
  explorer: "Explorer",
  creature_of_habit: "Creature of Habit",
  comfort_seeker: "Comfort Seeker",
  night_owl: "Night Owl",
  diplomat: "Diplomat",
  wildcard: "Wildcard",
  purist: "Purist",
};

export function getBaseTypeLabel(baseType: BaseFlavorType): string {
  return BASE_TYPE_LABELS[baseType];
}

// ── Fallback names ────────────────────────────────────────────────────────────

const FALLBACK_NAMES: Record<BaseFlavorType, { name: string; tagline: string }> = {
  anchor:           { name: "The Loyal Regular",       tagline: "Found what works. Never leaving." },
  explorer:         { name: "The Perpetual First Timer", tagline: "The menu is just a list of possibilities." },
  creature_of_habit:{ name: "The Devoted Repeater",    tagline: "Same meal. Every time. Zero regrets." },
  comfort_seeker:   { name: "The Comfort Architect",   tagline: "Dinner should feel like a hug." },
  night_owl:        { name: "The Late Night Decider",  tagline: "Best decisions happen after 10pm." },
  diplomat:         { name: "The Consensus Builder",   tagline: "Everyone eats well. That's the goal." },
  wildcard:         { name: "The Unpredictable One",   tagline: "The pattern is there are no patterns." },
  purist:           { name: "The Exacting Palate",     tagline: "Standards exist for a reason." },
};

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_PREFIX = "wwe_flavor_type_";
const NEW_DECISIONS_THRESHOLD = 5;

interface FlavorTypeCache {
  result: FlavorTypeResult;
  decisionCount: number;
}

function readCache(userId: string): FlavorTypeCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as FlavorTypeCache;
  } catch {
    return null;
  }
}

function writeCache(userId: string, data: FlavorTypeCache): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify(data));
  } catch {
    // Storage quota exceeded — non-fatal
  }
}

// ── Classifier ────────────────────────────────────────────────────────────────

/**
 * Applies behavioral rules to SoloDNA in priority order and returns the
 * best-fit base type, a confidence score, and the signals that drove it.
 */
export function classifyFlavorType(dna: SoloDNA): {
  baseType: BaseFlavorType;
  confidence: number;
  signals: FlavorTypeResult["signals"];
} {
  const uniqueCuisines = dna.topCuisines.length;
  const topCuisinePct = dna.topCuisines[0]?.pct ?? 0;
  const repeatMealCount = dna.allTimeNumber1?.count ?? 0;
  const comfortTagActive = dna.flavorTags.some(
    (t) => t.tag === "Comfort Seeker" && t.active
  );
  const repeatMeal = repeatMealCount >= 2;
  // SoloDNA does not expose shared-vs-solo decision split; diplomat requires it
  const sharedDecisionPct = 0;

  // ── Purist — very narrow taste, high hard NO count ────────────────────────
  // Signal: fewer than 3 unique cuisines AND totalDecisions >= 7
  if (uniqueCuisines < 3 && dna.totalDecisions >= 7) {
    return {
      baseType: "purist",
      confidence: Math.min(0.95, 0.7 + (3 - uniqueCuisines) * 0.1),
      signals: [
        {
          label: "Unique cuisines",
          value: String(uniqueCuisines),
          strength: Math.max(0, 1 - uniqueCuisines / 3),
        },
        {
          label: "Total decisions",
          value: String(dna.totalDecisions),
          strength: Math.min(1, dna.totalDecisions / 20),
        },
      ],
    };
  }

  // ── Anchor — always goes back to the same things ──────────────────────────
  // Signal: top cuisine > 70% of tagged decisions AND repeat rate high
  if (topCuisinePct >= 70 && repeatMealCount >= 2) {
    return {
      baseType: "anchor",
      confidence: Math.min(
        0.95,
        0.6 + (topCuisinePct - 70) / 100 + (repeatMealCount - 2) * 0.03
      ),
      signals: [
        {
          label: "Top cuisine",
          value: `${dna.topCuisines[0]?.cuisine ?? ""} ${topCuisinePct}%`,
          strength: topCuisinePct / 100,
        },
        {
          label: "Repeat meal count",
          value: `${repeatMealCount}×`,
          strength: Math.min(1, repeatMealCount / 5),
        },
      ],
    };
  }

  // ── Creature of Habit — same meal 3+ times ────────────────────────────────
  // Signal: allTimeNumber1 count >= 3
  if (repeatMealCount >= 3) {
    return {
      baseType: "creature_of_habit",
      confidence: Math.min(0.95, 0.6 + (repeatMealCount - 3) * 0.05),
      signals: [
        {
          label: "All-time #1",
          value: dna.allTimeNumber1?.mealName ?? "",
          strength: 1,
        },
        {
          label: "Times chosen",
          value: `${repeatMealCount}×`,
          strength: Math.min(1, repeatMealCount / 7),
        },
      ],
    };
  }

  // ── Comfort Seeker — comfort food dominates ───────────────────────────────
  // Signal: comfort flavor tag is active
  if (comfortTagActive && topCuisinePct < 60) {
    return {
      baseType: "comfort_seeker",
      confidence: 0.65,
      signals: [
        { label: "Comfort tag", value: "Active", strength: 0.8 },
        {
          label: "Top cuisine spread",
          value: `${topCuisinePct}%`,
          strength: Math.max(0, (60 - topCuisinePct) / 60),
        },
      ],
    };
  }

  // ── Night Owl — decides late consistently ─────────────────────────────────
  // Signal: mostActiveTimeOfDay === 'latenight'
  if (dna.mostActiveTimeOfDay === "latenight") {
    return {
      baseType: "night_owl",
      confidence: 0.75,
      signals: [
        { label: "Most active time", value: "Late night", strength: 0.9 },
      ],
    };
  }

  // ── Explorer — high cuisine variety ──────────────────────────────────────
  // Signal: 5+ unique cuisines, low repeat rate
  if (uniqueCuisines >= 5 && !repeatMeal) {
    return {
      baseType: "explorer",
      confidence: Math.min(0.9, 0.6 + (uniqueCuisines - 5) * 0.04),
      signals: [
        {
          label: "Unique cuisines",
          value: String(uniqueCuisines),
          strength: Math.min(1, uniqueCuisines / 8),
        },
        { label: "Repeat meals", value: "None", strength: 0.7 },
      ],
    };
  }

  // ── Diplomat — shared sessions dominate ──────────────────────────────────
  // Signal: more shared decisions than solo decisions
  if (sharedDecisionPct > 50) {
    return {
      baseType: "diplomat",
      confidence: 0.7,
      signals: [
        {
          label: "Shared decisions",
          value: `${sharedDecisionPct}%`,
          strength: sharedDecisionPct / 100,
        },
      ],
    };
  }

  // ── Wildcard — nothing fits clearly ──────────────────────────────────────
  // Signal: pattern confidence < 30%
  return {
    baseType: "wildcard",
    confidence: 0.4,
    signals: [{ label: "Pattern clarity", value: "Low", strength: 0.3 }],
  };
}

// ── AI name generator ─────────────────────────────────────────────────────────

async function generateFlavorTypeName(
  baseType: BaseFlavorType,
  dna: SoloDNA,
  userName?: string
): Promise<{ name: string; tagline: string }> {
  const fallback = FALLBACK_NAMES[baseType];
  try {
    const res = await fetch("/api/flavor-type", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseType, dna, userName }),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { name?: string | null; tagline?: string | null };
    if (!data.name || !data.tagline) return fallback;
    return { name: data.name, tagline: data.tagline };
  } catch {
    return fallback;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Returns the user's flavor type, including an AI-generated personalized name.
 *
 * Returns null when dna.totalDecisions < 7 — not enough data to assign a type.
 *
 * Result is cached in localStorage and regenerated when:
 * - No cache exists
 * - 5+ new decisions since last generation
 * - The base type would change
 */
export async function getFlavorType(
  dna: SoloDNA,
  userName?: string
): Promise<FlavorTypeResult | null> {
  if (dna.totalDecisions < 7) return null;

  const userId = getUserId();
  const classified = classifyFlavorType(dna);

  // Check cache — serve if still valid and type hasn't changed
  const cached = readCache(userId);
  if (cached) {
    const decisionDelta = dna.totalDecisions - cached.decisionCount;
    if (
      decisionDelta < NEW_DECISIONS_THRESHOLD &&
      cached.result.baseType === classified.baseType
    ) {
      return cached.result;
    }
  }

  // Generate fresh personalized name via AI (falls back to static name on failure)
  const { name, tagline } = await generateFlavorTypeName(
    classified.baseType,
    dna,
    userName
  );

  const result: FlavorTypeResult = {
    baseType: classified.baseType,
    confidence: classified.confidence,
    personalizedName: name,
    tagline,
    signals: classified.signals,
    assignedAt: new Date().toISOString(),
    sessionCount: dna.totalSessions,
  };

  writeCache(userId, { result, decisionCount: dna.totalDecisions });
  return result;
}
