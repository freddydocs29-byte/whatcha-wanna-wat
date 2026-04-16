"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Meal } from "../data/meals";
import { getSavedMeals, removeSavedMeal } from "../lib/storage";
import BottomNav from "../components/BottomNav";

export default function SavedPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setMeals(getSavedMeals());
    setLoaded(true);
  }, []);

  function handleRemove(mealId: string) {
    removeSavedMeal(mealId);
    setMeals((prev) => prev.filter((m) => m.id !== mealId));
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#080808] text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-6 pt-5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
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
              Your list
            </div>
            <h1 className="mt-5 text-[42px] font-semibold leading-[0.98] tracking-[-0.06em]">
              Saved
              <br />
              meals
            </h1>
            {loaded && (
              <p className="mt-2 text-sm text-white/35">
                {meals.length === 1 ? "1 saved meal" : `${meals.length} saved meals`}
              </p>
            )}
            <p className="mt-3 max-w-[31ch] text-[15px] leading-7 text-white/65">
              The ones worth going back to. Tap remove if something no longer
              fits.
            </p>
          </section>

          <section className="mt-8 flex flex-1 flex-col gap-3">
            {loaded && meals.length === 0 && (
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

            {meals.map((meal) => (
              <div
                key={meal.id}
                className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/locked?mealId=${meal.id}`}
                    className="flex-1 min-w-0"
                  >
                    <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 text-xs text-white/55">
                      {meal.category}
                    </div>
                    <p className="mt-2 text-[18px] font-semibold tracking-[-0.03em]">
                      {meal.name}
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-white/55">
                      {meal.whyItFits}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {meal.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-white/[0.07] px-3 py-1 text-xs text-white/50"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </Link>

                  <button
                    onClick={() => handleRemove(meal.id)}
                    className="mt-1 shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/40 transition hover:text-white/70 active:scale-[0.97]"
                  >
                    Remove from list
                  </button>
                </div>
              </div>
            ))}
          </section>

          <div className="mt-auto pt-8">
            {loaded && meals.length > 0 && (
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
