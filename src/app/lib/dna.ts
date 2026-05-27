import { supabase } from "./supabase";

// ── Extended decision row type ────────────────────────────────────────────────
// The base Decision type in supabase.ts reflects the original schema. These
// extra columns were added via migrations and are present in the live DB.

interface DecisionRow {
  id: string;
  session_id: string | null;
  user_id: string;
  meal_id: string;
  meal_name: string;
  meal_period: "breakfast" | "lunch" | "dinner" | "latenight";
  day_type: "weekday" | "friday" | "weekend" | "sunday";
  outcome: "accepted" | "rejected" | "abandoned";
  rejection_reason: string | null;
  position_in_deck: number;
  decided_at: string;
  is_ai_generated: boolean;
  session_type: "solo" | "shared" | "top5" | null;
  cuisine_tag: string | null;
  archetype: string | null;
  vibe_selection: string | null;
  time_to_match_seconds: number | null;
}

// ── Public return types ───────────────────────────────────────────────────────

export type SoloDNA = {
  topCuisines: { cuisine: string; count: number; pct: number }[];
  flavorTags: { tag: string; active: boolean }[];
  allTimeNumber1: { mealName: string; mealId: string; count: number } | null;
  totalDecisions: number;
  totalSessions: number;
  fastestMatchSeconds: number | null;
  avgSessionSeconds: number | null;
  currentStreakDays: number;
  longestStreakDays: number;
  mostActiveTimeOfDay: "morning" | "afternoon" | "latenight" | null;
  mostActiveDayType: "weekday" | "weekend" | null;
};

export type CouplesDNA = {
  mutualCuisines: { cuisine: string; count: number; pct: number }[];
  userAOnlyCuisines: string[];
  userBOnlyCuisines: string[];
  allTimeNumber1Together: { mealName: string; mealId: string; count: number } | null;
  totalMatchesTogether: number;
  totalSessionsTogether: number;
  fastestMatchTogether: number | null;
  avgMatchTimeTogether: number | null;
  compatibilityLabel: string | null;
  userAFlavorTags: { tag: string; active: boolean }[];
  userBFlavorTags: { tag: string; active: boolean }[];
};

// ── Empty fallbacks ───────────────────────────────────────────────────────────

function emptyDNA(): SoloDNA {
  return {
    topCuisines: [],
    flavorTags: [],
    allTimeNumber1: null,
    totalDecisions: 0,
    totalSessions: 0,
    fastestMatchSeconds: null,
    avgSessionSeconds: null,
    currentStreakDays: 0,
    longestStreakDays: 0,
    mostActiveTimeOfDay: null,
    mostActiveDayType: null,
  };
}

