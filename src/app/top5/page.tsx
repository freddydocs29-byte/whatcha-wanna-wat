"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { meals, type Meal } from "../data/meals";
import { MealDetailDrawer } from "../components/MealDetailDrawer";
import {
  getPreferences,
  getSavedMeals,
  getHistory,
  getTasteProfile,
  getRecentlySeenIds,
  getFlavorProfile,
  getFavorites,
  getNoveltyBias,
  saveDecidedMeal,
  addToHistory,
  type UserPreferences,
} from "../lib/storage";
import {
  rankMeals,
  hardGate,
  getAllHardNos,
  type RankedMeal,
} from "../lib/scoring";
import { inferSessionContext, recordAcceptedDecision } from "../lib/session-tracking";
import { checkAndTriggerTypeReveal } from "../lib/type-reveal-trigger";
import { trackEvent } from "../lib/analytics";
import { getUserId } from "../lib/identity";

// Mirrors the soft-preference filter from deck/page.tsx
function matchesPreferences(meal: Meal, prefs: UserPreferences | null): boolean {
  if (!prefs) return true;
  if (prefs.spiceLevel === "mild") {
    const spicyTerms = ["spicy", "flavorful", "bold"];
    const isSpicy =
      spicyTerms.some((t) => meal.category.toLowerCase().includes(t)) ||
      meal.tags.some((tag) =>
        spicyTerms.some((t) => tag.toLowerCase().includes(t))
      );
    if (isSpicy) return false;
  }
  if (prefs.kidFriendly === true) {
    const isKidFriendly = meal.tags.some((tag) =>
      ["kid", "crowd"].some((k) => tag.toLowerCase().includes(k))
    );
    if (!isKidFriendly) return false;
  }
  return true;
}

function buildTop5(): RankedMeal[] {
  const prefs = getPreferences();
  const savedMeals = getSavedMeals();
  const history = getHistory();
  const recentlySeen = getRecentlySeenIds();
  const tasteProfile = getTasteProfile();
  const flavorProfile = getFlavorProfile() ?? undefined;
  const favorites = getFavorites();
  const sessionContext = inferSessionContext(new Date());
  const noveltyBias = getNoveltyBias();

  const eligibleMeals = hardGate(meals, getAllHardNos(prefs));
  const prefFiltered = eligibleMeals.filter((m) => matchesPreferences(m, prefs));
  // Fall back to full eligible pool if preference filters leave fewer than 5
  const pool = prefFiltered.length >= 5 ? prefFiltered : eligibleMeals;

  const ranked = rankMeals(
    pool,
    prefs,
    savedMeals,
    history,
    false,
    tasteProfile,
    recentlySeen,
    flavorProfile,
    favorites,
    [],
    "solo",
    new Set(),
    null,
    "either",
    "mix-it-up",
    [],
    [],
    sessionContext,
    noveltyBias,
  );

  return ranked.slice(0, 5);
}

// ── Top 5 daily cache ────────────────────────────────────────────────────────

const TOP5_KEY_PREFIX = "wwe_top5_";

interface Top5CacheEntry {
  date: string;
  userId: string;
  meals: Array<{ id: string; reason: string }>;
  generatedAt: string;
  wasRefreshed?: boolean;
}

function getTop5CacheKey(): string {
  const today = new Date().toISOString().slice(0, 10);
  const userId = getUserId();
  return `${TOP5_KEY_PREFIX}${userId}_${today}`;
}

function clearStaleTop5Keys(todayKey: string): void {
  const stale: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(TOP5_KEY_PREFIX) && k !== todayKey) stale.push(k);
  }
  for (const k of stale) localStorage.removeItem(k);
}

function loadTop5Cache(key: string): { meals: RankedMeal[]; wasRefreshed: boolean } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached: Top5CacheEntry = JSON.parse(raw);
    const meals_result: RankedMeal[] = [];
    for (const { id, reason } of cached.meals) {
      const meal = meals.find((m) => m.id === id);
      if (meal) meals_result.push({ meal, reason, pantryMatchCount: 0 });
    }
    // Only use cache if we got all 5 meals back from the catalog
    if (meals_result.length !== 5) return null;
    return { meals: meals_result, wasRefreshed: cached.wasRefreshed ?? false };
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function saveTop5Cache(key: string, ranked: RankedMeal[], wasRefreshed = false): void {
  const today = new Date().toISOString().slice(0, 10);
  const userId = getUserId();
  const entry: Top5CacheEntry = {
    date: today,
    userId,
    meals: ranked.map((r) => ({ id: r.meal.id, reason: r.reason })),
    generatedAt: new Date().toISOString(),
    wasRefreshed,
  };
  localStorage.setItem(key, JSON.stringify(entry));
}

