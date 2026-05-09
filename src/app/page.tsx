"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "./components/BottomNav";
import { AnimatedHeadlineWord } from "./components/AnimatedHeadlineWord";
import SplashScreen from "./components/SplashScreen";
import { supabase } from "./lib/supabase";
import { getUserId } from "./lib/identity";
import {
  getSavedMeals,
  getFavorites,
  getHistory,
  hasCompletedOnboarding,
  markOnboardingDone,
  getTodaysPick,
  getStreak,
  clearTodaysPick,
  saveMeal,
  addFavorite,
  addToHistory,
  HistoryEntry,
} from "./lib/storage";
import { fetchProfileByAuthUserId } from "./lib/supabase-profile";
import { trackEvent } from "./lib/analytics";

function deriveInsights(history: HistoryEntry[]): string[] {
  if (history.length < 3) return [];

  const recent = history.slice(0, Math.min(10, history.length));
  const insights: string[] = [];

  // 1. Category pattern
  const catCounts: Record<string, number> = {};
  recent.forEach(({ meal }) => {
    catCounts[meal.category] = (catCounts[meal.category] || 0) + 1;
  });
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
  const catPhrases: Record<string, string> = {
    "Comfort food": "Leaning quick and comforting",
    "Quick & casual": "Keeping things fast and easy",
    "Healthy": "Keeping things on the lighter side",
    "Bold flavors": "Going for bold flavors lately",
    "Elevated": "Going a little fancy lately",
    "Classic Italian": "On an Italian kick lately",
    "Mediterranean": "Feeling Mediterranean lately",
    "Fresh": "Craving something fresh",
    "Crowd pleaser": "Sticking to crowd pleasers",
  };
  if (topCat && topCat[1] >= 2) {
    insights.push(catPhrases[topCat[0]] ?? `Drawn to ${topCat[0].toLowerCase()}`);
  }

  // 2. Tag pattern (speed/effort)
  const tagCounts: Record<string, number> = {};
  recent.forEach(({ meal }) => {
    meal.tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const quickCount = ["15 min", "20 min", "25 min"].reduce(
    (sum, t) => sum + (tagCounts[t] || 0),
    0,
  );
  if ((tagCounts["Easy"] || 0) >= 3 && insights.length < 2) {
    insights.push("Picking easy meals more often");
  } else if (quickCount >= 3 && insights.length < 2) {
    insights.push("Going for quick meals lately");
  }

  // 3. Protein/ingredient pattern
  const proteins = ["chicken", "beef", "shrimp", "salmon", "pork", "tofu", "eggs", "tuna"];
  const proteinCounts: Record<string, number> = {};
  recent.forEach(({ meal }) => {
    (meal.ingredients ?? []).forEach((ing) => {
      const lower = ing.toLowerCase();
      proteins.forEach((p) => {
        if (lower.includes(p)) proteinCounts[p] = (proteinCounts[p] || 0) + 1;
      });
    });
  });
  const topProtein = Object.entries(proteinCounts).sort((a, b) => b[1] - a[1])[0];
  if (topProtein && topProtein[1] >= 2 && insights.length < 2) {
    insights.push(`Picking ${topProtein[0]} often`);
  }

  // 4. Time-of-day pattern
  if (insights.length < 2) {
    const buckets: Record<string, number> = { morning: 0, lunch: 0, dinner: 0, late: 0 };
    recent.forEach(({ chosenAt }) => {
      const h = new Date(chosenAt).getHours();
      if (h < 11) buckets.morning++;
      else if (h < 15) buckets.lunch++;
      else if (h < 20) buckets.dinner++;
      else buckets.late++;
    });
    const topTime = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
    const timePhrases: Record<string, string> = {
      morning: "Deciding early — breakfast person?",
      lunch: "Most active around lunchtime",
      dinner: "Most active around dinner time",
      late: "A late-night decider",
    };
    if (topTime && topTime[1] >= 3) insights.push(timePhrases[topTime[0]]);
  }

  return insights.slice(0, 3);
}

export default function Home() {
  const router = useRouter();
  // showSplash: true when no Supabase session exists (logged-out user)
  // ready: true when session confirmed and home data loaded
  // While neither is set, we're waiting for the auth check — render null.
  const [showSplash, setShowSplash] = useState(false);
  const [ready, setReady] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [insights, setInsights] = useState<string[]>([]);
  const [todaysPick, setTodaysPick] = useState<HistoryEntry | null>(null);
  const [streak, setStreak] = useState(0);
  const [recentHistory, setRecentHistory] = useState<HistoryEntry[]>([]);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearStep, setClearStep] = useState<"confirm" | "completed" | "save">(
    "confirm",
  );
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAndRoute() {
      // getSession() reads from the Supabase localStorage cache — no network call.
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // No active session — show splash for logged-out users.
        setShowSplash(true);
        return;
      }

      // Session exists — check whether onboarding is complete.
      // Fast path: localStorage flag (same device as previous visit).
      if (!hasCompletedOnboarding()) {
        // Slow path: fetch Supabase profile (new device or cleared localStorage).
        // A profile is considered complete when display_name and at least one
        // cuisine preference are present.
        const profile = await fetchProfileByAuthUserId(session.user.id);
        const profileComplete =
          !!profile &&
          !!(profile.display_name) &&
          (profile.favorite_cuisines?.length ?? 0) > 0;

        if (!profileComplete) {
          router.replace("/onboarding");
          return;
        }
        // Profile is complete — set the flag so the next load uses the fast path.
        markOnboardingDone();
      }

      // Load home data.
      const saved = getSavedMeals();
      const favorites = getFavorites();
      const favoriteIds = new Set(favorites.map((m) => m.id));
      const savedForLater = saved.filter((m) => !favoriteIds.has(m.id));
      setSavedCount(favorites.length + savedForLater.length);
      const history = getHistory();
      setHistoryCount(history.length);
      setInsights(deriveInsights(history));
      setRecentHistory(history.slice(0, 8));
      setTodaysPick(getTodaysPick());
      setStreak(getStreak());
      setReady(true);

      // Track once per browser session so repeated navigations don't re-fire.
      if (!sessionStorage.getItem("wwe_app_opened")) {
        sessionStorage.setItem("wwe_app_opened", "1");
        trackEvent("app_opened");
      }
    }

    void checkAndRoute();
  }, [router]);

  function openClearModal() {
    setClearStep("confirm");
    setShowClearModal(true);
  }

  function closeClearModal() {
    setShowClearModal(false);
    setClearStep("confirm");
  }

  async function handleDecideWithSomeone() {
    setCreatingSession(true);
    setSessionError(null);

    // Diagnostic: log env var presence (not values) so preview failures are immediately visible
    console.log("[session] env check — NEXT_PUBLIC_SUPABASE_URL present:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("[session] env check — NEXT_PUBLIC_SUPABASE_ANON_KEY present:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    try {
      const hostId = getUserId();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("sessions")
        .insert({
          host_user_id: hostId,
          status: "waiting",
          expires_at: expiresAt,
          vibe: "mix-it-up",
          cooking_intent: "either",
        })
        .select()
        .single();

      if (error || !data) {
        console.error("[session] Failed to create session:", {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
        });
        const detail = [error?.code, error?.message].filter(Boolean).join(" — ");
        setSessionError(
          detail
            ? `Couldn't start a session: ${detail}`
            : "Couldn't start a session. Check your connection and try again.",
        );
        setCreatingSession(false);
        return;
      }

      trackEvent("shared_session_created", { sessionId: data.id });
      router.push(`/session/${data.id}`);
    } catch (e) {
      console.error("[session] Unexpected error:", e);
      setSessionError("Something went wrong. Please try again.");
      setCreatingSession(false);
    }
  }

  function recordPickIfNew() {
    if (!todaysPick) return;
    const today = new Date().toLocaleDateString();
    const alreadyToday = getHistory().some(
      (e) =>
        e.meal.id === todaysPick.meal.id &&
        new Date(e.chosenAt).toLocaleDateString() === today,
    );
    if (!alreadyToday) addToHistory(todaysPick.meal);
  }

  function handleClearDecision() {
    clearTodaysPick();
    setTodaysPick(null);
    setStreak(getStreak());
    setShowClearModal(false);
    setClearStep("confirm");
  }

  // Auth check in flight — render nothing to avoid a flash of splash for signed-in users.
  if (!showSplash && !ready) return null;

  // No session — logged-out user sees the splash.
  if (showSplash) {
    return (
      <SplashScreen
        onLetsGo={() => router.push("/auth?mode=signup")}
        onSignIn={() => router.push("/auth?mode=signin")}
      />
    );
  }

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  return (
    <main className="min-h-screen overflow-hidden bg-[#1C1A18] text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-6 safe-top">
        <div className="relative z-10 flex min-h-screen flex-col">

          {/* 1. TOP HEADER ROW */}
          <header className="flex items-center justify-between pt-4">
            <div />
            <Link
              href="/profile"
              className="w-11 h-11 rounded-full bg-[#E8621A] flex items-center justify-center font-display font-black text-lg text-white cursor-pointer"
            >
              W
            </Link>
          </header>

          {/* 2. GREETING BLOCK */}
          <section className="mt-8">
            {todaysPick ? (
              <>
                <h1 className="font-display font-black text-4xl text-white leading-tight">
                  We&apos;re eating
                  <br />
                  <span className="text-[#E8621A]">{todaysPick.meal.name}</span>
                  <br />
                  tonight.
                </h1>
                <p className="font-body text-base text-[#8A7F78] mt-2">
                  Already decided —{" "}
                  <button
                    onClick={openClearModal}
                    className="underline decoration-[#8A7F78]/50 underline-offset-2"
                  >
                    change it anytime.
                  </button>
                </p>
              </>
            ) : (
              <>
                <h1 className="font-display font-black text-4xl text-white leading-tight">
                  It&apos;s {timeOfDay} in Detroit.
                  <br />
                  <span className="text-[#E8621A]">Watcha wanna eat?</span>
                </h1>
                <p className="font-body text-base text-[#8A7F78] mt-2">
                  Your deck is ready.
                </p>
              </>
            )}
            {streak >= 1 && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs text-white/70">
                🔥 {streak} day streak
              </div>
            )}
          </section>

          {/* 3. HERO CARD — Decided meal or Deciding Together */}
          {todaysPick ? (
            <section className="bg-[#E8621A] rounded-[24px] p-6 mt-6">
              <p className="font-body text-sm text-white/70">You already picked</p>
              <h2 className="font-display font-black text-2xl text-white mt-1 leading-tight">
                {todaysPick.meal.name}
              </h2>
              {todaysPick.meal.whyItFits && (
                <p className="font-body text-sm text-white/80 mt-2 leading-relaxed">
                  {todaysPick.meal.whyItFits}
                </p>
              )}
              <div className="mt-5 grid gap-3">
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(todaysPick.meal.name + " recipe")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={recordPickIfNew}
                  className="block w-full bg-[#1C1A18] text-white font-display font-black text-base py-4 rounded-full text-center"
                >
                  Cook it
                </a>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(todaysPick.meal.name + " near me")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={recordPickIfNew}
                  className="block w-full bg-white/20 text-white font-display font-black text-base py-4 rounded-full text-center"
                >
                  Order it
                </a>
                <Link
                  href="/deck?change=1"
                  className="block w-full bg-transparent border border-white/30 text-white/80 font-display font-black text-base py-4 rounded-full text-center"
                >
                  Change it
                </Link>
              </div>
            </section>
          ) : (
            <section className="bg-[#E8621A] rounded-[24px] p-6 mt-6">
              <div className="flex items-start gap-4">
                <div className="flex flex-col">
                  <div className="w-14 h-14 rounded-[14px] bg-white/20 flex items-center justify-center text-3xl">
                    👥
                  </div>
                  <h2 className="font-display font-black text-xl text-white mt-3">
                    Deciding Together
                  </h2>
                  <p className="font-body text-sm text-white/80 mt-1">
                    Swipe with your group. Match on what everyone actually wants.
                  </p>
                </div>
              </div>
              <button
                onClick={() => { trackEvent("decide_with_someone_clicked"); void handleDecideWithSomeone(); }}
                disabled={creatingSession}
                className="w-full bg-[#1C1A18] text-white font-display font-black text-base py-4 rounded-full mt-5 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {creatingSession ? "Creating…" : "Start shared session →"}
              </button>
              {sessionError && (
                <p className="mt-3 text-center text-sm text-red-400">
                  {sessionError}
                </p>
              )}
            </section>
          )}

          {/* 4. SECONDARY CARDS ROW */}
          <div className="mt-4">
            {/* Card — Just Me */}
            <Link href="/deck" className="bg-[#2A2420] rounded-[20px] p-5 flex flex-col">
              <span className="text-2xl">🎯</span>
              <p className="font-display font-black text-lg text-white mt-3">Just Me</p>
              <p className="font-body text-sm text-[#8A7F78] mt-1">Solo swipe. Fast answer.</p>
            </Link>
          </div>

          {/* 5. RECENTLY DECIDED SECTION */}
          {recentHistory.length > 0 && (
            <div className="mt-8">
              <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-3">
                Recently Decided
              </p>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {recentHistory.map((entry) => (
                  <span
                    key={entry.meal.id + entry.chosenAt}
                    className="flex items-center gap-2 bg-[#2A2420] text-white font-body text-sm font-medium px-4 py-2 rounded-full whitespace-nowrap"
                  >
                    🍽️ {entry.meal.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 6. BOTTOM NAV */}
          <BottomNav />
        </div>
      </div>
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-5 pb-10">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeClearModal}
          />
          <div className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-[#111] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">

            {/* Step 1 — always visible */}
            <p className="text-lg font-semibold tracking-[-0.03em]">
              Clear today&apos;s decision?
            </p>
            <p className="mt-2 text-sm leading-6 text-white/50">
              You can always pick something new — this just resets today.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={closeClearModal}
                className="flex-1 rounded-full border border-white/10 bg-white/[0.05] py-3 text-sm font-medium text-white/70 transition active:scale-[0.98]"
              >
                Keep it
              </button>
              <button
                onClick={() => setClearStep("completed")}
                className="flex-1 rounded-full border border-white/15 bg-white/10 py-3 text-sm font-medium text-white transition hover:bg-white/15 active:scale-[0.98]"
              >
                Clear
              </button>
            </div>

            {/* Step 2 — did you eat it? */}
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                clearStep !== "confirm"
                  ? "grid-rows-[1fr]"
                  : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="mt-5 border-t border-white/10 pt-5">
                  <p className="text-base font-semibold tracking-[-0.02em]">
                    Did you cook or order this?
                  </p>
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => setClearStep("save")}
                      className="flex-1 rounded-full border border-white/10 bg-white/[0.05] py-3 text-sm font-medium text-white/70 transition active:scale-[0.98]"
                    >
                      Yes
                    </button>
                    <button
                      onClick={handleClearDecision}
                      className="flex-1 rounded-full border border-white/15 bg-white/10 py-3 text-sm font-medium text-white transition hover:bg-white/15 active:scale-[0.98]"
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 — save for later? */}
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                clearStep === "save"
                  ? "grid-rows-[1fr]"
                  : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="mt-5 border-t border-white/10 pt-5">
                  <p className="text-base font-semibold tracking-[-0.02em]">
                    Save it for later?
                  </p>
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => {
                        if (todaysPick) addFavorite(todaysPick.meal);
                        handleClearDecision();
                      }}
                      className="flex-1 rounded-full border border-white/10 bg-white/[0.05] py-2.5 text-sm font-medium text-white/70 transition active:scale-[0.98]"
                    >
                      ⭐ Favorite
                    </button>
                    <button
                      onClick={() => {
                        if (todaysPick) saveMeal(todaysPick.meal);
                        handleClearDecision();
                      }}
                      className="flex-1 rounded-full border border-white/10 bg-white/[0.05] py-2.5 text-sm font-medium text-white/70 transition active:scale-[0.98]"
                    >
                      🔖 Save
                    </button>
                    <button
                      onClick={handleClearDecision}
                      className="flex-1 rounded-full border border-white/15 bg-white/10 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 active:scale-[0.98]"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}