function emptyCouplesDNA(): CouplesDNA {
  return {
    mutualCuisines: [],
    userAOnlyCuisines: [],
    userBOnlyCuisines: [],
    allTimeNumber1Together: null,
    totalMatchesTogether: 0,
    totalSessionsTogether: 0,
    fastestMatchTogether: null,
    avgMatchTimeTogether: null,
    compatibilityLabel: null,
    userAFlavorTags: [],
    userBFlavorTags: [],
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function computeFlavorTags(decisions: DecisionRow[]): { tag: string; active: boolean }[] {
  const tags: { tag: string; active: boolean }[] = [];
  const total = decisions.length;
  if (!total) return tags;

  // Spice Lover — 3+ decisions with spicy/hot meal names
  const spicyCount = decisions.filter((d) =>
    d.meal_name?.toLowerCase().match(/spicy|curry|szechuan|jalapeño|habanero|sriracha|kimchi|jerk/)
  ).length;
  tags.push({ tag: "Spice Lover", active: spicyCount >= 3 });

  // Comfort Seeker — 50%+ decisions in comfort food archetype
  const comfortCount = decisions.filter((d) => d.archetype === "Comfort food").length;
  tags.push({ tag: "Comfort Seeker", active: comfortCount / total >= 0.5 });

  // Night Eater — 40%+ decisions in latenight period
  const nightCount = decisions.filter((d) => d.meal_period === "latenight").length;
  tags.push({ tag: "Night Eater", active: nightCount / total >= 0.4 });

  // Explorer — 5+ unique cuisines
  const uniqueCuisines = new Set(decisions.map((d) => d.cuisine_tag).filter(Boolean));
  tags.push({ tag: "Explorer", active: uniqueCuisines.size >= 5 });

  // Creature of Habit — same meal accepted 3+ times
  const mealCounts: Record<string, number> = {};
  decisions.forEach((d) => {
    mealCounts[d.meal_id] = (mealCounts[d.meal_id] ?? 0) + 1;
  });
  const repeatMeal = Object.values(mealCounts).some((c) => c >= 3);
  tags.push({ tag: "Creature of Habit", active: repeatMeal });

  // Weekend Warrior — 60%+ decisions on weekends (saturday + sunday)
  const weekendCount = decisions.filter(
    (d) => d.day_type === "weekend" || d.day_type === "sunday"
  ).length;
  tags.push({ tag: "Weekend Warrior", active: weekendCount / total >= 0.6 });

  return tags;
}

function computeStreak(decisions: DecisionRow[]): { current: number; longest: number } {
  if (!decisions.length) return { current: 0, longest: 0 };

  // Unique calendar dates, sorted descending
  const dates = [
    ...new Set(decisions.map((d) => new Date(d.decided_at).toDateString())),
  ]
    .map((s) => new Date(s))
    .sort((a, b) => b.getTime() - a.getTime());

  const todayStr = new Date().toDateString();
  const yesterdayStr = new Date(Date.now() - 86_400_000).toDateString();

  // Current streak — must start today or yesterday
  let current = 0;
  if (
    dates[0]?.toDateString() === todayStr ||
    dates[0]?.toDateString() === yesterdayStr
  ) {
    current = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff =
        (dates[i - 1].getTime() - dates[i].getTime()) / 86_400_000;
      if (Math.round(diff) === 1) current++;
      else break;
    }
  }

  // Longest streak
  let longest = dates.length > 0 ? 1 : 0;
  let running = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff =
      (dates[i - 1].getTime() - dates[i].getTime()) / 86_400_000;
    if (Math.round(diff) === 1) {
      running++;
      longest = Math.max(longest, running);
    } else {
      running = 1;
    }
  }

  return { current, longest };
}

/** Maps DB meal_period values to the three SoloDNA time-of-day buckets. */
function toTimeOfDay(
  period: "breakfast" | "lunch" | "dinner" | "latenight"
): "morning" | "afternoon" | "latenight" {
  if (period === "breakfast") return "morning";
  if (period === "latenight") return "latenight";
  return "afternoon"; // lunch + dinner
}

/** Collapses friday/sunday into the two SoloDNA day-type buckets. */
function toDayTypeBucket(
  day: "weekday" | "friday" | "weekend" | "sunday"
): "weekday" | "weekend" {
  return day === "weekend" || day === "sunday" ? "weekend" : "weekday";
}

// ── Public functions ──────────────────────────────────────────────────────────