// ─────────────────────────────────────────────────────────────────────────────

const POSITIONS = ["01", "02", "03", "04", "05"];

export default function Top5Page() {
  const router = useRouter();
  const [top5, setTop5] = useState<RankedMeal[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const [hasRefreshed, setHasRefreshed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMeal, setDrawerMeal] = useState<Meal | null>(null);
  const [lockedTop5Meal, setLockedTop5Meal] = useState<Meal | null>(null);
  const [lockedTop5Rank, setLockedTop5Rank] = useState<number | null>(null);

  useEffect(() => {
    const key = getTop5CacheKey();
    clearStaleTop5Keys(key);

    const cached = loadTop5Cache(key);
    if (cached) {
      setTop5(cached.meals);
      setHasRefreshed(cached.wasRefreshed);
    } else {
      const fresh = buildTop5();
      setTop5(fresh);
      saveTop5Cache(key, fresh);
    }

    trackEvent("top5_viewed");
  }, []);

  function handleRefresh() {
    const key = getTop5CacheKey();
    const fresh = buildTop5();
    setTop5(fresh);
    saveTop5Cache(key, fresh, true);
    setHasRefreshed(true);
    setSelected(null);
  }

  const selectedMeal = top5.find((r) => r.meal.id === selected);

  // Auto-navigate home after the lock-in confirmation is shown
  useEffect(() => {
    if (!lockedTop5Meal) return;
    const timer = setTimeout(() => {
      router.replace("/");
    }, 2200);
    return () => clearTimeout(timer);
  }, [lockedTop5Meal, router]);

  function handleSelect(id: string) {
    setSelected((prev) => (prev === id ? null : id));
  }

  function handleLockIn() {
    if (!selectedMeal || locking) return;
    setLocking(true);
    trackEvent("top5_locked_in", { mealId: selectedMeal.meal.id });

    addToHistory(selectedMeal.meal);
    saveDecidedMeal({
      ...selectedMeal.meal,
      decidedAt: new Date().toISOString(),
      mode: "solo",
    });
    void recordAcceptedDecision({ meal: selectedMeal.meal, positionInDeck: 0, sessionType: "top5", sessionId: null, vibeSelection: null });
    void checkAndTriggerTypeReveal();

    const rank = top5.findIndex((r) => r.meal.id === selectedMeal.meal.id) + 1;
    setLockedTop5Meal(selectedMeal.meal);
    setLockedTop5Rank(rank);
  }

  function handleLockInMeal(meal: Meal) {
    if (locking) return;
    setLocking(true);
    trackEvent("top5_locked_in", { mealId: meal.id });

    addToHistory(meal);
    saveDecidedMeal({
      ...meal,
      decidedAt: new Date().toISOString(),
      mode: "solo",
    });
    void recordAcceptedDecision({ meal, positionInDeck: 0, sessionType: "top5", sessionId: null, vibeSelection: null });
    void checkAndTriggerTypeReveal();

    const rank = top5.findIndex((r) => r.meal.id === meal.id) + 1;
    setLockedTop5Meal(meal);
    setLockedTop5Rank(rank);
  }

  // ── Lock-in confirmation screen ─────────────────────────────────────────────
  if (lockedTop5Meal) {
    return (
      <div
        className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden"
        style={{ backgroundColor: "#FAF6F1", color: "#1C1A18" }}
      >
        {/* Warm Candlelight bloom — top */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64" style={{ background: "radial-gradient(ellipse 100% 240px at 50% 0%, rgba(232,98,26,0.07) 0%, transparent 100%)" }} />
        {/* Warm bloom — bottom edge */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40" style={{ background: "linear-gradient(to top, rgba(245,180,100,0.04) 0%, transparent 100%)" }} />
        <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-6">

          {/* Green checkmark — animates in first */}
          <div
            className="relative flex items-center justify-center"
            style={{ animation: "checkPop 0.45s cubic-bezier(0.34,1.56,0.64,1) both" }}
          >
            <div className="absolute w-40 h-40 rounded-full bg-[#4A7C59]/15 animate-pulse" />
            <div
              className="w-28 h-28 rounded-full bg-[#4A7C59] flex items-center justify-center relative z-10"
              style={{ boxShadow: "0 0 48px rgba(74,124,89,0.35)" }}
            >
              <span className="font-display font-black text-5xl text-white">✓</span>
            </div>
          </div>

          {/* Content — fades up after check lands */}
          <div
            className="w-full flex flex-col items-center gap-6"
            style={{ animation: "contentRise 0.5s ease-out 0.35s both" }}
          >
            {/* Eyebrow */}
            <p
              className="font-body font-semibold text-[11px] tracking-[0.18em] uppercase"
              style={{ color: "#E8621A" }}
            >
              Tonight&apos;s Pick
            </p>

            {/* Headline */}
            <p
              className="font-display font-black text-3xl text-center leading-tight"
              style={{ color: "#1C1A18" }}
            >
              Top 5 made the call.
            </p>

            {/* Meal card */}
            <div
              className="w-full rounded-[24px] overflow-hidden"
              style={{ backgroundColor: "#EFEAE3" }}
            >
              {lockedTop5Meal.image ? (
                <Image
                  src={lockedTop5Meal.image}
                  alt={lockedTop5Meal.name}
                  width={400}
                  height={260}
                  className="w-full object-cover"
                  style={{ height: "220px" }}
                />
              ) : (
                <div
                  className="w-full flex items-center justify-center"
                  style={{ height: "220px" }}
                >
                  <span className="text-6xl">🍽️</span>
                </div>
              )}
              <div className="px-6 py-5">
                <p
                  className="font-display font-black text-2xl leading-tight"
                  style={{ color: "#1C1A18" }}
                >
                  {lockedTop5Meal.name}
                </p>
                <p
                  className="font-body text-sm mt-2"
                  style={{ color: "#6B6360" }}
                >
                  Ranked #{lockedTop5Rank} in tonight&apos;s Top 5
                </p>
              </div>
            </div>

            {/* Footer */}
            <p
              className="font-body text-xs"
              style={{ color: "#A89F99", fontStyle: "italic" }}
            >
              Taking you home…
            </p>
          </div>
        </div>

        <style>{`
          @keyframes checkPop {
            from { opacity: 0; transform: scale(0.5); }
            to   { opacity: 1; transform: scale(1); }
          }
          @keyframes contentRise {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{ backgroundColor: "#FAF6F1", color: "#1C1A18" }}
    >
      {/* Warm Candlelight bloom — ambient top glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72" style={{ background: "radial-gradient(ellipse 110% 280px at 50% 0%, rgba(232,98,26,0.065) 0%, transparent 100%)" }} />

      {/* Header */}
      <div className="sticky top-0 z-10" style={{ backgroundColor: "rgba(250,246,241,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "0 1px 0 rgba(28,16,8,0.07)" }}>
        <div className="max-w-md mx-auto px-5 pb-4 flex items-center gap-3" style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 48px)" }}>
          <Link
            href="/"
            className="flex items-center justify-center w-9 h-9 rounded-full transition-opacity hover:opacity-70"
            style={{ backgroundColor: "#EDE8E1", border: "1px solid rgba(28,16,8,0.08)" }}
            aria-label="Back"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 3L5 8L10 13"
                stroke="#1C1A18"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <div className="flex-1 flex items-center justify-between">
            <div>
              <p
                className="font-display font-black text-xl leading-tight"
                style={{ color: "#1C1A18" }}
              >
                Tonight&apos;s Top 5
              </p>
              <p
                style={{ fontFamily: "var(--font-instrument-serif)", fontStyle: "italic", fontSize: 13, color: "#E8621A", marginTop: 1, lineHeight: 1.2 }}
              >
                ranked just for you
              </p>
            </div>
            {!hasRefreshed && (
              <button
                onClick={handleRefresh}
                className="font-body text-xs px-3 py-1.5 rounded-full transition-opacity hover:opacity-70"
                style={{ color: "#8A7F78", backgroundColor: "#EDE8E1" }}
              >
                Refresh today&apos;s picks
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div
        className="max-w-md mx-auto px-5 pb-40"
        style={{ paddingTop: "8px" }}
      >
        {top5.length === 0 ? (
          <div className="mt-20 text-center">
            <p className="font-body text-base" style={{ color: "#8A7F78" }}>
              Building your list…
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {top5.map((ranked, idx) => {
              const isSelected = selected === ranked.meal.id;
              const meta = [ranked.meal.category, ranked.meal.cuisine]
                .filter(Boolean)
                .join(" · ");

              return (
                <div
                  key={ranked.meal.id}
                  className="w-full rounded-[20px] p-5 transition-all duration-200 flex gap-4 items-stretch"
                  style={{
                    backgroundColor: isSelected ? "rgba(255,244,237,0.97)" : "rgba(255,255,255,0.72)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: isSelected
                      ? "1.5px solid #E8621A"
                      : "1.5px solid rgba(28,16,8,0.07)",
                    boxShadow: isSelected
                      ? "0 6px 28px rgba(232,98,26,0.18), 0 1px 4px rgba(232,98,26,0.08)"
                      : "0 2px 18px rgba(28,16,8,0.07), 0 1px 4px rgba(28,16,8,0.04)",
                  }}
                >
                  {/* Left: text content — tapping selects this meal */}
                  <button
                    onClick={() => handleSelect(ranked.meal.id)}
                    className="flex-1 min-w-0 flex flex-col text-left"
                  >
                    {/* Position + reason row */}
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="font-display font-black text-2xl leading-none shrink-0"
                        style={{ color: "#E8621A" }}
                      >
                        {POSITIONS[idx]}
                      </span>
                      <span
                        className="font-body font-semibold text-[10px] tracking-widest uppercase leading-tight truncate"
                        style={{ color: "#E8621A" }}
                      >
                        {ranked.reason}
                      </span>
                    </div>

                    {/* Meal name */}
                    <p
                      className="font-display font-black text-xl leading-tight"
                      style={{ color: "#1C1A18" }}
                    >
                      {ranked.meal.name}
                    </p>

                    {/* Meta */}
                    <p
                      className="font-body text-sm mt-1"
                      style={{ color: "#6B6360" }}
                    >
                      {meta}
                    </p>

                    {/* Tags — show first 2 */}
                    {ranked.meal.tags.length > 0 && (
                      <div className="flex gap-1.5 mt-2.5 flex-wrap">
                        {ranked.meal.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="font-body text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: isSelected
                                ? "rgba(232,98,26,0.12)"
                                : "rgba(28,16,8,0.06)",
                              color: isSelected ? "#C45016" : "#6B6360",
                              border: isSelected ? "1px solid rgba(232,98,26,0.18)" : "1px solid rgba(28,16,8,0.05)",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Selected checkmark */}
                    {isSelected && (
                      <div className="flex items-center gap-1.5 mt-3">
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: "#E8621A" }}
                        >
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path
                              d="M1 3L3 5L7 1"
                              stroke="white"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <span
                          className="font-body text-xs font-semibold"
                          style={{ color: "#E8621A" }}
                        >
                          Selected
                        </span>
                      </div>
                    )}
                  </button>

                  {/* Right: info button + meal image */}
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <button
                      onClick={() => { setDrawerMeal(ranked.meal); setDrawerOpen(true); }}
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: isSelected ? "rgba(232,98,26,0.1)" : "rgba(28,16,8,0.06)", border: isSelected ? "1px solid rgba(232,98,26,0.2)" : "1px solid rgba(28,16,8,0.05)" }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isSelected ? "#E8621A" : "#8A7F78"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                    </button>
                    <div
                      className="w-28 flex-1 rounded-[14px] overflow-hidden flex items-center justify-center"
                      style={{ backgroundColor: isSelected ? "rgba(232,98,26,0.08)" : "rgba(28,16,8,0.05)", border: `1px solid ${isSelected ? "rgba(232,98,26,0.15)" : "rgba(28,16,8,0.06)"}`, minHeight: "56px", maxHeight: "90px" }}
                    >
                      {ranked.meal.image ? (
                        <Image
                          src={ranked.meal.image}
                          alt={ranked.meal.name}
                          width={112}
                          height={75}
                          className="w-full h-full object-cover"
                          style={{ display: "block" }}
                        />
                      ) : (
                        <span className="text-3xl">🍽️</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fixed bottom CTA */}
      {selectedMeal && (
        <div
          className="fixed bottom-0 left-0 right-0 z-20 px-5 pb-8 pt-4"
          style={{
            background:
              "linear-gradient(to top, #FAF6F1 60%, rgba(250,246,241,0.95) 80%, transparent)",
          }}
        >
          <div className="max-w-md mx-auto">
            <button
              onClick={handleLockIn}
              disabled={locking}
              className="w-full font-display font-black text-base py-4 rounded-full flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "#E8621A", color: "#fff", boxShadow: "0 8px 32px rgba(232,98,26,0.35)" }}
            >
              {locking
                ? "Locking in…"
                : `Lock in — ${selectedMeal.meal.name} →`}
            </button>
          </div>
        </div>
      )}

      <MealDetailDrawer
        meal={drawerMeal}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onLockIn={() => {
          setDrawerOpen(false);
          if (drawerMeal) handleLockInMeal(drawerMeal);
        }}
        context="top5"
      />
    </div>
  );
}
