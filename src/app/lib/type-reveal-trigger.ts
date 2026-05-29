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
 *   - Reveal already permanently shown (wwe_type_revealed === "true")
 *   - Reveal already queued and waiting (wwe_type_reveal_pending exists)
 *   - No userId available
 *
 * Only performs heavy work (Supabase count + DNA + AI name) on the very first
 * call that finds >= 7 accepted decisions.
 */
export async function checkAndTriggerTypeReveal(): Promise<void> {
  console.log('[type-reveal] checkAndTriggerTypeReveal called');
  if (typeof window === "undefined") return;
  if (localStorage.getItem("wwe_type_revealed") === "true") {
    console.log('[type-reveal] already revealed — skipping');
    return;
  }
  if (localStorage.getItem("wwe_type_reveal_pending")) {
    console.log('[type-reveal] already pending — skipping');
    return;
  }

  const userId = getUserId();
  if (!userId) return;

  // Quick count check — avoids heavy DNA computation in the common case.
  const { count } = await supabase
    .from("decisions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("outcome", "accepted");

  console.log('[type-reveal] decision count:', count);
  if (!count || count < 7) {
    console.log('[type-reveal] not enough decisions — skipping');
    return;
  }

  console.log('[type-reveal] threshold crossed — computing type');

  // Threshold crossed — compute solo DNA and derive the flavor type.
  // Dynamic import avoids any circular-dependency risk at module load time.
  const { getSoloDNA } = await import("./dna");
  const dna = await getSoloDNA(userId);
  if (!dna) return;

  // getFlavorType handles the pending-flag write and caching internally.
  await getFlavorType(dna, "solo", undefined, userId);
  console.log('[type-reveal] type computed, pending flag set?', localStorage.getItem('wwe_type_reveal_pending'));
}