export async function getSoloDNA(userId: string): Promise<SoloDNA> {
  const { data: decisions } = await supabase
    .from("decisions")
    .select("*")
    .eq("user_id", userId)
    .eq("outcome", "accepted")
    .order("decided_at", { ascending: false });

  if (!decisions?.length) return emptyDNA();

  const rows = decisions as DecisionRow[];

  // Top cuisines
  const cuisineCounts: Record<string, number> = {};
  rows.forEach((d) => {
    if (d.cuisine_tag)
      cuisineCounts[d.cuisine_tag] = (cuisineCounts[d.cuisine_tag] ?? 0) + 1;
  });
  const topCuisines = Object.entries(cuisineCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cuisine, count]) => ({
      cuisine,
      count,
      pct: Math.round((count / rows.length) * 100),
    }));

  // All-time #1 meal
  const mealCounts: Record<string, { name: string; count: number }> = {};
  rows.forEach((d) => {
    if (!mealCounts[d.meal_id])
      mealCounts[d.meal_id] = { name: d.meal_name, count: 0 };
    mealCounts[d.meal_id].count++;
  });
  const topMeal = Object.entries(mealCounts).sort(
    ([, a], [, b]) => b.count - a.count
  )[0];
  const allTimeNumber1 = topMeal
    ? {
        mealId: topMeal[0],
        mealName: topMeal[1].name,
        count: topMeal[1].count,
      }
    : null;

  // Flavor tags
  const flavorTags = computeFlavorTags(rows);

  // User sessions — use opened_at + ended_at + time_to_decision_seconds
  const { data: sessions } = await supabase
    .from("user_sessions")
    .select("opened_at, ended_at, time_to_decision_seconds")
    .eq("user_id", userId);

  const totalSessions = sessions?.length ?? 0;

  // Average session duration: prefer stored time_to_decision_seconds (resolved
  // sessions), fall back to ended_at − opened_at for non-resolved closed sessions.
  const sessionDurations: number[] = [];
  (sessions ?? []).forEach((s) => {
    if (typeof s.time_to_decision_seconds === "number") {
      sessionDurations.push(s.time_to_decision_seconds);
    } else if (s.ended_at && s.opened_at) {
      const sec =
        (new Date(s.ended_at as string).getTime() -
          new Date(s.opened_at as string).getTime()) /
        1000;
      if (sec > 0) sessionDurations.push(Math.round(sec));
    }
  });
  const avgSessionSeconds =
    sessionDurations.length > 0
      ? Math.round(
          sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
        )
      : null;

  // Fastest shared match from decisions
  const matchTimes = rows
    .filter(
      (d) =>
        d.session_type === "shared" &&
        typeof d.time_to_match_seconds === "number"
    )
    .map((d) => d.time_to_match_seconds as number);
  const fastestMatchSeconds =
    matchTimes.length > 0 ? Math.min(...matchTimes) : null;

  // Streak
  const { current: currentStreakDays, longest: longestStreakDays } =
    computeStreak(rows);

  // Most active time of day (map to three buckets)
  const todBuckets: Record<"morning" | "afternoon" | "latenight", number> = {
    morning: 0,
    afternoon: 0,
    latenight: 0,
  };
  rows.forEach((d) => {
    todBuckets[toTimeOfDay(d.meal_period)]++;
  });
  const todEntries = Object.entries(todBuckets) as [
    "morning" | "afternoon" | "latenight",
    number,
  ][];
  const topTod = todEntries.sort(([, a], [, b]) => b - a)[0];
  const mostActiveTimeOfDay: SoloDNA["mostActiveTimeOfDay"] =
    topTod && topTod[1] > 0 ? topTod[0] : null;

  // Most active day type (collapse to two buckets)
  const dayBuckets: Record<"weekday" | "weekend", number> = {
    weekday: 0,
    weekend: 0,
  };
  rows.forEach((d) => {
    dayBuckets[toDayTypeBucket(d.day_type)]++;
  });
  const dayEntries = Object.entries(dayBuckets) as [
    "weekday" | "weekend",
    number,
  ][];
  const topDay = dayEntries.sort(([, a], [, b]) => b - a)[0];
  const mostActiveDayType: SoloDNA["mostActiveDayType"] =
    topDay && topDay[1] > 0 ? topDay[0] : null;

  return {
    topCuisines,
    flavorTags,
    allTimeNumber1,
    totalDecisions: rows.length,
    totalSessions,
    fastestMatchSeconds,
    avgSessionSeconds,
    currentStreakDays,
    longestStreakDays,
    mostActiveTimeOfDay,
    mostActiveDayType,
  };
}

