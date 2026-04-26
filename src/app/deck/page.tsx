"use client";

import { useRef, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { meals, type Meal } from "../data/meals";
import { saveMeal, addToHistory, getPreferences, savePreferences, getSavedMeals, getHistory, getTasteProfile, updateTasteProfile, getRecentlySeenIds, recordSeenSession, getFlavorProfile, getFavorites, getTodaysPick, type UserPreferences, type HistoryEntry } from "../lib/storage";
import { rankMeals, hardGate, type RankedMeal, type SessionCookMode, type SessionVibeMode } from "../lib/scoring";
import { supabase } from "../lib/supabase";
import { getUserId } from "../lib/identity";
import { getAvoidSignals, getPreferSignals, checkTriggers, markNudgeFired, type NudgeTrigger } from "../lib/session-signals";
import { ProgressiveQuestion } from "../components/ProgressiveQuestion";

const SWIPE_THRESHOLD = 100;
const MIN_DECK_SIZE = 15;
const DECK_SIZE = 20;

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


const PANTRY_INGREDIENTS: Record<string, string[]> = {
  Proteins: ["Chicken", "Ground beef", "Steak", "Shrimp", "Salmon", "Eggs", "Bacon", "Sausage", "Tofu"],
  Carbs: ["Pasta", "Rice", "Bread", "Tortillas", "Potatoes", "Noodles"],
  Vegetables: ["Onions", "Garlic", "Bell peppers", "Broccoli", "Spinach", "Mushrooms", "Tomatoes"],
  Staples: ["Cheese", "Butter", "Beans"],
};

// Soft preference filters — spice and kid-friendly only.
// Hard-NO foods are enforced upstream by hardGate before any scoring,
// so they are intentionally absent here.
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

  return true;
}

/**
 * Build a ranked deck with a progressive fallback so the deck never drops
 * below MIN_DECK_SIZE. No vibe filter — session selectors (cookMode /
 * sessionVibeMode) are the only real-time context signals.
 *
 * hardGate runs first and permanently removes hard-NO meals.
 * Stage 1 — spice/kid preference hard-filters.
 * Stage 2 — relax spice + kid filters; hard NOs still excluded.
 */
function buildDeck(
  pantryMode: boolean,
  selectedIngredients: string[] = [],
  sessionShown: Set<string> = new Set(),
  cookMode: SessionCookMode = "either",
  sessionVibeMode: SessionVibeMode = "mix-it-up",
): RankedMeal[] {
  const prefs = getPreferences();
  const savedMeals = getSavedMeals();
  const history = getHistory();
  const recentlySeen = getRecentlySeenIds();
  const tasteProfile = getTasteProfile();
  const flavorProfile = getFlavorProfile() ?? undefined;
  const favorites = getFavorites();

  const eligibleMeals = hardGate(meals, prefs?.dislikedFoods ?? []);

  function rank(pool: Meal[]): RankedMeal[] {
    return rankMeals(pool, prefs, savedMeals, history, pantryMode, tasteProfile, recentlySeen, flavorProfile, favorites, selectedIngredients, "solo", sessionShown, null, cookMode, sessionVibeMode);
  }

  function fill(deck: RankedMeal[], candidates: Meal[]): RankedMeal[] {
    const seen = new Set(deck.map((r) => r.meal.id));
    const newMeals = candidates.filter((m) => !seen.has(m.id));
    if (newMeals.length === 0) return deck;
    return [...deck, ...rank(newMeals)];
  }

  // Stage 1: spice/kid preference hard-filters
  let deck = rank(eligibleMeals.filter((m) => matchesPreferences(m, prefs)));
  if (deck.length >= MIN_DECK_SIZE) return deck;

  // Stage 2: relax spice + kid filters
  deck = fill(deck, eligibleMeals);
  return deck;
}

function DeckContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isChangeMeal = searchParams.get("change") === "1";
  const sessionId = searchParams.get("sessionId");
  const [existingMeal, setExistingMeal] = useState<HistoryEntry | null>(null);
  const [rankedMeals, setRankedMeals] = useState<RankedMeal[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitX, setExitX] = useState<number | null>(null);
  const [pantryMode, setPantryMode] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [showIngredientSheet, setShowIngredientSheet] = useState(false);
  const [topPicksMode, setTopPicksMode] = useState(false);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const [cookMode, setCookMode] = useState<SessionCookMode>("either");
  const vibeParam = searchParams.get("vibe") as SessionVibeMode | null;
  const [sessionVibeMode, setSessionVibeMode] = useState<SessionVibeMode>(vibeParam ?? "mix-it-up");
  const [isChoosing, setIsChoosing] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(
    () => typeof window !== "undefined" && !localStorage.getItem("wwe_swipe_hint_seen")
  );
  // ── Shared-session state ────────────────────────────────────────────────────
  const [sharedLoading, setSharedLoading] = useState(!!sessionId);
  const [sharedError, setSharedError] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [bothDone, setBothDone] = useState(false);
  const [sharedRefreshing, setSharedRefreshing] = useState(false);
  const [matchedMeal, setMatchedMealState] = useState<Meal | null>(null);
  // Refs so polling/async callbacks always see current values without stale closures
  const matchedMealRef = useRef<Meal | null>(null);
  const rejectedMatchIdsRef = useRef<Set<string>>(new Set());
  // True when the current user's own 'yes' swipe triggered the match,
  // meaning we still need to advance the card if they click "Pick something else"
  const matchPendingAdvanceRef = useRef(false);

  function setMatchedMeal(meal: Meal | null) {
    matchedMealRef.current = meal;
    setMatchedMealState(meal);
  }

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  // Load the host-defined shared deck from the session row.
  // Both users fetch the same stored order — no local re-ranking.
  // Retries up to 10 times (every 2 s) before showing an error state.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let retries = 0;
    const MAX_RETRIES = 10;

    const load = async () => {
      const { data } = await supabase
        .from("sessions")
        .select("deck_meal_ids")
        .eq("id", sessionId)
        .single();

      if (cancelled) return;

      const ids: string[] = data?.deck_meal_ids ?? [];
      if (ids.length === 0) {
        retries++;
        if (retries >= MAX_RETRIES) {
          // Host hasn't saved the deck after ~20 s — surface a clear error.
          setSharedError(true);
          setSharedLoading(false);
          return;
        }
        setTimeout(load, 2000);
        return;
      }

      // Restore meal objects from stored IDs. Both users' hard NOs were already
      // applied at deck-build time (server-side UNION), so no client-side
      // filtering is needed — both users see the exact same deck.
      const orderedMeals: Meal[] = ids
        .map((id) => meals.find((m) => m.id === id))
        .filter((m): m is Meal => !!m);
      const ordered: RankedMeal[] = orderedMeals.map((meal) => ({ meal, reason: "" }));

      setRankedMeals(ordered.slice(0, DECK_SIZE));
      setSharedLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect when both users have finished swiping (no match yet), or if the deck was
  // cleared by a refresh — in which case follow the other user back to the session page.
  // Uses currentIndex / rankedMeals.length (state values) instead of the derived
  // `isExhausted` const to avoid a temporal-dead-zone issue with the dep array.
  useEffect(() => {
    const exhausted = currentIndex >= Math.min(rankedMeals.length, DECK_SIZE);
    if (!sessionId || !userId || !exhausted) return;

    const totalDeckSize = Math.min(rankedMeals.length, DECK_SIZE);
    let mounted = true;

    const checkState = async () => {
      if (!mounted) return;

      const { data: sessionData } = await supabase
        .from("sessions")
        .select("host_user_id, guest_user_id, deck_meal_ids")
        .eq("id", sessionId)
        .single();

      if (!mounted || !sessionData) return;

      // If the deck was cleared (other user hit "Refresh deck"), follow them to the lobby
      if (!sessionData.deck_meal_ids?.length) {
        router.push(`/session/${sessionId}`);
        return;
      }

      const otherUserId =
        userId === sessionData.host_user_id
          ? sessionData.guest_user_id
          : sessionData.host_user_id;

      if (!otherUserId) return;

      const { count } = await supabase
        .from("swipes")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("user_id", otherUserId);

      if (mounted && (count ?? 0) >= totalDeckSize) {
        setBothDone(true);
      }
    };

    checkState();
    const interval = setInterval(checkState, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [sessionId, userId, currentIndex, rankedMeals.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for matches while inside a shared session
  useEffect(() => {
    if (!sessionId) return;

    const poll = async () => {
      if (matchedMealRef.current) return; // Already showing match modal

      const { data: swipeData } = await supabase
        .from("swipes")
        .select("meal_id, user_id")
        .eq("session_id", sessionId)
        .eq("decision", "yes");

      if (!swipeData || swipeData.length === 0) return;

      // Group voters by meal
      const mealVoters: Record<string, Set<string>> = {};
      for (const row of swipeData) {
        if (!mealVoters[row.meal_id]) mealVoters[row.meal_id] = new Set();
        mealVoters[row.meal_id].add(row.user_id);
      }

      for (const [mealId, voters] of Object.entries(mealVoters)) {
        if (voters.size < 2) continue;
        if (rejectedMatchIdsRef.current.has(mealId)) continue;

        // Confirm session is still active before triggering
        const { data: sessionData } = await supabase
          .from("sessions")
          .select("status, locked_meal_id")
          .eq("id", sessionId)
          .single();
        if (sessionData?.status === "matched") {
          // The other user already confirmed the match — navigate this user
          // to the locked screen even if they are on the waiting/end-of-deck
          // screen and never saw the match modal.
          if (sessionData.locked_meal_id && !matchedMealRef.current) {
            router.push(`/locked?mealId=${sessionData.locked_meal_id}`);
          }
          return;
        }

        const found = meals.find((m) => m.id === mealId);
        if (found) {
          matchPendingAdvanceRef.current = false; // Detected via poll, not own swipe
          setMatchedMeal(found);
          return;
        }
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ────────────────────────────────────────────────────────────────────────────

  const afterExitRef = useRef<(() => void) | null>(null);
  // In-memory set of meal IDs that were the active card during this visit.
  // Populated before each re-rank so context/pantry switches apply a soft
  // penalty to meals the user just saw.
  const sessionShownRef = useRef<Set<string>>(new Set());
  // Tracks whether recordSeenSession has been called for the current deck
  // session — resets on handleRefreshDeck to allow re-recording.
  const deckRecordedRef = useRef(false);

  // ── Progressive onboarding signals ────────────────────────────────────────
  // All in-memory: reset each time the deck page mounts. Pass signals track
  // food-type avoidances; like signals track cuisine preferences from saves.
  // Only one nudge fires per session (firedTriggersRef guards this).
  const passSignalsRef = useRef<Record<string, number>>({});
  const likeSignalsRef = useRef<Record<string, number>>({});
  const firedTriggersRef = useRef<Set<string>>(new Set());
  // Nudge queued during a swipe exit — shown after the animation completes.
  const pendingNudgeRef = useRef<NudgeTrigger | null>(null);
  const [activeNudge, setActiveNudge] = useState<NudgeTrigger | null>(null);

  useEffect(() => {
    if (isChangeMeal) setExistingMeal(getTodaysPick());
  }, [isChangeMeal]);

  // Builds the solo deck on mount and whenever pantry/ingredients/session
  // selectors change. Shared decks are loaded in their own effect and never
  // re-ranked from local state.
  useEffect(() => {
    if (sessionId) return;
    for (let i = 0; i <= currentIndex && i < rankedMeals.length; i++) {
      const id = rankedMeals[i]?.meal?.id;
      if (id) sessionShownRef.current.add(id);
    }
    const ranked = buildDeck(pantryMode, selectedIngredients, sessionShownRef.current, cookMode, sessionVibeMode);
    if (!deckRecordedRef.current) {
      recordSeenSession(ranked.map((r) => r.meal.id));
      deckRecordedRef.current = true;
    }
    setRankedMeals(ranked.slice(0, DECK_SIZE));
    setCurrentIndex(0);
    x.set(0);
    setExitX(null);
  }, [pantryMode, selectedIngredients, cookMode, sessionVibeMode]); // eslint-disable-line react-hooks/exhaustive-deps

  function dismissHint() {
    if (!showSwipeHint) return;
    localStorage.setItem("wwe_swipe_hint_seen", "1");
    setShowSwipeHint(false);
  }

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const passOpacity = useTransform(x, [-SWIPE_THRESHOLD, -30], [1, 0]);
  const chooseOpacity = useTransform(x, [30, SWIPE_THRESHOLD], [0, 1]);

  const current = rankedMeals[currentIndex];
  const meal = current?.meal;
  const reason = current?.reason ?? "";
  const nextMeal = rankedMeals[currentIndex + 1]?.meal;
  const isExiting = exitX !== null;

  const totalCount = Math.min(rankedMeals.length, DECK_SIZE);
  const isExhausted = currentIndex >= totalCount;
  const decisionsMade = currentIndex;
  const progressPct = totalCount > 0 ? Math.min(100, (decisionsMade / totalCount) * 100) : 0;
  const urgencyMessage = (() => {
    if (sessionId && decisionsMade >= 15) return "Final picks…";
    if (decisionsMade >= totalCount) return "Time to decide";
    if (decisionsMade >= 15) return "Almost there";
    if (decisionsMade >= 6) return "Getting closer";
    return "Just getting started";
  })();

  function handleTopPicks() {
    // In shared mode the deck is fixed — top picks = top 35% of the current order.
    // In solo mode rebuild from scratch so scoring is fresh.
    const source = sessionId
      ? rankedMeals
      : buildDeck(pantryMode, selectedIngredients, sessionShownRef.current, cookMode, sessionVibeMode);
    const topN = Math.max(3, Math.ceil(source.length * 0.35));
    setRankedMeals(source.slice(0, topN));
    setCurrentIndex(0);
    setTopPicksMode(true);
    x.set(0);
    setExitX(null);
  }

  function toggleIngredient(name: string) {
    setSelectedIngredients((prev) => {
      if (prev.includes(name)) return prev.filter((i) => i !== name);
      if (prev.length >= 5) return prev;
      return [...prev, name];
    });
  }

  function togglePantry() {
    const next = !pantryMode;
    // Clear selections when turning pantry off so they don't linger.
    // Both state updates are batched by React 18, producing one re-render
    // and one unified-effect execution with the correct final state.
    if (!next) setSelectedIngredients([]);
    setPantryMode(next);
  }

  function triggerExit(direction: "left" | "right", afterExit: () => void) {
    afterExitRef.current = afterExit;
    setExitX(direction === "left" ? -600 : 600);
  }

  // ── Shared-session swipe helpers ────────────────────────────────────────────

  /** Save a 'yes' swipe, then check whether both users have said yes to this meal.
   *  Returns true if a match is found and the session is still active. */
  async function saveYesAndCheckMatch(mealId: string): Promise<boolean> {
    if (!sessionId || !userId) return false;

    // Insert swipe — unique constraint prevents duplicates
    await supabase.from("swipes").insert({
      session_id: sessionId,
      user_id: userId,
      meal_id: mealId,
      decision: "yes",
    });

    // Query 'yes' votes for this meal in this session
    const { data } = await supabase
      .from("swipes")
      .select("user_id")
      .eq("session_id", sessionId)
      .eq("meal_id", mealId)
      .eq("decision", "yes");

    if (!data || data.length < 2) return false;

    const uniqueUsers = new Set(data.map((r: { user_id: string }) => r.user_id));
    if (uniqueUsers.size < 2) return false;

    // Confirm session hasn't already been locked
    const { data: sessionData } = await supabase
      .from("sessions")
      .select("status")
      .eq("id", sessionId)
      .single();

    return sessionData?.status !== "matched";
  }

  async function handleSharedChoose(chosenMeal: Meal) {
    updateTasteProfile(chosenMeal, "choose");
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([12, 60, 8]);
    }
    setIsChoosing(true);

    const isMatch = await saveYesAndCheckMatch(chosenMeal.id);

    setIsChoosing(false);

    if (isMatch && !rejectedMatchIdsRef.current.has(chosenMeal.id)) {
      matchPendingAdvanceRef.current = true;
      setMatchedMeal(chosenMeal);
      return;
    }

    // No match — advance to next card
    triggerExit("right", () => setCurrentIndex((i) => i + 1));
  }

  async function handleMatchConfirm() {
    if (!matchedMeal || !sessionId) return;
    await supabase
      .from("sessions")
      .update({
        status: "matched",
        locked_meal_id: matchedMeal.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    addToHistory(matchedMeal);
    router.push(`/locked?mealId=${matchedMeal.id}`);
  }

  function handleMatchReject() {
    if (!matchedMeal) return;
    rejectedMatchIdsRef.current.add(matchedMeal.id);
    const shouldAdvance = matchPendingAdvanceRef.current;
    matchPendingAdvanceRef.current = false;
    setMatchedMeal(null);
    // Only advance if the current user's own swipe triggered this match
    // (i.e. they haven't moved to the next card yet)
    if (shouldAdvance) {
      triggerExit("right", () => setCurrentIndex((i) => i + 1));
    }
  }

  // ────────────────────────────────────────────────────────────────────────────

  function handleRefreshDeck() {
    sessionShownRef.current = new Set();
    deckRecordedRef.current = false;
    const ranked = buildDeck(pantryMode, selectedIngredients, sessionShownRef.current, cookMode, sessionVibeMode);
    recordSeenSession(ranked.map((r) => r.meal.id));
    deckRecordedRef.current = true;
    setRankedMeals(ranked.slice(0, DECK_SIZE));
    setCurrentIndex(0);
    x.set(0);
    setExitX(null);
  }

  // Shared-mode refresh: delete all swipes, clear the deck, return to the lobby so
  // the host can pick a new vibe and generate a fresh deck.  The other user's
  // both-done poller detects the cleared deck_meal_ids and follows automatically.
  async function handleSharedRefreshDeck() {
    if (!sessionId) return;
    setSharedRefreshing(true);
    await supabase.from("swipes").delete().eq("session_id", sessionId);
    await supabase
      .from("sessions")
      .update({ deck_meal_ids: null, updated_at: new Date().toISOString() })
      .eq("id", sessionId);
    router.push(`/session/${sessionId}`);
  }

  function handlePass() {
    dismissHint();
    if (meal) {
      updateTasteProfile(meal, "pass");

      // ── Progressive onboarding: track avoid signals (solo only) ──────────
      if (!sessionId) {
        for (const sig of getAvoidSignals(meal)) {
          passSignalsRef.current[sig] = (passSignalsRef.current[sig] ?? 0) + 1;
        }
        const nudge = checkTriggers(
          passSignalsRef.current,
          likeSignalsRef.current,
          firedTriggersRef.current,
        );
        if (nudge) {
          firedTriggersRef.current.add(nudge.signal);
          markNudgeFired(nudge.signal);
          // Queue to display after the exit animation completes
          pendingNudgeRef.current = nudge;
        }
      }

      // Save 'no' swipe in shared mode — fire-and-forget, no match check needed
      if (sessionId && userId) {
        supabase.from("swipes").insert({
          session_id: sessionId,
          user_id: userId,
          meal_id: meal.id,
          decision: "no",
        }).then(({ error }) => {
          if (error && error.code !== "23505") { // ignore unique violation
            console.error("Failed to save pass swipe:", error);
          }
        });
      }
    }
    triggerExit("left", () => setCurrentIndex((i) => i + 1));
  }

  function handleSave() {
    if (meal) {
      saveMeal(meal);
      updateTasteProfile(meal, "save");

      // ── Progressive onboarding: track prefer signals (solo only) ─────────
      // handleSave doesn't use triggerExit so we show the nudge immediately
      // rather than queuing it through onAnimationComplete.
      if (!sessionId) {
        for (const sig of getPreferSignals(meal)) {
          likeSignalsRef.current[sig] = (likeSignalsRef.current[sig] ?? 0) + 1;
        }
        const nudge = checkTriggers(
          passSignalsRef.current,
          likeSignalsRef.current,
          firedTriggersRef.current,
        );
        if (nudge) {
          firedTriggersRef.current.add(nudge.signal);
          markNudgeFired(nudge.signal);
          setActiveNudge(nudge);
        }
      }
    }
    x.set(0);
    setCurrentIndex((i) => i + 1);
  }

  function handleChoose() {
    if (!meal || isChoosing || isExiting) return;
    dismissHint();

    // ── Shared session path ──
    if (sessionId) {
      handleSharedChoose(meal);
      return;
    }

    // ── Solo path (unchanged) ──
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

      // Show any queued nudge after the next card has settled (150 ms grace).
      if (pendingNudgeRef.current) {
        const nudge = pendingNudgeRef.current;
        pendingNudgeRef.current = null;
        setTimeout(() => setActiveNudge(nudge), 150);
      }
    }
  }

  // ── Nudge answer handler ──────────────────────────────────────────────────

  function handleNudgeAnswer(yes: boolean) {
    const nudge = activeNudge;
    setActiveNudge(null);
    // Nudges are solo-only; shared decks are fixed and can't be rebuilt here.
    if (!nudge || !yes || sessionId) return;

    const prefs = getPreferences();
    if (!prefs) return;

    if (nudge.type === "avoid") {
      // Guard against duplicate entries
      if (prefs.dislikedFoods.includes(nudge.signal)) return;
      const updatedPrefs = {
        ...prefs,
        dislikedFoods: [...prefs.dislikedFoods, nudge.signal],
      };
      savePreferences(updatedPrefs);

      // Filter the NEW hard-NO out of the remaining deck in-place so the
      // user doesn't need to restart — they just keep swiping.
      const filteredRemaining = rankedMeals
        .slice(currentIndex)
        .filter(
          (rm) => hardGate([rm.meal], updatedPrefs.dislikedFoods).length > 0,
        );
      setRankedMeals([...rankedMeals.slice(0, currentIndex), ...filteredRemaining]);
    } else {
      // prefer: add cuisine to favorites
      if (prefs.cuisines.includes(nudge.signal)) return;
      const updatedPrefs = {
        ...prefs,
        cuisines: [...prefs.cuisines, nudge.signal],
      };
      savePreferences(updatedPrefs);

      // Re-rank remaining cards with the updated cuisine preference so the
      // user sees the boost take effect immediately this session.
      const remaining = rankedMeals.slice(currentIndex).map((rm) => rm.meal);
      if (remaining.length > 0) {
        const reranked = rankMeals(
          remaining,
          updatedPrefs,
          getSavedMeals(),
          getHistory(),
          pantryMode,
          getTasteProfile(),
          getRecentlySeenIds(),
          getFlavorProfile() ?? undefined,
          getFavorites(),
          selectedIngredients,
          "solo",
          sessionShownRef.current,
          null,
          cookMode,
          sessionVibeMode,
        );
        setRankedMeals([...rankedMeals.slice(0, currentIndex), ...reranked]);
      }
    }
  }

  // ── Shared deck error screen ──────────────────────────────────────────────
  if (sessionId && sharedError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#080808] px-6 text-center text-white">
        <p className="text-lg font-semibold tracking-[-0.03em]">Deck not ready</p>
        <p className="max-w-[28ch] text-sm leading-6 text-white/50">
          The shared deck hasn&apos;t been created yet. Ask the host to go back
          and tap &ldquo;Start swiping&rdquo; again.
        </p>
        <button
          onClick={() => router.push("/")}
          className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white"
        >
          Back to home
        </button>
      </main>
    );
  }

  // ── Shared deck loading screen ────────────────────────────────────────────
  if (sessionId && sharedLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
        <div className="flex flex-col items-center gap-3">
          <span className="h-2 w-2 animate-ping rounded-full bg-white/40" />
          <p className="text-sm text-white/35">Loading shared deck…</p>
        </div>
      </main>
    );
  }

  // ── Exhausted screen ──────────────────────────────────────────────────────
  if (isExhausted) {
    // ── Shared async waiting state ─────────────────────────────────────────
    // User has swiped through all cards. Keep polling; show match modal if one arrives.
    if (sessionId) {
      return (
        <main className="min-h-screen bg-[#080808] px-5 pb-6 safe-top text-white">
          <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
            <header className="flex items-center justify-between">
              <p className="text-sm text-white/50">Decision Deck</p>
              <button
                onClick={() => router.push("/")}
                className="text-sm text-white/35 transition hover:text-white/60"
              >
                Back
              </button>
            </header>

            <div className="flex flex-1 flex-col items-center justify-center text-center">
              {bothDone ? (
                <>
                  <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs text-white/45">
                    <span className="h-1 w-1 rounded-full bg-white/30" />
                    No match
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">
                    No match this round
                  </h2>
                  <p className="mt-3 max-w-[28ch] text-sm leading-6 text-white/55">
                    Want to try a fresh deck?
                  </p>
                  <div className="mt-8 w-full">
                    <button
                      onClick={handleSharedRefreshDeck}
                      disabled={sharedRefreshing}
                      className="w-full rounded-full bg-white py-4 text-base font-semibold text-black disabled:opacity-50"
                      style={{ boxShadow: "0 0 24px rgba(255,255,255,0.12), 0 2px 8px rgba(0,0,0,0.4)" }}
                    >
                      {sharedRefreshing ? "Resetting…" : "Refresh deck"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs text-white/45">
                    <span className="h-1 w-1 rounded-full bg-white/30" />
                    Your picks are in
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">
                    Waiting for them…
                  </h2>
                  <p className="mt-3 max-w-[28ch] text-sm leading-6 text-white/55">
                    You&apos;ll see a match as soon as you both agree on something.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Match modal — polling continues in the background */}
          <AnimatePresence>
            {matchedMeal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-5 pb-10 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ y: 72, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 72, opacity: 0 }}
                  transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
                  className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#111] shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
                >
                  <div className="relative h-56">
                    <img
                      src={matchedMeal.image}
                      alt={matchedMeal.name}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(to top, rgba(17,17,17,1) 0%, rgba(17,17,17,0.4) 55%, transparent 100%)",
                      }}
                    />
                    <div className="absolute bottom-5 left-5">
                      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                        It&apos;s a match
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-[-0.04em]">
                        You both picked
                      </h2>
                      <h2 className="text-2xl font-semibold leading-tight tracking-[-0.04em]">
                        {matchedMeal.name} 🍽️
                      </h2>
                    </div>
                  </div>
                  <div className="grid gap-3 p-5">
                    <button
                      onClick={handleMatchConfirm}
                      className="w-full rounded-full bg-white py-4 text-base font-semibold text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition hover:opacity-95 active:scale-[0.99]"
                    >
                      Lock it in
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      );
    }

    // ── Solo exhausted state ───────────────────────────────────────────────
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
                </div>
                <button
                  onClick={() => router.push("/browse")}
                  className="mt-4 text-sm text-white/35 underline underline-offset-4 transition hover:text-white/60"
                >
                  Browse all meals
                </button>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-semibold tracking-[-0.04em]">
                  No match yet
                </h2>
                <p className="mt-3 max-w-[28ch] text-sm leading-6 text-white/55">
                  Want to run it back?
                </p>
                <div className="mt-8 w-full">
                  <button
                    onClick={handleRefreshDeck}
                    className="w-full rounded-full bg-white py-4 text-base font-semibold text-black"
                    style={{ boxShadow: "0 0 24px rgba(255,255,255,0.12), 0 2px 8px rgba(0,0,0,0.4)" }}
                  >
                    Refresh deck
                  </button>
                  <div className="mt-5 flex justify-center gap-3">
                    <button
                      onClick={() => router.push("/browse")}
                      className="rounded-full border border-white/[0.07] bg-white/[0.05] px-5 py-3 text-sm text-white/50"
                    >
                      Browse all
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

        {/* Ambient pantry glow — warm bloom from top edge (solo only) */}
        {!sessionId && (
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
        )}

        <header className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm text-white/50">Decision Deck</p>
            {sessionId && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2 py-0.5 text-[10px] text-emerald-400/80">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                shared
              </span>
            )}
            {topPicksMode && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/35">
                top picks
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-white/35">
              {currentIndex + 1}/{rankedMeals.length}
            </p>
            <button
              onClick={() => router.push("/")}
              className="text-sm text-white/35 transition hover:text-white/60"
            >
              {isChangeMeal && existingMeal
                ? `Keep ${existingMeal.meal.name}`
                : "Back"}
            </button>
          </div>
        </header>

        <section className="mt-8">
          <h1 className="text-4xl font-semibold tracking-[-0.05em]">
            What sounds good?
          </h1>
          <p className="mt-3 max-w-[30ch] text-sm leading-6 text-white/60">
            Swipe left to pass, right to choose, or use the buttons below.
          </p>
        </section>

        {/* Vibe selector — solo: interactive; shared: read-only (locked by host) */}
        <div className="mt-4 flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
          {(["mix-it-up", "comfort-food", "quick-easy", "healthy", "something-new", "kid-friendly"] as SessionVibeMode[]).map((mode) => {
            const label =
              mode === "mix-it-up" ? "Mix It Up" :
              mode === "comfort-food" ? "Comfort Food" :
              mode === "quick-easy" ? "Quick & Easy" :
              mode === "healthy" ? "Healthy" :
              mode === "something-new" ? "Something New" :
              "Kid Friendly";
            const isActive = sessionVibeMode === mode;
            const isReadOnly = !!sessionId;
            return (
              <button
                key={mode}
                disabled={isReadOnly}
                onClick={() => !isReadOnly && setSessionVibeMode(mode)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                  isActive
                    ? "border-white/25 bg-white/[0.12] text-white/80"
                    : isReadOnly
                    ? "border-white/[0.05] bg-transparent text-white/20 cursor-default"
                    : "border-white/[0.07] bg-transparent text-white/30 hover:border-white/15 hover:text-white/55 active:scale-[0.96]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Pantry bar — solo only */}
        {!sessionId && <motion.button
          onClick={() => {
            if (!pantryMode) togglePantry();
            setShowIngredientSheet(true);
          }}
          animate={
            pantryMode
              ? { boxShadow: "0 0 18px rgba(251,191,36,0.12)" }
              : { boxShadow: "none" }
          }
          transition={{ duration: 0.3 }}
          className={`mt-4 flex w-full items-center justify-between rounded-2xl border px-4 py-2.5 text-left transition-colors duration-200 ${
            pantryMode
              ? "border-amber-400/25 bg-amber-400/[0.06] hover:bg-amber-400/[0.1]"
              : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]"
          } active:scale-[0.99]`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`shrink-0 transition-colors duration-200 ${pantryMode ? "text-amber-300" : "text-white/25"}`}
              style={pantryMode ? { filter: "drop-shadow(0 0 4px rgba(251,191,36,0.55))" } : undefined}
            >
              {pantryMode ? <FridgeOpen /> : <FridgeClosed />}
            </span>
            <span className={`text-xs font-medium tracking-[-0.01em] transition-colors duration-200 ${pantryMode ? "text-amber-200/70" : "text-white/30"}`}>
              Pantry
            </span>
            <span className={`text-xs transition-colors duration-200 ${pantryMode ? "text-white/30" : "text-white/20"}`}>—</span>
            <span className={`text-xs transition-colors duration-200 ${pantryMode ? "text-white/50" : "text-white/25"}`}>
              {selectedIngredients.length === 0
                ? "Use what you have"
                : selectedIngredients.length <= 2
                ? selectedIngredients.join(", ")
                : `${selectedIngredients.slice(0, 2).join(", ")} +${selectedIngredients.length - 2}`}
            </span>
          </div>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={`shrink-0 transition-colors duration-200 ${pantryMode ? "text-amber-300/40" : "text-white/15"}`}>
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.button>}

        {/* ── Progress + urgency ────────────────────────────────────────── */}
        {totalCount > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs tabular-nums text-white/45">
                {decisionsMade} / {totalCount} choices
              </span>
              {sessionId && (
                <span className="inline-flex items-center gap-1 text-[10px] text-white/35">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
                  Shared session
                </span>
              )}
            </div>
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full bg-white/25 transition-[width] duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-white/40">{urgencyMessage}</p>
          </div>
        )}

        <div className="relative mt-4">
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

      {/* ── Match modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {matchedMeal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-5 pb-10 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 72, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 72, opacity: 0 }}
              transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
              className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#111] shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
            >
              {/* Meal image */}
              <div className="relative h-56">
                <img
                  src={matchedMeal.image}
                  alt={matchedMeal.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(17,17,17,1) 0%, rgba(17,17,17,0.4) 55%, transparent 100%)",
                  }}
                />
                <div className="absolute bottom-5 left-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                    It&apos;s a match
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-[-0.04em]">
                    You both picked
                  </h2>
                  <h2 className="text-2xl font-semibold leading-tight tracking-[-0.04em]">
                    {matchedMeal.name} 🍽️
                  </h2>
                </div>
              </div>

              {/* Actions */}
              <div className="grid gap-3 p-5">
                <button
                  onClick={handleMatchConfirm}
                  className="w-full rounded-full bg-white py-4 text-base font-semibold text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition hover:opacity-95 active:scale-[0.99]"
                >
                  Lock it in
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Progressive onboarding nudge ────────────────────────────────────── */}
      <ProgressiveQuestion nudge={activeNudge} onAnswer={handleNudgeAnswer} />

      {/* ── Ingredient sheet backdrop ─────────────────────────────────────── */}
      <AnimatePresence>
        {showIngredientSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowIngredientSheet(false)}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* ── Ingredient sheet ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showIngredientSheet && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-[28px] border-t border-white/[0.08] bg-[#111111] px-5 pb-10 pt-4"
          >
            {/* Drag handle */}
            <div className="mx-auto mb-5 h-1 w-8 rounded-full bg-white/15" />

            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-[-0.02em] text-white/70">
                What&apos;s in your kitchen?
              </h3>
              {selectedIngredients.length > 0 && (
                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                  {selectedIngredients.length}/5
                </span>
              )}
            </div>

            {/* Ingredient chips */}
            <div className="max-h-[52vh] space-y-4 overflow-y-auto scrollbar-hide">
              {Object.entries(PANTRY_INGREDIENTS).map(([category, items]) => (
                <div key={category}>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/25">
                    {category}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((name) => {
                      const selected = selectedIngredients.includes(name);
                      const limitReached = !selected && selectedIngredients.length >= 5;
                      return (
                        <button
                          key={name}
                          onClick={() => toggleIngredient(name)}
                          disabled={limitReached}
                          className={`rounded-full border px-3 py-1.5 text-xs transition-colors duration-150 ${
                            selected
                              ? "border-amber-400/50 bg-amber-400/[0.15] text-amber-200"
                              : limitReached
                              ? "border-white/[0.05] bg-white/[0.03] text-white/20 cursor-not-allowed"
                              : "border-white/[0.07] bg-white/[0.05] text-white/45 hover:border-white/15 hover:text-white/65 active:scale-[0.96]"
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Done */}
            <button
              onClick={() => setShowIngredientSheet(false)}
              className="mt-5 w-full rounded-full border border-white/[0.07] bg-white/[0.05] py-3 text-sm font-medium text-white/55 transition hover:bg-white/[0.09] active:scale-[0.98]"
            >
              Done
            </button>

            {/* Turn off */}
            {pantryMode && (
              <button
                onClick={() => {
                  togglePantry();
                  setShowIngredientSheet(false);
                }}
                className="mt-3 w-full py-2 text-xs text-white/25 transition hover:text-white/45"
              >
                Turn off Pantry
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
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
