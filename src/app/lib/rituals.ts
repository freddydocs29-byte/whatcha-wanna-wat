/**
 * Ritual detection — finds repeated meal patterns from the decisions table
 * and surfaces proactive recommendations when a pattern matches the current
 * session context.
 *
 * DETECTION vs APPLICATION threshold (intentionally separate):
 *   Detection:    4+ accepted decisions in a context window → stored as a ritual
 *   Application:  confidence >= 0.6 AND daysSinceLastServed >= 5 → placed at position 0
 *   confidence = occurrences / 10, capped at 1.0  (so 6+ occurrences = eligible to apply)
 *
 * MATCHING priority (most specific first):
 *   A. Same meal_id + same (mealPeriod + dayType) → strongest signal
 *   B. Same category + same primary cuisine + same (mealPeriod + dayType) → fallback
 *      (only used when no type-A ritual matches the current context)
 *   NOTE: category + primary_tag is intentionally excluded — too broad for MVP.
 *
 * HARD GATE SAFETY:
 *   The caller must run hardGate on the ritual meal before placing it at position 0.
 *   User restrictions can change; rituals must never override current hard constraints.
 *
 * SUPPRESSION:
 *   If a proactively surfaced ritual meal is rejected 2+ times, suppress that
 *   context/meal pair for 30 days. The pattern may be ending.
 */

import { supabase } from "./supabase";
import { meals } from "../data/meals";

export type RitualDetection = {
  /** e.g. "friday-dinner", "weekday-dinner", "sunday-dinner" */
  context: string;
  mealId: string;
  mealName: string;
  category: string;
  occurrences: number;
  /** occurrences / 10, capped at 1.0 — requires 6+ to hit the 0.6 application threshold */
  confidence: number;
  lastServed: string; // ISO timestamp
  daysSinceLastServed: number;
  /** How the ritual was detected — for dev logging */
  matchType: "meal_id" | "category_cuisine";
};

// ── Suppression store (localStorage) ──────────────────────────────────────────

const RITUAL_REJECTION_KEY = "wwe_ritual_rejections";

type RitualRejectionStore = Record<
  string, // `${context}:${mealId}`
  { count: number; suppressedUntil?: string }
>;

function getRejectionStore(): RitualRejectionStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(RITUAL_REJECTION_KEY);
    return raw ? (JSON.parse(raw) as RitualRejectionStore) : {};
  } catch {
    return {};
  }
}

function setRejectionStore(store: RitualRejectionStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RITUAL_REJECTION_KEY, JSON.stringify(store));
}

/** Returns true if this ritual has been suppressed (rejected 2+ times recently). */
export function isRitualSuppressed(context: string, mealId: string): boolean {
  const store = getRejectionStore();
  const entry = store[`${context}:${mealId}`];
  if (!entry?.suppressedUntil) return false;
  return new Date(entry.suppressedUntil).getTime() > Date.now();
}

/**
 * Records a rejection of a proactively surfaced ritual meal.
 * Returns true if the ritual is now suppressed (hit the 2-rejection threshold).
 */
