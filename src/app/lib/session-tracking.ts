import { supabase } from "./supabase";
import { getUserId } from "./identity";
import type { Meal } from "../data/meals";

// ── Context inference ────────────────────────────────────────────────────────

export type MealPeriod = "breakfast" | "lunch" | "dinner" | "latenight";
export type DayType = "weekday" | "friday" | "weekend" | "sunday";
export type EffortBias = "low" | "medium" | "high";

export interface SessionContext {
  mealPeriod: MealPeriod;
  dayType: DayType;
  effortBias: EffortBias;
}

/**
 * Derives meal period, day type, and effort bias from a timestamp.
 * Pure function — no side effects, no imports.
 *
 * Meal periods:
 *   5:00–10:59  → breakfast
 *   11:00–14:59 → lunch
 *   15:00–20:59 → dinner
 *   21:00–4:59  → latenight
 *
 * Day types (sunday overrides weekend):
 *   Mon–Thu → weekday
 *   Fri     → friday
 *   Sat     → weekend
 *   Sun     → sunday
 *
 * Effort bias:
 *   latenight + weekday → low
 *   weekend or sunday   → high
 *   everything else     → medium
 */
export function inferSessionContext(timestamp: Date): SessionContext {
  const hour = timestamp.getHours();
  const day = timestamp.getDay(); // 0=Sun, 1=Mon … 5=Fri, 6=Sat

  // Meal period
  let mealPeriod: MealPeriod;
  if (hour >= 5 && hour < 11) {
    mealPeriod = "breakfast";
  } else if (hour >= 11 && hour < 15) {
    mealPeriod = "lunch";
  } else if (hour >= 15 && hour < 21) {
    mealPeriod = "dinner";
  } else {
    mealPeriod = "latenight";
  }

  // Day type — sunday explicitly overrides weekend
  let dayType: DayType;
  if (day === 0) {
    dayType = "sunday";
  } else if (day === 6) {
    dayType = "weekend";
  } else if (day === 5) {
    dayType = "friday";
  } else {
    dayType = "weekday";
  }

  // Effort bias
  let effortBias: EffortBias;
  if (mealPeriod === "latenight" && dayType === "weekday") {
    effortBias = "low";
  } else if (dayType === "weekend" || dayType === "sunday") {
    effortBias = "high";
  } else {
    effortBias = "medium";
  }

  return { mealPeriod, dayType, effortBias };
}

// ── Pending return check ─────────────────────────────────────────────────────
// After a resolved session, we store a token in localStorage. The next time the
// deck page mounts or gains visibility, we check if the user came back within
// 10 minutes — a "regret / second-thoughts" signal.

const RETURN_CHECK_KEY = "wwe_pending_return_check";

interface PendingReturnCheck {
  trackingSessionId: string;
  closedAt: string; // ISO timestamp
}

function storePendingReturnCheck(trackingSessionId: string): void {
  if (typeof window === "undefined") return;
  const entry: PendingReturnCheck = {
    trackingSessionId,
    closedAt: new Date().toISOString(),
  };
  localStorage.setItem(RETURN_CHECK_KEY, JSON.stringify(entry));
}

/**
 * Checks for a pending 10-minute return check and fires the DB update if
 * the user came back within the window. Always clears the localStorage entry
 * regardless of outcome. Safe to call on every deck mount — no-ops when there
 * is nothing to check.
 */
export function checkAndMarkReturn(): void {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(RETURN_CHECK_KEY);
  if (!raw) return;
  localStorage.removeItem(RETURN_CHECK_KEY);

  let entry: PendingReturnCheck;
  try {
    entry = JSON.parse(raw) as PendingReturnCheck;
  } catch {
    return;
  }

  const minutesElapsed = (Date.now() - new Date(entry.closedAt).getTime()) / 60_000;
  if (minutesElapsed >= 10) return;

  supabase
    .from("user_sessions")
    .update({ returned_within_10min: true })
    .eq("id", entry.trackingSessionId)
    .then(({ error }) => {
      if (error && process.env.NODE_ENV === "development") {
        console.warn("[session-tracking] markReturn failed:", error.message);
      }
    });
}

// ── Session lifecycle ────────────────────────────────────────────────────────

/**
 * Creates a user_sessions row and returns its UUID.
 * Called at deck mount — the returned promise is stored in a ref and awaited
 * only when a close/decision call needs the ID.
 * Returns null on failure; callers treat null as "tracking unavailable".
 */
export async function createTrackingSession(opts: {
  isGroupSession: boolean;
  groupSessionId?: string;
}): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const userId = getUserId();
  if (!userId) return null;

  const now = new Date();
  const { mealPeriod, dayType } = inferSessionContext(now);

  const { data, error } = await supabase
    .from("user_sessions")
    .insert({
      user_id: userId,
      opened_at: now.toISOString(),
      meal_period: mealPeriod,
      day_type: dayType,
      is_group_session: opts.isGroupSession,
      group_session_id: opts.groupSessionId ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[session-tracking] createTrackingSession failed:", error.message);
    }
    return null;
  }

  return (data as { id: string }).id;
}

/**
 * Closes a user_sessions row. Call on acceptance (resolved=true) or abandon
 * (resolved=false). Writes closed_at, final swipe count, and time-to-decision.
 * Stores a return-check token in localStorage when resolved=true.
 *
 * Fire-and-forget is fine for the abandon path; the acceptance path also does
 * not need to be awaited since navigation happens in parallel.
 */
export async function closeTrackingSession(opts: {
  trackingSessionId: string;
  resolved: boolean;
  swipeCount: number;
  openedAt: Date;
}): Promise<void> {
  const now = new Date();
  const timeToDecisionSeconds = opts.resolved
    ? Math.round((now.getTime() - opts.openedAt.getTime()) / 1000)
    : null;

  const { error } = await supabase
    .from("user_sessions")
    .update({
      closed_at: now.toISOString(),
      resolved: opts.resolved,
      swipe_count: opts.swipeCount,
      ...(timeToDecisionSeconds !== null
        ? { time_to_decision_seconds: timeToDecisionSeconds }
        : {}),
    })
    .eq("id", opts.trackingSessionId);

  if (error && process.env.NODE_ENV === "development") {
    console.warn("[session-tracking] closeTrackingSession failed:", error.message);
  }

  if (opts.resolved) {
    storePendingReturnCheck(opts.trackingSessionId);
  }
}

/**
 * Records a single meal decision row. Called on acceptance; the schema also
 * supports rejected/abandoned for future per-pass tracking.
 */
export async function recordDecision(opts: {
  trackingSessionId: string;
  meal: Meal;
  outcome: "accepted" | "rejected" | "abandoned";
  positionInDeck: number;
  isAiGenerated: boolean;
  rejectionReason?: string;
}): Promise<void> {
  if (typeof window === "undefined") return;

  const userId = getUserId();
  if (!userId) return;

  const now = new Date();
  const { mealPeriod, dayType } = inferSessionContext(now);

  const { error } = await supabase.from("decisions").insert({
    session_id: opts.trackingSessionId,
    user_id: userId,
    meal_id: opts.meal.id,
    meal_name: opts.meal.name,
    meal_period: mealPeriod,
    day_type: dayType,
    outcome: opts.outcome,
    rejection_reason: opts.rejectionReason ?? null,
    position_in_deck: opts.positionInDeck,
    decided_at: now.toISOString(),
    is_ai_generated: opts.isAiGenerated,
  });

  if (error && process.env.NODE_ENV === "development") {
    console.warn("[session-tracking] recordDecision failed:", error.message);
  }
}
