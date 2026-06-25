import { NextRequest, NextResponse } from "next/server";
import {
  getSoloDNA,
  getCouplesDNA,
  getAllPartners,
  getTotalSharedDecisions,
  type SoloDNA,
  type CouplesDNA,
  type PartnerInfo,
} from "../../../lib/dna";

// ── Response shape ─────────────────────────────────────────────────────────────

interface DNAResponse {
  solo: SoloDNA | null;
  couples: CouplesDNA | null;
  // getSoloInsights / getCouplesInsights read from localStorage and are not
  // server-safe. The API always returns null here; the Profile page generates
  // insights client-side using the existing helper functions.
  soloInsights: null;
  couplesInsights: null;
  partners: PartnerInfo[] | null;
  // Global count of matched shared sessions for this user across all partners.
  // Not filtered by partnerId — safe to use as a cumulative "With others" stat.
  totalSharedDecisions: number;
}

// ── GET /api/profile/dna ───────────────────────────────────────────────────────
// Query params:
//   userId      (required) — primary user ID (localStorage UUID)
//   allUserIds  (optional) — comma-separated list of all known IDs for this user
//                            (localStorage UUID + auth UUID); used for read queries
//                            so rows written under either identity are found
//   partnerId   (optional) — when provided, also loads couples DNA for this pair

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("userId");
  const partnerId = searchParams.get("partnerId") ?? undefined;
  // Parse allUserIds — falls back to [userId] if not provided
  const allUserIdsParam = searchParams.get("allUserIds");
  const queryIds: string[] = allUserIdsParam
    ? allUserIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : userId
    ? [userId]
    : [];

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  const result: DNAResponse = {
    solo: null,
    couples: null,
    soloInsights: null,
    couplesInsights: null,
    partners: null,
    totalSharedDecisions: 0,
  };

  // ── Solo DNA ──────────────────────────────────────────────────────────────
  try {
    result.solo = await getSoloDNA(queryIds);
  } catch (err) {
    console.error("[api/profile/dna] getSoloDNA failed:", err);
  }

  // ── Partners ──────────────────────────────────────────────────────────────
  try {
    result.partners = await getAllPartners(queryIds);
  } catch (err) {
    console.error("[api/profile/dna] getAllPartners failed:", err);
  }

  // ── Global shared decision count (all partners) ──────────────────────────
  try {
    result.totalSharedDecisions = await getTotalSharedDecisions(queryIds);
  } catch (err) {
    console.error("[api/profile/dna] getTotalSharedDecisions failed:", err);
  }

  // ── Couples DNA (only when partnerId provided) ────────────────────────────
  if (partnerId) {
    try {
      // Pass queryIds so getCouplesDNA can find rows written under either the
      // localStorage UUID or the auth UUID for the current user.
      result.couples = await getCouplesDNA(userId, partnerId, queryIds);
    } catch (err) {
      console.error("[api/profile/dna] getCouplesDNA failed:", err);
    }
  }

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, max-age=300",
    },
  });
}
