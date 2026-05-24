"use client";

import { useRef, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { meals, type Meal } from "../data/meals";
import { saveMeal, addToHistory, getPreferences, savePreferences, getSavedMeals, getHistory, getTasteProfile, updateTasteProfile, getRecentlySeenIds, recordSeenSession, getFlavorProfile, getFavorites, getTodaysPick, getNoveltyBias, saveDecidedMeal, type UserPreferences, type HistoryEntry } from "../lib/storage";
import { rankMeals, hardGate, getAllHardNos, getSharedReason, getTimeBucket, type RejectionEntry, type RankedMeal, type SessionCookMode, type SessionVibeMode } from "../lib/scoring";
import { fetchAIMeals } from "../lib/ai-meals";
import { shouldGenerateAI, type AIMealTriggerReason } from "../lib/ai-freshness";
import { supabase } from "../lib/supabase";
import { getUserId } from "../lib/identity";
import { getAvoidSignals, getPreferSignals, checkTriggers, checkCrossSessionNudge, type NudgeTrigger, type NudgeCandidate } from "../lib/session-signals";
import { ProgressiveQuestion } from "../components/ProgressiveQuestion";
import { LearningToast } from "../components/LearningToast";
import { trackEvent, writeSessionCategoryPasses } from "../lib/analytics";
import { createTrackingSession, closeTrackingSession, recordDecision, checkAndMarkReturn, inferSessionContext } from "../lib/session-tracking";
import { RejectionReasonSheet, type RejectionReason } from "../components/RejectionReasonSheet";
import SoloLockOverlay from "../components/SoloLockOverlay";
import { fetchSoftAvoids, upsertSoftAvoids, syncBehavioralSignalsToSupabase, upsertPantryIngredientCounts } from "../lib/supabase-profile";
import { getPantryIngredientOrder, type PantryIngredientTiers } from "../lib/pantry";
import { type SoftAvoid } from "../lib/supabase";
import { detectRituals, getRitualLabel, isRitualSuppressed, recordRitualRejection, type RitualDetection } from "../lib/rituals";
import { SessionTerminalScreen } from "../../components/SessionTerminalScreen";

const SWIPE_THRESHOLD = 100;
const MIN_DECK_SIZE = 8;
const DECK_SIZE = 12;
const VALID_VIBE_MODES: SessionVibeMode[] = ["mix-it-up", "comfort-food", "quick-easy", "healthy", "something-new"];

const SOLO_EXHAUSTED_HEADLINES = [
  "You swiped left on everything. Bold.",
  "Nothing landed. Let's fix that.",
  "Clean sweep. The deck respects it.",
  "Picky? The app can handle picky.",
  "You've seen it all. Let's go again.",
  "The deck has been defeated.",
];

const DIAG_VIBE_OPTIONS: { value: SessionVibeMode; emoji: string; label: string; description: string }[] = [
  { value: "comfort-food", emoji: "🔥", label: "Comfort me", description: "The good stuff. Familiar, satisfying." },
  { value: "quick-easy", emoji: "⚡", label: "Keep it easy", description: "Quick, simple, no-fuss." },
  { value: "mix-it-up", emoji: "✨", label: "Surprise me", description: "Something unexpected." },
  { value: "healthy", emoji: "🥗", label: "Healthy reset", description: "Light, fresh, feels good." },
  { value: "something-new", emoji: "🎉", label: "Something new", description: "Special occasion energy." },
];

// Reset-1 headline pool (second exhaustion)
const SOLO_EXHAUSTED_HEADLINES_R1 = [
  "Still nothing? We're not giving up.",
  "Round two. Let's get this.",
  "The deck disagrees with you. Try again.",
  "You're harder to please than we expected. Respect.",
];

// Reset-2 headline pool (third exhaustion)
const SOLO_EXHAUSTED_HEADLINES_R2 = [
  "We've shown you a lot of meals.",
  "At this point we're both hungry.",
  "Three rounds. Still standing.",
  "The deck is giving everything it has.",
];

const SOLO_RESET_SS_KEY = "wwe_solo_deck_resets";
const sharedResetKey = (id: string) => `wwe_shared_deck_resets_${id}`;

const WAITING_HEADLINES = [
  "Your picks are in. Waiting on them.",
  "The ball is in their court.",
  "They're still deciding. Hang tight.",
  "Almost there. Probably.",
  "Good things take two people.",
];

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
  rejectionEntries: RejectionEntry[] = [],
  softAvoids: SoftAvoid[] = [],
): RankedMeal[] {
  const prefs = getPreferences();
  const savedMeals = getSavedMeals();
  const history = getHistory();
  const recentlySeen = getRecentlySeenIds();
  const tasteProfile = getTasteProfile();
  const flavorProfile = getFlavorProfile() ?? undefined;
  const favorites = getFavorites();
  const sessionContext = inferSessionContext(new Date());

  const eligibleMeals = hardGate(meals, getAllHardNos(prefs));
  const noveltyBias = getNoveltyBias();

  function rank(pool: Meal[]): RankedMeal[] {
    return rankMeals(pool, prefs, savedMeals, history, pantryMode, tasteProfile, recentlySeen, flavorProfile, favorites, selectedIngredients, "solo", sessionShown, null, cookMode, sessionVibeMode, rejectionEntries, softAvoids, sessionContext, noveltyBias);
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

/**
 * Merge AI-ranked meals into the static deck by inserting them at regular
 * intervals. Skips any AI meal whose ID already exists in the static deck.
 * Zone layout:
 *   Zone 1 (0–4):   static scored meals only — AI never appears here
 *   Zone 2 (5–13):  static first; AI backfills only if static deck runs short
 *   Zone 3 (14+):   static tail followed by all remaining AI meals
 *
 * Static personalized meals always lead. AI explores in the tail.
 */
function interleaveAI(staticDeck: RankedMeal[], aiDeck: RankedMeal[]): RankedMeal[] {
  const staticIds = new Set(staticDeck.map((r) => r.meal.id));
  const uniqueAI = aiDeck.filter((r) => !staticIds.has(r.meal.id));
  if (uniqueAI.length === 0) return staticDeck;

  // Zone 1 (0–4): static only
  const zone1 = staticDeck.slice(0, 5);

  // Zone 2 (5–13, up to 9 slots): static first; AI backfills if static is short
  const zone2Static = staticDeck.slice(5, 14);
  let aiConsumed = 0;
  const zone2Backfill: RankedMeal[] = [];
  if (zone2Static.length < 9) {
    const needed = 9 - zone2Static.length;
    while (aiConsumed < uniqueAI.length && zone2Backfill.length < needed) {
      zone2Backfill.push(uniqueAI[aiConsumed++]);
    }
  }
  const zone2 = [...zone2Static, ...zone2Backfill];

  // Zone 3 (14+): static tail, then all remaining AI meals
  const zone3 = [...staticDeck.slice(14), ...uniqueAI.slice(aiConsumed)];

  return [...zone1, ...zone2, ...zone3];
}

/**
 * After interleaving, guarantee AI meals are not entirely truncated when valid
 * AI meals exist.
 *
 * Rules:
 *   - Positions 0–2 are always static (trustworthy anchor).
 *   - At least 1 AI meal must appear within the first 8 cards. If none do,
 *     the highest-ranked AI meal is moved to position 3.
 *   - After slicing to deckSize, at least min(2, validAICount) AI meals must
 *     survive. If the slice would drop them, the last static meals in the deck
 *     are replaced with AI meals from the tail.
 *   - Falls back to a plain slice when validAICount === 0.
 */
function guaranteeAIInDeck(
  merged: RankedMeal[],
  validAICount: number,
  deckSize: number,
): RankedMeal[] {
  if (validAICount === 0) return merged.slice(0, deckSize);

  const AI_FIRST_SLOT = 3; // positions 0–2 are static-only
  const AI_WINDOW_END = 8; // want at least 1 AI meal within first 8 cards

  const deck = [...merged];

  // Step 1: if no AI meal appears within positions 0–(AI_WINDOW_END-1),
  // move the highest-ranked AI meal to AI_FIRST_SLOT.
  const aiInWindowIdx = deck.slice(0, AI_WINDOW_END).findIndex((r) => r.meal.aiGenerated);
  if (aiInWindowIdx === -1) {
    const firstAIIdx = deck.findIndex((r) => r.meal.aiGenerated);
    if (firstAIIdx >= AI_FIRST_SLOT) {
      const [aiEntry] = deck.splice(firstAIIdx, 1);
      deck.splice(AI_FIRST_SLOT, 0, aiEntry);
    }
  }

  // Step 2: slice, then ensure ≥ min(2, validAICount) AI meals survive.
  const targetAI = Math.min(2, validAICount);
  const final = deck.slice(0, deckSize);
  const aiInFinal = final.filter((r) => r.meal.aiGenerated).length;

  if (aiInFinal < targetAI) {
    const needed = targetAI - aiInFinal;
    const aiFromTail = deck.slice(deckSize).filter((r) => r.meal.aiGenerated).slice(0, needed);
    let toPlace = aiFromTail.length;
    // Replace the last `toPlace` static meals in the final deck.
    for (let i = final.length - 1; i >= AI_FIRST_SLOT && toPlace > 0; i--) {
      if (!final[i].meal.aiGenerated) {
        final[i] = aiFromTail[aiFromTail.length - toPlace];
        toPlace--;
      }
    }
  }

  return final;
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
  const [pantryIngredientTiers, setPantryIngredientTiers] = useState<PantryIngredientTiers>({ tier1: [], tier2: [], tier3: [] });
  const [topPicksMode, setTopPicksMode] = useState(false);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const [cookMode, setCookMode] = useState<SessionCookMode>("either");
  const vibeParam = searchParams.get("vibe");
  const [sessionVibeMode, setSessionVibeMode] = useState<SessionVibeMode>(
    (vibeParam && VALID_VIBE_MODES.includes(vibeParam as SessionVibeMode))
      ? (vibeParam as SessionVibeMode)
      : "mix-it-up"
  );
  const startAtParam = searchParams.get("startAt");
  const [isChoosing, setIsChoosing] = useState(false);
  const [soloLockMeal, setSoloLockMeal] = useState<Meal | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(
    () => typeof window !== "undefined" && !localStorage.getItem("wwe_swipe_hint_seen")
  );
  const [showSwipeTip, setShowSwipeTip] = useState(
    () => typeof window !== "undefined" && !localStorage.getItem("watcha_swipe_tip_seen")
  );
  const [showCookOrderModal, setShowCookOrderModal] = useState(false);
  // ── Solo exhausted diagnostic state ────────────────────────────────────────
  const [soloExhaustedView, setSoloExhaustedView] = useState<"main" | "top3" | "vibe-select">("main");
  const [diagSelectedVibe, setDiagSelectedVibe] = useState<SessionVibeMode>("mix-it-up");
  // Solo reset progression — synced from sessionStorage on mount
  const [soloResetCount, setSoloResetCount] = useState(0);
  // ── Shared exhausted partner picks state ───────────────────────────────────
  const [sharedExhaustedView, setSharedExhaustedView] = useState<"main" | "partner-picks">("main");
  const [partnerPicks, setPartnerPicks] = useState<Meal[]>([]);
  const [partnerPicksLoading, setPartnerPicksLoading] = useState(false);
  // Confirm-lock dialog for partner picks
  const [confirmMeal, setConfirmMeal] = useState<Meal | null>(null);
  // Shared reset progression — synced from sessionStorage on mount
  const [sharedResetCount, setSharedResetCount] = useState(0);
  // Session code shown in "Start a fresh session" info message
  const [sharedSessionCode, setSharedSessionCode] = useState<string | null>(null);
  // Track whether "Start a fresh session" was already tapped (show info message)
  const [sharedFreshTapped, setSharedFreshTapped] = useState(false);
  // Partner's user ID — set once bothDone detection resolves
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null);
  // Rotating waiting headline index (cycles every 3 s while !bothDone)
  const [waitingHeadlineIdx, setWaitingHeadlineIdx] = useState(0);
  // ── AI Fresh Ideas state ────────────────────────────────────────────────────
  const [aiMealsLoading, setAiMealsLoading] = useState(false);
  // Tracks IDs of AI-generated meals so the card can show the right label.
  // Using a Set in state (vs relying on meal.aiGenerated) makes renders stable.
  const [aiMealIds, setAiMealIds] = useState<Set<string>>(new Set());
  // Prevent duplicate AI calls for the same context key within one deck lifetime.
  // Key encodes: sorted(ingredients) | vibeMode | triggerReason
  const lastAiContextKeyRef = useRef<string | null>(null);
  // Swipe-fatigue trigger fires once per deck, not per render cycle
  const swipeFatigueFiredRef = useRef(false);
  // ── Rejection reason capture ──────────────────────────────────────────────
  // passStreakRef: consecutive passes since last acceptance or sheet trigger
  // totalPassesRef: session total, never resets
  // rejectionCaptureCountRef: how many times the sheet has shown (cap: 3)
  // rejectionReasonsRef: always-current mirror of rejectionReasons state
  // recentlyPassedCategoriesRef: last ≤3 passed meal categories (for not_feeling_it)
  const exhaustedHeadlineRef = useRef<string | null>(null);
  const passStreakRef = useRef(0);
  const totalPassesRef = useRef(0);
  const rejectionCaptureCountRef = useRef(0);
  const [rejectionReasons, setRejectionReasons] = useState<RejectionEntry[]>([]);
  const rejectionReasonsRef = useRef<RejectionEntry[]>([]);
  const recentlyPassedCategoriesRef = useRef<string[]>([]);
  const pendingRejectionSheetRef = useRef(false);
  const pendingRejectionMealRef = useRef<Meal | null>(null);
  const [showRejectionSheet, setShowRejectionSheet] = useState(false);
  // ── Shared-session state ────────────────────────────────────────────────────
  const [sharedLoading, setSharedLoading] = useState(!!sessionId);
  const [sharedError, setSharedError] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showAbandonmentBanner, setShowAbandonmentBanner] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [bothDone, setBothDone] = useState(false);
  const [bypassToExhausted, setBypassToExhausted] = useState(false);
  const [sharedRefreshing, setSharedRefreshing] = useState(false);
  const [matchedMeal, setMatchedMealState] = useState<Meal | null>(null);
  const [matchConfirmError, setMatchConfirmError] = useState<string | null>(null);
  const [matchConfirming, setMatchConfirming] = useState(false);
  // Refs so polling/async callbacks always see current values without stale closures
  const matchedMealRef = useRef<Meal | null>(null);
  const rejectedMatchIdsRef = useRef<Set<string>>(new Set());
  // True when the current user's own 'yes' swipe triggered the match,
  // meaning we still need to advance the card if they click "Pick something else"
  const matchPendingAdvanceRef = useRef(false);
  // Guard: poll-detected match writes status:"matched" once per meal; reset on reject
  const matchWrittenRef = useRef(false);
  // Guard: direct-swipe match detection writes status:"matched" once; reset on reject
  const directMatchPersistedRef = useRef(false);

  function setMatchedMeal(meal: Meal | null) {
    matchedMealRef.current = meal;
    setMatchedMealState(meal);
    if (meal && sessionId) {
      trackEvent("match_found", { mealId: meal.id, sessionId });
    }
  }

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  // Mount guard: if user already completed this shared session, skip straight to exhausted UI
  useEffect(() => {
    if (!sessionId || typeof window === 'undefined') return;
    if (localStorage.getItem(`wwe_session_swiping_done_${sessionId}`) === 'true') {
      setBypassToExhausted(true);
      setSharedLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync solo/shared reset counters from sessionStorage on mount
  useEffect(() => {
    setSoloResetCount(parseInt(sessionStorage.getItem(SOLO_RESET_SS_KEY) ?? "0", 10) || 0);
    if (sessionId) {
      setSharedResetCount(parseInt(sessionStorage.getItem(sharedResetKey(sessionId)) ?? "0", 10) || 0);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch session code when shared deck is exhausted by both users
  useEffect(() => {
    if (!bothDone || !sessionId || sharedSessionCode) return;
    // Try localStorage first (host device)
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("wwe_active_session");
        if (stored) {
          const parsed = JSON.parse(stored) as { sessionCode?: string };
          if (parsed.sessionCode) { setSharedSessionCode(parsed.sessionCode); return; }
        }
      } catch { /* ignore */ }
    }
    // Fallback: fetch from DB
    void supabase.from("sessions").select("session_code").eq("id", sessionId).single()
      .then(({ data }) => { if (data?.session_code) setSharedSessionCode(data.session_code); });
  }, [bothDone, sessionId, sharedSessionCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist a completion flag once the user finishes swiping their shared deck.
  // Only written after the deck has actually loaded (rankedMeals.length > 0) to avoid
  // false positives on mount before the deck fetch completes.
  useEffect(() => {
    if (!sessionId || typeof window === 'undefined') return;
    const deckLoaded = rankedMeals.length > 0;
    const naturallyExhausted = currentIndex >= Math.min(rankedMeals.length, DECK_SIZE);
    if ((deckLoaded && naturallyExhausted) || bypassToExhausted) {
      localStorage.setItem(`wwe_session_swiping_done_${sessionId}`, 'true');
    }
  }, [bypassToExhausted, currentIndex, rankedMeals.length, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check whether the user returned within 10 minutes of a resolved session.
  // Reads a token written to localStorage on acceptance and updates the DB row.
  useEffect(() => {
    checkAndMarkReturn();
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
        .select("deck_meal_ids, vibe")
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
      const userCuisines = getPreferences()?.cuisines ?? [];
      const userLearnedWeights = getTasteProfile();
      const ordered: RankedMeal[] = orderedMeals.map((meal) => ({
        meal,
        reason: getSharedReason(meal, userCuisines, userLearnedWeights),
        pantryMatchCount: 0,
      }));

      setRankedMeals(ordered.slice(0, DECK_SIZE));
      setSharedLoading(false);

      // Vibe fallback: if the URL param is missing or not a known vibe value,
      // read vibe from the session row so deck generation uses the host's choice.
      // Defaults to "mix-it-up" only when the DB value is also absent/invalid.
      const dbVibe = (data as { deck_meal_ids?: string[]; vibe?: string } | null)?.vibe ?? null;
      if (!vibeParam || !VALID_VIBE_MODES.includes(vibeParam as SessionVibeMode)) {
        const fallback = (dbVibe && VALID_VIBE_MODES.includes(dbVibe as SessionVibeMode))
          ? (dbVibe as SessionVibeMode)
          : "mix-it-up";
        setSessionVibeMode(fallback);
        if (process.env.NODE_ENV === "development") {
          console.log(`[ai] vibe fallback — URL param: ${vibeParam ?? "null"}, DB value: ${dbVibe ?? "null"}, using: ${fallback}`);
        }
      }

      // Start tracking session once the shared deck is ready
      if (!trackingSessionPromiseRef.current) {
        trackingOpenedAtRef.current = new Date();
        trackingSessionPromiseRef.current = createTrackingSession({
          isGroupSession: true,
          groupSessionId: sessionId ?? undefined,
        });
      }
    };

    load();
    return () => { cancelled = true; };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect when both users have finished swiping (no match yet), or if the deck was
  // cleared by a refresh — in which case follow the other user back to the session page.
  // Uses currentIndex / rankedMeals.length (state values) instead of the derived
  // `isExhausted` const to avoid a temporal-dead-zone issue with the dep array.
  useEffect(() => {
    const exhausted = bypassToExhausted || currentIndex >= Math.min(rankedMeals.length, DECK_SIZE);
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

      // Persist partner ID so other parts of the exhausted UI can query their swipes
      if (mounted) setPartnerUserId(otherUserId);

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
  }, [sessionId, userId, bypassToExhausted, currentIndex, rankedMeals.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialise the rotating headline when the solo deck is first exhausted;
  // reset it so a fresh headline is picked on the next exhaustion.
  useEffect(() => {
    const exhausted = bypassToExhausted || currentIndex >= Math.min(rankedMeals.length, DECK_SIZE);
    if (exhausted && !sessionId) {
      if (exhaustedHeadlineRef.current === null) {
        // Read current reset count from sessionStorage (state may lag one render)
        const resetCount = parseInt(sessionStorage.getItem(SOLO_RESET_SS_KEY) ?? "0", 10) || 0;
        exhaustedHeadlineRef.current = pickExhaustedHeadline(resetCount);
      }
    } else if (!exhausted) {
      exhaustedHeadlineRef.current = null;
      setSoloExhaustedView("main");
    }
  }, [bypassToExhausted, currentIndex, rankedMeals.length, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cycle the waiting headline every 3 s while the partner hasn't finished yet.
  useEffect(() => {
    if (!sessionId || bothDone) return;
    const exhausted = bypassToExhausted || currentIndex >= Math.min(rankedMeals.length, DECK_SIZE);
    if (!exhausted) return;
    const interval = setInterval(() => {
      setWaitingHeadlineIdx((i) => (i + 1) % WAITING_HEADLINES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [sessionId, bothDone, bypassToExhausted, currentIndex, rankedMeals.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for matches while inside a shared session.
  // Also checks for expiry and surfaces the abandonment banner.
  useEffect(() => {
    if (!sessionId) return;

    const poll = async () => {
      if (matchedMealRef.current) return; // Already showing match modal

      // Fetch enough fields for match detection, expiry, and abandonment checks
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("status, locked_meal_id, expires_at, updated_at, host_user_id, guest_user_id")
        .eq("id", sessionId)
        .single();

      // Expiry check — stop polling and show expired screen
      if (
        sessionData?.status === "expired" ||
        (sessionData?.expires_at && new Date(sessionData.expires_at) <= new Date())
      ) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("wwe_active_session");
          localStorage.removeItem(`wwe_session_swiping_done_${sessionId}`);
        }
        setSessionExpired(true);
        return;
      }

      // Match already confirmed by the other user
      if (sessionData?.status === "matched") {
        if (sessionData.locked_meal_id && !matchedMealRef.current) {
          router.push("/");
        }
        return;
      }

      // Abandonment banner: session has been swiping for > 2 h with no recent partner swipes
      if (sessionData && !showAbandonmentBanner && userId) {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const swipingStarted = new Date(sessionData.updated_at);
        if (swipingStarted < twoHoursAgo) {
          const otherUserId =
            userId === sessionData.host_user_id
              ? sessionData.guest_user_id
              : sessionData.host_user_id;
          if (otherUserId) {
            const { data: lastSwipe } = await supabase
              .from("swipes")
              .select("created_at")
              .eq("session_id", sessionId)
              .eq("user_id", otherUserId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            const lastSwipeAt = lastSwipe?.created_at ? new Date(lastSwipe.created_at) : null;
            if (!lastSwipeAt || lastSwipeAt < twoHoursAgo) {
              setShowAbandonmentBanner(true);
            }
          }
        }
      }

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

        const found = meals.find((m) => m.id === mealId);
        if (found) {
          // Write matched state to Supabase so the other user's Home poll can detect it.
          // Guard prevents re-writing every interval tick for the same detection event.
          if (!matchWrittenRef.current) {
            matchWrittenRef.current = true;
            const { error: writeError } = await supabase
              .from("sessions")
              .update({
                status: "matched",
                locked_meal_id: found.id,
                updated_at: new Date().toISOString(),
              })
              .eq("id", sessionId);
            if (writeError) {
              console.error("[match] polling path failed to update session:", writeError.message);
            } else {
              console.log("[match] polling path wrote matched state:", found.id);
            }
          }
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

  // ── Session tracking refs ────────────────────────────────────────────────────
  // Promise storing the user_sessions row ID created at deck mount.
  // Stored as a Promise so the DB insert runs in parallel with deck rendering.
  const trackingSessionPromiseRef = useRef<Promise<string | null> | null>(null);
  // Wall-clock time the deck opened — used to compute time_to_decision_seconds.
  const trackingOpenedAtRef = useRef<Date | null>(null);
  // Running count of left/right swipes; written to DB when the session closes.
  const trackingSwipeCountRef = useRef(0);
  // Guard — prevents the unmount cleanup from closing a session that was already
  // closed by an acceptance path.
  const trackingClosedRef = useRef(false);

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
  // Cross-session nudge candidates: loaded on mount from analytics_events.
  const nudgeCandidatesRef = useRef<NudgeCandidate[]>([]);
  // Deduplication: if the rejection sheet fired this session, suppress the nudge.
  const rejectionSheetFiredRef = useRef(false);
  // Soft avoids: persisted score penalties loaded from Supabase on mount.
  const softAvoidsRef = useRef<SoftAvoid[]>([]);
  const [softAvoids, setSoftAvoids] = useState<SoftAvoid[]>([]);
  // Nudge queued during a swipe exit — shown after the animation completes.
  const pendingNudgeRef = useRef<NudgeTrigger | null>(null);
  const [activeNudge, setActiveNudge] = useState<NudgeTrigger | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ── Ritual detection refs ─────────────────────────────────────────────────
  // Stores the ritual result once detectRituals() completes (async on mount).
  const ritualDetectionRef = useRef<RitualDetection | null>(null);
  // Tracks whether position 0 in the current deck is a proactively surfaced ritual.
  // Used to record rejections correctly in handlePass.
  const isRitualPosition0Ref = useRef(false);
  // Mirror of currentIndex as a ref so async ritual callbacks can read it without
  // stale closure issues.
  const currentIndexRef = useRef(0);

  // Track the last meal id we fired card_seen for so we don't double-fire.
  const lastSeenMealIdRef = useRef<string | null>(null);

  // Pantry analytics: tracks whether a meal was accepted during a pantry session
  // so the cleanup effect can distinguish acceptance vs. abandon.
  const pantryMealAcceptedRef = useRef(false);
  // Refs that mirror pantry state so the unmount cleanup effect can read
  // current values without a stale closure (effects with [] deps capture at mount).
  const pantryModeRef = useRef(pantryMode);
  const selectedIngredientsRef = useRef(selectedIngredients);

  // Keep currentIndexRef in sync so async callbacks (ritual injection) read a
  // current value instead of the stale closure captured at effect creation.
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    if (isChangeMeal) setExistingMeal(getTodaysPick());
  }, [isChangeMeal]);

  // Fire card_seen whenever a new card becomes the active one.
  useEffect(() => {
    const mealId = rankedMeals[currentIndex]?.meal?.id;
    if (!mealId || mealId === lastSeenMealIdRef.current) return;
    lastSeenMealIdRef.current = mealId;
    trackEvent("card_seen", {
      mealId,
      swipeIndex: currentIndex,
      deckSize: Math.min(rankedMeals.length, DECK_SIZE),
      mode: sessionId ? "shared" : "solo",
      ...(sessionId ? { sessionId } : {}),
    });
  }, [currentIndex, rankedMeals, sessionId]);

  // Load soft avoids from Supabase on mount and clean up any expired entries.
  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;
    fetchSoftAvoids(userId).then((avoids) => {
      const now = new Date().toISOString();
      const active = avoids.filter((sa) => sa.expiresAt > now);
      softAvoidsRef.current = active;
      setSoftAvoids(active);
      if (active.length < avoids.length) {
        // Some expired — persist the cleaned array
        void upsertSoftAvoids(userId, active);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ritual detection (async, non-blocking, solo only) ─────────────────────
  //
  // Runs once on mount. If a qualifying ritual is found for the current context,
  // it is injected at position 0 of the deck — but only if the user hasn't
  // started swiping yet (currentIndex === 0).
  //
  // Application threshold: confidence >= 0.6 AND daysSinceLastServed >= 5.
  // Hard gate safety: the ritual meal is re-checked against current hard NOs
  // before placement. Preferences can change; rituals must never violate them.
  useEffect(() => {
    if (sessionId) return; // shared mode: skip
    const userId = getUserId();
    if (!userId) return;

    detectRituals(userId).then((rituals) => {
      const ctx = inferSessionContext(new Date());
      const contextKey = `${ctx.dayType}-${ctx.mealPeriod}`;

      const matching = rituals.find(
        (r) =>
          r.context === contextKey &&
          r.confidence >= 0.6 &&
          r.daysSinceLastServed >= 5 &&
          !isRitualSuppressed(r.context, r.mealId),
      );

      if (!matching) return;

      // Hard gate safety: re-check current restrictions before surfacing
      const currentPrefs = getPreferences();
      const ritualMealObj = meals.find((m) => m.id === matching.mealId);
      if (!ritualMealObj) return;
      const gated = hardGate([ritualMealObj], getAllHardNos(currentPrefs));
      if (gated.length === 0) {
        if (process.env.NODE_ENV === "development") {
          console.log(`[rituals] skipped ${matching.mealId} — fails current hard gate`);
        }
        return;
      }

      // Store the active ritual so handlePass can record rejections
      ritualDetectionRef.current = matching;

      // Inject at position 0 only if the user hasn't started swiping yet.
      // setRankedMeals functional update safely reads the current deck state.
      if (currentIndexRef.current > 0) return;

      const label = getRitualLabel(matching.context);
      const ritualEntry: RankedMeal = { meal: ritualMealObj, reason: label, pantryMatchCount: 0 };

      setRankedMeals((prev) => {
        if (prev.length === 0) return prev; // deck not built yet — no-op
        // Remove the ritual meal from wherever it sits in the scored deck
        const without = prev.filter((r) => r.meal.id !== matching.mealId);
        isRitualPosition0Ref.current = true;
        return [ritualEntry, ...without].slice(0, DECK_SIZE);
      });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load cross-session nudge candidates on mount.
  // Queries analytics_events for session_category_passes in the last 30 days,
  // aggregates by signal (client-side), and keeps signals that appeared in
  // 3+ distinct sessions.
  useEffect(() => {
    const userId = getUserId();
    if (!userId || sessionId) return; // nudge is solo-only
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("analytics_events")
      .select("properties")
      .eq("user_id", userId)
      .eq("event_name", "session_category_passes")
      .gte("created_at", since)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        // Count distinct session IDs per category
        const sessionsByCategory: Record<string, Set<string>> = {};
        for (const row of data) {
          const props = row.properties as {
            categories?: string[];
            sessionId?: string;
          };
          const cats = props?.categories ?? [];
          const sid = props?.sessionId ?? `__no_session_${Math.random()}`;
          for (const cat of cats) {
            if (!sessionsByCategory[cat]) sessionsByCategory[cat] = new Set();
            sessionsByCategory[cat].add(sid);
          }
        }
        const candidates: NudgeCandidate[] = Object.entries(sessionsByCategory)
          .filter(([, sessions]) => sessions.size >= 3)
          .map(([signal, sessions]) => ({ signal, crossSessionCount: sessions.size }));
        nudgeCandidatesRef.current = candidates;
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Builds the solo deck on mount and whenever pantry/ingredients/session
  // selectors change. Shared decks are loaded in their own effect and never
  // re-ranked from local state.
  useEffect(() => {
    if (sessionId) return;

    // Hand-off from the recommend screen: use the pre-composed deck so meals
    // the user already saw (positions 0 and 1) are not shown again.
    if (typeof window !== "undefined") {
      const raw = sessionStorage.getItem("wwe_recommend_deck");
      if (raw) {
        sessionStorage.removeItem("wwe_recommend_deck");
        const ids: string[] = JSON.parse(raw);
        const mealMap = new Map(meals.map((m) => [m.id, m]));
        const ordered: RankedMeal[] = ids.flatMap((id) => {
          const m = mealMap.get(id);
          return m ? [{ meal: m, reason: "", pantryMatchCount: 0 }] : [];
        });
        setRankedMeals(ordered.slice(0, DECK_SIZE));
        setCurrentIndex(parseInt(startAtParam ?? "0") || 0);
        x.set(0);
        setExitX(null);
        if (!trackingSessionPromiseRef.current) {
          trackingOpenedAtRef.current = new Date();
          trackingSessionPromiseRef.current = createTrackingSession({ isGroupSession: false });
        }
        return;
      }
    }

    for (let i = 0; i <= currentIndex && i < rankedMeals.length; i++) {
      const id = rankedMeals[i]?.meal?.id;
      if (id) sessionShownRef.current.add(id);
    }
    const ranked = buildDeck(pantryMode, selectedIngredients, sessionShownRef.current, cookMode, sessionVibeMode, rejectionReasonsRef.current, softAvoidsRef.current);
    if (!deckRecordedRef.current) {
      recordSeenSession(ranked.slice(0, DECK_SIZE).map((r) => r.meal.id));
      deckRecordedRef.current = true;
    }

    // ── Ritual injection ─────────────────────────────────────────────────────
    // If detectRituals() has already resolved and stored a result, inject the
    // ritual meal at position 0 now (before setRankedMeals). Hard gate re-check
    // already ran inside the detection effect; we just apply the result here.
    // Reset the position-0 flag each deck rebuild since deck order changes.
    isRitualPosition0Ref.current = false;
    const pendingRitual = ritualDetectionRef.current;
    let deckToSet = ranked.slice(0, DECK_SIZE);
    if (pendingRitual) {
      const ritualMealObj = meals.find((m) => m.id === pendingRitual.mealId);
      if (ritualMealObj) {
        const label = getRitualLabel(pendingRitual.context);
        const without = deckToSet.filter((r) => r.meal.id !== pendingRitual.mealId);
        deckToSet = [{ meal: ritualMealObj, reason: label, pantryMatchCount: 0 }, ...without].slice(0, DECK_SIZE);
        isRitualPosition0Ref.current = true;
      }
    }

    setRankedMeals(deckToSet);
    setCurrentIndex(0);
    x.set(0);
    setExitX(null);

    // Start tracking session on first deck build (guard prevents re-fire on
    // pantry/vibe changes which also run this effect)
    if (!trackingSessionPromiseRef.current) {
      trackingOpenedAtRef.current = new Date();
      trackingSessionPromiseRef.current = createTrackingSession({ isGroupSession: false });
    }

    // ── Deterministic AI freshness trigger ──────────────────────────────────
    // shouldGenerateAI() inspects the static deck quality and returns whether
    // AI enrichment is warranted and why. Each unique (ingredients, vibe, reason)
    // combination can fire at most once per session to prevent duplicate calls.
    swipeFatigueFiredRef.current = false; // reset fatigue guard on each deck rebuild

    const pantryActive = pantryMode && selectedIngredients.length > 0;
    const recentlySeenIds = getRecentlySeenIds();
    const { shouldGenerate, reason } = shouldGenerateAI({
      deck: ranked,
      pantryActive,
      recentlySeenIds,
      deckSize: DECK_SIZE,
    });

    if (!shouldGenerate) {
      if (process.env.NODE_ENV === "development") {
        console.log("[AI Freshness] skipped: strong_static_deck");
      }
      lastAiContextKeyRef.current = null; // reset so future context shifts can re-evaluate
    } else {
      // Build a stable context key: same (ingredients, vibe, reason) → same key → no duplicate call
      const contextKey = [
        ...[...selectedIngredients].sort(),
        sessionVibeMode,
        reason as AIMealTriggerReason,
      ].join("|");

      if (contextKey === lastAiContextKeyRef.current) {
        if (process.env.NODE_ENV === "development") {
          console.log("[AI Freshness] skipped: cache_hit");
        }
      } else {
        lastAiContextKeyRef.current = contextKey;
        if (process.env.NODE_ENV === "development") {
          console.log(`[AI Freshness] triggered: ${reason}`);
        }
        void enrichDeckWithAI(ranked.slice(0, DECK_SIZE), selectedIngredients);
      }
    }
  }, [pantryMode, selectedIngredients, cookMode, sessionVibeMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire deck_finished once when the user exhausts all cards.
  const deckFinishedFiredRef = useRef(false);
  useEffect(() => {
    const total = Math.min(rankedMeals.length, DECK_SIZE);
    const exhausted = total > 0 && currentIndex >= total;
    if (!exhausted || deckFinishedFiredRef.current) return;
    deckFinishedFiredRef.current = true;
    trackEvent("deck_finished", {
      deckSize: total,
      mode: sessionId ? "shared" : "solo",
      ...(sessionId ? { sessionId } : {}),
    });
  }, [currentIndex, rankedMeals.length, sessionId]);

  // Close the tracking session when the user navigates away without choosing.
  // The trackingClosedRef guard prevents double-fire when acceptance already
  // closed the session before the component unmounts.
  // Also writes session_category_passes so the next session can build nudge candidates.
  useEffect(() => {
    return () => {
      if (trackingClosedRef.current) return;
      trackingClosedRef.current = true;
      const userId = getUserId();
      const ctx = inferSessionContext(new Date());
      trackingSessionPromiseRef.current?.then((tsId) => {
        if (!tsId || !trackingOpenedAtRef.current) return;
        void closeTrackingSession({
          trackingSessionId: tsId,
          resolved: false,
          swipeCount: trackingSwipeCountRef.current,
          openedAt: trackingOpenedAtRef.current,
        });
        if (userId && Object.keys(passSignalsRef.current).length > 0) {
          writeSessionCategoryPasses(userId, passSignalsRef.current, {
            trackingSessionId: tsId,
            mealPeriod: ctx.mealPeriod,
            dayType: ctx.dayType,
          });
        }
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep pantry refs in sync with state so the unmount cleanup reads current values.
  useEffect(() => { pantryModeRef.current = pantryMode; }, [pantryMode]);
  useEffect(() => { selectedIngredientsRef.current = selectedIngredients; }, [selectedIngredients]);

  // Load ingredient frequency tiers when pantry activates so the sheet can
  // reorder chips by how often each ingredient has been selected historically.
  useEffect(() => {
    if (!pantryMode) return;
    const uid = getUserId();
    if (!uid) return;
    const allIngredients = Object.values(PANTRY_INGREDIENTS).flat();
    getPantryIngredientOrder(uid, allIngredients).then(setPantryIngredientTiers);
  }, [pantryMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pantry session analytics: fires when the component unmounts without an acceptance.
  // Covers navigate-away, back button, and session close with pantry active.
  useEffect(() => {
    return () => {
      if (
        pantryModeRef.current &&
        selectedIngredientsRef.current.length > 0 &&
        !pantryMealAcceptedRef.current
      ) {
        const ctx = inferSessionContext(new Date());
        trackEvent("pantry_ingredients_selected", {
          ingredients: selectedIngredientsRef.current,
          meal_period: ctx.mealPeriod,
          day_type: ctx.dayType,
          resulted_in_acceptance: false,
          match_count_of_accepted_meal: null,
        });
        const uid = getUserId();
        if (uid) void upsertPantryIngredientCounts(uid, selectedIngredientsRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Best-effort close on browser/tab close (beforeunload fires but the browser
  // may kill async work before the fetch completes).
  useEffect(() => {
    function onBeforeUnload() {
      if (trackingClosedRef.current) return;
      trackingClosedRef.current = true;
      const userId = getUserId();
      const ctx = inferSessionContext(new Date());
      trackingSessionPromiseRef.current?.then((tsId) => {
        if (!tsId || !trackingOpenedAtRef.current) return;
        void closeTrackingSession({
          trackingSessionId: tsId,
          resolved: false,
          swipeCount: trackingSwipeCountRef.current,
          openedAt: trackingOpenedAtRef.current,
        });
        if (userId && Object.keys(passSignalsRef.current).length > 0) {
          writeSessionCategoryPasses(userId, passSignalsRef.current, {
            trackingSessionId: tsId,
            mealPeriod: ctx.mealPeriod,
            dayType: ctx.dayType,
          });
        }
      });
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function dismissHint() {
    if (!showSwipeHint) return;
    localStorage.setItem("wwe_swipe_hint_seen", "1");
    setShowSwipeHint(false);
  }

  function dismissSwipeTip() {
    localStorage.setItem("watcha_swipe_tip_seen", "true");
    setShowSwipeTip(false);
  }

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const passOpacity = useTransform(x, [-SWIPE_THRESHOLD, -30], [1, 0]);
  const chooseOpacity = useTransform(x, [30, SWIPE_THRESHOLD], [0, 1]);

  const current = rankedMeals[currentIndex];
  const meal = current?.meal;
  const reason = current?.reason ?? "";
  const pantryMatchCount = current?.pantryMatchCount ?? 0;
  const nextMeal = rankedMeals[currentIndex + 1]?.meal;
  const isExiting = exitX !== null;

  const totalCount = Math.min(rankedMeals.length, DECK_SIZE);
  const isExhausted = bypassToExhausted || currentIndex >= totalCount;
  const decisionsMade = currentIndex;
  const progressPct = totalCount > 0 ? Math.min(100, (decisionsMade / totalCount) * 100) : 0;
  const urgencyMessage = (() => {
    if (decisionsMade >= 10) return "Almost there";
    if (decisionsMade >= 6)  return "Getting closer";
    if (decisionsMade >= 3)  return "Finding your pick";
    return "Just getting started";
  })();

  function handleTopPicks() {
    // In shared mode the deck is fixed — top picks = top 35% of the current order.
    // In solo mode rebuild from scratch so scoring is fresh.
    const source = sessionId
      ? rankedMeals
      : buildDeck(pantryMode, selectedIngredients, sessionShownRef.current, cookMode, sessionVibeMode, rejectionReasonsRef.current, softAvoidsRef.current);
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
    // Write completion flag immediately when user initiates their final swipe
    if (sessionId && typeof window !== 'undefined' && currentIndex >= Math.min(rankedMeals.length, DECK_SIZE) - 1) {
      localStorage.setItem(`wwe_session_swiping_done_${sessionId}`, 'true')
    }
    trackEvent("card_swiped_yes", {
      mealId: chosenMeal.id,
      swipeIndex: currentIndex,
      deckSize: totalCount,
      mode: "shared",
      sessionId,
    });
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

      // Immediately write matched state so the other user's Home polling can
      // detect it without waiting for a button tap.
      if (!directMatchPersistedRef.current && sessionId && chosenMeal.id) {
        directMatchPersistedRef.current = true;
        const { error: directWriteError } = await supabase
          .from("sessions")
          .update({
            status: "matched",
            locked_meal_id: chosenMeal.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId);
        if (directWriteError) {
          console.error("[match] failed to write on direct detection:", directWriteError.message);
          directMatchPersistedRef.current = false;
        } else {
          console.log("[match] wrote matched state on direct detection:", chosenMeal.id);
        }
      }

      return;
    }

    // No match — advance to next card
    triggerExit("right", () => setCurrentIndex((i) => i + 1));
  }

  async function handleMatchConfirm() {
    if (!matchedMeal || !sessionId) return;
    setMatchConfirming(true);
    setMatchConfirmError(null);
    trackEvent("match_confirmed", { mealId: matchedMeal.id, sessionId });

    const { error } = await supabase
      .from("sessions")
      .update({
        status: "matched",
        locked_meal_id: matchedMeal.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (error) {
      console.error("[match] failed to update session:", error.message);
      setMatchConfirmError("We found the match, but couldn't lock it in. Try again.");
      setMatchConfirming(false);
      return;
    }

    console.log("[match] session marked matched:", sessionId, matchedMeal.id);

    // Record acceptance — fire-and-forget
    trackingClosedRef.current = true;
    trackingSessionPromiseRef.current?.then((tsId) => {
      if (tsId && trackingOpenedAtRef.current) {
        void recordDecision({
          trackingSessionId: tsId,
          meal: matchedMeal,
          outcome: "accepted",
          positionInDeck: currentIndex,
          isAiGenerated: aiMealIds.has(matchedMeal.id),
        });
        void closeTrackingSession({
          trackingSessionId: tsId,
          resolved: true,
          swipeCount: trackingSwipeCountRef.current,
          openedAt: trackingOpenedAtRef.current,
        });
      }
    });

    addToHistory(matchedMeal);
    saveDecidedMeal({ ...matchedMeal, decidedAt: new Date().toISOString(), mode: "shared", sessionId: sessionId ?? undefined });
    if (typeof window !== "undefined") {
      localStorage.removeItem("wwe_active_session");
      localStorage.removeItem(`wwe_session_swiping_done_${sessionId}`);
    }
    router.push("/");
  }

  function handleMatchReject() {
    if (!matchedMeal) return;
    trackEvent("match_started_over", { mealId: matchedMeal.id, sessionId });
    rejectedMatchIdsRef.current.add(matchedMeal.id);
    matchWrittenRef.current = false; // allow next poll-detected match to write
    directMatchPersistedRef.current = false; // allow next direct-swipe match to write
    const shouldAdvance = matchPendingAdvanceRef.current;
    matchPendingAdvanceRef.current = false;
    setMatchedMeal(null);
    // Only advance if the current user's own swipe triggered this match
    // (i.e. they haven't moved to the next card yet)
    if (shouldAdvance) {
      triggerExit("right", () => setCurrentIndex((i) => i + 1));
    }
  }

  // ── AI Fresh Ideas ───────────────────────────────────────────────────────────
  //
  // Fetches AI-generated meals and merges them into the deck.
  // Called explicitly via the "Fresh ideas" button, or automatically when
  // pantry mode is active and the ingredient context key has changed.
  // Always falls back silently — the static deck is never disrupted on error.

  async function enrichDeckWithAI(
    baseStaticDeck: RankedMeal[],
    activePantryIngredients: string[],
  ): Promise<void> {
    if (aiMealsLoading) return;
    setAiMealsLoading(true);
    try {
      const prefs = getPreferences();
      const timeBucket = getTimeBucket();
      const history = getHistory();
      const recentNames = history.slice(0, 10).map((h) => h.meal.name);

      const aiRaw = await fetchAIMeals({
        preferences: {
          cuisines: prefs?.cuisines ?? [],
          hardNos: getAllHardNos(prefs),
          spiceLevel: prefs?.spiceLevel ?? "any",
          cookOrOrder: prefs?.cookOrOrder ?? "either",
        },
        partnerPreferences: null,
        pantryIngredients: activePantryIngredients,
        timeBucket,
        cookMode,
        vibeMode: sessionVibeMode,
        recentlySeenNames: recentNames,
        count: 10,
      });

      if (aiRaw.length === 0) return; // Nothing came back — silent fallback

      // ── Double hardGate: server already filtered, client confirms ──────────
      const gated = hardGate(aiRaw, getAllHardNos(prefs));
      if (process.env.NODE_ENV === "development" && gated.length < aiRaw.length) {
        console.log(`[ai] filtered by hardgate — before: ${aiRaw.length}, after: ${gated.length} (${aiRaw.length - gated.length} dropped)`);
      }
      if (gated.length === 0) return;

      // Track IDs for the "Fresh idea" / "Made from your pantry" label
      setAiMealIds((prev) => {
        const next = new Set(prev);
        gated.forEach((m) => next.add(m.id));
        return next;
      });

      // ── Rank AI meals through the existing scoring pipeline ────────────────
      const savedMeals = getSavedMeals();
      const historyEntries = getHistory();
      const recentlySeen = getRecentlySeenIds();
      const tasteProfile = getTasteProfile();
      const flavorProfile = getFlavorProfile() ?? undefined;
      const favorites = getFavorites();

      const rankedAI = rankMeals(
        gated,
        prefs,
        savedMeals,
        historyEntries,
        pantryMode,
        tasteProfile,
        recentlySeen,
        flavorProfile,
        favorites,
        activePantryIngredients,
        "solo",
        sessionShownRef.current,
        null,
        cookMode,
        sessionVibeMode,
        rejectionReasonsRef.current,
        softAvoidsRef.current,
        inferSessionContext(new Date()),
      );

      // ── Interleave AI meals into the static deck ───────────────────────────
      const merged = interleaveAI(baseStaticDeck, rankedAI);

      if (process.env.NODE_ENV === "development") {
        const wouldDrop = merged.filter((r) => r.meal.aiGenerated).length -
          merged.slice(0, DECK_SIZE).filter((r) => r.meal.aiGenerated).length;
        if (wouldDrop > 0) {
          console.log(`[ai] dropped by truncation — ${wouldDrop} meals would have been dropped (applying guarantee)`);
        }
      }

      const finalDeck = guaranteeAIInDeck(merged, rankedAI.length, DECK_SIZE);

      if (process.env.NODE_ENV === "development") {
        const aiInFinal = finalDeck.filter((r) => r.meal.aiGenerated);
        const firstAIIdx = finalDeck.findIndex((r) => r.meal.aiGenerated);
        console.log(`[ai] inserted into deck — count: ${aiInFinal.length}, first index: ${firstAIIdx}`);
      }

      setRankedMeals(finalDeck);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[ai-meals] enrichDeckWithAI failed — using static deck:", err);
      }
      // Static deck is already set — no-op on error
    } finally {
      setAiMealsLoading(false);
    }
  }

  /**
   * Swipe-fatigue AI injection — surgically inserts AI meals into the
   * REMAINING (not-yet-seen) cards without resetting currentIndex.
   * Only called once per deck lifetime (swipeFatigueFiredRef guards this).
   */
  async function injectAIForSwipeFatigue(): Promise<void> {
    if (aiMealsLoading || sessionId || swipeFatigueFiredRef.current) return;
    swipeFatigueFiredRef.current = true;

    const capturedIndex = currentIndex; // snapshot so async completion uses build-time index

    if (process.env.NODE_ENV === "development") {
      console.log(`[AI Freshness] triggered: swipe_fatigue (at card ${capturedIndex})`);
    }

    setAiMealsLoading(true);
    try {
      const prefs = getPreferences();
      const timeBucket = getTimeBucket();
      const history = getHistory();
      const recentNames = history.slice(0, 10).map((h) => h.meal.name);

      const aiRaw = await fetchAIMeals({
        preferences: {
          cuisines: prefs?.cuisines ?? [],
          hardNos: getAllHardNos(prefs),
          spiceLevel: prefs?.spiceLevel ?? "any",
          cookOrOrder: prefs?.cookOrOrder ?? "either",
        },
        partnerPreferences: null,
        pantryIngredients: selectedIngredients,
        timeBucket,
        cookMode,
        vibeMode: sessionVibeMode,
        recentlySeenNames: recentNames,
        count: 8,
      });

      if (aiRaw.length === 0) return;

      const gated = hardGate(aiRaw, getAllHardNos(prefs));
      if (gated.length === 0) return;

      setAiMealIds((prev) => {
        const next = new Set(prev);
        gated.forEach((m) => next.add(m.id));
        return next;
      });

      const savedMeals = getSavedMeals();
      const historyEntries = getHistory();
      const recentlySeen = getRecentlySeenIds();
      const tasteProfile = getTasteProfile();
      const flavorProfile = getFlavorProfile() ?? undefined;
      const favorites = getFavorites();

      const rankedAI = rankMeals(
        gated,
        prefs,
        savedMeals,
        historyEntries,
        pantryMode,
        tasteProfile,
        recentlySeen,
        flavorProfile,
        favorites,
        selectedIngredients,
        "solo",
        sessionShownRef.current,
        null,
        cookMode,
        sessionVibeMode,
        rejectionReasonsRef.current,
        softAvoidsRef.current,
        inferSessionContext(new Date()),
      );

      // Splice AI meals into the remaining (unseen) portion of the deck only.
      // Cards already swiped (< capturedIndex) are left untouched.
      setRankedMeals((prev) => {
        const swiped = prev.slice(0, capturedIndex);
        const remaining = prev.slice(capturedIndex);
        const enrichedRemaining = interleaveAI(remaining, rankedAI);
        return [...swiped, ...enrichedRemaining].slice(0, DECK_SIZE + rankedAI.length);
      });
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[ai-meals] swipe_fatigue injection failed — continuing with static deck:", err);
      }
    } finally {
      setAiMealsLoading(false);
    }
  }

  // Swipe-fatigue trigger: fires once when the user reaches card 12 with no
  // match yet. Solo mode only — shared decks are fixed at build time.
  useEffect(() => {
    if (sessionId) return;                        // shared mode: skip
    if (currentIndex < 12) return;                // threshold not yet reached
    if (swipeFatigueFiredRef.current) return;     // already fired this deck
    if (aiMealsLoading) return;                   // AI already in flight
    void injectAIForSwipeFatigue();
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * "Fresh Ideas" button handler — explicit user-triggered AI enrichment.
   * Rebuilds the static deck first to get a clean base, then enriches with AI.
   */
  async function handleFreshIdeas(): Promise<void> {
    if (aiMealsLoading || sessionId) return;
    trackEvent("fresh_ideas_tapped", { pantryMode, ingredientCount: selectedIngredients.length, vibeMode: sessionVibeMode });
    deckFinishedFiredRef.current = false;
    swipeFatigueFiredRef.current = false;
    sessionShownRef.current = new Set();
    deckRecordedRef.current = false;
    lastAiContextKeyRef.current = null; // allow re-trigger after explicit Fresh Ideas
    const staticDeck = buildDeck(pantryMode, selectedIngredients, sessionShownRef.current, cookMode, sessionVibeMode, rejectionReasonsRef.current, softAvoidsRef.current);
    recordSeenSession(staticDeck.slice(0, DECK_SIZE).map((r) => r.meal.id));
    deckRecordedRef.current = true;
    setRankedMeals(staticDeck.slice(0, DECK_SIZE));
    setCurrentIndex(0);
    x.set(0);
    setExitX(null);
    await enrichDeckWithAI(staticDeck.slice(0, DECK_SIZE), selectedIngredients);
  }

  // ────────────────────────────────────────────────────────────────────────────

  function handleRefreshDeck() {
    trackEvent("deck_refreshed", { mode: "solo" });
    deckFinishedFiredRef.current = false;
    swipeFatigueFiredRef.current = false;
    lastAiContextKeyRef.current = null; // allow freshness re-evaluation on next deck
    sessionShownRef.current = new Set();
    deckRecordedRef.current = false;
    const ranked = buildDeck(pantryMode, selectedIngredients, sessionShownRef.current, cookMode, sessionVibeMode, rejectionReasonsRef.current, softAvoidsRef.current);
    recordSeenSession(ranked.slice(0, DECK_SIZE).map((r) => r.meal.id));
    deckRecordedRef.current = true;
    setRankedMeals(ranked.slice(0, DECK_SIZE));
    setCurrentIndex(0);
    x.set(0);
    setExitX(null);
  }

  function pickExhaustedHeadline(resetCount: number): string {
    // Reset 1 and 2 pools: simple random, no persistence needed
    if (resetCount === 1) {
      return SOLO_EXHAUSTED_HEADLINES_R1[Math.floor(Math.random() * SOLO_EXHAUSTED_HEADLINES_R1.length)];
    }
    if (resetCount >= 2) {
      return SOLO_EXHAUSTED_HEADLINES_R2[Math.floor(Math.random() * SOLO_EXHAUSTED_HEADLINES_R2.length)];
    }
    // Reset 0: localStorage-tracked rotation across the original pool
    if (typeof window === "undefined") return SOLO_EXHAUSTED_HEADLINES[0];
    const seenKey = "wwe_exhausted_headlines_seen";
    const seen: number[] = JSON.parse(localStorage.getItem(seenKey) ?? "[]");
    const all = SOLO_EXHAUSTED_HEADLINES.map((_, i) => i);
    const available = all.filter((i) => !seen.includes(i));
    const pool = available.length > 0 ? available : all;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const newSeen = available.length > 0 ? [...seen, picked] : [picked];
    localStorage.setItem(seenKey, JSON.stringify(newSeen));
    return SOLO_EXHAUSTED_HEADLINES[picked];
  }

  function handleRefreshDeckWithVibe(vibe: SessionVibeMode) {
    // Increment solo reset counter in sessionStorage and state
    const nextCount = (parseInt(sessionStorage.getItem(SOLO_RESET_SS_KEY) ?? "0", 10) || 0) + 1;
    sessionStorage.setItem(SOLO_RESET_SS_KEY, String(nextCount));
    setSoloResetCount(nextCount);
    setSessionVibeMode(vibe);
    setSoloExhaustedView("main");
    trackEvent("deck_refreshed", { mode: "solo", vibe });
    deckFinishedFiredRef.current = false;
    swipeFatigueFiredRef.current = false;
    lastAiContextKeyRef.current = null;
    sessionShownRef.current = new Set();
    deckRecordedRef.current = false;
    const ranked = buildDeck(pantryMode, selectedIngredients, sessionShownRef.current, cookMode, vibe, rejectionReasonsRef.current, softAvoidsRef.current);
    recordSeenSession(ranked.slice(0, DECK_SIZE).map((r) => r.meal.id));
    deckRecordedRef.current = true;
    setRankedMeals(ranked.slice(0, DECK_SIZE));
    setCurrentIndex(0);
    x.set(0);
    setExitX(null);
  }

  async function handleLoadPartnerPicks() {
    if (!sessionId) return;
    // Resolve partner ID: prefer state (set during bothDone polling),
    // fallback to a fresh session query if it hasn't populated yet.
    let partnerId = partnerUserId;
    if (!partnerId) {
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("host_user_id, guest_user_id")
        .eq("id", sessionId)
        .single();
      if (!sessionData) return;
      partnerId =
        userId === sessionData.host_user_id
          ? sessionData.guest_user_id
          : sessionData.host_user_id;
      if (partnerId) setPartnerUserId(partnerId);
    }
    if (!partnerId) return;

    setPartnerPicksLoading(true);
    // Fetch only the partner's yes-swipes for this session
    const { data: swipeData } = await supabase
      .from("swipes")
      .select("meal_id")
      .eq("session_id", sessionId)
      .eq("user_id", partnerId)
      .eq("decision", "yes");

    if (!swipeData) { setPartnerPicksLoading(false); return; }

    // Dedupe raw swipe rows by meal_id before building the ID set
    const uniqueSwipeRows = swipeData.filter(
      (row, idx, self) => idx === self.findIndex((r) => r.meal_id === row.meal_id)
    );
    const partnerYesIds = new Set(uniqueSwipeRows.map((s) => s.meal_id as string));
    // Hydrate from static meals data, then dedupe by meal.id in case the static
    // meals array contains duplicate entries for the same ID.
    const picked = meals
      .filter((m) => partnerYesIds.has(m.id))
      .filter((meal, idx, self) => idx === self.findIndex((m) => m.id === meal.id));
    // Sort by ranked position in current deck, then alphabetically
    const rankMap = new Map(rankedMeals.map((r, idx) => [r.meal.id, idx]));
    picked.sort((a, b) => {
      const ra = rankMap.get(a.id) ?? 9999;
      const rb = rankMap.get(b.id) ?? 9999;
      return ra !== rb ? ra - rb : a.name.localeCompare(b.name);
    });
    setPartnerPicks(picked);
    setSharedExhaustedView("partner-picks");
    setPartnerPicksLoading(false);
  }

  // "Just decide for us" — takes position 0 from the shared deck (the group's
  // top-scored meal) and locks it in immediately without waiting for a mutual swipe.
  // Both users are routed to the same /locked screen via the match-polling mechanism.
  async function handleJustDecide() {
    const topMeal = rankedMeals[0]?.meal;
    if (!topMeal || !sessionId) return;

    trackEvent("just_decide_tapped", { mealId: topMeal.id, sessionId, positionInDeck: 0 });

    // Close tracking session before navigation
    trackingClosedRef.current = true;
    trackingSessionPromiseRef.current?.then((tsId) => {
      if (tsId && trackingOpenedAtRef.current) {
        void recordDecision({
          trackingSessionId: tsId,
          meal: topMeal,
          outcome: "accepted",
          positionInDeck: 0,
          isAiGenerated: aiMealIds.has(topMeal.id),
        });
        void closeTrackingSession({
          trackingSessionId: tsId,
          resolved: true,
          swipeCount: trackingSwipeCountRef.current,
          openedAt: trackingOpenedAtRef.current,
        });
      }
    });

    await supabase
      .from("sessions")
      .update({
        status: "matched",
        locked_meal_id: topMeal.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    addToHistory(topMeal);
    saveDecidedMeal({ ...topMeal, decidedAt: new Date().toISOString(), mode: "shared", sessionId: sessionId ?? undefined });
    router.push("/");
  }

  // Shared-mode refresh: delete all swipes, clear the deck, return to the lobby so
  // the host can pick a new vibe and generate a fresh deck.  The other user's
  // both-done poller detects the cleared deck_meal_ids and follows automatically.
  async function handleSharedRefreshDeck() {
    if (!sessionId) return;
    // Increment shared reset counter
    const nextCount = (parseInt(sessionStorage.getItem(sharedResetKey(sessionId)) ?? "0", 10) || 0) + 1;
    sessionStorage.setItem(sharedResetKey(sessionId), String(nextCount));
    setSharedResetCount(nextCount);
    trackEvent("deck_refreshed", { mode: "shared", sessionId });
    setSharedRefreshing(true);
    await supabase.from("swipes").delete().eq("session_id", sessionId);
    // Reset deck and status back to 'ready' so the session page auto-rebuilds
    await supabase
      .from("sessions")
      .update({ deck_meal_ids: null, status: "ready", updated_at: new Date().toISOString() })
      .eq("id", sessionId);
    router.push(`/session/${sessionId}`);
  }

  function handlePass() {
    dismissHint();
    if (meal) {
      trackingSwipeCountRef.current += 1;
      trackEvent("card_swiped_no", {
        mealId: meal.id,
        swipeIndex: currentIndex,
        deckSize: totalCount,
        mode: sessionId ? "shared" : "solo",
        ...(sessionId ? { sessionId } : {}),
      });
      updateTasteProfile(meal, "pass");

      // ── Rejection-reason capture: track streaks (solo only, cap 3) ────────
      if (!sessionId) {
        passStreakRef.current += 1;
        totalPassesRef.current += 1;

        // Keep last 3 passed categories for the "not_feeling_it" signal
        recentlyPassedCategoriesRef.current = [
          ...recentlyPassedCategoriesRef.current.slice(-2),
          meal.category,
        ];

        // Rejection sheet disabled for MVP — streak tracking preserved for future use
        const STREAK_THRESHOLD = 3;
        const CAP = 3;
        if (false && // disabled: sheet never shows
          passStreakRef.current >= STREAK_THRESHOLD &&
          rejectionCaptureCountRef.current < CAP &&
          !pendingRejectionSheetRef.current
        ) {
          pendingRejectionSheetRef.current = true;
          pendingRejectionMealRef.current = meal; // capture meal context for RejectionEntry
        }
      }

      // ── Progressive onboarding: track avoid signals (solo only) ──────────
      if (!sessionId && !rejectionSheetFiredRef.current) {
        for (const sig of getAvoidSignals(meal)) {
          passSignalsRef.current[sig] = (passSignalsRef.current[sig] ?? 0) + 1;
        }
        const nudge = checkCrossSessionNudge(
          passSignalsRef.current,
          nudgeCandidatesRef.current,
          firedTriggersRef.current,
        );
        if (nudge) {
          firedTriggersRef.current.add(nudge.signal);
          // Queue to display after the exit animation completes
          pendingNudgeRef.current = nudge;
        }
      }

      // ── Ritual rejection tracking (solo only) ────────────────────────────
      // If position 0 was a proactively surfaced ritual, record the rejection.
      // After 2 rejections in this context, the ritual is suppressed for 30 days.
      if (!sessionId && currentIndex === 0 && isRitualPosition0Ref.current) {
        const ritual = ritualDetectionRef.current;
        if (ritual && meal.id === ritual.mealId) {
          const suppressed = recordRitualRejection(ritual.context, ritual.mealId);
          if (suppressed) {
            // Clear the ritual so it doesn't re-inject on deck rebuilds
            ritualDetectionRef.current = null;
            isRitualPosition0Ref.current = false;
          }
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
    // Write completion flag immediately when user initiates their final swipe
    if (sessionId && typeof window !== 'undefined' && currentIndex >= Math.min(rankedMeals.length, DECK_SIZE) - 1) {
      localStorage.setItem(`wwe_session_swiping_done_${sessionId}`, 'true')
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
      if (!sessionId && !rejectionSheetFiredRef.current) {
        for (const sig of getPreferSignals(meal)) {
          likeSignalsRef.current[sig] = (likeSignalsRef.current[sig] ?? 0) + 1;
        }
        const nudge = checkTriggers(
          {}, // avoid nudge is cross-session only; don't fire it on save
          likeSignalsRef.current,
          firedTriggersRef.current,
        );
        if (nudge) {
          firedTriggersRef.current.add(nudge.signal);
          setActiveNudge(nudge);
          trackEvent("nudge_shown", { nudgeType: nudge.type, nudgeSignal: nudge.signal });
        }
      }
    }
    x.set(0);
    setCurrentIndex((i) => i + 1);
  }

  function handleChoose() {
    if (!meal || isChoosing || isExiting) return;
    dismissHint();

    trackingSwipeCountRef.current += 1;

    // ── Shared session path ──
    if (sessionId) {
      handleSharedChoose(meal);
      return;
    }

    // ── Solo path (unchanged) ──
    const chosenMeal = meal;
    trackEvent("card_swiped_yes", {
      mealId: chosenMeal.id,
      swipeIndex: currentIndex,
      deckSize: totalCount,
      mode: "solo",
    });

    if (pantryMode && selectedIngredients.length > 0) {
      const ctx = inferSessionContext(new Date());
      trackEvent("pantry_ingredients_selected", {
        ingredients: selectedIngredients,
        meal_period: ctx.mealPeriod,
        day_type: ctx.dayType,
        resulted_in_acceptance: true,
        match_count_of_accepted_meal: pantryMatchCount,
      });
      const uid = getUserId();
      if (uid) void upsertPantryIngredientCounts(uid, selectedIngredients);
      pantryMealAcceptedRef.current = true;
    }

    updateTasteProfile(chosenMeal, "choose");

    // Haptic feedback: firm tap + soft echo
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([12, 60, 8]);
    }

    // Mark closed before the timeout so the unmount cleanup doesn't double-fire
    trackingClosedRef.current = true;

    // Choosing resets the pass streak (user found something they want)
    passStreakRef.current = 0;

    // Brief flash moment before the exit animation fires
    setIsChoosing(true);
    setTimeout(() => {
      setIsChoosing(false);
      triggerExit("right", () => {
        // Record acceptance — fire-and-forget, does not block navigation
        trackingSessionPromiseRef.current?.then((tsId) => {
          if (tsId && trackingOpenedAtRef.current) {
            void recordDecision({
              trackingSessionId: tsId,
              meal: chosenMeal,
              outcome: "accepted",
              positionInDeck: currentIndex,
              isAiGenerated: aiMealIds.has(chosenMeal.id),
            });
            void closeTrackingSession({
              trackingSessionId: tsId,
              resolved: true,
              swipeCount: trackingSwipeCountRef.current,
              openedAt: trackingOpenedAtRef.current,
            });
          }
        });
        addToHistory(chosenMeal);
        saveDecidedMeal({ ...chosenMeal, decidedAt: new Date().toISOString(), mode: "solo" });
        syncBehavioralSignalsToSupabase(getUserId()).catch((err) =>
          console.warn("[sync] behavioral signals failed:", err),
        );

        // Soft avoid self-clear: if user accepted a meal whose category is in
        // soft avoids, the pattern is over — remove that entry immediately.
        if (softAvoidsRef.current.length > 0) {
          const acceptedSignals = getAvoidSignals(chosenMeal);
          if (acceptedSignals.length > 0) {
            const filtered = softAvoidsRef.current.filter(
              (sa) => !acceptedSignals.includes(sa.category),
            );
            if (filtered.length < softAvoidsRef.current.length) {
              softAvoidsRef.current = filtered;
              const userId = getUserId();
              if (userId) void upsertSoftAvoids(userId, filtered);
            }
          }
        }

        // Celebration overlay — navigates home after 2.5s
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([80, 40, 80]);
        setSoloLockMeal(chosenMeal);
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
        setTimeout(() => {
          setActiveNudge(nudge);
          trackEvent("nudge_shown", { nudgeType: nudge.type, nudgeSignal: nudge.signal });
        }, 150);
      }

      // Show rejection-reason sheet if queued (after nudge so they don't overlap).
      if (pendingRejectionSheetRef.current && !pendingNudgeRef.current) {
        pendingRejectionSheetRef.current = false;
        rejectionCaptureCountRef.current += 1;
        passStreakRef.current = 0; // reset streak so it won't re-fire immediately
        rejectionSheetFiredRef.current = true; // suppress nudge for rest of session
        setTimeout(() => setShowRejectionSheet(true), 200);
      }
    }
  }

  // ── Nudge answer handler ──────────────────────────────────────────────────

  function handleNudgeAnswer(yes: boolean) {
    const nudge = activeNudge;
    setActiveNudge(null);
    if (nudge) {
      trackEvent(yes ? "nudge_accepted" : "nudge_dismissed", {
        nudgeType: nudge.type,
        nudgeSignal: nudge.signal,
        source: yes ? "dial_it_back" : "just_not_tonight",
      });
    }
    // Nudges are solo-only; shared decks are fixed and can't be rebuilt here.
    if (!nudge || !yes || sessionId) return;

    // Show a brief confirmation so the user knows the app learned something.
    const msg =
      nudge.type === "avoid"
        ? `Got it — we'll dial back ${nudge.signal.toLowerCase()} for a while`
        : `Nice — we'll show more ${nudge.signal}`;
    setToastMessage(msg);

    if (nudge.type === "avoid") {
      // Soft avoid: score penalty for 60 days, not a hard exclusion.
      // Find the candidate's crossSessionCount for the strength field.
      const candidate = nudgeCandidatesRef.current.find((c) => c.signal === nudge.signal);
      const strength = candidate?.crossSessionCount ?? 3;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      const newEntry: SoftAvoid = {
        category: nudge.signal,
        ingredient: nudge.signal,
        addedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        strength,
      };
      // Guard against duplicate entries for the same signal
      const without = softAvoidsRef.current.filter((sa) => sa.category !== nudge.signal);
      const updated = [...without, newEntry];
      softAvoidsRef.current = updated;
      setSoftAvoids(updated);
      const userId = getUserId();
      if (userId) void upsertSoftAvoids(userId, updated);

      // Re-score remaining deck so the soft avoid penalty takes effect immediately
      const remaining = rankedMeals.slice(currentIndex).map((rm) => rm.meal);
      if (remaining.length > 0) {
        const prefs = getPreferences();
        const reranked = rankMeals(
          remaining,
          prefs,
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
          rejectionReasonsRef.current,
          updated,
          inferSessionContext(new Date()),
        );
        setRankedMeals([...rankedMeals.slice(0, currentIndex), ...reranked]);
      }
    } else {
      // prefer: add cuisine to favorites
      const prefs = getPreferences();
      if (!prefs) return;
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
          rejectionReasonsRef.current,
          softAvoidsRef.current,
          inferSessionContext(new Date()),
        );
        setRankedMeals([...rankedMeals.slice(0, currentIndex), ...reranked]);
      }
    }
  }

  // ── Rejection-reason sheet handlers ──────────────────────────────────────

  function handleRejectionSelect(reason: RejectionReason) {
    setShowRejectionSheet(false);

    // Build a rich RejectionEntry from the meal that triggered the streak
    const mealCtx = pendingRejectionMealRef.current;
    const entry: RejectionEntry = {
      reason,
      mealId: mealCtx?.id ?? "",
      category: mealCtx?.category ?? "",
      cuisine: mealCtx ? [mealCtx.cuisine] : [],
      tags: mealCtx?.tags ?? [],
    };

    // Deduplicate by reason+mealId so the same rejection isn't applied twice
    const alreadyStored = rejectionReasonsRef.current.some(
      (e) => e.reason === entry.reason && e.mealId === entry.mealId,
    );
    const next = alreadyStored
      ? rejectionReasonsRef.current
      : [...rejectionReasonsRef.current, entry];
    rejectionReasonsRef.current = next;
    setRejectionReasons(next);

    trackEvent("rejection_reason_selected", { reason, totalReasons: next.length });

    // Re-rank remaining deck cards with the updated rejection adjustment
    const remaining = rankedMeals.slice(currentIndex).map((rm) => rm.meal);
    if (remaining.length > 0) {
      const history = getHistory();
      const reranked = rankMeals(
        remaining,
        getPreferences(),
        getSavedMeals(),
        history,
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
        next,
        softAvoidsRef.current,
        inferSessionContext(new Date()),
      );
      setRankedMeals([...rankedMeals.slice(0, currentIndex), ...reranked]);
    }
  }

  function handleRejectionDismiss() {
    setShowRejectionSheet(false);
    // Don't penalise the user for dismissing — just reset streak so the sheet
    // doesn't re-trigger on the very next swipe.
    passStreakRef.current = 0;
  }

  // ── Session expired screen ────────────────────────────────────────────────
  if (sessionId && sessionExpired) {
    return <SessionTerminalScreen variant="expired" />;
  }

  // ── Shared deck error screen ──────────────────────────────────────────────
  if (sessionId && sharedError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#080808] px-6 text-center text-white">
        <p className="text-lg font-semibold tracking-[-0.03em]">Deck not ready</p>
        <p className="max-w-[28ch] text-sm leading-6 text-white/50">
          The shared deck couldn&apos;t be built. Ask the host to go back and
          try again.
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
        <main className="relative min-h-screen overflow-hidden bg-[#1C1A18] px-5 pb-6 safe-top text-white">
          {/* Subtle orange radial glow — always visible */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 80% 45% at 50% 0%, rgba(232,98,26,0.10) 0%, transparent 65%)" }}
          />
          <div className="mx-auto relative flex min-h-screen w-full max-w-md flex-col">
            <header className="flex items-center justify-between py-4">
              <span className="font-display font-black text-base text-white">
                Watcha<span className="text-[#E8621A]">?</span>
              </span>
              <button
                onClick={() => router.push("/")}
                className="font-body text-sm text-[#8A7F78] transition hover:text-white/60"
              >
                Back
              </button>
            </header>

            <div className="flex flex-1 flex-col items-center justify-center text-center">
              {bothDone ? (
                sharedExhaustedView === "partner-picks" ? (
                  /* ── Partner picks sub-screen ────────────────────────── */
                  <div className="w-full text-left">
                    <button
                      onClick={() => setSharedExhaustedView("main")}
                      className="mb-6 font-body text-sm text-[#8A7F78] hover:text-white transition"
                    >
                      ← Back
                    </button>
                    <p className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase mb-2">
                      THEIR YES PILE
                    </p>
                    <h2 className="font-display font-black text-2xl text-white leading-tight">
                      What they liked.
                    </h2>
                    <p className="font-body text-sm text-[#8A7F78] mt-2 mb-6">
                      Pick one as tonight&apos;s compromise.
                    </p>
                    {/* Confirm-lock dialog */}
                    {confirmMeal && (
                      <div className="fixed inset-0 z-50 flex items-end justify-center">
                        <div
                          className="absolute inset-0 bg-black/60"
                          onClick={() => setConfirmMeal(null)}
                        />
                        <div className="relative w-full max-w-md bg-[#2A2420] rounded-t-[28px] px-6 pt-6 pb-10">
                          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
                          <p className="font-display font-black text-xl text-white text-center">
                            Lock in {confirmMeal.name} as tonight&apos;s pick?
                          </p>
                          <div className="flex flex-col gap-3 mt-6">
                            <button
                              onClick={() => {
                                addToHistory(confirmMeal);
                                saveDecidedMeal({ ...confirmMeal, decidedAt: new Date().toISOString(), mode: "shared", sessionId: sessionId ?? undefined });
                                if (sessionId) sessionStorage.removeItem(sharedResetKey(sessionId));
                                router.push("/");
                              }}
                              className="w-full rounded-full bg-[#E8621A] py-4 font-display font-black text-base text-white transition hover:bg-[#F27B35] active:scale-[0.98]"
                              style={{ boxShadow: "0 0 20px rgba(232,98,26,0.3)" }}
                            >
                              Yes, let&apos;s eat →
                            </button>
                            <button
                              onClick={() => setConfirmMeal(null)}
                              className="w-full rounded-full border border-white/10 bg-transparent py-3 font-body text-sm text-[#8A7F78] transition hover:text-white active:scale-[0.98]"
                            >
                              Keep looking
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {(() => {
                      const uniquePartnerPicks = partnerPicks.filter(
                        (meal, idx, self) => idx === self.findIndex((m) => m.id === meal.id)
                      );
                      return uniquePartnerPicks.length === 0 ? (
                      <p className="font-body text-sm text-[#8A7F78] text-center py-8">
                        They haven&apos;t swiped yet. Check back soon.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {uniquePartnerPicks.map((meal) => (
                          <button
                            key={meal.id}
                            onClick={() => setConfirmMeal(meal)}
                            className="w-full text-left rounded-[20px] overflow-hidden bg-[#2A2420] border border-transparent hover:border-[#E8621A]/40 transition-all duration-200"
                          >
                            <div className="w-full bg-[#3D3733]" style={{ aspectRatio: "16/9" }}>
                              <img src={meal.image || FALLBACK_IMAGE} alt={meal.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="p-4">
                              <p className="font-display font-black text-xl text-white">{meal.name}</p>
                              <p className="font-body text-sm text-white/70 mt-1">{meal.description}</p>
                              {meal.tags && meal.tags.length > 0 && (
                                <div className="flex gap-1.5 flex-wrap mt-2">
                                  {meal.tags.slice(0, 3).map((tag) => (
                                    <span key={tag} className="bg-white/10 text-white/70 font-body text-xs px-2.5 py-1 rounded-full">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                    })()}
                  </div>
                ) : (
                  /* ── Shared no-match main screen ─────────────────────── */
                  <div className="w-full">
                    <p className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase mb-6">
                      DECK COMPLETE
                    </p>
                    {sharedResetCount >= 2 ? (
                      /* ── Shared terminal: exhausted all resets ──────── */
                      <>
                        <h2 className="font-display font-black text-2xl text-white text-center leading-tight">
                          You&apos;ve both seen everything.
                        </h2>
                        <p className="font-body text-sm text-[#8A7F78] text-center mt-2 mb-8">
                          Sometimes the answer isn&apos;t on the menu. Take a break and come back with fresh eyes.
                        </p>
                        <div className="flex flex-col gap-3 w-full text-left">
                          {/* See what they liked — always available */}
                          <button
                            onClick={() => void handleLoadPartnerPicks()}
                            disabled={partnerPicksLoading}
                            className="bg-[#2A2420] rounded-[18px] p-4 flex items-center gap-4 w-full cursor-pointer border border-transparent hover:border-[#E8621A]/40 transition-all duration-200 disabled:opacity-60"
                          >
                            <span className="text-2xl flex-shrink-0">👀</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-display font-black text-base text-white">
                                {partnerPicksLoading ? "Loading…" : "See what they liked"}
                              </p>
                              <p className="font-body text-xs text-[#8A7F78] mt-0.5">
                                Browse their yes pile and pick a compromise
                              </p>
                            </div>
                            <span className="text-[#8A7F78] text-lg flex-shrink-0">›</span>
                          </button>
                          {/* Go home */}
                          <button
                            onClick={() => router.push("/")}
                            className="mt-2 w-full rounded-full bg-[#E8621A] py-4 font-display font-black text-base text-white transition hover:bg-[#F27B35] active:scale-[0.98]"
                            style={{ boxShadow: "0 0 20px rgba(232,98,26,0.3)" }}
                          >
                            Go home
                          </button>
                        </div>
                      </>
                    ) : (
                      /* ── Standard shared no-match options ───────────── */
                      <>
                        <h2 className="font-display font-black text-3xl text-white leading-tight">
                          You&apos;ve both swiped everything.
                        </h2>
                        <p className="font-body text-sm text-[#8A7F78] mt-3 mb-10">
                          Still no match. Here&apos;s what you can do.
                        </p>
                        <div className="flex flex-col gap-3 w-full text-left">
                          {/* See what they liked */}
                          <button
                            onClick={() => void handleLoadPartnerPicks()}
                            disabled={partnerPicksLoading}
                            className="bg-[#2A2420] rounded-[18px] p-4 flex items-center gap-4 w-full cursor-pointer border border-transparent hover:border-[#E8621A]/40 transition-all duration-200 disabled:opacity-60"
                          >
                            <span className="text-2xl flex-shrink-0">👀</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-display font-black text-base text-white">
                                {partnerPicksLoading ? "Loading…" : "See what they liked"}
                              </p>
                              <p className="font-body text-xs text-[#8A7F78] mt-0.5">
                                Browse their yes pile and pick a compromise
                              </p>
                            </div>
                            <span className="text-[#8A7F78] text-lg flex-shrink-0">›</span>
                          </button>
                          {/* Fresh session — shows info message after tapping */}
                          {sharedFreshTapped ? (
                            <div className="bg-[#2A2420] rounded-[18px] p-4 text-center">
                              <p className="font-body text-sm text-[#8A7F78]">
                                Both of you need to choose this to start fresh.{sharedSessionCode ? " Share the session code again: " : ""}
                                {sharedSessionCode && (
                                  <span className="font-display font-black text-white">{sharedSessionCode}</span>
                                )}
                              </p>
                            </div>
                          ) : (
                            <button
                              onClick={() => setSharedFreshTapped(true)}
                              disabled={sharedRefreshing}
                              className="bg-[#2A2420] rounded-[18px] p-4 flex items-center gap-4 w-full cursor-pointer border border-transparent hover:border-[#E8621A]/40 transition-all duration-200 disabled:opacity-60"
                            >
                              <span className="text-2xl flex-shrink-0">🔄</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-display font-black text-base text-white">
                                  Start a fresh session
                                </p>
                                <p className="font-body text-xs text-[#8A7F78] mt-0.5">Build a new deck together</p>
                              </div>
                              <span className="text-[#8A7F78] text-lg flex-shrink-0">›</span>
                            </button>
                          )}
                          {/* Go home */}
                          <button
                            onClick={() => router.push("/")}
                            className="bg-[#2A2420] rounded-[18px] p-4 flex items-center gap-4 w-full cursor-pointer border border-transparent hover:border-[#E8621A]/40 transition-all duration-200"
                          >
                            <span className="text-2xl flex-shrink-0">🏠</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-display font-black text-base text-white">Go home</p>
                              <p className="font-body text-xs text-[#8A7F78] mt-0.5">Navigate home without action</p>
                            </div>
                            <span className="text-[#8A7F78] text-lg flex-shrink-0">›</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              ) : (
                /* ── Branded waiting screen ──────────────────────────────── */
                <div className="flex flex-col items-center w-full">
                  {/* Status eyebrow */}
                  <p className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase mb-10">
                    YOUR PICKS ARE IN
                  </p>
                  {/* Avatar pair */}
                  <div className="flex items-center gap-5 mb-10">
                    {/* Your avatar — filled orange */}
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className="w-14 h-14 rounded-full bg-[#E8621A] flex items-center justify-center"
                        style={{ boxShadow: "0 0 24px rgba(232,98,26,0.35)" }}
                      >
                        <span className="font-display font-black text-2xl text-white">✓</span>
                      </div>
                      <span className="font-body text-xs text-[#8A7F78]">You</span>
                    </div>
                    {/* Connector dots */}
                    <div className="flex gap-1 pb-4">
                      <span className="w-1 h-1 rounded-full bg-[#3D3733]" />
                      <span className="w-1 h-1 rounded-full bg-[#3D3733]" />
                      <span className="w-1 h-1 rounded-full bg-[#3D3733]" />
                    </div>
                    {/* Partner avatar — hollow with pulsing orange ring */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative w-14 h-14">
                        {/* Pulsing ring */}
                        <div
                          className="absolute inset-0 rounded-full border-2 border-[#E8621A] animate-ping opacity-40"
                        />
                        <div
                          className="w-14 h-14 rounded-full border-2 border-[#E8621A]/60 bg-[#2A2420] flex items-center justify-center"
                        >
                          <span className="font-display font-black text-2xl text-[#E8621A]/50">?</span>
                        </div>
                      </div>
                      <span className="font-body text-xs text-[#8A7F78]">Them</span>
                    </div>
                  </div>
                  {/* Headline */}
                  <h2 className="font-display font-black text-2xl text-white leading-tight max-w-[22ch]">
                    You&apos;re done swiping.
                  </h2>
                  {/* Subtext */}
                  <p className="font-body text-sm text-[#8A7F78] text-center mt-3 max-w-[28ch]">
                    We&apos;ll let you know when there&apos;s a match. They still have time.
                  </p>
                  {/* Ghost home button */}
                  <button
                    onClick={() => router.push("/")}
                    className="mt-12 font-body text-sm text-[#8A7F78]/60 hover:text-[#8A7F78] transition-colors"
                  >
                    Go home for now →
                  </button>
                </div>
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
                className="fixed inset-0 z-50 bg-[#1C1A18] overflow-y-auto"
              >
                <motion.div
                  initial={{ y: 72, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 72, opacity: 0 }}
                  transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
                  className="relative flex flex-col items-center justify-start min-h-screen px-6 pt-16 pb-10"
                >
                  {/* Radial green glow */}
                  <div
                    className="absolute inset-0 pointer-events-none z-0"
                    style={{ background: "radial-gradient(ellipse at 50% 25%, rgba(74,124,89,0.18) 0%, transparent 60%)" }}
                  />

                  <div className="relative z-10 flex flex-col items-center w-full">
                    {/* 1. Green pulsing circle */}
                    <div className="flex items-center justify-center">
                      <div
                        className="w-28 h-28 rounded-full bg-[#4A7C59] flex items-center justify-center animate-pulse-soft"
                        style={{ boxShadow: "0 0 60px rgba(74,124,89,0.45)" }}
                      >
                        <span className="font-display font-black text-5xl text-white">✓</span>
                      </div>
                    </div>

                    {/* 2. Eyebrow label */}
                    <p className="text-[#4A7C59] text-[11px] font-semibold tracking-widest uppercase mt-6">
                      IT&apos;S A MATCH.
                    </p>

                    {/* 3. Main headline */}
                    <h1 className="font-display font-black text-4xl text-white text-center mt-2 leading-tight">
                      Dinner is decided.
                    </h1>

                    {/* 4. Meal name in green */}
                    <p className="font-display font-bold text-2xl text-[#4A7C59] text-center mt-1">
                      {matchedMeal.name}
                    </p>

                    {/* 5. Meal image card */}
                    <div
                      className="w-full rounded-[20px] overflow-hidden mt-6 bg-[#2A2420]"
                      style={{ aspectRatio: "16/9" }}
                    >
                      <img
                        src={matchedMeal.image}
                        alt={matchedMeal.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* 6. Meal name + description */}
                    <div className="w-full mt-4 text-center">
                      <p className="font-display font-black text-xl text-white">{matchedMeal.name}</p>
                      <p className="font-body text-sm text-white/70 mt-1 leading-relaxed">{matchedMeal.description}</p>
                    </div>

                    {/* 7. Why this works card */}
                    {rankedMeals.find((r) => r.meal.id === matchedMeal.id)?.reason && (
                      <div className="w-full bg-[#2A2420] rounded-[18px] p-4 mt-4 flex items-start gap-3">
                        <span className="text-xl flex-shrink-0 mt-0.5">💡</span>
                        <p className="font-body text-sm text-white/75 leading-relaxed">
                          <span className="font-display font-black text-sm text-[#E8621A]">Why this works: </span>
                          {rankedMeals.find((r) => r.meal.id === matchedMeal.id)?.reason}
                        </p>
                      </div>
                    )}

                    {/* 8. CTA buttons */}
                    <div className="flex gap-3 w-full mt-6">
                      <button
                        onClick={() => setShowCookOrderModal(true)}
                        className="flex-1 py-4 rounded-[16px] bg-[#E8621A] text-white font-display font-black text-base"
                        style={{ boxShadow: "0 0 30px rgba(232,98,26,0.3)" }}
                      >
                        Let&apos;s eat 🙌
                      </button>
                      <button
                        onClick={() => sessionId ? void handleMatchConfirm() : router.push("/")}
                        disabled={matchConfirming}
                        className="flex-1 py-4 rounded-[16px] bg-[#2A2420] text-white font-display font-black text-base text-center disabled:opacity-60"
                      >
                        {matchConfirming ? "Locking in…" : "Back to home"}
                      </button>
                    </div>
                    {matchConfirmError && (
                      <p className="text-center text-sm text-red-400 mt-3">{matchConfirmError}</p>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cook vs Order modal — shared match */}
          {showCookOrderModal && (
            <div className="fixed inset-0 z-[60] flex items-end justify-center">
              <div
                className="absolute inset-0 bg-black/60"
                onClick={() => setShowCookOrderModal(false)}
              />
              <div className="relative w-full bg-[#2A2420] rounded-t-[28px] px-6 pt-6 pb-10">
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
                <p className="font-display font-black text-2xl text-white text-center">
                  How are you eating?
                </p>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <button
                    onClick={() => { setShowCookOrderModal(false); void handleMatchConfirm(); }}
                    disabled={matchConfirming}
                    className="bg-[#1C1A18] rounded-[20px] p-5 flex flex-col items-center gap-3 cursor-pointer border border-transparent hover:border-[#E8621A]/40 disabled:opacity-60"
                  >
                    <span className="text-4xl">🍳</span>
                    <p className="font-display font-black text-lg text-white">Cook it</p>
                    <p className="font-body text-xs text-[#8A7F78] text-center mt-1">See what you need</p>
                  </button>
                  <button
                    onClick={() => { setShowCookOrderModal(false); void handleMatchConfirm(); }}
                    disabled={matchConfirming}
                    className="bg-[#1C1A18] rounded-[20px] p-5 flex flex-col items-center gap-3 cursor-pointer border border-transparent hover:border-[#E8621A]/40 disabled:opacity-60"
                  >
                    <span className="text-4xl">🚗</span>
                    <p className="font-display font-black text-lg text-white">Order in</p>
                    <p className="font-body text-xs text-[#8A7F78] text-center mt-1">Find delivery options</p>
                  </button>
                </div>
                {matchConfirmError && (
                  <p className="text-center text-sm text-red-400 mt-4">{matchConfirmError}</p>
                )}
              </div>
            </div>
          )}
        </main>
      );
    }

    // ── Solo exhausted state ───────────────────────────────────────────────
    if (topPicksMode) {
      return (
        <main className="relative min-h-screen overflow-hidden bg-[#1C1A18] px-5 pb-6 safe-top text-white">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-24 right-[-60px] h-52 w-52 rounded-full bg-white/[0.04] blur-3xl" />
          </div>
          <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
            <header className="flex items-center justify-between">
              <span className="font-display font-black text-base text-white">
                Watcha<span className="text-[#E8621A]">?</span>
              </span>
              <button
                onClick={() => router.push("/")}
                className="font-body text-sm text-[#8A7F78] transition hover:text-white/60"
              >
                {isChangeMeal && existingMeal ? `Keep ${existingMeal.meal.name}` : "Back"}
              </button>
            </header>
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-[#2A2420] px-3.5 py-1.5 font-body text-xs text-[#8A7F78]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#E8621A]" />
                Round 2 complete
              </div>
              <h2 className="mt-4 font-display font-black text-3xl text-white leading-tight">
                That&apos;s your best set
              </h2>
              <p className="font-body mt-3 max-w-[28ch] text-sm leading-relaxed text-[#8A7F78]">
                You&apos;ve gone through your strongest matches. Want to try a new direction?
              </p>
              <p className="font-body mt-3 text-xs text-[#8A7F78]/60">You&apos;re close 👀</p>
              <div className="mt-8 w-full flex flex-col gap-3">
                <button
                  onClick={() => { setTopPicksMode(false); setCurrentIndex(0); }}
                  className="w-full rounded-full bg-[#E8621A] py-4 font-display font-black text-base text-white shadow-[0_0_20px_rgba(232,98,26,0.35)] transition hover:bg-[#F27B35] active:scale-[0.98]"
                >
                  Start over
                </button>
                <button
                  onClick={() => router.push("/browse")}
                  className="w-full rounded-full border border-white/10 bg-[#2A2420] py-3 font-body text-sm font-semibold text-[#8A7F78] transition active:scale-[0.98]"
                >
                  Browse all meals
                </button>
              </div>
            </div>
          </div>
        </main>
      );
    }

    // ── Solo branded two-step end-of-deck experience ───────────────────────
    const headline = exhaustedHeadlineRef.current ?? SOLO_EXHAUSTED_HEADLINES[0];

    // Helper to clear solo reset counter and navigate home
    function clearAndGoHome() {
      sessionStorage.removeItem(SOLO_RESET_SS_KEY);
      setSoloResetCount(0);
      router.push("/");
    }

    // Helper to decide + navigate home (canonical path)
    function lockInMeal(meal: Meal) {
      sessionStorage.removeItem(SOLO_RESET_SS_KEY);
      setSoloResetCount(0);
      addToHistory(meal);
      saveDecidedMeal({ ...meal, decidedAt: new Date().toISOString(), mode: "solo" });
      router.push("/");
    }

    // ── Easter egg: reset 3+ (terminal state) ─────────────────────────────
    if (soloResetCount >= 3) {
      const forcedMeal = rankedMeals[0]?.meal;
      return (
        <main className="relative min-h-screen overflow-hidden bg-[#1C1A18] px-5 pb-10 safe-top text-white">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 80% 50% at 50% 20%, rgba(232,98,26,0.18) 0%, transparent 65%)" }}
          />
          <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center text-center px-4">
            {/* Pulsing app icon */}
            <div
              className="w-24 h-24 bg-[#E8621A] rounded-[22%] flex items-center justify-center mb-10 animate-pulse"
              style={{ boxShadow: "0 0 60px rgba(232,98,26,0.45)" }}
            >
              <span className="font-display font-black text-6xl text-white">?</span>
            </div>
            <h2 className="font-display font-black text-4xl text-white text-center leading-tight">
              Okay. We tried.
            </h2>
            <p className="font-body text-base text-[#8A7F78] text-center mt-3 max-w-xs">
              You&apos;ve seen everything we&apos;ve got. Multiple times. The app has done its job — now it&apos;s your turn.
            </p>
            {forcedMeal && (
              <>
                <button
                  onClick={() => lockInMeal(forcedMeal)}
                  className="mt-10 w-full rounded-full bg-[#E8621A] py-4 font-display font-black text-base text-white transition hover:bg-[#F27B35] active:scale-[0.98]"
                  style={{ boxShadow: "0 0 24px rgba(232,98,26,0.4)" }}
                >
                  Just pick something →
                </button>
                <p className="font-body text-xs text-[#8A7F78]/60 text-center mt-3">
                  (It&apos;s {forcedMeal.name}. You&apos;ll be fine.)
                </p>
              </>
            )}
          </div>
        </main>
      );
    }

    // Sub-screen: top 3 picks
    if (soloExhaustedView === "top3") {
      const top3 = rankedMeals.slice(0, 3).map((r) => r.meal);
      return (
        <main className="relative min-h-screen overflow-y-auto bg-[#1C1A18] px-5 pb-10 safe-top text-white">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 80% 45% at 50% 0%, rgba(232,98,26,0.12) 0%, transparent 65%)" }}
          />
          <div className="mx-auto w-full max-w-md flex flex-col pt-safe">
            <header className="flex items-center justify-between py-4 mb-2">
              <button
                onClick={() => setSoloExhaustedView("main")}
                className="font-body text-sm text-[#8A7F78] hover:text-white transition"
              >
                ← Back
              </button>
              <button
                onClick={clearAndGoHome}
                className="font-body text-sm text-[#8A7F78] transition hover:text-white/60"
              >
                {isChangeMeal && existingMeal ? `Keep ${existingMeal.meal.name}` : "Home"}
              </button>
            </header>
            <p className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase mb-2">
              YOUR BEST OPTIONS
            </p>
            <h2 className="font-display font-black text-2xl text-white leading-tight">
              Your best options.
            </h2>
            <p className="font-body text-sm text-[#8A7F78] mt-2 mb-8">
              These scored highest for you tonight. Pick one.
            </p>
            <div className="flex flex-col gap-6 pb-8">
              {top3.map((meal) => (
                <div key={meal.id} className="flex flex-col rounded-[20px] overflow-hidden bg-[#2A2420]">
                  <div className="w-full bg-[#3D3733]" style={{ aspectRatio: "16/9" }}>
                    <img src={meal.image || FALLBACK_IMAGE} alt={meal.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-4">
                    <p className="font-display font-black text-xl text-white">{meal.name}</p>
                    <p className="font-body text-sm text-white/70 mt-1 leading-relaxed">{meal.description}</p>
                    <button
                      onClick={() => lockInMeal(meal)}
                      className="mt-4 w-full rounded-full bg-[#E8621A] py-3 font-display font-black text-base text-white transition active:scale-[0.98]"
                      style={{ boxShadow: "0 0 20px rgba(232,98,26,0.3)" }}
                    >
                      Lock this in →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      );
    }

    // Sub-screen: vibe selector
    if (soloExhaustedView === "vibe-select") {
      return (
        <main className="relative min-h-screen overflow-y-auto bg-[#1C1A18] px-5 pb-10 safe-top text-white">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 80% 45% at 50% 0%, rgba(232,98,26,0.12) 0%, transparent 65%)" }}
          />
          <div className="mx-auto w-full max-w-md flex flex-col pt-safe">
            <header className="flex items-center justify-between py-4 mb-2">
              <button
                onClick={() => setSoloExhaustedView("main")}
                className="font-body text-sm text-[#8A7F78] hover:text-white transition"
              >
                ← Back
              </button>
            </header>
            <p className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase mb-2">
              SET A MOOD
            </p>
            <h2 className="font-display font-black text-2xl text-white leading-tight mb-2">
              Pick a vibe.
            </h2>
            <p className="font-body text-sm text-[#8A7F78] mb-6">
              We&apos;ll rebuild the deck around it.
            </p>
            <div className="flex flex-col gap-3">
              {DIAG_VIBE_OPTIONS.map((opt) => {
                const selected = diagSelectedVibe === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setDiagSelectedVibe(opt.value)}
                    className="flex items-center gap-4 rounded-[20px] p-5 border transition-all duration-150 active:scale-[0.98] text-left"
                    style={{
                      borderColor: selected ? "#E8621A" : "transparent",
                      backgroundColor: selected ? "rgba(232,98,26,0.10)" : "#2A2420",
                    }}
                  >
                    <span className="text-3xl">{opt.emoji}</span>
                    <div className="flex-1">
                      <p className="font-display font-black text-base transition-colors duration-150" style={{ color: selected ? "#E8621A" : "white" }}>
                        {opt.label}
                      </p>
                      <p className="font-body text-xs text-[#8A7F78] mt-0.5">{opt.description}</p>
                    </div>
                    <div
                      className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150"
                      style={{
                        borderColor: selected ? "#E8621A" : "rgba(255,255,255,0.2)",
                        backgroundColor: selected ? "#E8621A" : "transparent",
                      }}
                    >
                      {selected && <span className="text-white text-[8px] font-bold">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => handleRefreshDeckWithVibe(diagSelectedVibe)}
              className="mt-8 w-full rounded-full bg-[#E8621A] py-4 font-display font-black text-base text-white transition hover:bg-[#F27B35] active:scale-[0.98]"
              style={{ boxShadow: "0 0 20px rgba(232,98,26,0.35)" }}
            >
              Build my deck →
            </button>
          </div>
        </main>
      );
    }

    // ── Main acknowledgment + diagnostic screen ────────────────────────────
    // "Fresh deck" option label changes at reset 2
    const freshDeckLabel = soloResetCount >= 2 ? "One more try" : "Nothing felt easy enough";
    const freshDeckSubtext = soloResetCount >= 2 ? "Build one last fresh deck" : "Show me quick, low-effort options";

    return (
      <main className="relative min-h-screen overflow-y-auto bg-[#1C1A18] px-5 pb-10 safe-top text-white">
        {/* Orange radial glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 90% 50% at 50% 0%, rgba(232,98,26,0.14) 0%, transparent 65%)" }}
        />
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
          <header className="flex items-center justify-between py-4">
            <span className="font-display font-black text-base text-white">
              Watcha<span className="text-[#E8621A]">?</span>
            </span>
            <button
              onClick={clearAndGoHome}
              className="font-body text-sm text-[#8A7F78] transition hover:text-white/60"
            >
              {isChangeMeal && existingMeal ? `Keep ${existingMeal.meal.name}` : "Back"}
            </button>
          </header>

          {/* ── Step 1: Acknowledgment ── */}
          <div className="flex flex-col items-center pt-8 pb-8 text-center">
            {/* Status eyebrow */}
            <p className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase mb-8">
              DECK COMPLETE
            </p>
            {/* App icon */}
            <div
              className="w-24 h-24 bg-[#E8621A] rounded-[22%] flex items-center justify-center mb-8"
              style={{ boxShadow: "0 0 60px rgba(232,98,26,0.35)" }}
            >
              <span className="font-display font-black text-6xl text-white">?</span>
            </div>
            {/* Rotating headline */}
            <h2 className="font-display font-black text-3xl text-white leading-tight max-w-[20ch]">
              {headline}
            </h2>
            {/* Subtext */}
            <p className="font-body text-sm text-[#8A7F78] text-center mt-3">
              What was missing?
            </p>
          </div>

          {/* ── Step 2: Diagnostic options ── */}
          <div className="flex flex-col gap-3 pb-8">
            {/* Option 1: Fresh deck (copy changes at reset 2) */}
            <button
              onClick={() => handleRefreshDeckWithVibe("quick-easy")}
              className="bg-[#2A2420] rounded-[18px] p-4 flex items-center gap-4 w-full cursor-pointer border border-transparent hover:border-[#E8621A]/40 transition-all duration-200"
            >
              <span className="text-2xl flex-shrink-0">😴</span>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-display font-black text-base text-white">{freshDeckLabel}</p>
                <p className="font-body text-xs text-[#8A7F78] mt-0.5">{freshDeckSubtext}</p>
              </div>
              <span className="text-[#8A7F78] text-lg flex-shrink-0">›</span>
            </button>

            {/* Option 2: Something exciting */}
            <button
              onClick={() => handleRefreshDeckWithVibe("something-new")}
              className="bg-[#2A2420] rounded-[18px] p-4 flex items-center gap-4 w-full cursor-pointer border border-transparent hover:border-[#E8621A]/40 transition-all duration-200"
            >
              <span className="text-2xl flex-shrink-0">🔥</span>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-display font-black text-base text-white">Nothing felt exciting enough</p>
                <p className="font-body text-xs text-[#8A7F78] mt-0.5">Surprise me with something different</p>
              </div>
              <span className="text-[#8A7F78] text-lg flex-shrink-0">›</span>
            </button>

            {/* Option 3: I couldn't decide → top 3 (no reset increment) */}
            <button
              onClick={() => setSoloExhaustedView("top3")}
              className="bg-[#2A2420] rounded-[18px] p-4 flex items-center gap-4 w-full cursor-pointer border border-transparent hover:border-[#E8621A]/40 transition-all duration-200"
            >
              <span className="text-2xl flex-shrink-0">🤔</span>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-display font-black text-base text-white">I couldn&apos;t decide</p>
                <p className="font-body text-xs text-[#8A7F78] mt-0.5">Show me my top 3 and I&apos;ll pick one</p>
              </div>
              <span className="text-[#8A7F78] text-lg flex-shrink-0">›</span>
            </button>

            {/* Option 4: Set a new mood */}
            <button
              onClick={() => setSoloExhaustedView("vibe-select")}
              className="bg-[#2A2420] rounded-[18px] p-4 flex items-center gap-4 w-full cursor-pointer border border-transparent hover:border-[#E8621A]/40 transition-all duration-200"
            >
              <span className="text-2xl flex-shrink-0">🎯</span>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-display font-black text-base text-white">Let me set a new mood</p>
                <p className="font-body text-xs text-[#8A7F78] mt-0.5">Choose a vibe and try again</p>
              </div>
              <span className="text-[#8A7F78] text-lg flex-shrink-0">›</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Deck screen ───────────────────────────────────────────────────────────
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1C1A18] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-24 right-[-60px] h-52 w-52 rounded-full bg-white/[0.04] blur-3xl" />
      </div>
      {soloLockMeal && (
        <SoloLockOverlay
          meal={soloLockMeal}
          onComplete={() => {
            setSoloLockMeal(null);
            router.push("/");
          }}
        />
      )}
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
                className="pointer-events-none absolute inset-x-0 top-0 h-64"
                style={{
                  background:
                    "radial-gradient(ellipse 100% 160px at 50% 0%, rgba(251,191,36,0.07) 0%, transparent 100%)",
                }}
              />
            )}
          </AnimatePresence>
        )}

        {/* Abandonment banner — non-blocking, shown only when partner has been quiet > 2h */}
        {sessionId && showAbandonmentBanner && (
          <div className="mx-5 mt-3 flex items-center gap-2 rounded-[12px] bg-[#2A2420] px-4 py-2.5">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#8A7F78]" />
            <p className="font-body text-xs text-[#8A7F78]">
              Still waiting on your partner. They have 24 hours to swipe.
            </p>
          </div>
        )}

        {/* 1. HEADER ROW */}
        <header className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            <p className="font-body text-sm text-[#8A7F78]">
              {sessionId ? "Deciding with your group" : "Decision Deck"}
            </p>
            <p className="font-body text-xs text-[#8A7F78]/60 mt-0.5">
              {Math.max(0, totalCount - currentIndex)} cards left
            </p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="text-[#8A7F78] font-body font-semibold text-sm px-4 py-1.5 rounded-full border border-white/10"
          >
            {isChangeMeal && existingMeal ? `Keep ${existingMeal.meal.name}` : "End"}
          </button>
        </header>

        {/* Pantry bar + Fresh Ideas — solo only */}
        {!sessionId && (
          <div className="px-5 mt-1 flex items-stretch gap-2">
            <motion.button
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
              className={`flex flex-1 items-center justify-between rounded-2xl border px-4 py-2.5 text-left transition-colors duration-200 ${
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
            </motion.button>

            {/* Fresh Ideas button — calls AI generation */}
            <motion.button
              onClick={() => void handleFreshIdeas()}
              disabled={aiMealsLoading}
              animate={aiMealsLoading ? { opacity: 0.5 } : { opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-xs text-white/35 transition-colors duration-200 hover:border-white/15 hover:text-white/55 active:scale-[0.97] disabled:pointer-events-none"
              title="Generate fresh meal ideas"
            >
              {aiMealsLoading ? (
                <span className="h-2.5 w-2.5 animate-spin rounded-full border border-white/30 border-t-white/70" />
              ) : (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M6.5 1v2M6.5 10v2M1 6.5h2M10 6.5h2M2.93 2.93l1.41 1.41M8.66 8.66l1.41 1.41M2.93 10.07l1.41-1.41M8.66 4.34l1.41-1.41" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              )}
              <span className="whitespace-nowrap">Fresh ideas</span>
            </motion.button>
          </div>
        )}

        {/* Swipe tip banner — first-time only */}
        {showSwipeTip && (
          <div className="mx-5 mb-3 bg-[#2A2420] rounded-[16px] px-5 py-4 flex items-center gap-4">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-7 h-7 rounded-full bg-[#2A2420] border border-white/10 flex items-center justify-center text-xs text-white/50">✕</div>
              <div className="w-7 h-7 rounded-full bg-[#E8621A] flex items-center justify-center text-xs text-white">✓</div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-black text-base text-white">Swipe right to say yes.</p>
              <p className="font-body text-sm text-[#8A7F78] mt-0.5">Left to pass. Or use the buttons below.</p>
            </div>
            <button
              onClick={dismissSwipeTip}
              className="text-[#E8621A] font-body font-semibold text-sm flex-shrink-0"
            >
              Got it
            </button>
          </div>
        )}

        {/* 3. BACK CARD + 2. SWIPE CARD */}
        <div className="relative mx-4 mt-2">

          {/* 3. Back card — depth effect, sits behind top card */}
          {nextMeal && (
            <motion.div
              animate={
                isExiting
                  ? { scale: 1, opacity: 1, y: 0 }
                  : { scale: 0.94, opacity: 0.5, y: -12 }
              }
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-0 rounded-[28px] bg-[#2A2420] pointer-events-none"
            />
          )}

          {/* 2. THE SWIPE CARD */}
          <motion.section
            style={{ x, rotate, aspectRatio: '3/4' } as React.CSSProperties & { x: typeof x; rotate: typeof rotate }}
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
            className="relative rounded-[28px] overflow-hidden w-full bg-[#2A2420] cursor-grab select-none touch-none z-10 shadow-[0_10px_40px_rgba(0,0,0,0.35)] active:cursor-grabbing"
          >
            {/* Layer 1 — Food image */}
            <img
              src={imgErrors.has(meal.id) || !meal.image ? FALLBACK_IMAGE : meal.image}
              alt={meal.name}
              draggable={false}
              onError={() => setImgErrors((prev) => new Set(prev).add(meal.id))}
              className="absolute inset-0 w-full h-full object-cover"
              style={imgErrors.has(meal.id) ? { filter: "brightness(0.88) saturate(0.6)" } : undefined}
            />

            {/* Layer 2 — Bottom scrim for text legibility */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)' }}
            />

            {/* Layer 3 — YES stamp (top right, shows when dragging right) */}
            <motion.div
              style={{ opacity: chooseOpacity }}
              className="absolute top-8 right-5 z-10 font-display font-black text-2xl text-[#4A7C59] border-4 border-[#4A7C59] rounded-xl px-3 py-1 rotate-12 pointer-events-none"
            >
              YES ✓
            </motion.div>

            {/* Layer 4 — NOPE stamp (top left, shows when dragging left) */}
            <motion.div
              style={{ opacity: passOpacity }}
              className="absolute top-8 left-5 z-10 font-display font-black text-2xl text-red-400 border-4 border-red-400 rounded-xl px-3 py-1 -rotate-12 pointer-events-none"
            >
              NOPE
            </motion.div>

            {/* Category + AI badge row (top of card) */}
            <div className="absolute top-0 left-0 right-0 p-4 z-10 flex items-start justify-between gap-2">
              <div className="inline-flex rounded-full border border-white/20 bg-black/30 px-3 py-1 text-xs text-white/75 backdrop-blur-sm">
                {meal.category}
              </div>
              {aiMealIds.has(meal.id) && (
                <div
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium backdrop-blur-sm ${
                    meal.aiLabel === "Made from your pantry"
                      ? "border-amber-400/30 bg-black/35 text-amber-300/80"
                      : "border-white/20 bg-black/35 text-white/60"
                  }`}
                >
                  {meal.aiLabel === "Made from your pantry" ? (
                    <span style={{ filter: "drop-shadow(0 0 3px rgba(251,191,36,0.5))" }}>✦</span>
                  ) : (
                    <span className="text-white/40">✦</span>
                  )}
                  {meal.aiLabel ?? "Fresh pick"}
                </div>
              )}
            </div>

            {/* Layer 5 — Card content (bottom of card) */}
            <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
              <h2 className="font-display font-black text-3xl text-white leading-tight">
                {meal.name}
              </h2>
              <p className="font-body text-sm text-white/80 mt-2 leading-relaxed line-clamp-2">
                {meal.description}
              </p>
              <div className="flex gap-2 mt-4 flex-wrap">
                {meal.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-white/10 text-white/80 font-body text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              {pantryMode && pantryMatchCount >= 2 && (
                <p className="text-xs text-white/60 mt-2">
                  {pantryMatchCount >= 3 ? "You've got this" : "You've got most of this"}
                </p>
              )}
              {reason && (
                <p className="text-xs text-white/60 mt-1">✦ {reason}</p>
              )}
            </div>

            {/* Swipe hint — fades in after a short delay, dismissed on first interaction */}
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
                  <div className="flex items-center gap-2.5 bg-[#2A2420] rounded-full px-5 py-2.5">
                    <span className="text-xs text-rose-400/75">← Swipe to pass</span>
                    <span className="text-[10px] text-white/25">·</span>
                    <span className="text-xs text-emerald-400/75">Swipe to choose →</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Choose glow — flashes briefly when a meal is confirmed */}
            <AnimatePresence>
              {isChoosing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="pointer-events-none absolute inset-0 z-30 rounded-[28px]"
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

        {/* 4. ACTION BUTTONS */}
        <div className="flex items-center justify-center gap-6 mt-5 pb-6">
          {/* NO button */}
          <button
            onClick={handlePass}
            disabled={isExiting || isChoosing}
            className="w-14 h-14 rounded-full bg-[#2A2420] border border-white/10 flex items-center justify-center text-2xl text-white/50 active:scale-90 transition-transform duration-150 disabled:opacity-40"
          >
            ✕
          </button>

          {/* YES button */}
          <button
            onClick={handleChoose}
            disabled={isExiting || isChoosing}
            className="w-20 h-20 rounded-full bg-[#E8621A] flex items-center justify-center text-3xl text-white active:scale-90 transition-transform duration-150 disabled:opacity-40"
            style={{ boxShadow: '0 0 40px rgba(232,98,26,0.35)' }}
          >
            ✓
          </button>

          {/* SAVE button */}
          <button
            onClick={handleSave}
            disabled={isExiting || isChoosing}
            className="w-14 h-14 rounded-full bg-[#4A7C59] flex items-center justify-center text-xl text-white active:scale-90 transition-transform duration-150 disabled:opacity-40"
            style={{ boxShadow: '0 0 24px rgba(74,124,89,0.3)' }}
          >
            ⭐
          </button>
        </div>

        {/* Just decide — shared sessions only */}
        {sessionId && (
          <div className="flex justify-center -mt-2 pb-4">
            <button
              onClick={() => void handleJustDecide()}
              disabled={isExiting || isChoosing || rankedMeals.length === 0}
              className="text-[13px] text-white/25 transition hover:text-white/50 disabled:opacity-0"
            >
              Just decide for us
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
            className="fixed inset-0 z-50 bg-[#1C1A18] overflow-y-auto"
          >
            <motion.div
              initial={{ y: 72, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 72, opacity: 0 }}
              transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
              className="relative flex flex-col items-center justify-start min-h-screen px-6 pt-16 pb-10"
            >
              {/* Radial green glow */}
              <div
                className="absolute inset-0 pointer-events-none z-0"
                style={{ background: "radial-gradient(ellipse at 50% 25%, rgba(74,124,89,0.18) 0%, transparent 60%)" }}
              />

              <div className="relative z-10 flex flex-col items-center w-full">
                {/* 1. Green pulsing circle */}
                <div className="flex items-center justify-center">
                  <div
                    className="w-28 h-28 rounded-full bg-[#4A7C59] flex items-center justify-center animate-pulse-soft"
                    style={{ boxShadow: "0 0 60px rgba(74,124,89,0.45)" }}
                  >
                    <span className="font-display font-black text-5xl text-white">✓</span>
                  </div>
                </div>

                {/* 2. Eyebrow label */}
                <p className="text-[#4A7C59] text-[11px] font-semibold tracking-widest uppercase mt-6">
                  IT&apos;S A MATCH.
                </p>

                {/* 3. Main headline */}
                <h1 className="font-display font-black text-4xl text-white text-center mt-2 leading-tight">
                  Dinner is decided.
                </h1>

                {/* 4. Meal name in green */}
                <p className="font-display font-bold text-2xl text-[#4A7C59] text-center mt-1">
                  {matchedMeal.name}
                </p>

                {/* 5. Meal image card */}
                <div
                  className="w-full rounded-[20px] overflow-hidden mt-6 bg-[#2A2420]"
                  style={{ aspectRatio: "16/9" }}
                >
                  <img
                    src={matchedMeal.image}
                    alt={matchedMeal.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* 6. Meal name + description */}
                <div className="w-full mt-4 text-center">
                  <p className="font-display font-black text-xl text-white">{matchedMeal.name}</p>
                  <p className="font-body text-sm text-white/70 mt-1 leading-relaxed">{matchedMeal.description}</p>
                </div>

                {/* 7. Why this works card */}
                {rankedMeals.find((r) => r.meal.id === matchedMeal.id)?.reason && (
                  <div className="w-full bg-[#2A2420] rounded-[18px] p-4 mt-4 flex items-start gap-3">
                    <span className="text-xl flex-shrink-0 mt-0.5">💡</span>
                    <p className="font-body text-sm text-white/75 leading-relaxed">
                      <span className="font-display font-black text-sm text-[#E8621A]">Why this works: </span>
                      {rankedMeals.find((r) => r.meal.id === matchedMeal.id)?.reason}
                    </p>
                  </div>
                )}

                {/* 8. CTA buttons */}
                <div className="flex gap-3 w-full mt-6">
                  <button
                    onClick={() => setShowCookOrderModal(true)}
                    className="flex-1 py-4 rounded-[16px] bg-[#E8621A] text-white font-display font-black text-base"
                    style={{ boxShadow: "0 0 30px rgba(232,98,26,0.3)" }}
                  >
                    Let&apos;s eat 🙌
                  </button>
                  <button
                    onClick={() => sessionId ? void handleMatchConfirm() : router.push("/")}
                    disabled={matchConfirming}
                    className="flex-1 py-4 rounded-[16px] bg-[#2A2420] text-white font-display font-black text-base text-center disabled:opacity-60"
                  >
                    {matchConfirming ? "Locking in…" : "Back to home"}
                  </button>
                </div>
                {matchConfirmError && (
                  <p className="text-center text-sm text-red-400 mt-3">{matchConfirmError}</p>
                )}

                {/* 9. Footer — other matches count (solo only) */}
                {!sessionId && rejectedMatchIdsRef.current.size > 0 && (
                  <p className="text-center mt-4">
                    <span className="font-body text-sm text-[#8A7F78]">
                      {rejectedMatchIdsRef.current.size} other {rejectedMatchIdsRef.current.size === 1 ? "match" : "matches"} waiting.{" "}
                    </span>
                    <button onClick={handleMatchReject} className="text-[#E8621A] font-semibold text-sm">
                      See them →
                    </button>
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Progressive onboarding nudge ────────────────────────────────────── */}
      <ProgressiveQuestion nudge={activeNudge} onAnswer={handleNudgeAnswer} />

      {/* ── Learning confirmation toast ──────────────────────────────────────── */}
      <LearningToast message={toastMessage} onDone={() => setToastMessage(null)} />

      {/* ── Rejection-reason capture sheet ──────────────────────────────────── */}
      <RejectionReasonSheet
        visible={showRejectionSheet}
        onSelect={handleRejectionSelect}
        onDismiss={handleRejectionDismiss}
      />

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
              {(() => {
                const { tier1, tier2, tier3 } = pantryIngredientTiers;
                const hasTierData = tier1.length > 0 || tier2.length > 0;

                // New user or no history: fall back to default category grouping
                if (!hasTierData) {
                  return Object.entries(PANTRY_INGREDIENTS).map(([category, items]) => (
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
                  ));
                }

                // Returning user: render tier1 → separator → tier2 → separator → tier3
                const renderChips = (items: string[]) => (
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
                );

                return (
                  <>
                    {tier1.length > 0 && renderChips(tier1)}
                    {tier1.length > 0 && (tier2.length > 0 || tier3.length > 0) && (
                      <div className="border-t border-white/[0.06]" />
                    )}
                    {tier2.length > 0 && renderChips(tier2)}
                    {tier2.length > 0 && tier3.length > 0 && (
                      <div className="border-t border-white/[0.06]" />
                    )}
                    {tier3.length > 0 && renderChips([...tier3].sort())}
                  </>
                );
              })()}
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

      {/* Cook vs Order modal — shared match */}
      {showCookOrderModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowCookOrderModal(false)}
          />
          <div className="relative w-full bg-[#2A2420] rounded-t-[28px] px-6 pt-6 pb-10">
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
            <p className="font-display font-black text-2xl text-white text-center">
              How are you eating?
            </p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => { setShowCookOrderModal(false); void handleMatchConfirm(); }}
                disabled={matchConfirming}
                className="bg-[#1C1A18] rounded-[20px] p-5 flex flex-col items-center gap-3 cursor-pointer border border-transparent hover:border-[#E8621A]/40 disabled:opacity-60"
              >
                <span className="text-4xl">🍳</span>
                <p className="font-display font-black text-lg text-white">Cook it</p>
                <p className="font-body text-xs text-[#8A7F78] text-center mt-1">See what you need</p>
              </button>
              <button
                onClick={() => { setShowCookOrderModal(false); void handleMatchConfirm(); }}
                disabled={matchConfirming}
                className="bg-[#1C1A18] rounded-[20px] p-5 flex flex-col items-center gap-3 cursor-pointer border border-transparent hover:border-[#E8621A]/40 disabled:opacity-60"
              >
                <span className="text-4xl">🚗</span>
                <p className="font-display font-black text-lg text-white">Order in</p>
                <p className="font-body text-xs text-[#8A7F78] text-center mt-1">Find delivery options</p>
              </button>
            </div>
            {matchConfirmError && (
              <p className="text-center text-sm text-red-400 mt-4">{matchConfirmError}</p>
            )}
          </div>
        </div>
      )}
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
