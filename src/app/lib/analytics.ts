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
