"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HistoryEntry, getHistory, clearHistory } from "../lib/storage";
import BottomNav from "../components/BottomNav";

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor(
    (now.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) /
      86_400_000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setEntries(getHistory());
    setLoaded(true);
  }, []);

  function handleClear() {
    clearHistory();
    setEntries([]);
    setConfirming(false);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#080808] text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-6 pt-5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-52 -left-20 h-56 w-56 rounded-full bg-white/[0.05] blur-3xl" />
          <div className="absolute bottom-24 right-[-60px] h-52 w-52 rounded-full bg-white/[0.04] blur-3xl" />
        </div>

        <div className="relative z-10 flex min-h-screen flex-col">
          <header className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
              Whatcha Wanna Eat?
            </p>
            <Link
              href="/profile"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white/80 backdrop-blur-md transition active:scale-[0.98]"
            >
              👤
            </Link>
          </header>

          <section className="pt-10">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs text-white/55 backdrop-blur-md">
              What you've chosen
            </div>
            <h1 className="mt-5 text-[42px] font-semibold leading-[0.98] tracking-[-0.06em]">
              Your food
              <br />
              memory
            </h1>
            <p className="mt-4 max-w-[31ch] text-[15px] leading-7 text-white/65">
              Every meal you've locked in. Patterns start showing up fast.
            </p>
          </section>

          <section className="mt-8 flex flex-1 flex-col gap-3">
            {loaded && entries.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/30">
                  {entries.length} meal{entries.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => setConfirming(true)}
                  className="text-xs text-white/35 transition hover:text-white/60 active:scale-[0.97]"
                >
                  Clear history
                </button>
              </div>
            )}

            {loaded && entries.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="mb-5 text-4xl">📋</div>
                <p className="text-base font-semibold tracking-[-0.03em]">
                  No history yet
                </p>
                <p className="mt-2 max-w-[26ch] text-sm leading-6 text-white/50">
                  Choose a meal on the deck and it'll show up here.
                </p>
                <Link
                  href="/deck"
                  className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:opacity-95 active:scale-[0.99]"
                >
                  Go to deck
                </Link>
              </div>
            )}

            {entries.map((entry, i) => (
              <div
                key={i}
                className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 text-xs text-white/55">
                      {entry.meal.category}
                    </div>
                    <p className="mt-2 text-[18px] font-semibold tracking-[-0.03em]">
                      {entry.meal.name}
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-white/55">
                      {entry.meal.whyItFits}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.meal.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-white/[0.07] px-3 py-1 text-xs text-white/50"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-1 shrink-0 text-right">
                    <p className="text-xs font-medium text-white/50">
                      {formatDate(entry.chosenAt)}
                    </p>
                    <p className="mt-0.5 text-xs text-white/30">
                      {formatTime(entry.chosenAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <div className="mt-auto pt-8">
            <BottomNav />
          </div>
        </div>
      </div>
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-5 pb-10">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirming(false)}
          />
          <div className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-[#111] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <p className="text-lg font-semibold tracking-[-0.03em]">
              Clear history?
            </p>
            <p className="mt-2 text-sm leading-6 text-white/50">
              This will permanently remove all {entries.length} meal
              {entries.length !== 1 ? "s" : ""} from your history.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-full border border-white/10 bg-white/[0.05] py-3 text-sm font-medium text-white/70 transition active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="flex-1 rounded-full border border-white/15 bg-white/10 py-3 text-sm font-medium text-white transition hover:bg-white/15 active:scale-[0.98]"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
