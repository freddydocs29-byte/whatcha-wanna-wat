import { getUserId, getKnownUserIds } from "./identity";
import { supabase } from "./supabase";
import { getFlavorType } from "./flavor-type";
import type { CouplesFlavor, Person } from "./couples-flavor-types";
import { baseTypeToCoupleType } from "./couples-flavor-types";

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

/**
 * Fire-and-forget background check for couples flavor type reveal.
 * Called after every shared session match completes.
 *
 * Idempotency guards (all exit early with no network):
 *   1. wwe_couples_type_reveal_pending already set
 *   2. Same type already revealed for this partner (wwe_couples_type_last_revealed_{partnerId})
 *   3. Match count unchanged since last check for this partner
 *
 * Accepts only userId + partnerId; fetches display names/avatars internally
 * since the call site (home page match detection) doesn't have that data in scope.
 */
export async function checkAndTriggerCouplesTypeReveal(
  userId: string,
  partnerId: string
): Promise<void> {
  if (typeof window === "undefined") return;

  // Guard 1 — reveal already queued
  // TODO(debug): Remove couples-reveal logs after reveal trigger is verified.
  if (localStorage.getItem("wwe_couples_type_reveal_pending")) {
    console.log("[couples-reveal]", "pending check", { hasPending: true });
    console.log("[couples-reveal]", "early return: pending already queued");
    return;
  }
  // TODO(debug): Remove couples-reveal logs after reveal trigger is verified.
  console.log("[couples-reveal]", "pending check", { hasPending: false });

  // Guard 3 — count unchanged since last check for this partner
  // (checked before any network calls for fast exit)
  const matchCountKey = `wwe_couples_type_last_match_count_${partnerId}`;

  // Dynamic imports to avoid circular-dependency risk at module load time
  const { getCouplesDNA } = await import("./dna");
  const knownIds = await getKnownUserIds();
  // TODO(debug): Remove couples-reveal logs after reveal trigger is verified.
  console.log("[couples-reveal]", "ids", { userId, partnerId, knownIds });
  const couplesDNA = await getCouplesDNA(userId, partnerId, knownIds);
  // TODO(debug): Remove couples-reveal logs after reveal trigger is verified.
  console.log("[couples-reveal]", "couplesDNA", {
    totalMatchesTogether: couplesDNA.totalMatchesTogether,
    mutualCuisines: couplesDNA.mutualCuisines,
    allTimeNumber1Together: couplesDNA.allTimeNumber1Together,
  });

  // TODO(debug): Remove couples-reveal logs after reveal trigger is verified.
  console.log("[couples-reveal]", "threshold check", {
    totalMatchesTogether: couplesDNA.totalMatchesTogether,
    meetsThreshold: couplesDNA.totalMatchesTogether >= 7,
  });
  if (couplesDNA.totalMatchesTogether < 7) {
    // TODO(debug): Remove couples-reveal logs after reveal trigger is verified.
    console.log("[couples-reveal]", "early return: below threshold");
    // Store whatever count we have so we skip the DNA fetch next time until it changes
    localStorage.setItem(matchCountKey, String(couplesDNA.totalMatchesTogether));
    return;
  }

  const lastMatchCount = Number.parseInt(
    localStorage.getItem(matchCountKey) ?? "-1",
    10
  );
  if (
    Number.isFinite(lastMatchCount) &&
    lastMatchCount === couplesDNA.totalMatchesTogether
  ) {
    return; // No new matches since last check
  }
  // Update the stored count now (before the expensive type computation)
  localStorage.setItem(matchCountKey, String(couplesDNA.totalMatchesTogether));

  // Compute the couples flavor type
  const result = await getFlavorType(couplesDNA, { partnerId }, undefined, userId);
  // TODO(debug): Remove couples-reveal logs after reveal trigger is verified.
  console.log("[couples-reveal]", "flavor result", result);
  if (!result) {
    // TODO(debug): Remove couples-reveal logs after reveal trigger is verified.
    console.log("[couples-reveal]", "early return: getFlavorType returned null");
    return;
  }

  // Guard 2 — same type already revealed for this partner
  const lastRevealedKey = `wwe_couples_type_last_revealed_${partnerId}`;
  // TODO(debug): Remove couples-reveal logs after reveal trigger is verified.
  console.log("[couples-reveal]", "last revealed check", {
    lastRevealed: localStorage.getItem("wwe_couples_type_last_revealed_" + partnerId),
  });
  if (localStorage.getItem(lastRevealedKey) === result.baseType) {
    // TODO(debug): Remove couples-reveal logs after reveal trigger is verified.
    console.log("[couples-reveal]", "early return: same type already revealed");
    return;
  }

  // Guard 1 re-check — another async path may have set it while we were computing
  if (localStorage.getItem("wwe_couples_type_reveal_pending")) return;

  // Fetch display names and avatars for both users
  const [{ data: userProfile }, { data: partnerProfile }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("display_name, avatar_url").eq("user_id", partnerId).maybeSingle(),
  ]);

  const userName: string = (userProfile?.display_name as string | null) ?? "You";
  const userAvatarUrl: string = (userProfile?.avatar_url as string | null) ?? "";
  const partnerName: string = (partnerProfile?.display_name as string | null) ?? "Partner";
  const partnerAvatarUrl: string = (partnerProfile?.avatar_url as string | null) ?? "";

  // Format avgMatchTime from seconds
  const avgSec = couplesDNA.avgMatchTimeTogether;
  let avgMatchTime = "—";
  if (avgSec !== null && avgSec > 0) {
    if (avgSec < 60) {
      avgMatchTime = `${Math.round(avgSec)} sec`;
    } else if (avgSec < 300) {
      avgMatchTime = `${Math.round(avgSec / 60)} min flat`;
    } else {
      avgMatchTime = `${Math.round(avgSec / 60)} min`;
    }
  }

  const safePeople: [Person, Person] = [
    {
      name: userName?.trim() || "You",
      avatarUrl: userAvatarUrl || "",
    },
    {
      name: partnerName?.trim() || "Partner",
      avatarUrl: partnerAvatarUrl || "",
    },
  ];

  const payload: CouplesFlavor & { baseType: string } = {
    type: baseTypeToCoupleType(result.baseType) ?? "wildcard",
    people: safePeople,
    totalMatches: couplesDNA.totalMatchesTogether,
    topMeal: couplesDNA.allTimeNumber1Together?.mealName ?? "",
    topCuisine: couplesDNA.mutualCuisines[0]?.cuisine ?? "",
    avgMatchTime,
    partnerId,
    baseType: result.baseType,
  };

  // TODO(debug): Remove couples-reveal logs after reveal trigger is verified.
  console.log("[couples-reveal]", "pending written", { type: result.baseType });
  localStorage.setItem("wwe_couples_type_reveal_pending", JSON.stringify(payload));
}
