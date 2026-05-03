/**
 * Client-side helper for the AI Fresh Ideas layer.
 *
 * Responsibilities:
 *   1. Build the context payload from local user state
 *   2. Check sessionStorage cache before calling the server
 *   3. POST to /api/generate-meals (key never leaves the server)
 *   4. Return Meal[] ready to be hardGated + ranked by the caller
 *
 * This module is client-only — it uses sessionStorage and fetch.
 * Never import OpenAI here.
 */

import type { Meal } from "../data/meals";
import type { UserPreferences } from "./storage";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AIMealRequest {
  preferences: Pick<UserPreferences, "cuisines" | "dislikedFoods" | "spiceLevel" | "cookOrOrder">;
  partnerPreferences: { cuisines: string[]; dislikedFoods: string[] } | null;
  pantryIngredients: string[];
  timeBucket: "morning" | "dinner";
  cookMode: "cook" | "order" | "either";
  vibeMode: string;
  recentlySeenNames: string[];
  count?: number;
  /**
   * Phase 4B — cuisines underrepresented in Zones 1+2 of the composed deck.
   * When AI_DIVERSIFIER is on, the server prompt steers AI toward these cuisines.
   */
  cuisineGaps?: string[];
  /**
   * Phase 4C — when true, the server prompt instructs AI to suggest meals
   * deliberately outside the user's comfort zone (fires every 3 sessions).
   */
  challengerMode?: boolean;
  /**
   * Phase A — random phrase generated fresh each deck build.
   * Included in the cache key so the same preferences never return cached
   * results from a previous session.
   */
  sessionSeed?: string;
  /**
   * Names of AI-generated meals from the last 3 sessions.
   * Passed to the server prompt so the model explicitly avoids re-suggesting
   * meals it already produced — prevents AI self-repetition across sessions.
   */
  previousAIMealNames?: string[];
  /**
   * Names of static meals already placed in Zone 1 of the current deck.
   * Passed to the server prompt so the model avoids suggesting near-duplicates
   * of the anchored meals the user will already see.
   */
  existingDeckNames?: string[];
}

// ── Cache ────────────────────────────────────────────────────────────────────

const CACHE_PREFIX = "wwe_ai_meals_v1_";
// Phase A: reduced from 1 hour to 5 minutes. sessionSeed in the key already
// guarantees a fresh call per deck build; the short TTL is purely a cleanup
// mechanism so stale entries don't accumulate in sessionStorage.
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  meals: Meal[];
  ts: number;
}

function getCacheKey(req: AIMealRequest): string {
  const pantry = [...req.pantryIngredients].sort().join(",");
  const nos = [...req.preferences.dislikedFoods].sort().join(",");
  const cuisines = [...req.preferences.cuisines].sort().join(",");
  const partner = req.partnerPreferences
    ? [...(req.partnerPreferences.dislikedFoods)].sort().join(",")
    : "";
  // Phase 4B/4C — include gaps and challenger flag so context shifts get fresh results
  const gaps = [...(req.cuisineGaps ?? [])].sort().join(",");
  const challenger = req.challengerMode ? "1" : "0";
  // Phase A — sessionSeed makes every deck build a distinct cache key so we
  // never serve stale AI results from a previous session.
  const seed = req.sessionSeed ?? "";
  return `${CACHE_PREFIX}${pantry}|${nos}|${cuisines}|${partner}|${req.timeBucket}|${req.vibeMode}|${gaps}|${challenger}|${seed}`;
}

function readCache(key: string): Meal[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return entry.meals;
  } catch {
    return null;
  }
}

function writeCache(key: string, meals: Meal[]): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry = { meals, ts: Date.now() };
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // sessionStorage can throw when storage is full — silently skip
  }
}

// ── Main fetch ───────────────────────────────────────────────────────────────

/**
 * Fetch AI-generated meal ideas. Returns an empty array on any failure so
 * callers can silently fall back to the static deck.
 *
 * Results are cached in sessionStorage for 1 hour per unique context key.
 * The OpenAI API key is NEVER sent from this function — it only calls our own
 * /api/generate-meals route which reads the key from server env.
 */
export async function fetchAIMeals(req: AIMealRequest): Promise<Meal[]> {
  const cacheKey = getCacheKey(req);

  const cached = readCache(cacheKey);
  if (cached !== null) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[ai-meals] Cache hit · ${cached.length} meals · key: ${cacheKey.slice(CACHE_PREFIX.length, CACHE_PREFIX.length + 40)}…`);
    }
    return cached;
  }

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[ai-meals] Calling /api/generate-meals` +
        ` · pantry: [${req.pantryIngredients.join(", ")}]` +
        ` · hardNos: [${req.preferences.dislikedFoods.join(", ")}]` +
        ` · vibe: ${req.vibeMode}` +
        ` · time: ${req.timeBucket}`
    );
  }

  const resp = await fetch("/api/generate-meals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[ai-meals] Server returned ${resp.status}`);
    }
    return [];
  }

  const data: { meals?: Meal[] } = await resp.json();
  const meals = data.meals ?? [];

  if (meals.length > 0) {
    writeCache(cacheKey, meals);
  }

  if (process.env.NODE_ENV === "development") {
    console.log(`[ai-meals] Received ${meals.length} meals from server`);
  }

  return meals;
}
