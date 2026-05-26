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
import { inferSessionContext } from "../lib/session-tracking";
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

    router.push("/");
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

    router.push("/");
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#FAF6F1", color: "#1C1A18" }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10" style={{ backgroundColor: "#FAF6F1" }}>
        <div className="max-w-md mx-auto px-5 pt-14 pb-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center justify-center w-9 h-9 rounded-full"
            style={{ backgroundColor: "#EDE8E1" }}
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
                className="font-body text-xs mt-0.5"
                style={{ color: "#8A7F78" }}
              >
                Ranked for you
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
                  className="w-full rounded-[20px] p-5 transition-all duration-150 flex gap-4 items-stretch"
                  style={{
                    backgroundColor: isSelected ? "#FFF4ED" : "#EFEAE3",
                    border: isSelected
                      ? "2px solid #E8621A"
                      : "2px solid transparent",
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
                                ? "#FDDEC8"
                                : "#DDD8D0",
                              color: "#4A3F38",
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
                      style={{ backgroundColor: isSelected ? "#FDDEC8" : "#DDD8D0" }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B6360" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                    </button>
                    <div
                      className="w-28 flex-1 rounded-[12px] overflow-hidden flex items-center justify-center"
                      style={{ backgroundColor: isSelected ? "#FDDEC8" : "#DDD8D0", minHeight: "56px", maxHeight: "90px" }}
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
              "linear-gradient(to top, #FAF6F1 70%, transparent)",
          }}
        >
          <div className="max-w-md mx-auto">
            <button
              onClick={handleLockIn}
              disabled={locking}
              className="w-full font-display font-black text-base py-4 rounded-full flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "#E8621A", color: "#fff" }}
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
