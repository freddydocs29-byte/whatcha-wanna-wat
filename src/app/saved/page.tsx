"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Meal } from "../data/meals";
import { getSavedMealsEnriched, removeSavedMeal, toggleSavedFavorite, addToHistory, updateTasteProfile, saveDecidedMeal } from "../lib/storage";
import { trackEvent } from "../lib/analytics";
import { EVENT_MEAL_FAVORITED } from "../lib/analytics-events";
import BottomNav from "../components/BottomNav";
import { fetchOrCreateProfile } from "../lib/supabase-profile";
import { getUserId } from "../lib/identity";
import type { Profile } from "../lib/supabase";
import { MealDetailDrawer } from "../components/MealDetailDrawer";

const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function StarIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function MealCard({
  meal,
  isFavorite,
  onChoose,
  onInfo,
  onToggleFavorite,
  onRemove,
}: {
  meal: Meal;
  isFavorite: boolean;
  onChoose: () => void;
  onInfo: () => void;
  onToggleFavorite: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className="rounded-[20px] p-5 overflow-hidden"
      style={{
        background: "linear-gradient(180deg, rgba(255,231,202,0.07), rgba(255,231,202,0.02))",
        border: "1px solid rgba(245,237,224,0.16)",
        backdropFilter: "blur(20px)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 38px rgba(0,0,0,0.4)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: content */}
        <button onClick={onChoose} className="flex-1 min-w-0 text-left">
          <div
            className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide mb-2"
            style={{
              background: "rgba(255,231,202,0.08)",
              border: "1px solid rgba(245,237,224,0.12)",
              color: "rgba(199,189,172,0.9)",
              fontFamily: "var(--font-manrope)",
            }}
          >
            {meal.category}
          </div>
          <p
            className="text-white leading-tight"
            style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "20px", letterSpacing: "-0.01em" }}
          >
            {meal.name}
          </p>
          {meal.whyItFits && (
            <p className="font-body text-xs mt-1 leading-snug" style={{ color: "#897E73", fontWeight: 300 }}>
              {meal.whyItFits}
            </p>
          )}
          {meal.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {meal.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                  style={{
                    background: "rgba(255,231,202,0.05)",
                    border: "1px solid rgba(245,237,224,0.12)",
                    color: "rgba(245,237,224,0.5)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </button>

        {/* Right: action column */}
        <div className="mt-0.5 flex flex-col items-end gap-2 flex-shrink-0">
          <button
            onClick={onInfo}
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:opacity-80 active:scale-[0.95]"
            style={{
              background: "rgba(255,231,202,0.06)",
              border: "1px solid rgba(245,237,224,0.1)",
              color: "rgba(245,237,224,0.4)",
            }}
            aria-label="More details"
          >
            <InfoIcon />
          </button>
          <button
            onClick={onToggleFavorite}
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:opacity-80 active:scale-[0.95]"
            style={
              isFavorite
                ? {
                    background: "rgba(251,191,36,0.15)",
                    border: "1px solid rgba(251,191,36,0.3)",
                    color: "#FBB124",
                  }
                : {
                    background: "rgba(255,231,202,0.05)",
                    border: "1px solid rgba(245,237,224,0.09)",
                    color: "rgba(245,237,224,0.35)",
                  }
            }
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <StarIcon filled={isFavorite} />
          </button>
          {onRemove && (
            <button
              onClick={onRemove}
              className="rounded-full px-3 py-1.5 font-body text-xs transition hover:opacity-75 active:scale-[0.97]"
              style={{
                background: "rgba(255,231,202,0.04)",
                border: "1px solid rgba(245,237,224,0.08)",
                color: "rgba(245,237,224,0.3)",
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
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
    const wasFavorited = favoriteMeals.some((m) => m.id === meal.id);
    toggleSavedFavorite(meal.id);
    if (!wasFavorited) {
      trackEvent(EVENT_MEAL_FAVORITED, { mealId: meal.id, mealName: meal.name, sourceScreen: "saved" });
    }
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
    <main
      className="relative min-h-screen overflow-hidden text-white"
      style={{ background: "#0B0805" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 36% at 50% -4%, rgba(232,98,26,0.16) 0%, transparent 60%)," +
            "radial-gradient(ellipse 70% 40% at 50% 104%, rgba(184,74,18,0.16) 0%, transparent 66%)," +
            "radial-gradient(ellipse 40% 22% at 84% 30%, rgba(230,178,106,0.06) 0%, transparent 70%)",
        }}
      />
      {/* Film grain */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: GRAIN_SVG }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }}
      />

      <div className="relative z-[2] mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-28 safe-top">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="pt-6 pb-2">
          <div className="flex items-center justify-end mb-6">
            <button
              onClick={() => router.push("/profile")}
              className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-display font-black text-lg text-white flex-shrink-0"
              style={{ background: "#E8621A" }}
            >
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Profile" />
              ) : (
                <span>{profile?.display_name?.[0]?.toUpperCase() ?? "?"}</span>
              )}
            </button>
          </div>
          <h1
            className="text-white"
            style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "32px", letterSpacing: "-0.02em" }}
          >
            Saved Meals
          </h1>
          <p className="font-body text-sm mt-1" style={{ color: "#897E73", fontWeight: 300 }}>
            Everything you&apos;ve loved, matched, and decided on.
          </p>
        </div>

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {isEmpty && (
          <div className="flex flex-1 flex-col items-center justify-center text-center py-16">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 text-3xl"
              style={{ background: "rgba(255,231,202,0.06)", border: "1px solid rgba(245,237,224,0.1)" }}
            >
              🍽️
            </div>
            <p className="text-white" style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "20px" }}>Nothing saved yet</p>
            <p className="mt-2 max-w-[26ch] font-body text-sm leading-relaxed" style={{ color: "#897E73", fontWeight: 300 }}>
              Hit Save on the deck when a meal catches your eye.
            </p>
            <Link
              href="/deck"
              className="mt-6 rounded-full px-6 py-3.5 text-sm text-white transition hover:opacity-95 active:scale-[0.99]"
              style={{
                fontFamily: "var(--font-quicksand)",
                fontWeight: 700,
                background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 48%, #B84A12 100%)",
                boxShadow: "0 0 24px rgba(232,98,26,0.35)",
              }}
            >
              Go to deck
            </Link>
          </div>
        )}

        {/* ── Content ───────────────────────────────────────────────────── */}
        {loaded && !isEmpty && (
          <div className="mt-8 flex flex-1 flex-col gap-10">

            {/* ── Favorites ─────────────────────────────────────────────── */}
            <section id="favorites">
              <div className="flex items-center gap-2.5 mb-4">
                <span
                  className="text-[11px] tracking-[2.4px] uppercase"
                  style={{ color: "#E8621A", fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  Favorites
                </span>
                {favoriteMeals.length > 0 && (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px]"
                    style={{
                      background: "rgba(255,231,202,0.08)",
                      border: "1px solid rgba(245,237,224,0.12)",
                      color: "rgba(199,189,172,0.8)",
                      fontFamily: "var(--font-jetbrains-mono)",
                      minWidth: "22px",
                      textAlign: "center",
                    }}
                  >
                    {favoriteMeals.length}
                  </span>
                )}
              </div>

              {favoriteMeals.length === 0 ? (
                <div
                  className="rounded-[20px] px-5 py-6 text-center"
                  style={{
                    background: "rgba(255,231,202,0.03)",
                    border: "1px solid rgba(245,237,224,0.07)",
                    boxShadow: "inset 0 1px 0 rgba(245,237,224,0.04)",
                  }}
                >
                  <p className="font-body text-sm" style={{ color: "rgba(245,237,224,0.35)" }}>
                    Star a meal below to mark it as a favorite.
                  </p>
                  <p className="mt-1 font-body text-xs" style={{ color: "rgba(245,237,224,0.2)" }}>
                    Favorites get surfaced first in your deck.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {favoriteMeals.map((meal) => (
                    <MealCard
                      key={meal.id}
                      meal={meal}
                      isFavorite
                      onChoose={() => handleChoose(meal)}
                      onInfo={() => { setDrawerMeal(meal); setDrawerOpen(true); }}
                      onToggleFavorite={() => handleToggleFavorite(meal)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ── Saved for Later ─────────────────────────────────────────── */}
            {savedForLater.length > 0 && (
              <section id="saved">
                <div className="flex items-center gap-2.5 mb-4">
                  <span
                    className="text-[11px] tracking-[2.4px] uppercase"
                    style={{ color: "#E8621A", fontFamily: "var(--font-jetbrains-mono)" }}
                  >
                    Saved for later
                  </span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px]"
                    style={{
                      background: "rgba(255,231,202,0.08)",
                      border: "1px solid rgba(245,237,224,0.12)",
                      color: "rgba(199,189,172,0.8)",
                      fontFamily: "var(--font-jetbrains-mono)",
                      minWidth: "22px",
                      textAlign: "center",
                    }}
                  >
                    {savedForLater.length}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {savedForLater.map((meal) => (
                    <MealCard
                      key={meal.id}
                      meal={meal}
                      isFavorite={false}
                      onChoose={() => handleChoose(meal)}
                      onInfo={() => { setDrawerMeal(meal); setDrawerOpen(true); }}
                      onToggleFavorite={() => handleToggleFavorite(meal)}
                      onRemove={() => handleRemove(meal.id)}
                    />
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
                className="font-body text-sm transition hover:opacity-70 active:scale-[0.98]"
                style={{
                  color: "rgba(245,237,224,0.35)",
                  textDecoration: "underline",
                  textUnderlineOffset: "4px",
                }}
              >
                Find something else
              </Link>
            </div>
          )}
          <BottomNav />
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
