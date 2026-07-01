import { supabase } from "./supabase";
import { BADGE_ORDER, BadgeId, BadgeProgress } from "./badges";
import { meals } from "../data/meals";

// ---------------------------------------------------------------------------
// Cuisine fallback map — resolves cuisine for older decisions where
// cuisine_tag is null by looking up the static meal catalog.
// ---------------------------------------------------------------------------
const mealCuisineMap: Record<string, string> = {};
meals.forEach((m) => {
  mealCuisineMap[m.id] = m.cuisine;
});

// ---------------------------------------------------------------------------
// Streak helper — replicates computeStreak() from dna.ts without importing it.
// Uses Date.toDateString() for local-timezone day bucketing, matching dna.ts
// exactly. Accepts an array of decided_at ISO strings.
// ---------------------------------------------------------------------------
function computeCurrentStreak(decidedAts: string[]): number {
  if (!decidedAts.length) return 0;

  // Unique calendar dates, sorted descending
  const dates = [
    ...new Set(decidedAts.map((d) => new Date(d).toDateString())),
  ]
    .map((s) => new Date(s))
    .sort((a, b) => b.getTime() - a.getTime());

  const todayStr = new Date().toDateString();
  const yesterdayStr = new Date(Date.now() - 86_400_000).toDateString();

  // Current streak must start today or yesterday
  if (
    dates[0]?.toDateString() !== todayStr &&
    dates[0]?.toDateString() !== yesterdayStr
  ) {
    return 0;
  }

  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (dates[i - 1].getTime() - dates[i].getTime()) / 86_400_000;
    if (Math.round(diff) === 1) current++;
    else break;
  }
  return current;
}

// ---------------------------------------------------------------------------
// Shape of a raw decision row returned from Supabase
// ---------------------------------------------------------------------------
interface DecisionRow {
  meal_id: string;
  meal_period: string;
  session_type: string | null;
  cuisine_tag: string | null;
  decided_at: string;
  outcome: string;
}

