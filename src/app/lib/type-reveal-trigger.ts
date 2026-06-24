import { getUserId } from "./identity";
import { supabase } from "./supabase";
import { getFlavorType } from "./flavor-type";

/**
 * Fire-and-forget background check: after every accepted decision, see if the
 * user has just crossed the 7-decision threshold and queue the flavor-type
 * reveal if so.
 *
 * Exits immediately (no network) when:
 *   - Running on the server (typeof window === "undefined")
 *   - Reveal already queued and waiting (wwe_type_reveal_pending exists)
 *   - No userId available
 *
 * The per-type guard (wwe_type_last_revealed) lives inside getFlavorType so
 * it catches both trigger-path and profile-display-path calls uniformly.
 * Only performs heavy work (Supabase count + DNA + AI name) when needed.
 */
export async function checkAndTriggerTypeReveal(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("wwe_type_reveal_pending")) return;

  const userId = getUserId();
  if (!userId) return;

  // Quick count check — avoids heavy DNA computation in the common case.
  const { count } = await supabase
    .from("decisions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("outcome", "accepted");

  if (!count || count < 7) return;

  // Re-trigger gap guard: after the first reveal, only re-trigger when the
  // user has made ≥10 more accepted decisions since the last reveal.
  // wwe_type_last_revealed_at being absent means this is the first reveal —
  // in that case we fall through and show it.
  const lastRevealedAt = localStorage.getItem("wwe_type_last_revealed_at");
  if (lastRevealedAt) {
    const lastRevealedCount = Number.parseInt(
      localStorage.getItem("wwe_type_last_revealed_count") ?? "0",
      10
    );
    const decisionsSinceReveal =
      count - (Number.isFinite(lastRevealedCount) ? lastRevealedCount : 0);
    if (decisionsSinceReveal < 10) return;
  }

  // Threshold crossed — compute solo DNA and derive the flavor type.
  // Dynamic import avoids any circular-dependency risk at module load time.
  const { getSoloDNA } = await import("./dna");
  const dna = await getSoloDNA(userId);
  if (!dna) return;

  // getFlavorType handles the pending-flag write and caching internally.
  await getFlavorType(dna, "solo", undefined, userId);

  // Stamp the exact Supabase decision count into the pending payload so that
  // page.tsx can persist it as wwe_type_last_revealed_count when the reveal
  // is actually displayed. This keeps the re-trigger guard using the same
  // count value that crossed the threshold here.
  const pending = localStorage.getItem("wwe_type_reveal_pending");
  if (pending) {
    try {
      const payload = JSON.parse(pending) as {
        typeName: string;
        tagline: string;
        baseType?: string;
      };
      localStorage.setItem(
        "wwe_type_reveal_pending",
        JSON.stringify({ ...payload, decisionCount: count })
      );
    } catch {
      // Malformed payload — leave as-is; reveal still shows, count just won't persist.
    }
  }
}
