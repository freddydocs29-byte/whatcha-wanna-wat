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
  firstMatchEver: string | null;
  inRut: boolean;
  rutType: "cuisine" | "category" | null;
  rutCuisine: string | null;
  rutCategory: string | null;
  rutLength: number;
  longestRut: number;
  longestRutType: "cuisine" | "category" | null;
  longestRutValue: string | null;
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
    firstMatchEver: null,
    inRut: false,
    rutType: null,
    rutCuisine: null,
    rutCategory: null,
    rutLength: 0,
    longestRut: 0,
    longestRutType: null,
    longestRutValue: null,
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

function computeRut(
  decisions: DecisionRow[],
  field: "cuisine_tag" | "archetype"
): {
  inRut: boolean;
  rutValue: string | null;
  rutLength: number;
  longestRut: number;
  longestRutValue: string | null;
} {
  const valid = decisions.filter((d) => d[field]);

  if (valid.length < 4) {
    return {
      inRut: false,
      rutValue: null,
      rutLength: 0,
      longestRut: 0,
      longestRutValue: null,
    };
  }

  const sorted = [...valid].sort(
    (a, b) => new Date(a.decided_at).getTime() - new Date(b.decided_at).getTime()
  );

  let currentStreak = 1;
  let currentValue = sorted[0][field] as string;
  let longestRut = 1;
  let longestRutValue: string | null = currentValue;

  for (let i = 1; i < sorted.length; i++) {
    const value = sorted[i][field] as string;

    if (value === currentValue) {
      currentStreak++;
    } else {
      currentStreak = 1;
      currentValue = value;
    }

    if (currentStreak > longestRut) {
      longestRut = currentStreak;
      longestRutValue = currentValue;
    }
  }

  const lastValue = sorted[sorted.length - 1][field] as string;
  let currentRutLength = 0;

  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i][field] === lastValue) currentRutLength++;
    else break;
  }

  const inRut = currentRutLength >= 4;

  return {
    inRut,
    rutValue: inRut ? lastValue : null,
    rutLength: inRut ? currentRutLength : 0,
    longestRut: longestRut >= 4 ? longestRut : 0,
    longestRutValue: longestRut >= 4 ? longestRutValue : null,
  };
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

/**
 * Normalises a userId param to an array of one or more IDs.
 * Filters out blanks so callers can pass getKnownUserIds() results directly.
 */
function toIds(userId: string | string[]): string[] {
  const ids = Array.isArray(userId) ? userId : [userId];
  return ids.filter(Boolean);
}

/**
 * Builds a Supabase OR-filter string that matches any of the given IDs
 * against two columns (e.g. "user_id_a" and "user_id_b").
 */
function buildPairOrFilter(ids: string[], colA: string, colB: string): string {
  return ids.flatMap((id) => [`${colA}.eq.${id}`, `${colB}.eq.${id}`]).join(",");
}