// ---------------------------------------------------------------------------
// computeBadges
//
// Reads existing data from Supabase and returns badge progress for the given
// user. Read-only — no writes, no UI, no reveal logic.
// newlyEarned is always [] until persistence/reveal coordination is added.
// ---------------------------------------------------------------------------
export async function computeBadges(userId: string): Promise<{
  badges: BadgeProgress[];
  newlyEarned: BadgeId[];
}> {
  const fallback = {
    badges: BADGE_ORDER.map((id) => ({
      badgeId: id,
      earned: false,
      progress: 0,
    })),
    newlyEarned: [] as BadgeId[],
  };

  try {
    // -----------------------------------------------------------------------
    // Parallel queries — independent, no data dependencies between them
    // -----------------------------------------------------------------------
    const [profileResult, decisionsResult, partnershipsResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("is_founding_taster")
          .eq("user_id", userId)
          .maybeSingle(),

        supabase
          .from("decisions")
          .select(
            "meal_id, meal_period, session_type, cuisine_tag, decided_at, outcome",
          )
          .eq("user_id", userId)
          .in("outcome", ["accepted", "rejected"]),

        supabase
          .from("partner_relationships")
          .select("match_count")
          .or(`user_id_a.eq.${userId},user_id_b.eq.${userId}`)
          .order("match_count", { ascending: false })
          .limit(1),
      ]);

    const profile = profileResult.data;
    const decisions: DecisionRow[] = decisionsResult.data ?? [];
    const partnerships = partnershipsResult.data ?? [];

    // -----------------------------------------------------------------------
    // Derived subsets
    // -----------------------------------------------------------------------
    const acceptedDecisions = decisions.filter((d) => d.outcome === "accepted");

    // -----------------------------------------------------------------------
    // first_taster
    // -----------------------------------------------------------------------
    const firstTasterEarned = profile?.is_founding_taster === true;
    const firstTaster: BadgeProgress = {
      badgeId: "first_taster",
      earned: firstTasterEarned,
      progress: firstTasterEarned ? 1 : 0,
    };

    // -----------------------------------------------------------------------
    // first_bite — first accepted shared session match
    // -----------------------------------------------------------------------
    const acceptedShared = acceptedDecisions.filter(
      (d) => d.session_type === "shared",
    );
    const firstBiteEarned = acceptedShared.length >= 1;
    const firstBite: BadgeProgress = {
      badgeId: "first_bite",
      earned: firstBiteEarned,
      progress: firstBiteEarned ? 1 : 0,
      progressLabel: firstBiteEarned ? undefined : "Complete a shared session",
    };

    // -----------------------------------------------------------------------
    // tasty_buddy — 10 matches with one partner
    // -----------------------------------------------------------------------
    const maxMatchCount: number = partnerships[0]?.match_count ?? 0;
    const tastyBuddyEarned = maxMatchCount >= 10;
    const tastyBuddy: BadgeProgress = {
      badgeId: "tasty_buddy",
      earned: tastyBuddyEarned,
      progress: Math.min(maxMatchCount / 10, 1),
      progressLabel: tastyBuddyEarned
        ? undefined
        : `${maxMatchCount} / 10 matches`,
    };

    // -----------------------------------------------------------------------
    // night_owl — accepted match with meal_period === "latenight"
    // -----------------------------------------------------------------------
    const lateNightAccepted = acceptedDecisions.filter(
      (d) => d.meal_period === "latenight",
    );
    const nightOwlEarned = lateNightAccepted.length >= 1;
    const nightOwl: BadgeProgress = {
      badgeId: "night_owl",
      earned: nightOwlEarned,
      progress: nightOwlEarned ? 1 : 0,
      progressLabel: nightOwlEarned ? undefined : "Make a match after 9pm",
    };

    // -----------------------------------------------------------------------
    // explorer — 5 distinct cuisines matched
    // -----------------------------------------------------------------------
    const uniqueCuisines = new Set<string>();
    for (const d of acceptedDecisions) {
      const cuisine = d.cuisine_tag ?? mealCuisineMap[d.meal_id] ?? null;
      if (cuisine) uniqueCuisines.add(cuisine);
    }
    const explorerEarned = uniqueCuisines.size >= 5;
    const explorer: BadgeProgress = {
      badgeId: "explorer",
      earned: explorerEarned,
      progress: Math.min(uniqueCuisines.size / 5, 1),
      progressLabel: explorerEarned
        ? undefined
        : `${uniqueCuisines.size} / 5 cuisines`,
    };

    // -----------------------------------------------------------------------
    // on_a_streak — 3 consecutive calendar days with at least one decision
    // Uses all decisions (accepted + rejected) for engagement tracking.
    // -----------------------------------------------------------------------
    const currentStreak = computeCurrentStreak(
      decisions.map((d) => d.decided_at),
    );
    const onAStreakEarned = currentStreak >= 3;
    const onAStreak: BadgeProgress = {
      badgeId: "on_a_streak",
      earned: onAStreakEarned,
      progress: Math.min(currentStreak / 3, 1),
      progressLabel: onAStreakEarned
        ? undefined
        : `${currentStreak} / 3 days`,
    };

    // -----------------------------------------------------------------------
    // comfort_zone — same cuisine matched 5+ times
    // -----------------------------------------------------------------------
    const cuisineCounts: Record<string, number> = {};
    for (const d of acceptedDecisions) {
      const cuisine = d.cuisine_tag ?? mealCuisineMap[d.meal_id] ?? null;
      if (cuisine) {
        cuisineCounts[cuisine] = (cuisineCounts[cuisine] ?? 0) + 1;
      }
    }
    let maxCount = 0;
    let topCuisine: string | null = null;
    for (const [cuisine, count] of Object.entries(cuisineCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topCuisine = cuisine;
      }
    }
    const comfortZoneEarned = maxCount >= 5;
    const comfortZone: BadgeProgress = {
      badgeId: "comfort_zone",
      earned: comfortZoneEarned,
      progress: Math.min(maxCount / 5, 1),
      progressLabel: comfortZoneEarned
        ? undefined
        : topCuisine
          ? `${maxCount} / 5 ${topCuisine}`
          : `${maxCount} / 5 matches`,
    };

    // -----------------------------------------------------------------------
    // Assemble in BADGE_ORDER
    // -----------------------------------------------------------------------
    const badgeMap: Record<BadgeId, BadgeProgress> = {
      first_taster: firstTaster,
      first_bite: firstBite,
      tasty_buddy: tastyBuddy,
      night_owl: nightOwl,
      explorer: explorer,
      on_a_streak: onAStreak,
      comfort_zone: comfortZone,
    };

    const badges = BADGE_ORDER.map((id) => badgeMap[id]);

    return { badges, newlyEarned: [] };
  } catch (error) {
    console.error("[badges] computeBadges failed:", error);
    return fallback;
  }
}
