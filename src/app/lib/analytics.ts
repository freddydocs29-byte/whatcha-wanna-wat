import { supabase } from "./supabase";
import { getUserId } from "./identity";

export type EventProperties = Record<string, unknown>;

const isProd = process.env.NODE_ENV === "production";

/**
 * Fire-and-forget analytics tracker.
 * Dev:  console.log only — no network calls.
 * Prod: insert into analytics_events; silent on failure.
 *
 * Never throws. Never awaited. Never blocks the UI.
 */
/**
 * Records which ingredient categories were passed on during a session.
 * Called when the session closes (unmount or beforeunload).
 * Used to build cross-session nudge candidates on the next session start.
 */
export function writeSessionCategoryPasses(
  userId: string,
  passSignals: Record<string, number>,
  ctx: { trackingSessionId?: string; mealPeriod: string; dayType: string },
): void {
  if (typeof window === "undefined") return;
  const categories = Object.keys(passSignals);
  if (categories.length === 0) return; // nothing to record

  supabase
    .from("analytics_events")
    .insert({
      user_id: userId,
      session_id: ctx.trackingSessionId ?? null,
      event_name: "session_category_passes",
      properties: {
        categories,
        ingredients: categories, // same granularity for now; ingredient groups = category labels
        sessionId: ctx.trackingSessionId ?? null,
        mealPeriod: ctx.mealPeriod,
        dayType: ctx.dayType,
        timestamp: new Date().toISOString(),
      },
    })
    .then(({ error }) => {
      void error; // intentionally silent
    });
}

export function trackEvent(
  eventName: string,
  properties: EventProperties = {},
): void {
  if (typeof window === "undefined") return; // skip SSR

  const payload: EventProperties = {
    ...properties,
    timestamp: new Date().toISOString(),
  };

  if (!isProd) {
    console.log("[analytics]", eventName, payload);
    return;
  }

  const userId = getUserId();

  supabase
    .from("analytics_events")
    .insert({
      user_id: userId || null,
      session_id: (properties.sessionId as string) ?? null,
      event_name: eventName,
      properties: payload,
    })
    .then(({ error }) => {
      void error; // intentionally silent in production
    });
}