export async function getLatestPartner(
  userId: string
): Promise<{ partnerId: string } | null> {
  // user_id_a / user_id_b are stored sorted alphabetically
  const { data } = await supabase
    .from("partner_relationships")
    .select("user_id_a, user_id_b, session_count")
    .or(`user_id_a.eq.${userId},user_id_b.eq.${userId}`)
    .order("session_count", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const partnerId =
    (data.user_id_a as string) === userId
      ? (data.user_id_b as string)
      : (data.user_id_a as string);

  return { partnerId };
}

export async function getCouplesDNA(
  userIdA: string,
  userIdB: string
): Promise<CouplesDNA> {
  const [sortedA, sortedB] = [userIdA, userIdB].sort();

  // Look up the canonical relationship row for this pair
  const { data: relationship } = await supabase
    .from("partner_relationships")
    .select("last_session_id, session_count, match_count")
    .eq("user_id_a", sortedA)
    .eq("user_id_b", sortedB)
    .maybeSingle();

  if (!relationship) return emptyCouplesDNA();

  // Collect only the session IDs that belong to this exact pair so we don't
  // accidentally include shared decisions from sessions with other partners.
  const { data: pairSessions } = await supabase
    .from("sessions")
    .select("id")
    .or(
      `and(host_user_id.eq.${userIdA},guest_user_id.eq.${userIdB}),and(host_user_id.eq.${userIdB},guest_user_id.eq.${userIdA})`
    );

  const pairSessionIds = (pairSessions ?? []).map((s) => (s as { id: string }).id);

  // All accepted shared decisions for both users, scoped to this pair's sessions
  const { data: sharedDecisions } = pairSessionIds.length
    ? await supabase
        .from("decisions")
        .select("*")
        .in("user_id", [userIdA, userIdB])
        .eq("session_type", "shared")
        .eq("outcome", "accepted")
        .in("session_id", pairSessionIds)
    : { data: [] };

  if (!sharedDecisions?.length) {
    // Return relationship counts even when no decision rows exist yet
    return {
      ...emptyCouplesDNA(),
      totalMatchesTogether: (relationship.match_count as number) ?? 0,
      totalSessionsTogether: (relationship.session_count as number) ?? 0,
    };
  }

  const rows = sharedDecisions as DecisionRow[];

  // Mutual cuisines
  const mutualCuisineCounts: Record<string, number> = {};
  rows.forEach((d) => {
    if (d.cuisine_tag)
      mutualCuisineCounts[d.cuisine_tag] =
        (mutualCuisineCounts[d.cuisine_tag] ?? 0) + 1;
  });
  const total = rows.length;
  const mutualCuisines = Object.entries(mutualCuisineCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cuisine, count]) => ({
      cuisine,
      count,
      pct: Math.round((count / total) * 100),
    }));

  // All-time #1 together
  const mealCounts: Record<string, { name: string; count: number }> = {};
  rows.forEach((d) => {
    if (!mealCounts[d.meal_id])
      mealCounts[d.meal_id] = { name: d.meal_name, count: 0 };
    mealCounts[d.meal_id].count++;
  });
  const topMeal = Object.entries(mealCounts).sort(
    ([, a], [, b]) => b.count - a.count
  )[0];
  const allTimeNumber1Together = topMeal
    ? {
        mealId: topMeal[0],
        mealName: topMeal[1].name,
        count: topMeal[1].count,
      }
    : null;

  // Match timing
  const matchTimes = rows
    .filter(
      (d) => typeof d.time_to_match_seconds === "number"
    )
    .map((d) => d.time_to_match_seconds as number);
  const fastestMatchTogether =
    matchTimes.length > 0 ? Math.min(...matchTimes) : null;
  const avgMatchTimeTogether =
    matchTimes.length > 0
      ? Math.round(
          matchTimes.reduce((a, b) => a + b, 0) / matchTimes.length
        )
      : null;

  // Per-user flavor tags for the "where you differ" section
  const userARows = rows.filter((d) => d.user_id === userIdA);
  const userBRows = rows.filter((d) => d.user_id === userIdB);

  return {
    mutualCuisines,
    userAOnlyCuisines: [], // populated from solo DNA cross-ref when card ships
    userBOnlyCuisines: [],
    allTimeNumber1Together,
    totalMatchesTogether: (relationship.match_count as number) ?? 0,
    totalSessionsTogether: (relationship.session_count as number) ?? 0,
    fastestMatchTogether,
    avgMatchTimeTogether,
    compatibilityLabel: null, // type system not built yet
    userAFlavorTags: computeFlavorTags(userARows),
    userBFlavorTags: computeFlavorTags(userBRows),
  };
}
