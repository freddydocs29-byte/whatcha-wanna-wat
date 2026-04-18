"use client";

import { useRef, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { meals, type Meal } from "../data/meals";
import { saveMeal, addToHistory, getPreferences, getSavedMeals, getHistory, getTasteProfile, updateTasteProfile, getRecentlySeenIds, recordSeenSession, getFlavorProfile, getFavorites, getTodaysPick, type UserPreferences, type HistoryEntry } from "../lib/storage";
import { rankMeals, type RankedMeal } from "../lib/scoring";

const SWIPE_THRESHOLD = 100;
const MIN_DECK_SIZE = 15;

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&h=750&q=80";

function FridgeClosed() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" aria-hidden="true">
      <rect x="1.75" y="0.75" width="10.5" height="14.5" rx="2.25" stroke="currentColor" strokeWidth="1.5" />
      <line x1="1.75" y1="5.25" x2="12.25" y2="5.25" stroke="currentColor" strokeWidth="1.25" />
      <line x1="9.75" y1="2" x2="9.75" y2="3.75" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="9.75" y1="7.5" x2="9.75" y2="11.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function FridgeOpen() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" aria-hidden="true">
      <rect x="4.5" y="0.75" width="8.75" height="14.5" rx="2.25" stroke="currentColor" strokeWidth="1.5" />
      <line x1="4.5" y1="5.25" x2="13.25" y2="5.25" stroke="currentColor" strokeWidth="1.25" />
      <line x1="6" y1="10" x2="11.5" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
      <path d="M4.5 1.5 L1.5 3.25 L1.5 13 L4.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="2.75" y1="7.5" x2="2.75" y2="9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

type TasteFilter = {
  id: string;
  label: string;
  description: string;
  match: (meal: Meal) => boolean;
};

const FILTERS: TasteFilter[] = [
  {
    id: "quick-easy",
    label: "Quick & Easy",
    description: "Under 25 min, minimal effort",
    match: (m) =>
      m.tags.some((t) =>
        ["easy", "15 min", "20 min", "25 min"].some((k) =>
          t.toLowerCase().includes(k)
        )
      ),
  },
  {
    id: "comfort-food",
    label: "Comfort Food",
    description: "Hearty, familiar, feel-good",
    match: (m) =>
      m.category.toLowerCase().includes("comfort") ||
      m.tags.some((t) =>
        ["indulgent", "crowd pleaser"].some((k) => t.toLowerCase().includes(k))
      ),
  },
  {
    id: "healthy",
    label: "Healthy",
    description: "Light, nutritious, no regrets",
    match: (m) =>
      m.category.toLowerCase().includes("health") ||
      m.tags.some((t) =>
        ["nutritious", "light", "protein"].some((k) =>
          t.toLowerCase().includes(k)
        )
      ),
  },
  {
    id: "something-new",
    label: "Something New",
    description: "Bold, adventurous, unexpected",
    match: (m) =>
      ["bold flavors", "fresh", "elevated", "classic italian"].some((c) =>
        m.category.toLowerCase().includes(c)
      ),
  },
  {
    id: "kid-friendly",
    label: "Kid-Friendly",
    description: "Everyone at the table will eat it",
    match: (m) =>
      m.tags.some((t) =>
        ["kid", "crowd"].some((k) => t.toLowerCase().includes(k))
      ),
  },
  {
    id: "no-preference",
    label: "No Preference",
    description: "Show me everything",
    match: () => true,
  },
];

const DISLIKED_MEAL_MAP: Record<string, string[]> = {
  Seafood: ["sushi-bowl", "grilled-salmon"],
  Dairy: ["chicken-alfredo"],
  "Gluten / Pasta": ["chicken-alfredo", "pasta-pomodoro"],
  Beef: ["burgers"],
  Pork: [],
  Chicken: ["chicken-alfredo", "butter-chicken", "chicken-stir-fry", "bbq-chicken", "caesar-salad"],
};

function matchesPreferences(meal: Meal, prefs: UserPreferences | null): boolean {
  if (!prefs) return true;

  // Spice filter — exclude meals tagged as bold/flavorful if user wants mild
  if (prefs.spiceLevel === "mild") {
    const spicyTerms = ["spicy", "flavorful", "bold"];
    const isSpicy =
      spicyTerms.some((t) => meal.category.toLowerCase().includes(t)) ||
      meal.tags.some((tag) =>
        spicyTerms.some((t) => tag.toLowerCase().includes(t))
      );
    if (isSpicy) return false;
  }

  // Kid-friendly filter
  if (prefs.kidFriendly === true) {
    const isKidFriendly = meal.tags.some((tag) =>
      ["kid", "crowd"].some((k) => tag.toLowerCase().includes(k))
    );
    if (!isKidFriendly) return false;
  }

  // Disliked foods filter
  for (const disliked of prefs.dislikedFoods) {
    const excluded = DISLIKED_MEAL_MAP[disliked] ?? [];
    if (excluded.includes(meal.id)) return false;
  }

  return true;
}

/**
 * Build a ranked deck for the given filter + pantry mode, with a progressive
 * fallback so the deck never drops below MIN_DECK_SIZE.
 *
 * Stage 1 — full filter + all preference hard-filters (ideal path).
 * Stage 2 — relax the taste filter: use all meals but keep kid-friendly, spice,
 *           and disliked-foods hard-filters. Adds the best cross-filter matches
 *           the user still clearly wants.
 * Stage 3 — relax kid-friendly and spice hard-filters, keep only disliked-foods.
 *           These are explicit ingredient exclusions the user set; we always honour them.
 * Stage 4 — add all remaining meals. Safety net for extreme edge cases.
 *
 * Meals added in later stages are still scored with the full preference + history
 * signals so the deck stays relevant — it just stops hard-blocking everything.
 */
function buildDeck(filterId: string | null, pantryMode: boolean): RankedMeal[] {
  const prefs = getPreferences();
  const savedMeals = getSavedMeals();
  const history = getHistory();
  const recentlySeen = getRecentlySeenIds();
  const tasteProfile = getTasteProfile();
  const flavorProfile = getFlavorProfile() ?? undefined;
  const favorites = getFavorites();

  function rank(pool: Meal[]): RankedMeal[] {
    return rankMeals(pool, prefs, savedMeals, history, pantryMode, tasteProfile, recentlySeen, flavorProfile, favorites);
  }

  // Merge new ranked meals into an existing deck, skipping duplicates.
  function fill(deck: RankedMeal[], candidates: Meal[]): RankedMeal[] {
    const seen = new Set(deck.map((r) => r.meal.id));
    const newMeals = candidates.filter((m) => !seen.has(m.id));
    if (newMeals.length === 0) return deck;
    return [...deck, ...rank(newMeals)];
  }

  const filter = FILTERS.find((f) => f.id === filterId) ?? null;
  const filterBase = filter ? meals.filter(filter.match) : meals;

  // Stage 1: full filter + full preferences
  let deck = rank(filterBase.filter((m) => matchesPreferences(m, prefs)));
  if (deck.length >= MIN_DECK_SIZE) return deck;

  // Stage 2: relax taste filter — all meals still pass through preference hard-filters
  deck = fill(deck, meals.filter((m) => matchesPreferences(m, prefs)));
  if (deck.length >= MIN_DECK_SIZE) return deck;

  // Stage 3: relax kid-friendly + spice hard-filters, keep only disliked-food exclusions
  const dislikedIds = new Set(
    (prefs?.dislikedFoods ?? []).flatMap((d) => DISLIKED_MEAL_MAP[d] ?? [])
  );
  deck = fill(deck, meals.filter((m) => !dislikedIds.has(m.id)));
  if (deck.length >= MIN_DECK_SIZE) return deck;

  // Stage 4: add all remaining meals (safety net)
  deck = fill(deck, meals);
  return deck;
}

function DeckContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isChangeMeal = searchParams.get("change") === "1";
  const [existingMeal, setExistingMeal] = useState<HistoryEntry | null>(null);
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [rankedMeals, setRankedMeals] = useState<RankedMeal[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitX, setExitX] = useState<number | null>(null);
  const [pantryMode, setPantryMode] = useState(false);
  const [topPicksMode, setTopPicksMode] = useState(false);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const [isChoosing, setIsChoosing] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(
    () => typeof window !== "undefined" && !localStorage.getItem("wwe_swipe_hint_seen")
  );
  const afterExitRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isChangeMeal) setExistingMeal(getTodaysPick());
  }, [isChangeMeal]);

  function dismissHint() {
    if (!showSwipeHint) return;
    localStorage.setItem("wwe_swipe_hint_seen", "1");
    setShowSwipeHint(false);
  }

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const passOpacity = useTransform(x, [-SWIPE_THRESHOLD, -30], [1, 0]);
  const chooseOpacity = useTransform(x, [30, SWIPE_THRESHOLD], [0, 1]);

  const activeFilter = FILTERS.find((f) => f.id === activeFilterId) ?? null;

  const current = rankedMeals[currentIndex];
  const meal = current?.meal;
  const reason = current?.reason ?? "";
  const nextMeal = rankedMeals[currentIndex + 1]?.meal;
  const isExhausted = currentIndex >= rankedMeals.length;
  const isExiting = exitX !== null;

  function selectFilter(id: string) {
    const ranked = buildDeck(id, pantryMode);
    recordSeenSession(ranked.map((r) => r.meal.id));
    setRankedMeals(ranked);
    setActiveFilterId(id);
    setCurrentIndex(0);
    setTopPicksMode(false);
    x.set(0);
    setExitX(null);
  }

  function handleTopPicks() {
    const allRanked = buildDeck(activeFilterId, pantryMode);
    const topN = Math.max(3, Math.ceil(allRanked.length * 0.35));
    setRankedMeals(allRanked.slice(0, topN));
    setCurrentIndex(0);
    setTopPicksMode(true);
    x.set(0);
    setExitX(null);
  }

  function togglePantry() {
    const next = !pantryMode;
    setPantryMode(next);
    if (activeFilterId !== null) {
      setRankedMeals(buildDeck(activeFilterId, next));
      setCurrentIndex(0);
      x.set(0);
      setExitX(null);
    }
  }

  function resetFilter() {
    setActiveFilterId(null);
    setRankedMeals([]);
    setCurrentIndex(0);
    setTopPicksMode(false);
    x.set(0);
    setExitX(null);
  }

  function triggerExit(direction: "left" | "right", afterExit: () => void) {
    afterExitRef.current = afterExit;
    setExitX(direction === "left" ? -600 : 600);
  }

  function handlePass() {
    dismissHint();
    if (meal) updateTasteProfile(meal, "pass");
    triggerExit("left", () => setCurrentIndex((i) => i + 1));
  }

  function handleSave() {
    if (meal) {
      saveMeal(meal);
      updateTasteProfile(meal, "save");
    }
    x.set(0);
    setCurrentIndex((i) => i + 1);
  }

  function handleChoose() {
    if (!meal || isChoosing || isExiting) return;
    dismissHint();
    const chosenMeal = meal;
    updateTasteProfile(chosenMeal, "choose");

    // Haptic feedback: firm tap + soft echo
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([12, 60, 8]);
    }

    // Brief flash moment before the exit animation fires
    setIsChoosing(true);
    setTimeout(() => {
      setIsChoosing(false);
      triggerExit("right", () => {
        addToHistory(chosenMeal);
        router.push(`/locked?mealId=${chosenMeal.id}${pantryMode ? "&pantry=1" : ""}`);
      });
    }, 240);
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    dismissHint();
    if (info.offset.x < -SWIPE_THRESHOLD) handlePass();
    else if (info.offset.x > SWIPE_THRESHOLD) handleChoose();
  }

  function onAnimationComplete() {
    if (exitX !== null && afterExitRef.current) {
      const action = afterExitRef.current;
      afterExitRef.current = null;
      x.set(0);
      setExitX(null);
      action();
    }
  }

  // ── Filter picker screen ──────────────────────────────────────────────────
  if (activeFilterId === null) {
    return (
      <main className="min-h-screen bg-[#080808] px-5 pb-6 safe-top text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
          <header className="flex items-center justify-between">
            <p className="text-sm text-white/50">Decision Deck</p>
            <button
              onClick={() => router.push("/")}
              className="text-sm text-white/35 transition hover:text-white/60"
            >
              {isChangeMeal && existingMeal
                ? `Keep ${existingMeal.meal.name}`
                : "Back"}
            </button>
          </header>

          <section className="mt-10">
            <h1 className="text-4xl font-semibold tracking-[-0.05em]">
              What are you feeling?
            </h1>
            <p className="mt-3 max-w-[30ch] text-sm leading-6 text-white/55">
              Pick a vibe and we'll show meals that match. You can always change
              it.
            </p>
          </section>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {FILTERS.slice(0, -1).map((filter) => (
              <button
                key={filter.id}
                onClick={() => selectFilter(filter.id)}
                className="flex flex-col items-start rounded-[24px] border border-white/10 bg-white/[0.05] p-4 text-left shadow-[0_6px_24px_rgba(0,0,0,0.25)] transition hover:bg-white/[0.09] active:scale-[0.98]"
              >
                <span className="text-base font-semibold tracking-[-0.03em]">
                  {filter.label}
                </span>
                <span className="mt-1 text-xs leading-5 text-white/50">
                  {filter.description}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex justify-center">
            <button
              onClick={() => selectFilter("no-preference")}
              className="text-sm text-white/40 underline underline-offset-4 transition hover:text-white/70"
            >
              Skip — show me everything
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Exhausted screen ──────────────────────────────────────────────────────
  if (isExhausted) {
    return (
      <main className="min-h-screen bg-[#080808] px-5 pb-6 safe-top text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
          <header className="flex items-center justify-between">
            <p className="text-sm text-white/50">Decision Deck</p>
            <button
              onClick={() => router.push("/")}
              className="text-sm text-white/35 transition hover:text-white/60"
            >
              {isChangeMeal && existingMeal
                ? `Keep ${existingMeal.meal.name}`
                : "Back"}
            </button>
          </header>

          <div className="flex flex-1 flex-col items-center justify-center text-center">
            {topPicksMode ? (
              <>
                <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs text-white/45">
                  <span className="h-1 w-1 rounded-full bg-white/30" />
                  Round 2 complete
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">
                  That&apos;s your best set
                </h2>
                <p className="mt-3 max-w-[28ch] text-sm leading-6 text-white/55">
                  You&apos;ve gone through your strongest matches. Want to try a new direction?
                </p>
                <p className="mt-3 text-xs text-white/30">You&apos;re close 👀</p>
                <div className="mt-8 flex gap-3">
                  <button
                    onClick={() => { setTopPicksMode(false); setCurrentIndex(0); }}
                    className="rounded-full border border-white/[0.07] bg-white/[0.05] px-5 py-3 text-sm text-white/50"
                  >
                    Start over
                  </button>
                  <button
                    onClick={resetFilter}
                    className="rounded-full border border-white/[0.07] bg-white/[0.05] px-5 py-3 text-sm text-white/50"
                  >
                    Change filter
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs text-white/45">
                  <span className="h-1 w-1 rounded-full bg-white/30" />
                  First pass complete
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">
                  Want to narrow it down?
                </h2>
                <p className="mt-3 max-w-[28ch] text-sm leading-6 text-white/55">
                  You&apos;ve seen everything once. Let&apos;s zero in on your best picks.
                </p>
                <div className="mt-8 w-full">
                  <button
                    onClick={handleTopPicks}
                    className="w-full rounded-full bg-white py-4 text-base font-semibold text-black"
                    style={{ boxShadow: "0 0 24px rgba(255,255,255,0.12), 0 2px 8px rgba(0,0,0,0.4)" }}
                  >
                    Show top picks
                  </button>
                  <div className="mt-5 flex justify-center gap-3">
                    <button
                      onClick={() => setCurrentIndex(0)}
                      className="rounded-full border border-white/[0.07] bg-white/[0.05] px-5 py-3 text-sm text-white/50"
                    >
                      Start over
                    </button>
                    <button
                      onClick={resetFilter}
                      className="rounded-full border border-white/[0.07] bg-white/[0.05] px-5 py-3 text-sm text-white/50"
                    >
                      Change filter
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ── Deck screen ───────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#080808] px-5 pb-6 safe-top text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col">

        {/* Ambient pantry glow — warm bloom from top edge */}
        <AnimatePresence>
          {pantryMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="pointer-events-none absolute inset-x-0 top-0 h-64 -mx-5"
              style={{
                background:
                  "radial-gradient(ellipse 100% 160px at 50% 0%, rgba(251,191,36,0.07) 0%, transparent 100%)",
              }}
            />
          )}
        </AnimatePresence>

        <header className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm text-white/50">Decision Deck</p>
            {topPicksMode && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/35">
                top picks
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={togglePantry}
              animate={
                pantryMode
                  ? {
                      boxShadow:
                        "0 0 20px rgba(251,191,36,0.45), 0 0 8px rgba(251,191,36,0.3)",
                      scale: 1.02,
                    }
                  : { boxShadow: "none", scale: 1 }
              }
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors duration-200 ${
                pantryMode
                  ? "border-amber-400/50 bg-amber-400/[0.1] font-medium text-amber-200"
                  : "border-white/[0.07] text-white/[0.2] hover:border-white/[0.12] hover:text-white/35"
              }`}
            >
              <span className="relative flex h-[16px] w-[14px] shrink-0 items-center justify-center">
                <AnimatePresence initial={false}>
                  {pantryMode ? (
                    <motion.span
                      key="fridge-open"
                      initial={{ opacity: 0, scale: 0.75 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.75 }}
                      transition={{ duration: 0.15 }}
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ filter: "drop-shadow(0 0 5px rgba(251,191,36,0.9))" }}
                    >
                      <FridgeOpen />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="fridge-closed"
                      initial={{ opacity: 0, scale: 0.75 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.75 }}
                      transition={{ duration: 0.15 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <FridgeClosed />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              Pantry
            </motion.button>
            <button
              onClick={resetFilter}
              className="text-xs text-white/35 transition hover:text-white/60"
            >
              {activeFilter?.label} ·{" "}
              <span className="underline underline-offset-2">change</span>
            </button>
            <p className="text-sm text-white/35">
              {currentIndex + 1}/{rankedMeals.length}
            </p>
          </div>
        </header>

        {/* Pantry mode indicator — read-only system state */}
        <AnimatePresence>
          {pantryMode && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="mt-3 flex items-center justify-center gap-2.5 rounded-2xl bg-white/[0.04] px-5 py-2"
            >
              <span
                className="shrink-0 text-amber-300"
                style={{ filter: "drop-shadow(0 0 4px rgba(251,191,36,0.65))" }}
              >
                <FridgeOpen />
              </span>
              <p className="text-xs font-medium tracking-[-0.01em] text-white/50">
                Cooking from your kitchen
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="mt-8">
          <h1 className="text-4xl font-semibold tracking-[-0.05em]">
            What sounds good?
          </h1>
          <p className="mt-3 max-w-[30ch] text-sm leading-6 text-white/60">
            Swipe left to pass, right to choose, or use the buttons below.
          </p>
        </section>

        <div className="relative mt-8">
          {/* Next card — sits behind, promotes forward when current card exits */}
          {nextMeal && (
            <motion.div
              animate={
                isExiting
                  ? { scale: 1, opacity: 1, y: 0 }
                  : { scale: 0.92, opacity: 0.4, y: 10 }
              }
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-0 pointer-events-none select-none rounded-[34px] border border-white/[0.06] bg-white/[0.04]"
            />
          )}

          {/* Current card — draggable, on top */}
          <motion.section
            style={{ x, rotate }}
            animate={
              isExiting
                ? { x: exitX, opacity: 0, scale: 1, filter: "brightness(1) contrast(1)" }
                : isChoosing
                ? { scale: 1.05, opacity: 1, filter: "brightness(1.08) contrast(1.04)" }
                : { scale: 1, opacity: 1, filter: "brightness(1) contrast(1)" }
            }
            transition={
              isExiting
                ? { duration: 0.3, ease: "easeOut" }
                : { duration: 0.12, ease: "easeOut" }
            }
            onAnimationComplete={onAnimationComplete}
            drag={isExiting || isChoosing ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.8}
            onDragEnd={handleDragEnd}
            className="relative z-10 cursor-grab select-none touch-none rounded-[34px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] active:cursor-grabbing"
          >
            {/* Pass stamp */}
            <motion.div
              style={{ opacity: passOpacity }}
              className="pointer-events-none absolute left-5 top-8 z-10 -rotate-12 rounded border-2 border-rose-400/80 px-3 py-1 text-sm font-bold uppercase tracking-widest text-rose-400"
            >
              Pass
            </motion.div>

            {/* Choose stamp */}
            <motion.div
              style={{ opacity: chooseOpacity }}
              className="pointer-events-none absolute right-5 top-8 z-10 rotate-12 rounded border-2 border-emerald-400/80 px-3 py-1 text-sm font-bold uppercase tracking-widest text-emerald-400"
            >
              Choose
            </motion.div>

            <div className="relative aspect-[4/5] overflow-hidden rounded-[28px]">
              {/* Meal photo */}
              <img
                src={imgErrors.has(meal.id) ? FALLBACK_IMAGE : meal.image}
                alt={meal.name}
                draggable={false}
                onError={() =>
                  setImgErrors((prev) => new Set(prev).add(meal.id))
                }
                className="absolute inset-0 h-full w-full object-cover"
                style={
                  imgErrors.has(meal.id)
                    ? { filter: "brightness(0.88) saturate(0.6)" }
                    : undefined
                }
              />

              {/* Gradient overlay — sits above the image, below all text (z-10 content is above this) */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.28) 38%, rgba(0,0,0,0.06) 62%, transparent 100%)",
                }}
              />

              {/* Swipe hint — overlaid on card, fades in after a short delay, persists until first interaction */}
              <AnimatePresence>
                {showSwipeHint && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.5 } }}
                    transition={{ duration: 0.6, delay: 0.9 }}
                    className="pointer-events-none absolute inset-x-0 z-20 flex justify-center"
                    style={{ bottom: "38%" }}
                  >
                    <div className="flex items-center gap-2.5 rounded-full bg-black/50 px-4 py-2 backdrop-blur-sm">
                      <span className="text-xs text-rose-400/75">← Swipe to pass</span>
                      <span className="text-[10px] text-white/25">·</span>
                      <span className="text-xs text-emerald-400/75">Swipe to choose →</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Card content */}
              <div className="relative z-10 flex h-full flex-col justify-between p-5">
                {/* Top: category badge */}
                <div>
                  <div className="inline-flex rounded-full border border-white/20 bg-black/30 px-3 py-1 text-xs text-white/75 backdrop-blur-sm">
                    {meal.category}
                  </div>
                </div>

                {/* Bottom: title, description, tags, why */}
                <div className="space-y-3">
                  <div>
                    <h2
                      className="text-3xl font-semibold tracking-[-0.04em] text-white"
                      style={{ textShadow: "0 2px 20px rgba(0,0,0,1), 0 1px 6px rgba(0,0,0,0.65)" }}
                    >
                      {meal.name}
                    </h2>
                    <p
                      className="mt-2 text-sm leading-6 text-white/85"
                      style={{ textShadow: "0 1px 12px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.5)" }}
                    >
                      {meal.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-white/60">
                    {meal.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-white/15 px-3 py-1 backdrop-blur-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {reason && (
                    <p
                      className="text-xs text-white/50"
                      style={{ textShadow: "0 1px 8px rgba(0,0,0,0.7)" }}
                    >
                      ✦ {reason}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Choose glow — flashes briefly when a meal is confirmed */}
            <AnimatePresence>
              {isChoosing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="pointer-events-none absolute inset-0 z-30 rounded-[34px]"
                  style={{
                    background:
                      "radial-gradient(ellipse 80% 70% at 50% 35%, rgba(255,255,255,0.22) 0%, transparent 72%)",
                    boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.18)",
                  }}
                />
              )}
            </AnimatePresence>

            {/* Confirmation text — appears briefly on choose */}
            <AnimatePresence>
              {isChoosing && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1, ease: "easeOut" }}
                  className="pointer-events-none absolute inset-x-0 z-40 flex justify-center"
                  style={{ top: "40%" }}
                >
                  <span className="rounded-full bg-black/40 px-4 py-1.5 text-sm font-medium tracking-[0.05em] text-white backdrop-blur-sm">
                    Locked in.
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        </div>


        <div className="mt-4 grid grid-cols-3 gap-3">
          <button
            onClick={handlePass}
            disabled={isExiting || isChoosing}
            className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-4 text-sm text-white/70 disabled:opacity-40"
          >
            Pass
          </button>
          <button
            onClick={handleChoose}
            disabled={isExiting || isChoosing}
            className="rounded-full border border-white/10 bg-white px-4 py-4 text-center text-sm font-semibold text-black disabled:opacity-40"
          >
            Choose
          </button>
          <button
            onClick={handleSave}
            disabled={isExiting || isChoosing}
            className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-4 text-sm text-white/70 disabled:opacity-40"
          >
            Save
          </button>
        </div>

        {isChangeMeal && existingMeal && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => router.push("/")}
              className="text-sm text-white/35 transition hover:text-white/60"
            >
              Keep {existingMeal.meal.name}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function DeckPage() {
  return (
    <Suspense>
      <DeckContent />
    </Suspense>
  );
}
