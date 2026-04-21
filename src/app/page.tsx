"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "./components/BottomNav";
import {
  getSavedMeals,
  getFavorites,
  getHistory,
  hasCompletedOnboarding,
  getTodaysPick,
  getStreak,
  clearTodaysPick,
  saveMeal,
  addFavorite,
  getPreferences,
  getTasteProfile,
  getFlavorProfile,
  getRecentlySeenIds,
  getLastDecidePick,
  setLastDecidePick,
  addToHistory,
  HistoryEntry,
} from "./lib/storage";
import { meals } from "./data/meals";
import { rankMeals } from "./lib/scoring";
import SaveLaterButton from "./locked/SaveLaterButton";

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
  const [ready, setReady] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [insights, setInsights] = useState<string[]>([]);
  const [todaysPick, setTodaysPick] = useState<HistoryEntry | null>(null);
  const [streak, setStreak] = useState(0);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearStep, setClearStep] = useState<"confirm" | "completed" | "save">(
    "confirm",
  );

  useEffect(() => {
    if (!hasCompletedOnboarding()) {
      router.replace("/onboarding");
      return;
    }
    const saved = getSavedMeals();
    const favorites = getFavorites();
    const favoriteIds = new Set(favorites.map((m) => m.id));
    const savedForLater = saved.filter((m) => !favoriteIds.has(m.id));
    setSavedCount(favorites.length + savedForLater.length);
    const history = getHistory();
    setHistoryCount(history.length);
    setInsights(deriveInsights(history));
    setTodaysPick(getTodaysPick());
    setStreak(getStreak());
    setReady(true);
  }, [router]);

  function openClearModal() {
    setClearStep("confirm");
    setShowClearModal(true);
  }

  function closeClearModal() {
    setShowClearModal(false);
    setClearStep("confirm");
  }

  function handleDecideForMe() {
    const prefs = getPreferences();
    const saved = getSavedMeals();
    const favs = getFavorites();
    const history = getHistory();
    const tasteProfile = getTasteProfile();
    const flavorProfile = getFlavorProfile();
    const recentlySeen = getRecentlySeenIds();
    const ranked = rankMeals(
      meals,
      prefs,
      saved,
      history,
      false,
      tasteProfile,
      recentlySeen,
      flavorProfile ?? undefined,
      favs,
    );

    // Take up to 5 strongest candidates and avoid repeating the last instant pick.
    const lastId = getLastDecidePick();
    const pool = ranked.slice(0, 5);
    const pick = (lastId ? pool.find((r) => r.meal.id !== lastId) : null) ?? pool[0] ?? ranked[0];

    setLastDecidePick(pick.meal.id);
    addToHistory(pick.meal);
    router.push(`/locked?mealId=${pick.meal.id}&decided=1`);
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

  if (!ready) return null;

  return (
    <main className="min-h-screen overflow-hidden bg-[#080808] text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-6 safe-top">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-52 -left-20 h-56 w-56 rounded-full bg-white/[0.05] blur-3xl" />
          <div className="absolute bottom-24 right-[-60px] h-52 w-52 rounded-full bg-white/[0.04] blur-3xl" />
        </div>

        <div className="relative z-10 flex min-h-screen flex-col">
          <header className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 opacity-90">
              <Image src="/logoheader.png" alt="WWE logo" height={18} width={18} className="h-[18px] w-auto" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
                Whatcha Wanna Eat?
              </p>
            </Link>

            <Link
              href="/profile"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white/80 backdrop-blur-md transition active:scale-[0.98]"
            >
              👤
            </Link>
          </header>

          <section className="pt-10">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs text-white/55 backdrop-blur-md">
              Tonight's question
            </div>

            {todaysPick ? (
              <>
                <h1 className="mt-5 text-[52px] font-semibold leading-[0.98] tracking-[-0.06em]">
                  We&apos;re eating
                  <br />
                  {todaysPick.meal.name}
                  <br />
                  tonight.
                </h1>
                <p className="mt-5 max-w-[31ch] text-[15px] leading-7 text-white/65">
                  Already decided —{" "}
                  <button
                    onClick={openClearModal}
                    className="underline decoration-white/30 underline-offset-2 transition active:text-white/90"
                  >
                    change it anytime.
                  </button>
                </p>
                <button
                  onClick={openClearModal}
                  className="mt-2 block text-sm text-white/55 transition active:text-white/80"
                >
                  ↻ Clear decision
                </button>
              </>
            ) : (
              <>
                <h1 className="mt-5 text-[52px] font-semibold leading-[0.98] tracking-[-0.06em]">
                  What we
                  <br />
                  eating
                  <br />
                  tonight?
                </h1>
                <p className="mt-5 max-w-[31ch] text-[15px] leading-7 text-white/65">
                  Less scrolling, less debating, less &quot;I don&apos;t know.&quot; Let&apos;s land on
                  something good fast.
                </p>
              </>
            )}

            {streak >= 1 && (
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs text-white/70 backdrop-blur-md">
                🔥 {streak} day streak
              </div>
            )}
          </section>

          <div className="mt-8 border-t border-white/[0.07]" />

          <section className="mt-8 rounded-[34px] border border-white/10 bg-gradient-to-b from-white/[0.14] via-white/[0.08] to-white/[0.04] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            {todaysPick ? (
              <>
                <p className="text-sm text-white/50">You already picked</p>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.04em]">
                    {todaysPick.meal.name}
                  </h2>
                  <SaveLaterButton meal={todaysPick.meal} />
                </div>
                <p className="mt-3 max-w-[34ch] text-sm leading-6 text-white/65">
                  {todaysPick.meal.whyItFits}
                </p>
                <div className="mt-6 grid gap-3">
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(todaysPick.meal.name + " recipe")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={recordPickIfNew}
                    className="block w-full rounded-full bg-white px-5 py-4 text-center text-base font-semibold text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition hover:opacity-95 active:scale-[0.99]"
                  >
                    Cook it
                  </a>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(todaysPick.meal.name + " near me")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={recordPickIfNew}
                    className="block rounded-full border border-white/10 bg-white/[0.05] px-5 py-4 text-center text-base font-medium text-white"
                  >
                    Order it
                  </a>
                  <Link
                    href="/deck?change=1"
                    className="rounded-full border border-white/10 bg-transparent px-5 py-4 text-center text-base font-medium text-white/70"
                  >
                    Change it
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-white/50">Ready when you are</p>
                    <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.04em]">
                      Let&apos;s make a quick decision
                    </h2>
                  </div>
                  <div className="shrink-0 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
                    under 60 sec
                  </div>
                </div>
                <p className="mt-3 max-w-[34ch] text-sm leading-6 text-white/65">
                  Swipe through ideas, save what hits, and lock in dinner without
                  the usual back-and-forth.
                </p>
                <Link
                  href="/deck"
                  className="mt-6 block w-full rounded-full bg-white px-5 py-4 text-center text-base font-semibold text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition hover:opacity-95 active:scale-[0.99]"
                >
                  Let&apos;s decide
                </Link>
                <button
                  onClick={handleDecideForMe}
                  className="mt-3 block w-full rounded-full border border-white/10 bg-white/[0.05] px-5 py-4 text-center text-base font-medium text-white transition active:scale-[0.99]"
                >
                  ✨ Decide for me
                </button>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/45">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                  Personalized picks
                  <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                  Fast decisions
                  <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                  Learns as you go
                </div>
              </>
            )}
          </section>

          <div className="mt-6 border-t border-white/[0.07]" />

          {/* Compact stats row — always visible, tappable navigation */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link
              href="/saved"
              className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-md transition active:scale-[0.98] active:bg-white/[0.07]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm leading-none">🔖</span>
                  <p className="text-[13px] font-medium text-white/70">Saved</p>
                </div>
                <p className="text-[20px] font-semibold leading-none tracking-[-0.04em]">
                  {savedCount}
                </p>
              </div>
              <p className="mt-2 text-xs text-white/35">Meals you want to come back to</p>
            </Link>

            <Link
              href="/history"
              className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-md transition active:scale-[0.98] active:bg-white/[0.07]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm leading-none">🕒</span>
                  <p className="text-[13px] font-medium text-white/70">History</p>
                </div>
                <p className="text-[20px] font-semibold leading-none tracking-[-0.04em]">
                  {historyCount}
                </p>
              </div>
              <p className="mt-2 text-xs text-white/35">What you&apos;ve been eating lately</p>
            </Link>
          </div>

          {/* Personal insight card — taps through to Profile */}
          {insights.length > 0 && (
            <Link
              href="/profile"
              className="mt-3 block rounded-[22px] border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur-md transition active:scale-[0.98] active:bg-white/[0.07]"
            >
              <p className="text-[11px] uppercase tracking-widest text-white/35">
                Lately you&apos;ve been…
              </p>
              <ul className="mt-3 space-y-2.5">
                {insights.map((insight, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2.5 text-sm text-white/70"
                  >
                    <span className="h-1 w-1 shrink-0 rounded-full bg-white/25" />
                    {insight}
                  </li>
                ))}
              </ul>
              {historyCount >= 3 && (
                <p className="mt-4 text-[11px] text-white/25">
                  Learning from {historyCount} pick{historyCount === 1 ? "" : "s"}
                </p>
              )}
            </Link>
          )}

          <div className="mt-auto pt-8">
            <BottomNav />
          </div>
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