export async function getSoloDNA(userId: string | string[]): Promise<SoloDNA> {
  const ids = toIds(userId);
  const { data: decisions } = await supabase
    .from("decisions")
    .select("*")
    .in("user_id", ids)
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
  const taggedCount = rows.filter((d) => d.cuisine_tag).length;
  const topCuisines = Object.entries(cuisineCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cuisine, count]) => ({
      cuisine,
      count,
      pct: taggedCount > 0 ? Math.round((count / taggedCount) * 100) : 0,
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

  // First shared match ever — derived from accepted shared decisions
  const sharedDecisions = rows.filter((d) => d.session_type === "shared");
  const firstMatchEver =
    sharedDecisions.length > 0
      ? sharedDecisions.reduce((earliest, d) =>
          new Date(d.decided_at) < new Date(earliest.decided_at) ? d : earliest
        ).decided_at
      : null;

  // Rut detection — cuisine and category/archetype
  const cuisineRut = computeRut(rows, "cuisine_tag");
  const categoryRut = computeRut(rows, "archetype");

  // Pick the stronger/current rut: prefer active cuisine rut, then active category
  // rut, then whichever has the longer historical rut.
  let inRut = false;
  let rutType: SoloDNA["rutType"] = null;
  let rutCuisine: string | null = null;
  let rutCategory: string | null = null;
  let rutLength = 0;

  if (cuisineRut.inRut) {
    inRut = true;
    rutType = "cuisine";
    rutCuisine = cuisineRut.rutValue;
    rutLength = cuisineRut.rutLength;
  } else if (categoryRut.inRut) {
    inRut = true;
    rutType = "category";
    rutCategory = categoryRut.rutValue;
    rutLength = categoryRut.rutLength;
  }

  const longestRut = Math.max(cuisineRut.longestRut, categoryRut.longestRut);
  let longestRutType: SoloDNA["longestRutType"] = null;
  let longestRutValue: string | null = null;

  if (longestRut >= 4) {
    if (cuisineRut.longestRut >= categoryRut.longestRut) {
      longestRutType = "cuisine";
      longestRutValue = cuisineRut.longestRutValue;
    } else {
      longestRutType = "category";
      longestRutValue = categoryRut.longestRutValue;
    }
  }

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
    firstMatchEver,
    inRut,
    rutType,
    rutCuisine,
    rutCategory,
    rutLength,
    longestRut,
    longestRutType,
    longestRutValue,
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

export type PartnerInfo = {
  partnerId: string;
  sessionCount: number;
  matchCount: number;
  lastSessionAt: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export async function getAllPartners(userId: string | string[]): Promise<PartnerInfo[]> {
  const myIds = toIds(userId);
  const myIdSet = new Set(myIds);

  const { data: relationships } = await supabase
    .from("partner_relationships")
    .select("user_id_a, user_id_b, session_count, match_count")
    .or(buildPairOrFilter(myIds, "user_id_a", "user_id_b"))
    .order("session_count", { ascending: false });

  if (!relationships?.length) return [];

  // Deduplicate partners: a partner may appear under multiple of our IDs.
  // Keep the row with the highest session_count.
  const partnerMap = new Map<string, { sessionCount: number; matchCount: number }>();
  for (const r of relationships) {
    const pid = myIdSet.has(r.user_id_a as string)
      ? (r.user_id_b as string)
      : (r.user_id_a as string);
    if (myIdSet.has(pid)) continue; // skip rows where both sides are "us"
    const existing = partnerMap.get(pid);
    const sc = (r.session_count as number) ?? 0;
    if (!existing || sc > existing.sessionCount) {
      partnerMap.set(pid, { sessionCount: sc, matchCount: (r.match_count as number) ?? 0 });
    }
  }

  const partnerIds = Array.from(partnerMap.keys());
  if (!partnerIds.length) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", partnerIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p])
  );

  return partnerIds.map((partnerId) => {
    const rel = partnerMap.get(partnerId)!;
    const profile = profileMap.get(partnerId);
    return {
      partnerId,
      sessionCount: rel.sessionCount,
      matchCount: rel.matchCount,
      lastSessionAt: null,
      displayName: (profile?.display_name as string | null) ?? null,
      avatarUrl: (profile?.avatar_url as string | null) ?? null,
    };
  });
}

/**
 * Returns partners sorted by most-recently-shared session, with deduplication.
 * Falls back to getAllPartners (session-count order) if no sessions exist yet.
 * Used for homepage display — does not affect scoring or DNA computation.
 *
 * Accepts one or more user IDs so historical rows written under either the
 * localStorage UUID or the Supabase auth UUID are both found.
 */
export async function getRecentPartners(userId: string | string[]): Promise<PartnerInfo[]> {
  const myIds = toIds(userId);
  const myIdSet = new Set(myIds);

  // Query sessions with a real partner, most recent first
  const { data: sessions } = await supabase
    .from("sessions")
    .select("host_user_id, guest_user_id, created_at")
    .or(buildPairOrFilter(myIds, "host_user_id", "guest_user_id"))
    .not("guest_user_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!sessions?.length) {
    return getAllPartners(myIds);
  }

  // Deduplicate: first occurrence of each partner = most recent session
  const seen = new Set<string>();
  const recentPartnerIds: string[] = [];
  const latestSessionAt = new Map<string, string>();
  for (const s of sessions) {
    const partnerId = myIdSet.has(s.host_user_id as string)
      ? (s.guest_user_id as string)
      : (s.host_user_id as string);
    if (partnerId && !myIdSet.has(partnerId) && !seen.has(partnerId)) {
      seen.add(partnerId);
      recentPartnerIds.push(partnerId);
      latestSessionAt.set(partnerId, s.created_at as string);
    }
  }

  if (!recentPartnerIds.length) return getAllPartners(myIds);

  // Fetch profiles for recent partners
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", recentPartnerIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p])
  );

  // Fetch session/match counts from partner_relationships for PartnerInfo shape
  const { data: relationships } = await supabase
    .from("partner_relationships")
    .select("user_id_a, user_id_b, session_count, match_count")
    .or(buildPairOrFilter(myIds, "user_id_a", "user_id_b"));

  const relMap = new Map<string, { sessionCount: number; matchCount: number }>();
  for (const r of relationships ?? []) {
    const pid = myIdSet.has(r.user_id_a as string)
      ? (r.user_id_b as string)
      : (r.user_id_a as string);
    if (myIdSet.has(pid)) continue;
    const sc = (r.session_count as number) ?? 0;
    const existing = relMap.get(pid);
    if (!existing || sc > existing.sessionCount) {
      relMap.set(pid, { sessionCount: sc, matchCount: (r.match_count as number) ?? 0 });
    }
  }

  return recentPartnerIds.map((partnerId) => {
    const profile = profileMap.get(partnerId);
    const rel = relMap.get(partnerId);
    return {
      partnerId,
      sessionCount: rel?.sessionCount ?? 0,
      matchCount: rel?.matchCount ?? 0,
      lastSessionAt: latestSessionAt.get(partnerId) ?? null,
      displayName: (profile?.display_name as string | null) ?? null,
      avatarUrl: (profile?.avatar_url as string | null) ?? null,
    };
  });
}

export async function getCouplesDNA(
  userIdA: string,
  userIdB: string,
  knownUserIdsA?: string[]
): Promise<CouplesDNA> {
  // Build the list of IDs to try for user A. When the caller supplies
  // knownUserIdsA (localStorage UUID + auth UUID), rows written under either
  // identity are found even when the UUIDs differ across sessions.
  const idsA = knownUserIdsA?.length ? knownUserIdsA : [userIdA];

  // Build an OR filter across all combinations of idsA × [userIdB], with each
  // pair normalised through alphabetic sort to match the storage convention
  // (user_id_a ≤ user_id_b).
  const pairs = idsA.flatMap((a) => {
    const [sa, sb] = [a, userIdB].sort();
    return `and(user_id_a.eq.${sa},user_id_b.eq.${sb})`;
  });

  // Look up the best canonical relationship row — prefer the row with the
  // highest counts so fragmented duplicates don't hide real history.
  const { data: relData } = await supabase
    .from("partner_relationships")
    .select("last_session_id, session_count, match_count")
    .or(pairs.join(","))
    .order("session_count", { ascending: false })
    .order("match_count", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fallback: original exact-pair lookup in case the OR query yields nothing
  // (e.g. idsA is empty or the row predates knownUserIds support).
  let relationship = relData ?? null;
  if (!relationship) {
    const [sortedA, sortedB] = [userIdA, userIdB].sort();
    const { data: fallbackData } = await supabase
      .from("partner_relationships")
      .select("last_session_id, session_count, match_count")
      .eq("user_id_a", sortedA)
      .eq("user_id_b", sortedB)
      .maybeSingle();
    relationship = fallbackData ?? null;
  }

  if (!relationship) return emptyCouplesDNA();

  // Collect only the session IDs that belong to this exact pair so we don't
  // accidentally include shared decisions from sessions with other partners.
  const { data: pairSessions } = await supabase
    .from("sessions")
    .select("id, status")
    .or(
      `and(host_user_id.eq.${userIdA},guest_user_id.eq.${userIdB}),and(host_user_id.eq.${userIdB},guest_user_id.eq.${userIdA})`
    );

  // Count sessions the RPC marked as matched — this is the ground truth for
  // completed shared picks (the RPC sets status='matched' atomically).
  const totalMatchesTogether = (pairSessions ?? []).filter(
    (s) => (s as { id: string; status: string }).status === "matched"
  ).length;

  const pairSessionIds = (pairSessions ?? []).map((s) => (s as { id: string; status: string }).id);

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

  // Only include sessions where BOTH users have an accepted row — ignore
  // one-sided rows from incomplete/legacy sessions so couples DNA is never
  // computed from partial data.
  const grouped = new Map<string, { a: DecisionRow[]; b: DecisionRow[] }>();
  (sharedDecisions ?? []).forEach((d) => {
    const sid = (d as DecisionRow).session_id ?? "";
    if (!grouped.has(sid)) grouped.set(sid, { a: [], b: [] });
    const group = grouped.get(sid)!;
    if ((d as DecisionRow).user_id === userIdA) group.a.push(d as DecisionRow);
    else group.b.push(d as DecisionRow);
  });
  const rows: DecisionRow[] = [...grouped.values()]
    .filter((g) => g.a.length > 0 && g.b.length > 0)
    .flatMap((g) => [...g.a, ...g.b]);

  if (!rows.length) {
    // Return relationship counts even when no complete shared sessions exist yet
    return {
      ...emptyCouplesDNA(),
      totalMatchesTogether,
      totalSessionsTogether: (relationship.session_count as number) ?? 0,
    };
  }

  // Mutual cuisines
  const mutualCuisineCounts: Record<string, number> = {};
  rows.forEach((d) => {
    if (d.cuisine_tag)
      mutualCuisineCounts[d.cuisine_tag] =
        (mutualCuisineCounts[d.cuisine_tag] ?? 0) + 1;
  });
  const taggedCount = rows.filter((d) => d.cuisine_tag).length;
  const mutualCuisines = Object.entries(mutualCuisineCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cuisine, count]) => ({
      cuisine,
      count,
      pct: taggedCount > 0 ? Math.round((count / taggedCount) * 100) : 0,
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
    totalMatchesTogether,
    totalSessionsTogether: (relationship.session_count as number) ?? 0,
    fastestMatchTogether,
    avgMatchTimeTogether,
    compatibilityLabel: null, // type system not built yet
    userAFlavorTags: computeFlavorTags(userARows),
    userBFlavorTags: computeFlavorTags(userBRows),
  };
}

// ── Global shared decision count (all partners) ────────────────────────────
// Returns the number of matched sessions the user has participated in across
// ALL partners — not filtered by a specific partner. One count per session
// (no double-counting when both users have rows in the decisions table).
export async function getTotalSharedDecisions(userId: string | string[]): Promise<number> {
  const ids = toIds(userId);
  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .or(buildPairOrFilter(ids, "host_user_id", "guest_user_id"))
    .eq("status", "matched");

  if (error) {
    console.error("[getTotalSharedDecisions] query failed:", error);
    return 0;
  }

  return (data ?? []).length;
}
