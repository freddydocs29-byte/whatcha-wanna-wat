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

  // Threshold crossed — compute solo DNA and derive the flavor type.
  // Dynamic import avoids any circular-dependency risk at module load time.
  const { getSoloDNA } = await import("./dna");
  const dna = await getSoloDNA(userId);
  if (!dna) return;

  // getFlavorType handles the pending-flag write and caching internally.
  await getFlavorType(dna, "solo", undefined, userId);
}
