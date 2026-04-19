"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Meal } from "../data/meals";
import { getSavedMealsEnriched, removeSavedMeal, toggleSavedFavorite } from "../lib/storage";
import BottomNav from "../components/BottomNav";

function StarIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function SavedPage() {
  const [favoriteMeals, setFavoriteMeals] = useState<Meal[]>([]);
  const [savedForLater, setSavedForLater] = useState<Meal[]>([]);
  const [loaded, setLoaded] = useState(false);

  function refresh() {
    const enriched = getSavedMealsEnriched();
    setFavoriteMeals(enriched.filter((s) => s.isFavorite).map((s) => s.meal));
    setSavedForLater(enriched.filter((s) => !s.isFavorite).map((s) => s.meal));
  }

  useEffect(() => {
    refresh();
    setLoaded(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleToggleFavorite(meal: Meal) {
    toggleSavedFavorite(meal.id);
    refresh();
  }

  function handleRemove(mealId: string) {
    removeSavedMeal(mealId);
    refresh();
  }

  const isEmpty = loaded && favoriteMeals.length === 0 && savedForLater.length === 0;

  return (
    <main className="min-h-screen overflow-hidden bg-[#080808] text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-28 safe-top">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
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
              Your list
            </div>
            <h1 className="mt-5 text-[42px] font-semibold leading-[0.98] tracking-[-0.06em]">
              Saved
              <br />
              meals
            </h1>
            <p className="mt-3 max-w-[31ch] text-[15px] leading-7 text-white/65">
              Star the meals you know you love. Save the rest for later.
            </p>
            <p className="mt-1.5 text-xs text-white/30">
              Tap a meal to make it your next choice.
            </p>
          </section>

          {isEmpty && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="mb-5 text-4xl">🍽️</div>
              <p className="text-base font-semibold tracking-[-0.03em]">
                Nothing saved yet
              </p>
              <p className="mt-2 max-w-[26ch] text-sm leading-6 text-white/50">
                Hit Save on the deck when a meal catches your eye.
              </p>
              <Link
                href="/deck"
                className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:opacity-95 active:scale-[0.99]"
              >
                Go to deck
              </Link>
            </div>
          )}

          {loaded && !isEmpty && (
            <div className="mt-8 flex flex-1 flex-col gap-8">

              {/* ── Favorites ──────────────────────────────────────────── */}
              <section id="favorites">
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-sm font-semibold tracking-[-0.02em] text-white">
                    Favorites
                  </span>
                  {favoriteMeals.length > 0 && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/50">
                      {favoriteMeals.length}
                    </span>
                  )}
                </div>

                {favoriteMeals.length === 0 ? (
                  <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.025] px-5 py-6 text-center">
                    <p className="text-sm text-white/35">
                      Star a meal below to mark it as a favorite.
                    </p>
                    <p className="mt-1 text-xs text-white/25">
                      Favorites get surfaced first in your deck.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {favoriteMeals.map((meal) => (
                      <div
                        key={meal.id}
                        className="rounded-[28px] border border-white/15 bg-white/[0.07] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.28)] backdrop-blur-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <Link href={`/locked?mealId=${meal.id}`} className="flex-1 min-w-0">
                            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 text-xs text-white/55">
                              {meal.category}
                            </div>
                            <p className="mt-2 text-[18px] font-semibold tracking-[-0.03em]">
                              {meal.name}
                            </p>
                            <p className="mt-1.5 text-sm leading-6 text-white/60">
                              {meal.whyItFits}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {meal.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-white/[0.09] px-3 py-1 text-xs text-white/55"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </Link>

                          <button
                            onClick={() => handleToggleFavorite(meal)}
                            className="mt-1 shrink-0 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-amber-400 transition hover:bg-white/15 active:scale-[0.95]"
                            aria-label="Remove from favorites"
                          >
                            <StarIcon filled />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Saved for Later ─────────────────────────────────────── */}
              {savedForLater.length > 0 && (
                <section id="saved">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-sm font-medium tracking-[-0.02em] text-white/50">
                      Saved for Later
                    </span>
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-white/30">
                      {savedForLater.length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {savedForLater.map((meal) => (
                      <div
                        key={meal.id}
                        className="rounded-[28px] border border-white/[0.08] bg-white/[0.04] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <Link href={`/locked?mealId=${meal.id}`} className="flex-1 min-w-0">
                            <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.07] px-2.5 py-0.5 text-xs text-white/40">
                              {meal.category}
                            </div>
                            <p className="mt-2 text-[17px] font-semibold tracking-[-0.03em] text-white/85">
                              {meal.name}
                            </p>
                            <p className="mt-1.5 text-sm leading-6 text-white/40">
                              {meal.whyItFits}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {meal.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-white/[0.05] px-3 py-1 text-xs text-white/35"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </Link>

                          <div className="mt-1 shrink-0 flex flex-col items-end gap-2">
                            <button
                              onClick={() => handleToggleFavorite(meal)}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/25 transition hover:text-white/50 active:scale-[0.95]"
                              aria-label="Add to favorites"
                            >
                              <StarIcon filled={false} />
                            </button>
                            <button
                              onClick={() => handleRemove(meal.id)}
                              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/30 transition hover:text-white/55 active:scale-[0.97]"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          <div className="mt-auto pt-8">
            {loaded && !isEmpty && (
              <div className="mb-5 flex justify-center">
                <Link
                  href="/deck"
                  className="text-sm text-white/35 underline underline-offset-4 transition hover:text-white/60"
                >
                  Find something else
                </Link>
              </div>
            )}
            <BottomNav />
          </div>
        </div>
      </div>
    </main>
  );
}