export function recordRitualRejection(context: string, mealId: string): boolean {
  const store = getRejectionStore();
  const key = `${context}:${mealId}`;
  const prev = store[key] ?? { count: 0 };
  const newCount = prev.count + 1;

  if (newCount >= 2) {
    const suppressedUntil = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    store[key] = { count: newCount, suppressedUntil };
    setRejectionStore(store);
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[rituals] suppressed ${context}:${mealId} for 30 days (rejected ${newCount}× as ritual)`,
      );
    }
    return true;
  }

  store[key] = { count: newCount };
  setRejectionStore(store);
  return false;
}

// ── Core detection ─────────────────────────────────────────────────────────────

/**
 * Queries the decisions table and finds meals accepted 4+ times in the same
 * meal_period + day_type context within the last 180 days.
 *
 * Matching order:
 *   1. Type A — same meal_id (specific; highest trust)
 *   2. Type B — same category + primary cuisine (fallback, only when no type-A
 *      ritual exists for that context). Surfaces the most common meal_id in
 *      the group so position 0 always shows a specific meal.
 *
 * Returns [] for users with fewer than 4 total accepted decisions.
 * Sorted descending by confidence so callers can take the first match.
 */
export async function detectRituals(userId: string): Promise<RitualDetection[]> {
  const since = new Date(
    Date.now() - 180 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("decisions")
    .select("meal_id, meal_name, meal_period, day_type, decided_at")
    .eq("user_id", userId)
    .eq("outcome", "accepted")
    .gte("decided_at", since)
    .order("decided_at", { ascending: false });

  if (error || !data || data.length < 4) return [];

  const mealLookup = new Map(meals.map((m) => [m.id, m]));
  const now = Date.now();

  // ── Type A: same meal_id + context ─────────────────────────────────────────

  type GroupA = {
    mealId: string;
    mealName: string;
    mealPeriod: string;
    dayType: string;
    occurrences: number;
    lastServed: string; // data is desc → first row per key = most recent
  };
  const groupsA: Record<string, GroupA> = {};

  for (const row of data) {
    const key = `${row.meal_id as string}:${row.meal_period as string}:${row.day_type as string}`;
    if (!groupsA[key]) {
      groupsA[key] = {
        mealId: row.meal_id as string,
        mealName: row.meal_name as string,
        mealPeriod: row.meal_period as string,
        dayType: row.day_type as string,
        occurrences: 0,
        lastServed: row.decided_at as string,
      };
    }
    groupsA[key].occurrences += 1;
  }

  const ritualsA: RitualDetection[] = [];
  const contextsCoveredByA = new Set<string>();

  for (const g of Object.values(groupsA)) {
    if (g.occurrences < 4) continue;
    const context = `${g.dayType}-${g.mealPeriod}`;
    const daysSinceLastServed = Math.floor(
      (now - new Date(g.lastServed).getTime()) / (1000 * 60 * 60 * 24),
    );
    const category = mealLookup.get(g.mealId)?.category ?? "";

    ritualsA.push({
      context,
      mealId: g.mealId,
      mealName: g.mealName,
      category,
      occurrences: g.occurrences,
      confidence: Math.min(1.0, g.occurrences / 10),
      lastServed: g.lastServed,
      daysSinceLastServed,
      matchType: "meal_id",
    });
    contextsCoveredByA.add(context);
  }

  // ── Type B: category + primary cuisine + context (fallback only) ────────────
  // Only computed for contexts where no type-A ritual was found.

  type GroupB = {
    category: string;
    primaryCuisine: string;
    mealPeriod: string;
    dayType: string;
    occurrences: number;
    lastServed: string;
    // Track per-meal_id counts to surface the most common one
    mealCounts: Record<string, { count: number; name: string }>;
  };
  const groupsB: Record<string, GroupB> = {};

  for (const row of data) {
    const mealPeriod = row.meal_period as string;
    const dayType = row.day_type as string;
    const context = `${dayType}-${mealPeriod}`;

    // Skip contexts already covered by a type-A ritual
    if (contextsCoveredByA.has(context)) continue;

    const mealObj = mealLookup.get(row.meal_id as string);
    if (!mealObj) continue;

    const primaryCuisine = mealObj.cuisine ?? "";
    if (!primaryCuisine) continue; // can't form a cuisine ritual without cuisine data

    const key = `${mealObj.category}:${primaryCuisine}:${mealPeriod}:${dayType}`;
    if (!groupsB[key]) {
      groupsB[key] = {
        category: mealObj.category,
        primaryCuisine,
        mealPeriod,
        dayType,
        occurrences: 0,
        lastServed: row.decided_at as string,
        mealCounts: {},
      };
    }
    const grp = groupsB[key];
    grp.occurrences += 1;

    const mealId = row.meal_id as string;
    if (!grp.mealCounts[mealId]) {
      grp.mealCounts[mealId] = { count: 0, name: row.meal_name as string };
    }
    grp.mealCounts[mealId].count += 1;
  }

  const ritualsB: RitualDetection[] = [];

  for (const g of Object.values(groupsB)) {
    if (g.occurrences < 4) continue;
    const context = `${g.dayType}-${g.mealPeriod}`;
    if (contextsCoveredByA.has(context)) continue; // double-check

    // Surface the most common meal_id within this category+cuisine+context group
    const topMeal = Object.entries(g.mealCounts).sort((a, b) => b[1].count - a[1].count)[0];
    if (!topMeal) continue;

    const [topMealId, topMealData] = topMeal;
    const daysSinceLastServed = Math.floor(
      (now - new Date(g.lastServed).getTime()) / (1000 * 60 * 60 * 24),
    );

    ritualsB.push({
      context,
      mealId: topMealId,
      mealName: topMealData.name,
      category: g.category,
      occurrences: g.occurrences,
      // Slightly discounted confidence for the fallback match type
      confidence: Math.min(1.0, g.occurrences / 12),
      lastServed: g.lastServed,
      daysSinceLastServed,
      matchType: "category_cuisine",
    });
  }

  const all = [...ritualsA, ...ritualsB].sort((a, b) => b.confidence - a.confidence);

  if (process.env.NODE_ENV === "development" && all.length > 0) {
    console.log(`[rituals] detected ${all.length} ritual(s) for user ${userId.slice(0, 8)}:`);
    all.slice(0, 5).forEach((r) => {
      console.log(
        `  ${r.context} · ${r.mealName} · ${r.occurrences}× · confidence ${r.confidence.toFixed(2)} · ${r.matchType} · ${r.daysSinceLastServed}d ago`,
      );
    });
  }

  return all;
}

// ── UI label ───────────────────────────────────────────────────────────────────

/**
 * Returns a warm, observational label for a ritual meal shown at position 0.
 * Quiet and personal — not "our algorithm detected," just noticed.
 */
export function getRitualLabel(context: string): string {
  const [dayType, mealPeriod] = context.split("-");

  if (dayType === "friday" && mealPeriod === "dinner") return "Your usual Friday dinner";
  if (dayType === "friday")                             return "Your Friday go-to";
  if (dayType === "sunday" && mealPeriod === "dinner")  return "You always go here on Sundays";
  if (dayType === "sunday")                             return "Your Sunday ritual";
  if (dayType === "weekend" && mealPeriod === "dinner") return "Your go-to weekend dinner";
  if (dayType === "weekend")                            return "Your go-to weekend meal";
  if (mealPeriod === "latenight")                       return "Your go-to late night";
  if (dayType === "weekday" && mealPeriod === "dinner") return "Your go-to weeknight meal";
  return "You always come back to this one";
}
