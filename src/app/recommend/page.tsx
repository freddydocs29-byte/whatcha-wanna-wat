"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { meals, type Meal } from "../data/meals";
import {
  getPreferences,
  getSavedMeals,
  getHistory,
  getTasteProfile,
  getFlavorProfile,
  getRecentlySeenIds,
  getFavorites,
  addToHistory,
  type UserPreferences,
} from "../lib/storage";
import { rankMeals, hardGate, type RankedMeal } from "../lib/scoring";
import {
  inferSessionContext,
  createTrackingSession,
  closeTrackingSession,
  type SessionContext,
} from "../lib/session-tracking";
import { trackEvent } from "../lib/analytics";
import { fetchSoftAvoids } from "../lib/supabase-profile";
import { getUserId } from "../lib/identity";
import { type SoftAvoid } from "../lib/supabase";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&h=750&q=80";

const MIN_DECK_SIZE = 15;
const DECK_SIZE = 20;

// ── Preference soft-filter (mirrors deck/page.tsx) ────────────────────────
function matchesPreferences(meal: Meal, prefs: UserPreferences | null): boolean {
  if (!prefs) return true;
  if (prefs.spiceLevel === "mild") {
    const spicyTerms = ["spicy", "flavorful", "bold"];
    const isSpicy =
      spicyTerms.some((t) => meal.category.toLowerCase().includes(t)) ||
      meal.tags.some((tag) => spicyTerms.some((t) => tag.toLowerCase().includes(t)));
    if (isSpicy) return false;
  }
  if (prefs.kidFriendly === true) {
    const isKidFriendly = meal.tags.some((tag) =>
      ["kid", "crowd"].some((k) => tag.toLowerCase().includes(k)),
    );
    if (!isKidFriendly) return false;
  }
  return true;
}

// ── Deck composition (mirrors buildDeck in deck/page.tsx) ─────────────────
function composeDeck(softAvoids: SoftAvoid[]): RankedMeal[] {
  const prefs = getPreferences();
  const savedMeals = getSavedMeals();
  const history = getHistory();
  const recentlySeen = getRecentlySeenIds();
  const tasteProfile = getTasteProfile();
  const flavorProfile = getFlavorProfile() ?? undefined;
  const favorites = getFavorites();
  const sessionContext = inferSessionContext(new Date());
  const eligibleMeals = hardGate(meals, prefs?.dislikedFoods ?? []);

  function rank(pool: Meal[]): RankedMeal[] {
    return rankMeals(
      pool, prefs, savedMeals, history, false, tasteProfile, recentlySeen,
      flavorProfile, favorites, [], "solo", new Set(), null, "either", "mix-it-up",
      [], softAvoids, sessionContext,
    );
  }

  function fill(deck: RankedMeal[], candidates: Meal[]): RankedMeal[] {
    const seen = new Set(deck.map((r) => r.meal.id));
    const newMeals = candidates.filter((m) => !seen.has(m.id));
    if (newMeals.length === 0) return deck;
    return [...deck, ...rank(newMeals)];
  }

  let deck = rank(eligibleMeals.filter((m) => matchesPreferences(m, prefs)));
  if (deck.length >= MIN_DECK_SIZE) return deck;
  deck = fill(deck, eligibleMeals);
  return deck;
}

// ── Context line ──────────────────────────────────────────────────────────
function generateContextLine(meal: Meal, ctx: SessionContext): string {
  const tags = meal.tags.map((t) => t.toLowerCase());
  const hasComfort = tags.some(
    (t) => t.includes("comfort") || t.includes("cozy") || t.includes("classic"),
  );

  if (ctx.effortBias === "low") return "Easy pick for tonight";
  if (ctx.dayType === "friday" && hasComfort) return "Friday comfort pick";
  if (ctx.dayType === "sunday" && hasComfort) return "Sunday comfort food";
  if (ctx.dayType === "weekend") return "Weekend pick";
  return "";
}

