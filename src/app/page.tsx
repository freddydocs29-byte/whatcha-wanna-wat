"use client";

// ─── TEST ONLY: remove the next 5 lines when done testing the loading screen ───
const TEST_LOADING_DELAY = true;
let _testDelayPromise: Promise<void> | null = null;
function _getTestDelay() {
  if (!_testDelayPromise) _testDelayPromise = new Promise<void>((r) => setTimeout(r, 2500));
  return _testDelayPromise;
}
// ────────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "./components/BottomNav";
import {
  getSavedMeals,
  getHistory,
  hasCompletedOnboarding,
  getTodaysPick,
  getStreak,
  HistoryEntry,
} from "./lib/storage";
import SaveLaterButton from "./locked/SaveLaterButton";

export default function Home() {
  // TEST ONLY: suspends component so loading.tsx stays visible — remove with the lines above
  if (TEST_LOADING_DELAY) use(_getTestDelay());

  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [todaysPick, setTodaysPick] = useState<HistoryEntry | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!hasCompletedOnboarding()) {
      router.replace("/onboarding");
      return;
    }
    setSavedCount(getSavedMeals().length);
    setHistoryCount(getHistory().length);
    setTodaysPick(getTodaysPick());
    setStreak(getStreak());
    setReady(true);
  }, [router]);

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
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
                Whatcha Wanna Eat?
              </p>
            </div>

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
                  Already decided — change it anytime.
                </p>
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
                    className="block w-full rounded-full bg-white px-5 py-4 text-center text-base font-semibold text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition hover:opacity-95 active:scale-[0.99]"
                  >
                    Cook it
                  </a>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(todaysPick.meal.name + " near me")}`}
                    target="_blank"
                    rel="noopener noreferrer"
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
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/45">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                  Personalized picks
                  <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                  Fast decisions
                </div>
              </>
            )}
          </section>

          <section className="mt-6 grid gap-4">
            <Link
              href="/saved"
              className="rounded-[30px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur-md transition active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/45">Saved meals</p>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/60">
                  {savedCount} {savedCount === 1 ? "pick" : "picks"}
                </span>
              </div>

              <p className="mt-3 text-[22px] font-semibold tracking-[-0.04em]">
                Your reliable hits
              </p>

              <p className="mt-2 text-sm leading-6 text-white/60">
                Keep the meals you already know work when nobody wants to think
                too hard.
              </p>
            </Link>

            <Link
              href="/history"
              className="rounded-[30px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur-md transition active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/45">History</p>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/60">
                  {historyCount} {historyCount === 1 ? "choice" : "choices"}
                </span>
              </div>

              <p className="mt-3 text-[22px] font-semibold tracking-[-0.04em]">
                Your food memory
              </p>

              <p className="mt-2 text-sm leading-6 text-white/60">
                Past picks help WWE learn your patterns and make better calls
                over time.
              </p>
            </Link>
          </section>

          <div className="mt-auto pt-8">
            <BottomNav />
          </div>
        </div>
      </div>
    </main>
  );
}
