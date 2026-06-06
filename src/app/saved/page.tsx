"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Meal } from "../data/meals";
import { getSavedMealsEnriched, removeSavedMeal, toggleSavedFavorite, addToHistory, updateTasteProfile, saveDecidedMeal } from "../lib/storage";
import BottomNav from "../components/BottomNav";
import { fetchOrCreateProfile } from "../lib/supabase-profile";
import { getUserId } from "../lib/identity";
import type { Profile } from "../lib/supabase";
import { MealDetailDrawer } from "../components/MealDetailDrawer";

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
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [favoriteMeals, setFavoriteMeals] = useState<Meal[]>([]);
  const [savedForLater, setSavedForLater] = useState<Meal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMeal, setDrawerMeal] = useState<Meal | null>(null);

  function refresh() {
    const enriched = getSavedMealsEnriched();
    setFavoriteMeals(enriched.filter((s) => s.isFavorite).map((s) => s.meal));
    setSavedForLater(enriched.filter((s) => !s.isFavorite).map((s) => s.meal));
  }

  useEffect(() => {
    refresh();
    setLoaded(true);
    fetchOrCreateProfile(getUserId()).then(setProfile).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleToggleFavorite(meal: Meal) {
    toggleSavedFavorite(meal.id);
    refresh();
  }

  function handleRemove(mealId: string) {
    removeSavedMeal(mealId);
    refresh();
  }

  function handleChoose(meal: Meal) {
    updateTasteProfile(meal, "choose");
    addToHistory(meal);
    saveDecidedMeal({ ...meal, decidedAt: new Date().toISOString(), mode: "solo" });
    router.push("/");
  }

  const isEmpty = loaded && favoriteMeals.length === 0 && savedForLater.length === 0;

  return (
    <main className="min-h-screen overflow-hidden bg-[#1C1A18] text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-28 safe-top">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 90% 28% at 50% 0%, rgba(232,98,26,0.11) 0%, transparent 70%), radial-gradient(ellipse 70% 20% at 50% 100%, rgba(28,16,8,0.55) 0%, transparent 65%)",
          }}
        />

        <div className="relative z-10 flex min-h-screen flex-col">
          <div className="px-5 pt-6 pb-2">
            {/* Avatar top right only */}
            <div className="flex items-center justify-end mb-6">
              <button
                onClick={() => router.push('/profile')}
                className="w-11 h-11 rounded-full bg-[#E8621A] overflow-hidden flex items-center justify-center font-display font-black text-lg text-white flex-shrink-0"
              >
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Profile" />
                  : <span>{profile?.display_name?.[0]?.toUpperCase() ?? '?'}</span>
                }
              </button>
            </div>

            {/* Page headline */}
            <h1 className="font-display font-black text-3xl text-white">Saved Meals</h1>
            <p className="font-body text-sm text-[#8A7F78] mt-1">
              Everything you&apos;ve loved, matched, and decided on.
            </p>
          </div>

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
                className="mt-6 rounded-full bg-[#E8621A] px-6 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(232,98,26,0.30)] transition hover:opacity-95 active:scale-[0.99]"
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
                  <span className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase mb-3">
                    Favorites
                  </span>
                  {favoriteMeals.length > 0 && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/50">
                      {favoriteMeals.length}
                    </span>
                  )}
                </div>

                {favoriteMeals.length === 0 ? (
                  <div className="rounded-[20px] border border-white/[0.05] bg-[#232120] px-5 py-6 text-center shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
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
                        className="bg-[#2A2420] rounded-[20px] p-5 border border-white/[0.05] shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button onClick={() => handleChoose(meal)} className="flex-1 min-w-0 text-left">
                            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 text-xs text-white/55">
                              {meal.category}
                            </div>
                            <p className="font-display font-bold text-base text-white mt-2">
                              {meal.name}
                            </p>
                            <p className="text-[#8A7F78] text-xs font-body mt-0.5">
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
                          </button>

                          <div className="mt-1 shrink-0 flex flex-col items-end gap-2">
                            <button
                              onClick={() => { setDrawerMeal(meal); setDrawerOpen(true); }}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/30 transition hover:text-white/55 active:scale-[0.95]"
                              aria-label="More details"
                            >
                              <span className="font-body text-sm font-semibold">i</span>
                            </button>
                            <button
                              onClick={() => handleToggleFavorite(meal)}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-amber-400 transition hover:bg-white/15 active:scale-[0.95]"
                              aria-label="Remove from favorites"
                            >
                              <StarIcon filled />
                            </button>
                          </div>
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
                    <span className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase mb-3">
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
                        className="bg-[#2A2420] rounded-[20px] p-5 border border-white/[0.05] shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button onClick={() => handleChoose(meal)} className="flex-1 min-w-0 text-left">
                            <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.07] px-2.5 py-0.5 text-xs text-white/40">
                              {meal.category}
                            </div>
                            <p className="font-display font-bold text-base text-white mt-2">
                              {meal.name}
                            </p>
                            <p className="text-[#8A7F78] text-xs font-body mt-0.5">
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
                          </button>

                          <div className="mt-1 shrink-0 flex flex-col items-end gap-2">
                            <button
                              onClick={() => { setDrawerMeal(meal); setDrawerOpen(true); }}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/25 transition hover:text-white/50 active:scale-[0.95]"
                              aria-label="More details"
                            >
                              <span className="font-body text-sm font-semibold">i</span>
                            </button>
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

      <MealDetailDrawer
        meal={drawerMeal}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        context="saved"
      />
    </main>
  );
}