// ── Component ─────────────────────────────────────────────────────────────
export default function RecommendPage() {
  const router = useRouter();

  const [sessionDeck, setSessionDeck] = useState<RankedMeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const trackingSessionIdRef = useRef<string | null>(null);
  const openedAtRef = useRef<Date>(new Date());
  const sessionCtxRef = useRef<SessionContext>(inferSessionContext(new Date()));

  useEffect(() => {
    const userId = getUserId();
    const softAvoidsPromise = userId
      ? fetchSoftAvoids(userId).then((avoids) => {
          const now = new Date().toISOString();
          return avoids.filter((sa) => sa.expiresAt > now);
        })
      : Promise.resolve([] as SoftAvoid[]);

    softAvoidsPromise.then((softAvoids) => {
      const deck = composeDeck(softAvoids);
      setSessionDeck(deck);
      setIsLoading(false);
      trackEvent("recommend_screen_opened", { deckSize: deck.length });
    });

    createTrackingSession({ isGroupSession: false }).then((id) => {
      trackingSessionIdRef.current = id;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const meal = sessionDeck[0]?.meal ?? null;
  const ctx = sessionCtxRef.current;
  const contextLine = meal ? generateContextLine(meal, ctx) : "";
  const imgSrc = !imgError && meal?.image ? meal.image : FALLBACK_IMAGE;

  function handleChoose() {
    if (!meal || isAnimating) return;
    trackEvent("meal_chosen", {
      mealId: meal.id,
      source: "single_recommend",
      positionInDeck: 0,
    });
    addToHistory(meal);
    const sessionId = trackingSessionIdRef.current;
    if (sessionId) {
      void closeTrackingSession({
        trackingSessionId: sessionId,
        resolved: true,
        swipeCount: 1,
        openedAt: openedAtRef.current,
      });
    }
    router.push(`/locked?mealId=${meal.id}&decided=1`);
  }

  function handlePass() {
    if (!meal || isAnimating) return;
    trackEvent("meal_passed", {
      mealId: meal.id,
      source: "single_recommend",
      positionInDeck: 0,
    });
    setIsAnimating(true);
    setTimeout(() => {
      sessionStorage.setItem(
        "wwe_recommend_deck",
        JSON.stringify(sessionDeck.map((r) => r.meal.id)),
      );
      router.push("/deck?startAt=1");
    }, 280);
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#080808] px-5 pb-8 safe-top text-white">
        <div className="mx-auto w-full max-w-md">
          <div className="flex items-center justify-between py-4">
            <div className="h-10 w-10 animate-pulse rounded-full bg-white/[0.06]" />
            <div className="h-3 w-24 animate-pulse rounded-full bg-white/[0.04]" />
            <div className="h-10 w-10" />
          </div>
          <div
            className="mt-2 animate-pulse rounded-[28px] bg-white/[0.06]"
            style={{ aspectRatio: "4/3" }}
          />
          <div className="mt-5 h-8 w-2/3 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded-full bg-white/[0.04]" />
          <div className="mt-8 h-14 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="mt-3 h-14 animate-pulse rounded-full bg-white/[0.04]" />
        </div>
      </main>
    );
  }

  // ── Deck exhausted ────────────────────────────────────────────────────────
  if (!meal) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#080808] px-5 text-center text-white">
        <p className="text-sm text-white/50">Nothing left to suggest.</p>
        <button
          onClick={() => router.push("/deck")}
          className="mt-4 text-sm text-white/70 underline underline-offset-4"
        >
          Browse all options
        </button>
      </main>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-8 safe-top">
        {/* Header */}
        <header className="flex items-center justify-between py-4">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white/60 transition active:scale-[0.96]"
          >
            ←
          </button>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/30">
            Tonight&apos;s pick
          </p>
          <div className="h-10 w-10" />
        </header>

        {/* Card */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={meal.id}
              initial={{ opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
            >
              {/* Image */}
              <div
                className="relative w-full overflow-hidden rounded-[28px]"
                style={{ aspectRatio: "4/3" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgSrc}
                  alt={meal.name}
                  className="h-full w-full object-cover"
                  onError={() => setImgError(true)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
              </div>

              {/* Meal info */}
              <div className="mt-5">
                {contextLine && (
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/35">
                    {contextLine}
                  </p>
                )}
                <h1 className="text-[34px] font-semibold leading-[1.04] tracking-[-0.04em]">
                  {meal.name}
                </h1>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/45">
                  {meal.whyItFits}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            onClick={handleChoose}
            disabled={isAnimating}
            className="w-full rounded-full bg-white px-5 py-4 text-base font-semibold text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
          >
            Yes, let&apos;s eat
          </button>
          <button
            onClick={handlePass}
            disabled={isAnimating}
            className="w-full rounded-full border border-white/10 bg-white/[0.05] px-5 py-4 text-base font-medium text-white transition hover:bg-white/[0.08] active:scale-[0.98] disabled:opacity-60"
          >
            Show me something else
          </button>
        </div>
      </div>
    </main>
  );
}
