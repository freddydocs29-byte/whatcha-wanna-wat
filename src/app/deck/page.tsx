"use client";

import { useRef, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useMotionValue, useTransform, AnimatePresence, useReducedMotion } from "framer-motion";
import { meals, type Meal } from "../data/meals";
import { saveMeal, addToHistory, getPreferences, savePreferences, getSavedMeals, getHistory, getTasteProfile, updateTasteProfile, getRecentlySeenIds, recordSeenSession, getFlavorProfile, getFavorites, getTodaysPick, getNoveltyBias, saveDecidedMeal, type UserPreferences, type HistoryEntry } from "../lib/storage";
import { rankMeals, hardGate, allergenGate, getAllHardNos, getSharedReason, getTimeBucket, type RejectionEntry, type RankedMeal, type SessionCookMode, type SessionVibeMode } from "../lib/scoring";
import { fetchAIMeals } from "../lib/ai-meals";
import { shouldGenerateAI, type AIMealTriggerReason } from "../lib/ai-freshness";
import { supabase } from "../lib/supabase";
import { getUserId, getKnownUserIds } from "../lib/identity";
import { checkAndTriggerCouplesTypeReveal } from "../lib/type-reveal-trigger";
import { getAvoidSignals, getPreferSignals, checkTriggers, checkCrossSessionNudge, type NudgeTrigger, type NudgeCandidate } from "../lib/session-signals";
import { ProgressiveQuestion } from "../components/ProgressiveQuestion";
import { LearningToast } from "../components/LearningToast";
import { trackEvent, writeSessionCategoryPasses } from "../lib/analytics";
import { EVENT_SESSION_STARTED, EVENT_WATCHAS_CALL_TRIGGERED, EVENT_DECISION_LOCKED, EVENT_SHARED_SESSION_ABANDONED, EVENT_GUEST_LIMIT_REACHED, EVENT_MEAL_SAVED } from "../lib/analytics-events";
import { createTrackingSession, closeTrackingSession, recordDecision, recordAcceptedDecision, checkAndMarkReturn, inferSessionContext } from "../lib/session-tracking";
import { RejectionReasonSheet, type RejectionReason } from "../components/RejectionReasonSheet";
import SoloLockOverlay from "../components/SoloLockOverlay";
import { fetchSoftAvoids, upsertSoftAvoids, syncBehavioralSignalsToSupabase, upsertPantryIngredientCounts } from "../lib/supabase-profile";
import { getPantryIngredientOrder, type PantryIngredientTiers } from "../lib/pantry";
import { type SoftAvoid } from "../lib/supabase";
import { detectRituals, getRitualLabel, isRitualSuppressed, recordRitualRejection, type RitualDetection } from "../lib/rituals";
import { SessionTerminalScreen } from "../../components/SessionTerminalScreen";
import { MealDetailDrawer } from "../components/MealDetailDrawer";
import GuestLimitPrompt from "../components/GuestLimitPrompt";
import { guestDeckBudgetExhausted, tryConsumeGuestDeckBudget, tryConsumeGuestDeckBudgetNoGrant, consumeGuestDeckEntryGrant, getGuestAttempts } from "../lib/guestLimit";
import WatchasCall from "../components/WatchasCall";
import { WatchaCallDetailsDrawer } from "../components/WatchaCallDetailsDrawer";
import { MealImageFallback } from "../components/MealImageFallback";

const SWIPE_THRESHOLD = 100;
const MIN_DECK_SIZE = 8;
const DECK_SIZE = 12;
const VALID_VIBE_MODES: SessionVibeMode[] = ["mix-it-up", "comfort-food", "quick-easy", "healthy", "something-new"];

function getDeckProgressCopy(currentIndex: number, totalCount: number): string {
  const position = currentIndex + 1;

  if (position >= totalCount) return "Last pick";

  const progress = position / Math.max(totalCount, 1);

  if (progress < 0.35) return "Top pick for tonight";
  if (progress < 0.7) return "Still a great match";
  return "Another solid option";
}

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

// Solo-specific Watcha's Call reveal copy — NOT shared with the shared (partner) flow.
// Shared flow uses NO_MATCH_COPY in WatchasCall.tsx; this array must never be merged with it.
const SOLO_NO_MATCH_COPY = [
  { headline: "Nothing landed.", sub: "Happens to the best of us. We kept watching." },
  { headline: "No clear winner tonight.", sub: "You\u2019ve seen it all. We\u2019ve seen what you lingered on." },
  { headline: "You swiped everything.", sub: "So we did what we do." },
  { headline: "Indecision: 1. You: also 1.", sub: "It\u2019s fine. That\u2019s what we\u2019re here for." },
  { headline: "Clean sweep, no match.", sub: "We were paying attention the whole time." },
] as const;

// Rotating copy for the shared waiting screen (shown while partner hasn't finished swiping)
const WAITING_HEADLINES = [
  "Your picks are in. Waiting on them.",
  "The ball is in their court.",
  "They're still deciding. Hang tight.",
  "Almost there. Probably.",
  "Good things take two people.",
];

// ── Solo Watcha's Call algorithm ──────────────────────────────────────────────
// Variables used: rankedMeals (ordered pool), savedFeedback (★'d meals), currentIndex (cards seen)
// Tier A: highest-ranked meal the user saved (liked) this session
// Tier B: highest-ranked seen meal not saved (neutral — saw it, neither loved nor chose it)
// Tier C: top of tonight's deck regardless of swipe
function computeSoloWCE(
  rankedMeals: RankedMeal[],
  savedFeedback: Set<string>,
  currentIndex: number,
): { meal: Meal; tier: "A" | "B" | "C" } | null {
  if (rankedMeals.length === 0) return null;
  // Tier A: saved (liked) meals, highest-ranked first
  for (const { meal } of rankedMeals) {
    if (savedFeedback.has(meal.id)) return { meal, tier: "A" };
  }
  // Tier B: seen but not saved (neutral)
  const seenCount = Math.min(currentIndex, rankedMeals.length);
  for (let i = 0; i < seenCount; i++) {
    const { meal } = rankedMeals[i];
    if (!savedFeedback.has(meal.id)) return { meal, tier: "B" };
  }
  // Tier C: top of deck regardless
  return { meal: rankedMeals[0].meal, tier: "C" };
}

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

  const eligibleMeals = allergenGate(hardGate(meals, getAllHardNos(prefs)), prefs?.allergens ?? []);
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
    () => typeof window !== "undefined" && !localStorage.getItem("swipe_tutorial_seen")
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMeal, setDrawerMeal] = useState<Meal | null>(null);
  const [drawerHintSeen, setDrawerHintSeen] = useState(
    () => typeof window !== "undefined" && !!localStorage.getItem("wwe_drawer_hint_seen")
  );
  const [isGuest, setIsGuest] = useState(false);
  const [showGuestLimit, setShowGuestLimit] = useState(false);
  // ── Solo exhausted diagnostic state ────────────────────────────────────────
  const [soloExhaustedView, setSoloExhaustedView] = useState<"main" | "top3" | "vibe-select">("main");
  const [diagSelectedVibe, setDiagSelectedVibe] = useState<SessionVibeMode>("mix-it-up");
  // Solo reset progression — synced from sessionStorage on mount
  const [soloResetCount, setSoloResetCount] = useState(0);
  // ── Solo Watcha's Call state (isolated — never touches shared session flow) ─
  const [soloWatchaCallView, setSoloWatchaCallView] = useState<"reveal" | "main" | "locked" | "exit" | null>(null);
  const [soloWatchaCallMeal, setSoloWatchaCallMeal] = useState<Meal | null>(null);
  const [soloWatchaCallTier, setSoloWatchaCallTier] = useState<"A" | "B" | "C" | null>(null);
  // Details drawer — isolated; never touches lock/exit/reveal state
  const [watchaCallDetailsOpen, setWatchaCallDetailsOpen] = useState(false);
  const [soloWCRevealStage, setSoloWCRevealStage] = useState(0);
  // Picked once per component instance — stable across re-renders
  // Picked once per reveal instance in the trigger effect below; initial value is a stable placeholder.
  const soloWCRevealCopyRef = useRef<typeof SOLO_NO_MATCH_COPY[number]>(SOLO_NO_MATCH_COPY[0]);
  const soloWCTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Partner's user ID — set once bothDone detection resolves
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null);
  // Partner's display name (fetched from profiles once partnerUserId is known)
  const [partnerName, setPartnerName] = useState<string>("");
  // Avatar URLs for Watcha's Call overlap avatars
  const [myDisplayName, setMyDisplayName] = useState<string>("");
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [partnerAvatarUrl, setPartnerAvatarUrl] = useState<string | null>(null);
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
  const [waitingHeadlineIdx, setWaitingHeadlineIdx] = useState(0);
  // Set when the poll detects status:"abandoned" — partner left during Step 2 wait
  const [partnerSteppedAway, setPartnerSteppedAway] = useState(false);
  const partnerSteppedAwayRef = useRef(false);
  // Guard: once both users have finished swiping with no match, suppress the normal
  // match modal — WatchasCall handles detection and routing from this point.
  const tiebreakActiveRef = useRef(false);
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

  // Migrate legacy swipe hint keys to canonical swipe_tutorial_seen.
  // Runs once on deck mount — not in render. Existing users who already dismissed
  // any prior hint will never see the tutorial again.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const oldHint = localStorage.getItem("wwe_swipe_hint_seen");
    const oldTip = localStorage.getItem("watcha_swipe_tip_seen");
    const oldCanonical = localStorage.getItem("wwe_swipe_tutorial_seen");
    if (oldHint || oldTip || oldCanonical) {
      localStorage.setItem("swipe_tutorial_seen", "true");
      localStorage.removeItem("wwe_swipe_hint_seen");
      localStorage.removeItem("watcha_swipe_tip_seen");
      localStorage.removeItem("wwe_swipe_tutorial_seen");
      setShowSwipeHint(false);
    }
  }, []);

  // Detect guest state (no Supabase auth session) for post-match routing.
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsGuest(!user);
    });
  }, []);

  // Guest budget mount gate — blocks rogue /deck navigations when budget is exhausted.
  // consumeGuestDeckEntryGrant() reads and clears the one-time grant written by
  // tryConsumeGuestDeckBudget(), so a legitimately-allowed deck is never blocked.
  useEffect(() => {
    if (!isGuest) return;
    if (guestDeckBudgetExhausted()) {
      const hasEntryGrant = consumeGuestDeckEntryGrant();
      if (!hasEntryGrant) {
        setShowGuestLimit(true);
        trackEvent(EVENT_GUEST_LIMIT_REACHED, {
          attempts_used: getGuestAttempts(),
          trigger_source: "splash",
        });
      }
    }
  }, [isGuest]);

  // Mount guard: if user already completed this shared session, skip straight to exhausted UI
  useEffect(() => {
    if (!sessionId || typeof window === 'undefined') return;
    if (localStorage.getItem(`wwe_session_swiping_done_${sessionId}`) === 'true') {
      setBypassToExhausted(true);
      setSharedLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync solo reset counter from sessionStorage on mount
  useEffect(() => {
    setSoloResetCount(parseInt(sessionStorage.getItem(SOLO_RESET_SS_KEY) ?? "0", 10) || 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize Solo Watcha's Call when deck exhausts on 2nd+ run (soloResetCount >= 1)
  // Uses: rankedMeals (ordered pool), savedFeedback (★'d meals), currentIndex (cards seen)
  useEffect(() => {
    if (sessionId || soloResetCount < 1 || soloResetCount >= 3) return;
    if (soloWatchaCallView !== null) return; // already initialized
    const totalCount = Math.min(rankedMeals.length, DECK_SIZE);
    if (rankedMeals.length === 0 || (!bypassToExhausted && currentIndex < totalCount)) return;
    const result = computeSoloWCE(rankedMeals, savedFeedback, currentIndex);
    if (!result) return;
    setSoloWatchaCallMeal(result.meal);
    setSoloWatchaCallTier(result.tier);
    // Pick a fresh variant for this reveal instance (stable for the rest of the reveal).
    soloWCRevealCopyRef.current = SOLO_NO_MATCH_COPY[Math.floor(Math.random() * SOLO_NO_MATCH_COPY.length)];
    setSoloWatchaCallView("reveal");
    const wcDedupKey = "wwe_analytics_watchas_call_solo";
    if (!sessionStorage.getItem(wcDedupKey)) {
      trackEvent(EVENT_WATCHAS_CALL_TRIGGERED, { sessionMode: "solo", tier: result.tier ?? undefined });
      sessionStorage.setItem(wcDedupKey, "1");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, soloResetCount, soloWatchaCallView, currentIndex, bypassToExhausted, rankedMeals.length]);

  // Solo Watcha's Call reveal animation timing
  useEffect(() => {
    if (soloWatchaCallView !== "reveal") return;
    setSoloWCRevealStage(0);
    const t1 = setTimeout(() => setSoloWCRevealStage(1), 120);
    const t2 = setTimeout(() => setSoloWCRevealStage(2), 1500);
    const t3 = setTimeout(() => setSoloWatchaCallView("main"), 3500);
    soloWCTimersRef.current = [t1, t2, t3];
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      soloWCTimersRef.current = [];
    };
  }, [soloWatchaCallView]);

  // Fetch partner display name + avatar once their user ID is known
  useEffect(() => {
    if (!partnerUserId) return;
    void supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", partnerUserId)
      .single()
      .then(({ data }) => {
        if (data?.display_name) setPartnerName(data.display_name as string);
        if (data?.avatar_url) setPartnerAvatarUrl(data.avatar_url as string);
      });
  }, [partnerUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch current user's display name + avatar for Watcha's Call overlap
  useEffect(() => {
    if (!userId) return;
    void supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (data?.display_name) setMyDisplayName(data.display_name as string);
        if (data?.avatar_url) setMyAvatarUrl(data.avatar_url as string);
      });
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // §2: 60-second timeout — if partner hasn't finished by then, auto-advance
  useEffect(() => {
    const exhausted = bypassToExhausted || currentIndex >= Math.min(rankedMeals.length, DECK_SIZE);
    if (!sessionId || !exhausted || bothDone) return;
    const timer = setTimeout(() => setBothDone(true), 60_000);
    return () => clearTimeout(timer);
  }, [sessionId, bypassToExhausted, currentIndex, rankedMeals.length, bothDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // §2c: When the partner's leave signal is detected, show a brief transition
  // message for 2.5 s then advance into Watcha's Call.
  useEffect(() => {
    if (!partnerSteppedAway) return;
    const timer = setTimeout(() => setBothDone(true), 2500);
    return () => clearTimeout(timer);
  }, [partnerSteppedAway]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cycle the waiting headline every 3 s while the partner hasn't finished yet.
  useEffect(() => {
    const exhausted = bypassToExhausted || currentIndex >= Math.min(rankedMeals.length, DECK_SIZE);
    if (!sessionId || !exhausted || bothDone) return;
    const interval = setInterval(() => {
      setWaitingHeadlineIdx((i) => (i + 1) % WAITING_HEADLINES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [sessionId, bypassToExhausted, currentIndex, rankedMeals.length, bothDone]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Restore shared deck position after the deck loads (shared mode only, runs once).
  useEffect(() => {
    if (!sessionId || rankedMeals.length === 0 || bypassToExhausted || deckIndexRestoredRef.current) return;
    deckIndexRestoredRef.current = true;
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(`wwe_shared_deck_index_${sessionId}`);
    if (!stored) return;
    const parsed = parseInt(stored, 10);
    const limit = Math.min(rankedMeals.length, DECK_SIZE);
    if (!isNaN(parsed) && parsed > 0 && parsed < limit) {
      setCurrentIndex(parsed);
    } else {
      localStorage.removeItem(`wwe_shared_deck_index_${sessionId}`);
    }
  }, [sessionId, rankedMeals.length, bypassToExhausted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist shared deck position to localStorage (shared mode only).
  // Only writes when sessionId exists and deck is loaded; skips if already done.
  // Removes the key when at index 0 to avoid stale zero entries.
  useEffect(() => {
    if (!sessionId || rankedMeals.length === 0) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(`wwe_session_swiping_done_${sessionId}`) === 'true') return;
    if (currentIndex === 0) {
      localStorage.removeItem(`wwe_shared_deck_index_${sessionId}`);
    } else {
      localStorage.setItem(`wwe_shared_deck_index_${sessionId}`, String(currentIndex));
    }
  }, [currentIndex, sessionId, rankedMeals.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
        .select("deck_meal_ids, vibe, session_code, expires_at, status")
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
      const sessionData = data as { deck_meal_ids?: string[]; vibe?: string; session_code?: string | null; expires_at?: string; status?: string } | null;
      const dbVibe = sessionData?.vibe ?? null;

      // Self-healing wwe_active_session write — ensures the home resume banner
      // can surface for any shared-session participant (guest or host) who
      // navigates away mid-swipe, even if the pointer was never written or was
      // cleared by an expiry/match removeItem call earlier in the session.
      // Overwrites only when the pointer is missing, expired, malformed, or
      // pointing to a different sessionId. Leaves a valid same-session pointer alone.
      if (typeof window !== 'undefined' && sessionId && sessionData) {
        let shouldWrite = true

        const existingRaw = localStorage.getItem('wwe_active_session')
        if (existingRaw) {
          try {
            const existing = JSON.parse(existingRaw)
            const expiresAt = existing?.expiresAt
              ? new Date(existing.expiresAt).getTime()
              : 0
            const isSameSession = existing?.sessionId === sessionId
            const isNotExpired = expiresAt > Date.now()
            shouldWrite = !(isSameSession && isNotExpired)
          } catch {
            shouldWrite = true
          }
        }

        if (shouldWrite) {
          localStorage.setItem('wwe_active_session', JSON.stringify({
            sessionId,
            sessionCode: sessionData.session_code ?? null,
            expiresAt: sessionData.expires_at,
            status: sessionData.status ?? 'swiping',
            vibe: sessionData.vibe ?? 'mix-it-up',
          }))
        }
      }

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
          sessionType: "shared",
          vibe: sessionVibeMode,
        });
        void trackingSessionPromiseRef.current.then((tsId) => {
          if (tsId) trackEvent(EVENT_SESSION_STARTED, { sessionMode: "shared", isGuest, vibe: sessionVibeMode ?? undefined });
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
      if (partnerSteppedAwayRef.current) return; // bridge showing, timer pending

      const { data: sessionData } = await supabase
        .from("sessions")
        .select("host_user_id, guest_user_id, status")
        .eq("id", sessionId)
        .single();

      if (!mounted || !sessionData) return;

      const otherUserId =
        userId === sessionData.host_user_id
          ? sessionData.guest_user_id
          : sessionData.host_user_id;

      if (!otherUserId) return;

      // Persist partner ID so WatchasCall can query their swipes
      if (mounted) setPartnerUserId(otherUserId);

      // Partner left during Step 2 — show bridge then advance to Watcha's Call
      if (sessionData.status === "abandoned") {
        partnerSteppedAwayRef.current = true;
        tiebreakActiveRef.current = true;
        if (mounted) setPartnerSteppedAway(true);
        return;
      }

      const { count } = await supabase
        .from("swipes")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("user_id", otherUserId);

      if (mounted && (count ?? 0) >= totalDeckSize) {
        tiebreakActiveRef.current = true;
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
          localStorage.removeItem(`wwe_shared_deck_index_${sessionId}`);
        }
        setSessionExpired(true);
        return;
      }

      // Match already confirmed by the other user — show the match screen so
      // both participants see the celebration before routing. saveDecidedMeal
      // and navigation are handled by handleMatchConfirm() after the user taps
      // "Let's eat", keeping host and non-host paths identical.
      // When tiebreakActiveRef is true, WatchasCall manages lock detection itself.
      if (sessionData?.status === "matched") {
        if (tiebreakActiveRef.current) return; // WatchasCall handles this
        if (sessionData.locked_meal_id && !matchedMealRef.current) {
          const found = meals.find((m) => m.id === sessionData.locked_meal_id);
          if (found) {
            matchPendingAdvanceRef.current = false;
            setMatchedMeal(found);
          }
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
        if (tiebreakActiveRef.current) break; // WatchasCall handles post-exhaustion lock
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
  const [savedFeedback, setSavedFeedback] = useState<Set<string>>(new Set());

  // ── Ritual detection refs ─────────────────────────────────────────────────
  // Stores the ritual result once detectRituals() completes (async on mount).
  const ritualDetectionRef = useRef<RitualDetection | null>(null);
  // Tracks whether position 0 in the current deck is a proactively surfaced ritual.
  // Used to record rejections correctly in handlePass.
  const isRitualPosition0Ref = useRef(false);
  // Mirror of currentIndex as a ref so async ritual callbacks can read it without
  // stale closure issues.
  const currentIndexRef = useRef(0);
  // Guard: shared deck position restore runs only once per deck lifetime.
  const deckIndexRestoredRef = useRef(false);

  // Track the last meal id we fired card_seen for so we don't double-fire.
  const lastSeenMealIdRef = useRef<string | null>(null);

  // Pantry analytics: tracks whether a meal was accepted during a pantry session
  // so the cleanup effect can distinguish acceptance vs. abandon.
  const pantryMealAcceptedRef = useRef(false);
  // Refs that mirror pantry state so the unmount cleanup effect can read
  // current values without a stale closure (effects with [] deps capture at mount).
  const pantryModeRef = useRef(pantryMode);
  const selectedIngredientsRef = useRef(selectedIngredients);
  const preserveCurrentIndexRef = useRef(false);

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
      const gated = allergenGate(hardGate([ritualMealObj], getAllHardNos(currentPrefs)), currentPrefs?.allergens ?? []);
      if (gated.length === 0) {
        if (process.env.NODE_ENV === "development") {
          console.log(`[rituals] skipped ${matching.mealId} — fails current hard gate or allergen gate`);
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
          trackingSessionPromiseRef.current = createTrackingSession({ isGroupSession: false, sessionType: "solo", vibe: sessionVibeMode });
          void trackingSessionPromiseRef.current.then((tsId) => {
            if (tsId) trackEvent(EVENT_SESSION_STARTED, { sessionMode: "solo", isGuest, vibe: sessionVibeMode ?? undefined });
          });
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
    if (!preserveCurrentIndexRef.current) {
      setCurrentIndex(0);
    }
    preserveCurrentIndexRef.current = false;
    x.set(0);
    setExitX(null);

    // Start tracking session on first deck build (guard prevents re-fire on
    // pantry/vibe changes which also run this effect)
    if (!trackingSessionPromiseRef.current) {
      trackingOpenedAtRef.current = new Date();
      trackingSessionPromiseRef.current = createTrackingSession({ isGroupSession: false, sessionType: "solo", vibe: sessionVibeMode });
      void trackingSessionPromiseRef.current.then((tsId) => {
        if (tsId) trackEvent(EVENT_SESSION_STARTED, { sessionMode: "solo", isGuest, vibe: sessionVibeMode ?? undefined });
      });
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
    localStorage.setItem("swipe_tutorial_seen", "true");
    setShowSwipeHint(false);
  }

  function dismissDrawerHint() {
    if (drawerHintSeen) return;
    localStorage.setItem("wwe_drawer_hint_seen", "1");
    setDrawerHintSeen(true);
  }

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const passOpacity = useTransform(x, [-SWIPE_THRESHOLD, -30], [1, 0]);
  const chooseOpacity = useTransform(x, [30, SWIPE_THRESHOLD], [0, 1]);
  const prefersReducedMotion = useReducedMotion() ?? false;

  const current = rankedMeals[currentIndex];
  const meal = current?.meal;
  const reason = current?.reason ?? "";
  const pantryMatchCount = current?.pantryMatchCount ?? 0;
  const nextMeal = rankedMeals[currentIndex + 1]?.meal;
  const isExiting = exitX !== null;
  // Recommendation Card: only the original deck index 0 gets this treatment.
  // currentIndex IS the original deck position (it only increments, never resets mid-deck).
  const isRecommendationCard = currentIndex === 0;
  const recVoiceLine = sessionId ? "You'll both want this" : "Tonight, we recommend";
  const recCuisineTime = meal
    ? [meal.cuisine, meal.tags.find((t) => t.toLowerCase().includes("min"))].filter(Boolean).join(" · ")
    : "";

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
    preserveCurrentIndexRef.current = true;
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

    // Fetch session created_at for time-to-match calculation, and host/guest IDs
    // for the couples-reveal trigger that fires immediately after RPC success.
    const { data: matchedSessionData } = await supabase
      .from("sessions")
      .select("created_at, host_user_id, guest_user_id")
      .eq("id", sessionId)
      .single();

    const matchSessionStart = matchedSessionData?.created_at ?? null;
    const matchTimeToMatchSeconds = matchSessionStart
      ? Math.max(0, Math.round((Date.now() - new Date(matchSessionStart).getTime()) / 1000))
      : null;

    const now = new Date();
    const { mealPeriod, dayType } = inferSessionContext(now);

    // Single RPC: updates session status, writes both users' decision rows,
    // and upserts the partner relationship atomically.
    const { error } = await supabase.rpc("record_shared_match_decision", {
      p_session_id: sessionId,
      p_meal_id: matchedMeal.id,
      p_meal_name: matchedMeal.name,
      p_meal_period: mealPeriod,
      p_day_type: dayType,
      p_is_ai_generated: aiMealIds.has(matchedMeal.id),
      p_cuisine_tag: matchedMeal.cuisine ?? null,
      p_archetype: matchedMeal.category ?? null,
      p_vibe_selection: sessionVibeMode ?? null,
      p_time_to_match_seconds: matchTimeToMatchSeconds,
    });

    if (error) {
      console.error("[match] record_shared_match_decision failed:", error.message);
      setMatchConfirmError("We found the match, but couldn't lock it in. Try again.");
      setMatchConfirming(false);
      return;
    }

    console.log("[match] shared match decision recorded:", sessionId, matchedMeal.id);

    const _dlKey = `wwe_analytics_decision_locked_${sessionId}_${matchedMeal.id}`;
    if (!sessionStorage.getItem(_dlKey)) {
      trackEvent(EVENT_DECISION_LOCKED, { mealId: matchedMeal.id, sessionMode: "shared", resolutionPath: "swipe_match", sessionId: sessionId ?? undefined });
      sessionStorage.setItem(_dlKey, "1");
    }

    // Guard: prevent the home-screen polling loop from writing a duplicate
    // decision row for the current user (the RPC already wrote both rows).
    if (typeof window !== "undefined") {
      localStorage.setItem(`wwe_decision_written_${sessionId}_${matchedMeal.id}`, "1");
    }

    // Close the tracking session — no need to call recordDecision, RPC handled it.
    trackingClosedRef.current = true;
    trackingSessionPromiseRef.current?.then((tsId) => {
      if (tsId && trackingOpenedAtRef.current) {
        void closeTrackingSession({
          trackingSessionId: tsId,
          resolved: true,
          swipeCount: trackingSwipeCountRef.current,
          openedAt: trackingOpenedAtRef.current,
        });
      }
    });

    // Fire couples-reveal trigger before clearing session storage so
    // checkAndTriggerCouplesTypeReveal can still access localStorage state.
    try {
      const currentUserId = getUserId();
      const knownIds = await getKnownUserIds();

      const isHost = knownIds.includes(matchedSessionData?.host_user_id ?? "");
      const isGuest = matchedSessionData?.guest_user_id
        ? knownIds.includes(matchedSessionData.guest_user_id)
        : false;

      const partnerId = isHost
        ? matchedSessionData?.guest_user_id
        : isGuest
          ? matchedSessionData?.host_user_id
          : null;

      if (currentUserId && partnerId) {
        await checkAndTriggerCouplesTypeReveal(currentUserId, partnerId);
      }
    } catch (e) {
      console.warn("[couples-reveal] deck trigger failed silently:", e);
    }

    addToHistory(matchedMeal);
    saveDecidedMeal({ ...matchedMeal, decidedAt: new Date().toISOString(), mode: "shared", sessionId: sessionId ?? undefined });
    if (typeof window !== "undefined") {
      localStorage.removeItem("wwe_active_session");
      localStorage.removeItem(`wwe_session_swiping_done_${sessionId}`);
      localStorage.removeItem(`wwe_shared_deck_index_${sessionId}`);
    }
    // Re-check auth state at navigation time — the mount-time isGuest value may
    // not yet be settled for guests joining via a share link.
    const { data: { user: navUser } } = await supabase.auth.getUser();
    router.push(navUser ? "/" : "/guest-home");
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

  // ── AI enrichment ────────────────────────────────────────────────────────────
  //
  // Fetches AI-generated meals and merges them into the deck.
  // Called automatically when pantry mode is active and the ingredient context
  // key has changed, or when swipe fatigue is detected.
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
          allergens: prefs?.allergens ?? [],
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

      // ── Double hardGate + allergenGate: server already filtered, client confirms ──
      const hardGated = hardGate(aiRaw, getAllHardNos(prefs));
      const gated = allergenGate(hardGated, prefs?.allergens ?? []);
      if (process.env.NODE_ENV === "development" && gated.length < aiRaw.length) {
        console.log(`[ai] filtered by hardGate/allergenGate — before: ${aiRaw.length}, after: ${gated.length} (${aiRaw.length - gated.length} dropped)`);
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
          allergens: prefs?.allergens ?? [],
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

      const gated = allergenGate(hardGate(aiRaw, getAllHardNos(prefs)), prefs?.allergens ?? []);
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

  function canGuestRequestNewDeck(): boolean {
    if (!isGuest) return true;
    if (!tryConsumeGuestDeckBudgetNoGrant()) {
      setShowGuestLimit(true);
      trackEvent(EVENT_GUEST_LIMIT_REACHED, {
        attempts_used: getGuestAttempts(),
        trigger_source: "fresh_ideas",
      });
      return false;
    }
    return true;
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
    if (!canGuestRequestNewDeck()) return;
    // Increment solo reset counter in sessionStorage and state
    const nextCount = (parseInt(sessionStorage.getItem(SOLO_RESET_SS_KEY) ?? "0", 10) || 0) + 1;
    sessionStorage.setItem(SOLO_RESET_SS_KEY, String(nextCount));
    setSoloResetCount(nextCount);
    // Reset Solo WC view so stale state from a previous reveal doesn't re-appear
    // before the new deck is exhausted and the trigger effect re-fires.
    setSoloWatchaCallView(null);
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

  function handlePass() {
    dismissHint();
    dismissDrawerHint();
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
      if (savedFeedback.has(meal.id)) {
        setToastMessage("Already saved");
        return;
      }
      saveMeal(meal);
      trackEvent(EVENT_MEAL_SAVED, { mealId: meal.id, source_screen: "deck" });
      updateTasteProfile(meal, "save");
      setSavedFeedback(prev => { const s = new Set(prev); s.add(meal.id); return s; });
      setToastMessage("Saved ★");

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
  }

  function handleChoose() {
    if (!meal || isChoosing || isExiting) return;
    dismissHint();
    dismissDrawerHint();

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
              sessionType: "solo",
              sharedSessionId: null,
              vibeSelection: sessionVibeMode,
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

        const _soloDlKey = `wwe_analytics_decision_locked_solo_${chosenMeal.id}`;
        if (!sessionStorage.getItem(_soloDlKey)) {
          trackEvent(EVENT_DECISION_LOCKED, { mealId: chosenMeal.id, sessionMode: "solo", resolutionPath: "swipe_match" });
          sessionStorage.setItem(_soloDlKey, "1");
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
      <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0B0805] px-6 text-center text-white overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 45% at 50% 0%, rgba(232,98,26,0.12) 0%, transparent 65%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }} />
        <div
          className="relative z-10 rounded-[24px] px-8 py-8 flex flex-col items-center gap-4 w-full max-w-sm"
          style={{
            background: "linear-gradient(180deg, rgba(255,231,202,0.06) 0%, rgba(255,231,202,0.02) 100%)",
            border: "1px solid rgba(245,237,224,0.16)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 50px rgba(0,0,0,0.45)",
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color: "#E8621A", filter: "drop-shadow(0 0 6px rgba(232,98,26,0.5))", fontSize: 11 }}>✦</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "2.4px", textTransform: "uppercase", color: "#E8621A" }}>Session error</span>
          </div>
          <p style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 22, color: "#F6EEE2", letterSpacing: "-0.01em" }}>Deck not ready</p>
          <p className="text-center leading-relaxed" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: 13, color: "#897E73", maxWidth: "28ch" }}>
            The shared deck couldn&apos;t be built. Ask the host to go back and try again.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-2 w-full rounded-full py-3.5 transition active:scale-[0.98]"
            style={{
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 700,
              fontSize: 15,
              color: "#1c0c03",
              background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 50%, #B84A12 100%)",
              boxShadow: "0 1px 0 rgba(255,224,188,0.5) inset, 0 -2px 0 rgba(120,52,0,0.35) inset, 0 12px 26px rgba(232,98,26,0.40), 0 0 0 1px rgba(232,98,26,0.28)",
            }}
          >
            Back to home
          </button>
        </div>
      </main>
    );
  }

  // ── Shared deck loading screen ────────────────────────────────────────────
  if (sessionId && sharedLoading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-[#0B0805] text-white overflow-hidden">
        <div className="pointer-events-none absolute inset-0 candlelight-animate" style={{ background: "radial-gradient(ellipse 90% 36% at 50% -4%, rgba(232,98,26,0.12) 0%, transparent 60%)", animation: "candlelight-amb 9s ease-in-out infinite" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }} />
        <div className="relative z-10 flex flex-col items-center gap-4 px-8 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center animate-pulse"
            style={{
              background: "rgba(232,98,26,0.10)",
              border: "1px solid rgba(232,98,26,0.22)",
              boxShadow: "0 0 30px rgba(232,98,26,0.18)",
              fontSize: 28,
            }}
          >
            🍽️
          </div>
          <span className="h-1.5 w-1.5 animate-ping rounded-full" style={{ background: "rgba(232,98,26,0.7)" }} />
          <div>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "2.4px", textTransform: "uppercase", color: "#E8621A" }}>
              Building the deck
            </p>
            <p className="mt-1" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 18, color: "#C7BDAC" }}>
              Syncing with your partner…
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ── Layer B structural guard: deck not populated yet ─────────────────────
  // Checked BEFORE isExhausted so an empty rankedMeals array (length === 0)
  // never satisfies currentIndex (0) >= totalCount (0) and shows "still deciding".
  // Handles the case where bypassToExhausted prematurely cleared sharedLoading.
  const deckNotReady = !!sessionId && rankedMeals.length === 0 && !sharedError && !sessionExpired;
  if (deckNotReady) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-[#0B0805] text-white overflow-hidden">
        <div className="pointer-events-none absolute inset-0 candlelight-animate" style={{ background: "radial-gradient(ellipse 90% 36% at 50% -4%, rgba(232,98,26,0.12) 0%, transparent 60%)", animation: "candlelight-amb 9s ease-in-out infinite" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }} />
        <div className="relative z-10 flex flex-col items-center gap-4 px-8 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center animate-pulse"
            style={{
              background: "rgba(232,98,26,0.10)",
              border: "1px solid rgba(232,98,26,0.22)",
              boxShadow: "0 0 30px rgba(232,98,26,0.18)",
              fontSize: 28,
            }}
          >
            🍽️
          </div>
          <span className="h-1.5 w-1.5 animate-ping rounded-full" style={{ background: "rgba(232,98,26,0.7)" }} />
          <div>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "2.4px", textTransform: "uppercase", color: "#E8621A" }}>
              Building your deck
            </p>
            <p className="mt-1" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 18, color: "#C7BDAC" }}>
              Almost ready…
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ── Exhausted screen ──────────────────────────────────────────────────────
  if (isExhausted) {
    // ── Shared async waiting state / Watcha's Call ────────────────────────
    if (sessionId) {
      return (
        <main className="relative min-h-screen overflow-hidden bg-[#0B0805] px-5 pb-6 safe-top text-white">
          {/* Candlelight ambient glow */}
          <div
            className="pointer-events-none absolute inset-0 candlelight-animate"
            style={{ background: "radial-gradient(ellipse 80% 45% at 50% 0%, rgba(232,98,26,0.13) 0%, transparent 65%)", animation: "candlelight-amb 9s ease-in-out infinite" }}
          />
          {/* Film grain */}
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
          {/* Vignette */}
          <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }} />
          <div className="mx-auto relative flex min-h-screen w-full max-w-md flex-col">
            {!bothDone && (
              <header className="flex items-center justify-between py-4">
                <span className="font-display font-black text-base text-white">
                  Watcha<span className="text-[#E8621A]">?</span>
                </span>
                <button
                  onClick={async () => {
                    if (isExhausted && sessionId) {
                      // Write leave signal so the waiting partner advances to Watcha's Call
                      try {
                        const { error: abandonErr } = await supabase
                          .from("sessions")
                          .update({ status: "abandoned", updated_at: new Date().toISOString() })
                          .eq("id", sessionId);
                        if (!abandonErr) {
                          trackEvent(EVENT_SHARED_SESSION_ABANDONED, {
                            sessionId,
                            abandoned_at_step: "swiping",
                            swipe_count_at_abandon: currentIndex ?? 0,
                          });
                        }
                      } catch {
                        // best-effort; navigate home regardless
                      }
                    }
                    window.location.href = "/";
                  }}
                  className="font-body text-sm text-[#8A7F78] transition hover:text-white/60"
                >
                  Back
                </button>
              </header>
            )}

            <div className="flex flex-1 flex-col items-center justify-center text-center">
              {!bothDone ? (
                partnerSteppedAway ? (
                  /* §2b: Partner stepped away — brief bridge before Watcha's Call */
                  <div className="flex flex-col items-center gap-3 text-center px-6">
                    <p style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 22, color: "#F6EEE2", lineHeight: 1.2 }}>
                      Looks like they stepped away.
                    </p>
                    <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: 13, color: "#897E73" }}>
                      We&apos;ll make the call from what we have.
                    </p>
                  </div>
                ) : (
                /* §2: Branded waiting screen — partner still deciding */
                <div className="flex flex-col items-center w-full">
                  {/* Glass card container */}
                  <div className="w-full rounded-[24px] p-7 text-center" style={{ background: "linear-gradient(180deg, rgba(255,231,202,0.07) 0%, rgba(255,231,202,0.02) 100%)", border: "1px solid rgba(245,237,224,0.16)", backdropFilter: "blur(24px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 50px rgba(0,0,0,0.45)" }}>
                    {/* Live session eyebrow */}
                    <div className="flex items-center justify-center gap-2 mb-8">
                      <span className="w-2 h-2 rounded-full animate-ping" style={{ background: "#E8621A", boxShadow: "0 0 8px rgba(232,98,26,0.6)" }} />
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "2px", textTransform: "uppercase", color: "#E8621A" }}>
                        Your picks are in
                      </span>
                    </div>
                    {/* Avatar pair */}
                    <div className="flex items-center justify-center gap-5 mb-8">
                      {/* Your avatar — ember orb */}
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center"
                          style={{ background: "linear-gradient(180deg,#FF8A3D,#E8621A 60%,#B84A12)", boxShadow: "0 0 24px rgba(232,98,26,0.35)" }}
                        >
                          <span style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 22, color: "#fff" }}>✓</span>
                        </div>
                        <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: 12, color: "#897E73" }}>You</span>
                      </div>
                      {/* Connector dots */}
                      <div className="flex gap-1 pb-4">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(245,237,224,0.12)" }} />
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(245,237,224,0.08)" }} />
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(245,237,224,0.04)" }} />
                      </div>
                      {/* Partner avatar — hollow with pulsing ember ring */}
                      <div className="flex flex-col items-center gap-2">
                        <div className="relative w-14 h-14">
                          <div className="absolute inset-0 rounded-full border-2 border-[#E8621A] animate-ping opacity-30" />
                          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ border: "1px solid rgba(232,98,26,0.40)", background: "rgba(255,231,202,0.04)" }}>
                            <span style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 22, color: "rgba(232,98,26,0.45)" }}>?</span>
                          </div>
                        </div>
                        <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: 12, color: "#897E73" }}>{partnerName ? partnerName.split(" ")[0] : "Them"}</span>
                      </div>
                    </div>
                    {/* Rotating headline */}
                    <h2 style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 24, color: "#F6EEE2", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
                      {WAITING_HEADLINES[waitingHeadlineIdx]}
                    </h2>
                    <p className="mt-3" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: 13, color: "#897E73" }}>
                      We&apos;ll make the call the moment they&apos;re done.
                    </p>
                  </div>
                </div>
                )
              ) : partnerUserId ? (
                /* §4–§5: Watcha's Call */
                <WatchasCall
                  sessionId={sessionId}
                  userId={userId}
                  partnerUserId={partnerUserId}
                  partnerName={partnerName}
                  myName={myDisplayName}
                  myAvatarUrl={myAvatarUrl}
                  partnerAvatarUrl={partnerAvatarUrl}
                  orderedMeals={rankedMeals.map((r) => r.meal)}
                  deckSize={Math.min(rankedMeals.length, DECK_SIZE)}
                  aiMealIds={aiMealIds}
                  sessionVibeMode={sessionVibeMode}
                  onResolve={() => {
                    if (!trackingClosedRef.current) {
                      trackingClosedRef.current = true;
                      trackingSessionPromiseRef.current?.then((tsId) => {
                        if (tsId && trackingOpenedAtRef.current) {
                          void closeTrackingSession({
                            trackingSessionId: tsId,
                            resolved: true,
                            swipeCount: trackingSwipeCountRef.current,
                            openedAt: trackingOpenedAtRef.current,
                          });
                        }
                      });
                    }
                  }}
                />
              ) : (
                /* partnerUserId not yet loaded — brief spinner */
                <div className="flex flex-col items-center gap-4 text-center">
                  <div
                    className="w-8 h-8 rounded-full border-2 animate-spin"
                    style={{ borderColor: "rgba(232,98,26,0.3)", borderTopColor: "#E8621A" }}
                  />
                  <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: 13, color: "#897E73" }}>
                    Loading…
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Match modal — only fires while !bothDone; suppressed once tiebreakActiveRef is set */}
          <AnimatePresence>
            {matchedMeal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="fixed inset-0 z-50 bg-[#0B0805] overflow-y-auto"
              >
                <div className="pointer-events-none absolute inset-0" style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
                <div className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }} />
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
                    {/* 1. Green orb with rings */}
                    <div className="flex items-center justify-center">
                      {/* Outer ring */}
                      <div className="absolute rounded-full" style={{ width: 200, height: 200, background: "rgba(94,158,110,0.04)" }} />
                      {/* Mid ring */}
                      <div className="absolute rounded-full animate-pulse-soft" style={{ width: 164, height: 164, background: "rgba(94,158,110,0.08)" }} />
                      {/* Green orb */}
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          type: "spring",
                          damping: 12,
                          stiffness: 260,
                          delay: 0.2,
                        }}
                        className="relative flex items-center justify-center"
                        style={{
                          width: 112, height: 112, borderRadius: "50%",
                          background: "radial-gradient(circle at 42% 36%, #86C796, #5E9E6E 55%, #3F744F)",
                          boxShadow: "0 0 60px rgba(94,158,110,0.50), 0 0 0 14px rgba(94,158,110,0.08), 0 0 0 30px rgba(94,158,110,0.04)",
                        }}
                      >
                        <motion.span
                          initial={{ scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{
                            type: "spring",
                            damping: 14,
                            stiffness: 300,
                            delay: 0.35,
                          }}
                          style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 46, color: "#fff", display: "inline-block" }}
                        >✓</motion.span>
                      </motion.div>
                    </div>

                    {/* 2. Eyebrow label */}
                    <p className="mt-16" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "3px", textTransform: "uppercase", color: "#86A972" }}>
                      IT&apos;S A MATCH.
                    </p>

                    {/* 3. Main headline */}
                    <h1 className="mt-2 text-center leading-tight" style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 36, color: "#F6EEE2", letterSpacing: "-0.02em" }}>
                      Dinner is decided.
                    </h1>

                    {/* 4. Meal name italic green */}
                    <p className="mt-2 text-center" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 24, color: "#5E9E6E" }}>
                      {matchedMeal.name}
                    </p>

                    {/* 5. Meal image card with studio treatment */}
                    <div
                      className="relative w-full rounded-[20px] overflow-hidden mt-7"
                      style={{
                        aspectRatio: "16/9",
                        border: "1px solid rgba(245,237,224,0.16)",
                        boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
                      }}
                    >
                      <img src={matchedMeal.image} alt={matchedMeal.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 58% 46% at 50% 2%, rgba(255,248,235,0.60) 0%, rgba(255,235,200,0.28) 28%, transparent 65%)", mixBlendMode: "screen" }} />
                      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(8,5,3,0.70) 0%, rgba(8,5,3,0.30) 28%, transparent 55%)" }} />
                    </div>

                    {/* 6. Description */}
                    <p className="mt-4 text-center leading-relaxed" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: "#897E73" }}>{matchedMeal.description}</p>

                    {/* 7. Why this works card */}
                    {rankedMeals.find((r) => r.meal.id === matchedMeal.id)?.reason && (
                      <div
                        className="w-full rounded-[18px] p-4 mt-4 flex items-start gap-3"
                        style={{
                          background: "rgba(255,231,202,0.04)",
                          border: "1px solid rgba(245,237,224,0.085)",
                          borderLeft: "3px solid rgba(232,98,26,0.50)",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                        }}
                      >
                        <p className="leading-relaxed" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: "#897E73" }}>
                          <span style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 13, color: "#FF8A3D" }}>Why this works: </span>
                          {rankedMeals.find((r) => r.meal.id === matchedMeal.id)?.reason}
                        </p>
                      </div>
                    )}

                    {/* 8. CTA buttons */}
                    <div className="flex gap-3 w-full mt-7">
                      <button
                        onClick={() => sessionId ? void handleMatchConfirm() : router.push("/")}
                        disabled={matchConfirming}
                        className="flex-1 py-4 rounded-[16px] transition active:scale-[0.98] disabled:opacity-60"
                        style={{
                          fontFamily: "'Quicksand', sans-serif",
                          fontWeight: 700,
                          fontSize: 16,
                          color: "#fff",
                          background: "linear-gradient(180deg, #86C796 0%, #5E9E6E 50%, #3F744F 100%)",
                          boxShadow: "0 1px 0 rgba(190,230,200,0.35) inset, 0 -2px 0 rgba(30,70,40,0.35) inset, 0 14px 30px rgba(94,158,110,0.32)",
                        }}
                      >
                        {matchConfirming ? "Locking in…" : "Let\u2019s eat 🙌"}
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

        </main>
      );
    }

    // ── Solo exhausted state ───────────────────────────────────────────────
    if (topPicksMode) {
      return (
        <main className="relative min-h-screen overflow-hidden bg-[#0B0805] px-5 pb-6 safe-top text-white">
          <div
            className="pointer-events-none absolute inset-0 candlelight-animate"
            style={{
              background:
                "radial-gradient(ellipse 90% 28% at 50% 0%, rgba(232,98,26,0.13) 0%, transparent 70%), radial-gradient(ellipse 70% 20% at 50% 100%, rgba(28,16,8,0.55) 0%, transparent 65%)",
              animation: "candlelight-amb 9s ease-in-out infinite",
            }}
          />
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
          <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }} />
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
              <div
                className="mb-5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs"
                style={{
                  background: "rgba(255,231,202,0.04)",
                  border: "1px solid rgba(245,237,224,0.085)",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  color: "#897E73",
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#E8621A", boxShadow: "0 0 6px rgba(232,98,26,0.6)" }} />
                Round 2 complete
              </div>
              <h2 className="mt-4 leading-tight" style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 30, color: "#F6EEE2", letterSpacing: "-0.02em" }}>
                That&apos;s your best set
              </h2>
              <p className="mt-3 max-w-[28ch] leading-relaxed" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: 14, color: "#897E73" }}>
                You&apos;ve gone through your strongest matches. Want to try a new direction?
              </p>
              <p className="mt-3" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 12, color: "rgba(137,126,115,0.55)" }}>You&apos;re close 👀</p>
              <div className="mt-8 w-full flex flex-col gap-3">
                <button
                  onClick={() => { setTopPicksMode(false); setCurrentIndex(0); }}
                  className="w-full rounded-full py-4 transition active:scale-[0.98]"
                  style={{
                    fontFamily: "'Quicksand', sans-serif",
                    fontWeight: 700,
                    fontSize: 16,
                    color: "#1c0c03",
                    background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 50%, #B84A12 100%)",
                    boxShadow: "0 1px 0 rgba(255,224,188,0.5) inset, 0 -2px 0 rgba(120,52,0,0.35) inset, 0 14px 30px rgba(232,98,26,0.45), 0 0 0 1px rgba(232,98,26,0.28)",
                  }}
                >
                  Start over
                </button>
                <button
                  onClick={() => router.push("/browse")}
                  className="w-full rounded-full py-3 transition active:scale-[0.98]"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 500,
                    fontSize: 14,
                    color: "#897E73",
                    background: "rgba(255,231,202,0.04)",
                    border: "1px solid rgba(245,237,224,0.085)",
                  }}
                >
                  Browse all meals
                </button>
              </div>
            </div>
          </div>
          {showGuestLimit && (
            <GuestLimitPrompt onClose={() => setShowGuestLimit(false)} />
          )}
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
      void recordAcceptedDecision({ meal, positionInDeck: 0, sessionType: "solo", sessionId: null, vibeSelection: sessionVibeMode });
      // Close the tracking session that was opened at deck mount
      if (!trackingClosedRef.current) {
        trackingClosedRef.current = true;
        trackingSessionPromiseRef.current?.then((tsId) => {
          if (tsId && trackingOpenedAtRef.current) {
            void closeTrackingSession({
              trackingSessionId: tsId,
              resolved: true,
              swipeCount: trackingSwipeCountRef.current,
              openedAt: trackingOpenedAtRef.current,
            });
          } else if (process.env.NODE_ENV === "development") {
            console.warn("[session-tracking] lockInMeal: no tracking session, skipping close");
          }
        });
      }
      router.push(isGuest ? `/locked?mealId=${meal.id}` : "/");
    }

    // ── Easter egg: reset 3+ (terminal state) ─────────────────────────────
    if (soloResetCount >= 3) {
      const forcedMeal = rankedMeals[0]?.meal;
      return (
        <main className="relative min-h-screen overflow-hidden bg-[#0B0805] px-5 pb-10 safe-top text-white">
          <div
            className="pointer-events-none absolute inset-0 candlelight-animate"
            style={{ background: "radial-gradient(ellipse 80% 50% at 50% 20%, rgba(232,98,26,0.18) 0%, transparent 65%)", animation: "candlelight-amb 9s ease-in-out infinite" }}
          />
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
          <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }} />
          <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center text-center px-4">
            {/* Pulsing ember orb icon */}
            <div className="relative flex items-center justify-center mb-10">
              <div className="absolute w-32 h-32 rounded-full animate-pulse" style={{ background: "radial-gradient(circle, rgba(232,98,26,0.22) 0%, transparent 70%)" }} />
              <div
                className="relative w-24 h-24 rounded-[22%] flex items-center justify-center"
                style={{
                  background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 50%, #B84A12 100%)",
                  boxShadow: "0 0 60px rgba(232,98,26,0.50), inset 0 1px 0 rgba(255,224,188,0.35)",
                }}
              >
                <span style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 52, color: "#fff" }}>?</span>
              </div>
            </div>
            <h2 style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 36, color: "#F6EEE2", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              Okay. We tried.
            </h2>
            <p className="mt-3 max-w-xs" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: 15, color: "#897E73", lineHeight: 1.6 }}>
              You&apos;ve seen everything we&apos;ve got. Multiple times. The app has done its job — now it&apos;s your turn.
            </p>
            {forcedMeal && (
              <>
                <button
                  onClick={() => lockInMeal(forcedMeal)}
                  className="mt-10 w-full rounded-full py-4 transition active:scale-[0.98]"
                  style={{
                    fontFamily: "'Quicksand', sans-serif",
                    fontWeight: 700,
                    fontSize: 16,
                    color: "#1c0c03",
                    background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 50%, #B84A12 100%)",
                    boxShadow: "0 1px 0 rgba(255,224,188,0.5) inset, 0 -2px 0 rgba(120,52,0,0.35) inset, 0 14px 30px rgba(232,98,26,0.45), 0 0 0 1px rgba(232,98,26,0.28)",
                  }}
                >
                  Just pick something →
                </button>
                <p className="mt-3 text-center" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 14, color: "rgba(137,126,115,0.60)" }}>
                  (It&apos;s {forcedMeal.name}. You&apos;ll be fine.)
                </p>
              </>
            )}
          </div>
        </main>
      );
    }

    // ── Solo Watcha's Call (soloResetCount >= 1 — resolution of 2nd+ deck) ───
    // Guest rule: this is deck RESOLUTION, not deck entry — no budget consumed,
    // no GuestLimitPrompt, no new deck created.
    if (soloResetCount >= 1) {
      // Initializing — effect fires on next tick; blank dark screen prevents flash
      if (soloWatchaCallView === null) {
        return <main className="min-h-screen bg-[#0B0805]" />;
      }

      const wc = soloWatchaCallMeal;

      function soloTierReason(): string {
        switch (soloWatchaCallTier) {
          case "A": return "Your strongest lean from tonight\u2019s deck.";
          case "B": return "Nothing you loved, but nothing you hated either. This was the safest call.";
          case "C": return "Top of tonight\u2019s deck. Still our best read on what you\u2019d eat.";
          default: return "";
        }
      }

      // Lock path: same data writes as lockInMeal() — no shared RPC, no navigation here.
      // Navigation happens in "Let's eat 🙌" after the green locked view.
      // Note: do NOT call setSoloResetCount(0) here — soloResetCount must stay >= 1
      // so the locked view condition remains true. sessionStorage cleared so a refresh starts fresh.
      function doSoloWCLock() {
        if (!wc) return;
        sessionStorage.removeItem(SOLO_RESET_SS_KEY);
        addToHistory(wc);
        saveDecidedMeal({ ...wc, decidedAt: new Date().toISOString(), mode: "solo" });
        void recordAcceptedDecision({ meal: wc, positionInDeck: 0, sessionType: "solo", sessionId: null, vibeSelection: sessionVibeMode });
        if (!trackingClosedRef.current) {
          trackingClosedRef.current = true;
          trackingSessionPromiseRef.current?.then((tsId) => {
            if (tsId && trackingOpenedAtRef.current) {
              void closeTrackingSession({
                trackingSessionId: tsId,
                resolved: true,
                swipeCount: trackingSwipeCountRef.current,
                openedAt: trackingOpenedAtRef.current,
              });
            }
          });
        }
        const _wcDlKey = `wwe_analytics_decision_locked_solo_${wc.id}`;
        if (!sessionStorage.getItem(_wcDlKey)) {
          trackEvent(EVENT_DECISION_LOCKED, { mealId: wc.id, sessionMode: "solo", resolutionPath: "watchas_call" });
          sessionStorage.setItem(_wcDlKey, "1");
        }
        setSoloWatchaCallView("locked");
      }

      // Reusable background layers
      const bgLayers = (
        <>
          <div className="pointer-events-none absolute inset-0 candlelight-animate" style={{ background: "radial-gradient(ellipse 80% 45% at 50% 0%, rgba(232,98,26,0.13) 0%, transparent 65%)", animation: "candlelight-amb 9s ease-in-out infinite" }} />
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
          <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }} />
        </>
      );

      // ── Reveal ──────────────────────────────────────────────────────────────
      if (soloWatchaCallView === "reveal") {
        const vis = (stage: number) => ({
          opacity: soloWCRevealStage >= stage ? 1 : 0,
          transform: soloWCRevealStage >= stage ? "none" : "translateY(10px)",
        });
        return (
          <main className="relative min-h-screen overflow-hidden bg-[#0B0805] text-white">
            {bgLayers}
            <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center text-center" style={{ padding: "0 36px", gap: 13 }}>
              {/* Pulsing ember dot */}
              <div style={{ width: 13, height: 13, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, #FF8A3D, #E8621A 70%, #B84A12)", boxShadow: "0 0 24px rgba(232,98,26,0.5), 0 0 0 10px rgba(232,98,26,0.08), 0 0 0 22px rgba(232,98,26,0.04)", animation: "wce-pulse 1.8s ease-in-out infinite" }} />
              {/* Eyebrow */}
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "3px", textTransform: "uppercase", color: "#E8621A", transition: "opacity 0.6s ease, transform 0.6s ease", ...vis(1) }}>
                Watcha&apos;s Call
              </div>
              {/* Headline */}
              <h2 style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 39, lineHeight: 1.0, letterSpacing: "-0.02em", color: "#F6EEE2", transition: "opacity 0.7s cubic-bezier(0.2,0.7,0.2,1), transform 0.7s cubic-bezier(0.2,0.7,0.2,1)", ...vis(1) }}>
                {soloWCRevealCopyRef.current.headline}
              </h2>
              {/* Sub */}
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: 14, lineHeight: 1.5, color: "#C7BDAC", maxWidth: 280, transition: "opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s", ...vis(2) }}>
                {soloWCRevealCopyRef.current.sub}
              </div>
            </div>
          </main>
        );
      }

      // ── Locked (green ambient shift) ─────────────────────────────────────────
      if (soloWatchaCallView === "locked") {
        return (
          <main className="relative min-h-screen overflow-hidden bg-[#0B0805] text-white">
            {/* Green ambient overlay */}
            <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 40% at 50% 40%, rgba(94,158,110,0.20), transparent 60%), radial-gradient(ellipse 80% 50% at 50% 104%, rgba(184,74,18,0.08), transparent 66%)", transition: "opacity 0.7s ease" }} />
            <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
            <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }} />
            <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center text-center" style={{ padding: "0 32px", gap: 15 }}>
              {/* Green orb */}
              <div style={{ width: 138, height: 138, borderRadius: "50%", background: "radial-gradient(circle at 42% 36%, #86C796, #5E9E6E 55%, #3F744F)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 54, boxShadow: "0 0 64px rgba(94,158,110,0.45), 0 0 0 16px rgba(94,158,110,0.08), 0 0 0 34px rgba(94,158,110,0.04)", animation: "wce-pop 0.7s cubic-bezier(0.2,0.8,0.2,1) backwards" }}>
                ✓
              </div>
              {/* Eyebrow */}
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: "3px", textTransform: "uppercase", color: "#86A972" }}>
                Watcha&apos;s Call · locked
              </div>
              {/* Headline */}
              <h2 style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 36, letterSpacing: "-0.02em", color: "#F6EEE2", lineHeight: 1 }}>
                Dinner&apos;s decided.
              </h2>
              {/* Meal name (italic, green accent) */}
              <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 27, color: "#86A972" }}>
                {wc?.name}
              </div>
              {/* Line */}
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: 13.5, lineHeight: 1.5, color: "#C7BDAC", maxWidth: 280 }}>
                You&apos;ll take credit for this later. We&apos;ll allow it.
              </div>
              {/* CTA */}
              <button
                onClick={() => { window.location.href = "/"; }}
                style={{ marginTop: 8, padding: "15px 30px", borderRadius: 100, border: "none", cursor: "pointer", fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 15.5, color: "#06140a", background: "linear-gradient(180deg,#86C796,#5E9E6E 50%,#3F744F)", boxShadow: "0 1px 0 rgba(220,255,228,0.5) inset, 0 -2px 0 rgba(20,60,30,0.4) inset, 0 14px 30px rgba(94,158,110,0.32)" }}
              >
                Let&apos;s eat 🙌
              </button>
            </div>
          </main>
        );
      }

      // ── Exit ─────────────────────────────────────────────────────────────────
      if (soloWatchaCallView === "exit") {
        return (
          <main className="relative min-h-screen overflow-hidden bg-[#0B0805] text-white">
            {bgLayers}
            <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center text-center" style={{ padding: "0 38px", gap: 14 }}>
              {/* Ring icon */}
              <div style={{ width: 74, height: 74, borderRadius: "50%", border: "1.5px solid rgba(245,237,224,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, color: "#E8621A", background: "rgba(255,231,202,0.045)" }}>
                ◠
              </div>
              {/* Eyebrow */}
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "3px", textTransform: "uppercase", color: "#897E73" }}>
                Called off
              </div>
              {/* Headline */}
              <h2 style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 32, letterSpacing: "-0.02em", color: "#F6EEE2", lineHeight: 1.02 }}>
                All yours tonight.
              </h2>
              {/* Sub */}
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: 13.5, lineHeight: 1.55, color: "#C7BDAC", maxWidth: 290 }}>
                No new deck tonight. We&apos;ll be ready when you are.
              </div>
              {/* Back home */}
              <button
                onClick={() => { window.location.href = "/"; }}
                style={{ marginTop: 10, padding: "14px 28px", borderRadius: 100, cursor: "pointer", fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 15.5, color: "#F6EEE2", background: "rgba(255,231,202,0.04)", border: "1px solid rgba(245,237,224,0.16)" }}
              >
                Back home
              </button>
            </div>
          </main>
        );
      }

      // ── Main view ─────────────────────────────────────────────────────────────
      // No overlap section — solo has no partner avatars or "You leaned / They leaned"
      return (
        <main className="relative min-h-screen overflow-y-auto bg-[#0B0805] text-white">
          {bgLayers}
          <div className="mx-auto flex min-h-screen w-full max-w-md flex-col" style={{ padding: "6px 22px 22px" }}>
            {/* Eyebrow */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "2.6px", textTransform: "uppercase", color: "#E8621A" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#E8621A", boxShadow: "0 0 8px rgba(232,98,26,0.5)", animation: "wce-breathe 2.4s ease-in-out infinite", flexShrink: 0 }} />
              Watcha&apos;s Call
            </div>
            {/* Lead line */}
            <div style={{ marginTop: 11 }}>
              <span style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 23, lineHeight: 1.08, letterSpacing: "-0.01em", color: "#F6EEE2" }}>
                You swiped everything.{" "}
              </span>
              <em style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontWeight: 400, fontSize: 23, lineHeight: 1.08, color: "#FF8A3D" }}>
                So we picked one.
              </em>
            </div>
            {/* Pick card */}
            <div style={{ position: "relative", height: 286, borderRadius: 22, overflow: "hidden", marginTop: 15, border: "1px solid rgba(245,237,224,0.16)", boxShadow: "0 18px 40px rgba(0,0,0,0.5)" }}>
              {wc?.image && !imgErrors.has(wc.id) ? (
                <img
                  src={wc.image}
                  alt={wc.name}
                  onError={() => setImgErrors((prev) => new Set(prev).add(wc.id))}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <MealImageFallback mealName={wc?.name ?? "Tonight's pick"} />
              )}
              {/* Top spotlight */}
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 58% 46% at 50% 2%, rgba(255,248,235,0.55) 0%, rgba(255,228,190,0.10) 30%, transparent 58%)", mixBlendMode: "screen", pointerEvents: "none" }} />
              {/* Scrim */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(7,4,2,0.97) 16%, rgba(7,4,2,0.5) 50%, transparent 80%)" }} />
              {/* Watcha's Call badge */}
              <div style={{ position: "absolute", top: 14, left: 14, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "1.6px", textTransform: "uppercase", color: "#1c0c03", background: "linear-gradient(180deg,#FF8A3D,#E8621A)", padding: "6px 11px", borderRadius: 100, boxShadow: "0 6px 16px rgba(232,98,26,0.4)" }}>
                Watcha&apos;s Call
              </div>
              {/* Info overlay */}
              <div style={{ position: "absolute", left: 16, right: 16, bottom: 15 }}>
                <h3 style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 29, color: "#F6EEE2", letterSpacing: "-0.01em", textShadow: "0 2px 14px rgba(0,0,0,0.6)" }}>{wc?.name}</h3>
                <div style={{ marginTop: 11, fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 16.5, lineHeight: 1.32, color: "#F6EEE2" }}>
                  {soloTierReason()}
                </div>
              </div>
            </div>
            {/* See details */}
            <button
              onClick={() => setWatchaCallDetailsOpen(true)}
              style={{
                marginTop: 10,
                background: "none",
                border: "1px solid rgba(245,237,224,0.14)",
                borderRadius: 100,
                cursor: "pointer",
                width: "100%",
                padding: "10px 0",
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 13.5,
                color: "#C7BDAC",
                letterSpacing: "0.01em",
              }}
            >
              See details
            </button>

            {/* Actions */}
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
              <button
                onClick={doSoloWCLock}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 100, border: "none", width: "100%", fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 15.5, letterSpacing: "-0.01em", cursor: "pointer", color: "#1c0c03", background: "linear-gradient(180deg,#FF8A3D,#E8621A 48%,#B84A12)", boxShadow: "0 1px 0 rgba(255,224,188,0.6) inset, 0 -2px 0 rgba(120,52,0,0.4) inset, 0 14px 30px rgba(232,98,26,0.4), 0 0 0 1px rgba(232,98,26,0.3)" }}
              >
                Lock it in
              </button>
              <div style={{ textAlign: "center", fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: 11, color: "#897E73", padding: "5px 0 1px" }}>
                Locked in for tonight.
              </div>
              <button
                onClick={() => setSoloWatchaCallView("exit")}
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Quicksand', sans-serif", fontWeight: 600, fontSize: 14, color: "#C7BDAC", padding: 9, textAlign: "center" as const }}
              >
                Not tonight
              </button>
            </div>

            {/* Solo Watcha's Call details drawer */}
            <WatchaCallDetailsDrawer
              meal={wc}
              isOpen={watchaCallDetailsOpen}
              onClose={() => setWatchaCallDetailsOpen(false)}
              onLockIn={() => {
                setWatchaCallDetailsOpen(false);
                doSoloWCLock();
              }}
              mode="solo"
              tierReason={soloTierReason()}
            />
          </div>
        </main>
      );
    }

    // Sub-screen: top 3 picks
    if (soloExhaustedView === "top3") {
      const top3 = rankedMeals.slice(0, 3).map((r) => r.meal);
      return (
        <main className="relative min-h-screen overflow-y-auto bg-[#0B0805] px-5 pb-10 safe-top text-white">
          <div
            className="pointer-events-none absolute inset-0 candlelight-animate"
            style={{ background: "radial-gradient(ellipse 80% 45% at 50% 0%, rgba(232,98,26,0.13) 0%, transparent 65%)", animation: "candlelight-amb 9s ease-in-out infinite" }}
          />
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
          <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }} />
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
                <div
                  key={meal.id}
                  className="flex flex-col rounded-[20px] overflow-hidden"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,231,202,0.06) 0%, rgba(255,231,202,0.02) 100%)",
                    border: "1px solid rgba(245,237,224,0.16)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 40px rgba(0,0,0,0.4)",
                  }}
                >
                  <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9" }}>
                    {meal.image && !imgErrors.has(meal.id) ? (
                      <img
                        src={meal.image}
                        alt={meal.name}
                        className="w-full h-full object-cover"
                        onError={() => setImgErrors((prev) => new Set(prev).add(meal.id))}
                      />
                    ) : (
                      <MealImageFallback mealName={meal.name} />
                    )}
                    {/* Top spotlight */}
                    <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 58% 46% at 50% 2%, rgba(255,248,235,0.60) 0%, rgba(255,235,200,0.30) 28%, transparent 65%)", mixBlendMode: "screen" }} />
                    {/* Bottom scrim */}
                    <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(8,5,3,0.80) 0%, rgba(8,5,3,0.40) 28%, transparent 55%)" }} />
                  </div>
                  <div className="p-5">
                    <p style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 20, color: "#F6EEE2", letterSpacing: "-0.01em" }}>{meal.name}</p>
                    <p className="mt-1 leading-relaxed" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: "#897E73" }}>{meal.description}</p>
                    <button
                      onClick={() => lockInMeal(meal)}
                      className="mt-5 w-full rounded-full py-3.5 transition active:scale-[0.98]"
                      style={{
                        fontFamily: "'Quicksand', sans-serif",
                        fontWeight: 700,
                        fontSize: 15,
                        color: "#1c0c03",
                        background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 50%, #B84A12 100%)",
                        boxShadow: "0 1px 0 rgba(255,224,188,0.5) inset, 0 -2px 0 rgba(120,52,0,0.35) inset, 0 12px 26px rgba(232,98,26,0.40), 0 0 0 1px rgba(232,98,26,0.28)",
                      }}
                    >
                      Lock this in →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {showGuestLimit && (
            <GuestLimitPrompt onClose={() => setShowGuestLimit(false)} />
          )}
        </main>
      );
    }

    // Sub-screen: vibe selector
    if (soloExhaustedView === "vibe-select") {
      return (
        <main className="relative min-h-screen overflow-y-auto bg-[#0B0805] px-5 pb-10 safe-top text-white">
          <div
            className="pointer-events-none absolute inset-0 candlelight-animate"
            style={{ background: "radial-gradient(ellipse 80% 45% at 50% 0%, rgba(232,98,26,0.13) 0%, transparent 65%)", animation: "candlelight-amb 9s ease-in-out infinite" }}
          />
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
          <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }} />
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
                      borderColor: selected ? "#E8621A" : "rgba(245,237,224,0.085)",
                      background: selected ? "rgba(232,98,26,0.10)" : "rgba(255,231,202,0.04)",
                      boxShadow: selected ? "inset 0 0 0 1px rgba(232,98,26,0.28), 0 0 20px rgba(232,98,26,0.12)" : "none",
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
              className="mt-8 w-full rounded-full py-4 transition active:scale-[0.98]"
              style={{
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 700,
                fontSize: 16,
                color: "#1c0c03",
                background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 50%, #B84A12 100%)",
                boxShadow: "0 1px 0 rgba(255,224,188,0.5) inset, 0 -2px 0 rgba(120,52,0,0.35) inset, 0 14px 30px rgba(232,98,26,0.45), 0 0 0 1px rgba(232,98,26,0.28)",
              }}
            >
              Build my deck →
            </button>
          </div>
          {showGuestLimit && (
            <GuestLimitPrompt onClose={() => setShowGuestLimit(false)} />
          )}
        </main>
      );
    }

    // ── Main acknowledgment + diagnostic screen ────────────────────────────
    // "Fresh deck" option label changes at reset 2
    const freshDeckLabel = soloResetCount >= 2 ? "One more try" : "Nothing felt easy enough";
    const freshDeckSubtext = soloResetCount >= 2 ? "Build one last fresh deck" : "Show me quick, low-effort options";

    return (
      <main className="relative min-h-screen overflow-y-auto bg-[#0B0805] px-5 pb-10 safe-top text-white">
        {/* Candlelight ambient glow */}
        <div
          className="pointer-events-none absolute inset-0 candlelight-animate"
          style={{ background: "radial-gradient(ellipse 90% 50% at 50% 0%, rgba(232,98,26,0.14) 0%, transparent 65%)", animation: "candlelight-amb 9s ease-in-out infinite" }}
        />
        {/* Film grain */}
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }} />
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
          <div className="flex flex-col gap-2.5 pb-8">
            {/* Option 1: Fresh deck */}
            <button
              onClick={() => handleRefreshDeckWithVibe("quick-easy")}
              className="rounded-[18px] p-4 flex items-center gap-4 w-full cursor-pointer transition-all duration-200"
              style={{ background: "rgba(255,231,202,0.04)", border: "1px solid rgba(245,237,224,0.085)" }}
            >
              <span className="text-2xl flex-shrink-0">😴</span>
              <div className="flex-1 min-w-0 text-left">
                <p style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 15, color: "#F6EEE2" }}>{freshDeckLabel}</p>
                <p className="mt-0.5" style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#897E73" }}>{freshDeckSubtext}</p>
              </div>
              <span style={{ color: "#E8621A", fontSize: 18, flexShrink: 0 }}>›</span>
            </button>

            {/* Option 2: Something exciting */}
            <button
              onClick={() => handleRefreshDeckWithVibe("something-new")}
              className="rounded-[18px] p-4 flex items-center gap-4 w-full cursor-pointer transition-all duration-200"
              style={{ background: "rgba(255,231,202,0.04)", border: "1px solid rgba(245,237,224,0.085)" }}
            >
              <span className="text-2xl flex-shrink-0">🔥</span>
              <div className="flex-1 min-w-0 text-left">
                <p style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 15, color: "#F6EEE2" }}>Nothing felt exciting enough</p>
                <p className="mt-0.5" style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#897E73" }}>Surprise me with something different</p>
              </div>
              <span style={{ color: "#E8621A", fontSize: 18, flexShrink: 0 }}>›</span>
            </button>

            {/* Option 3: Top 3 */}
            <button
              onClick={() => setSoloExhaustedView("top3")}
              className="rounded-[18px] p-4 flex items-center gap-4 w-full cursor-pointer transition-all duration-200"
              style={{ background: "rgba(255,231,202,0.04)", border: "1px solid rgba(245,237,224,0.085)" }}
            >
              <span className="text-2xl flex-shrink-0">🤔</span>
              <div className="flex-1 min-w-0 text-left">
                <p style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 15, color: "#F6EEE2" }}>I couldn&apos;t decide</p>
                <p className="mt-0.5" style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#897E73" }}>Show me my top 3 and I&apos;ll pick one</p>
              </div>
              <span style={{ color: "#E8621A", fontSize: 18, flexShrink: 0 }}>›</span>
            </button>

            {/* Option 4: Set vibe */}
            <button
              onClick={() => setSoloExhaustedView("vibe-select")}
              className="rounded-[18px] p-4 flex items-center gap-4 w-full cursor-pointer transition-all duration-200"
              style={{ background: "rgba(255,231,202,0.04)", border: "1px solid rgba(245,237,224,0.085)" }}
            >
              <span className="text-2xl flex-shrink-0">🎯</span>
              <div className="flex-1 min-w-0 text-left">
                <p style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 15, color: "#F6EEE2" }}>Let me set a new mood</p>
                <p className="mt-0.5" style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#897E73" }}>Choose a vibe and try again</p>
              </div>
              <span style={{ color: "#E8621A", fontSize: 18, flexShrink: 0 }}>›</span>
            </button>
          </div>
        </div>
        {showGuestLimit && (
          <GuestLimitPrompt onClose={() => setShowGuestLimit(false)} />
        )}
      </main>
    );
  }

  // ── Deck screen ───────────────────────────────────────────────────────────
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0B0805] text-white">
      {/* Candlelight ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 candlelight-animate"
        style={{
          background:
            "radial-gradient(ellipse 90% 36% at 50% -4%, rgba(232,98,26,0.14) 0%, transparent 60%)," +
            "radial-gradient(ellipse 60% 30% at 50% 108%, rgba(184,74,18,0.10) 0%, transparent 65%)," +
            "radial-gradient(ellipse 40% 22% at 84% 30%, rgba(230,178,106,0.05) 0%, transparent 70%)",
          animation: "candlelight-amb 9s ease-in-out infinite",
        }}
      />
      {/* Film grain */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }} />
      {soloLockMeal && (
        <SoloLockOverlay
          meal={soloLockMeal}
          onComplete={() => {
            const mealId = soloLockMeal?.id;
            setSoloLockMeal(null);
            router.push(isGuest && mealId ? `/locked?mealId=${mealId}` : "/");
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
            <p style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 20, color: "#F6EEE2", letterSpacing: "-0.01em" }}>
              {sessionId ? "Deciding Together" : "Decision Deck"}
            </p>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#897E73", letterSpacing: "1px", marginTop: 2 }}>
              {getDeckProgressCopy(currentIndex, totalCount)}
            </p>
          </div>
          <button
            onClick={() => router.push("/")}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
              fontSize: 13,
              color: "#C7BDAC",
              padding: "8px 16px",
              borderRadius: 100,
              border: "1px solid rgba(245,237,224,0.16)",
              background: "rgba(255,231,202,0.045)",
            }}
          >
            {isChangeMeal && existingMeal ? `Keep ${existingMeal.meal.name}` : "End"}
          </button>
        </header>

        {/* Pantry bar — solo authenticated only */}
        {!sessionId && !isGuest && (
          <div className="px-5 mt-1 flex items-stretch gap-2">
            <motion.button
              onClick={() => {
                setShowIngredientSheet(true);
              }}
              animate={
                pantryMode
                  ? { boxShadow: "0 0 18px rgba(232,98,26,0.12)" }
                  : { boxShadow: "none" }
              }
              transition={{ duration: 0.3 }}
              className="flex flex-1 items-center justify-between rounded-[13px] px-4 py-2.5 text-left active:scale-[0.99] transition-all duration-200"
              style={pantryMode ? {
                border: "1px solid rgba(232,98,26,0.26)",
                background: "rgba(232,98,26,0.08)",
              } : {
                border: "1px solid rgba(245,237,224,0.085)",
                background: "rgba(255,231,202,0.045)",
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="shrink-0 transition-colors duration-200"
                  style={pantryMode
                    ? { color: "#FF8A3D", filter: "drop-shadow(0 0 4px rgba(232,98,26,0.5))" }
                    : { color: "rgba(255,255,255,0.25)" }}
                >
                  {pantryMode ? <FridgeOpen /> : <FridgeClosed />}
                </span>
                <span className="text-xs font-medium tracking-[-0.01em] transition-colors duration-200" style={pantryMode ? { color: "#FF8A3D" } : { color: "rgba(255,255,255,0.30)" }}>
                  Pantry
                </span>
                <span className="text-xs transition-colors duration-200" style={{ color: pantryMode ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.20)" }}>—</span>
                <span className="text-xs transition-colors duration-200" style={{ color: pantryMode ? "#C7BDAC" : "rgba(255,255,255,0.25)" }}>
                  {selectedIngredients.length === 0
                    ? "Use what you have"
                    : selectedIngredients.length <= 2
                    ? selectedIngredients.join(", ")
                    : `${selectedIngredients.slice(0, 2).join(", ")} +${selectedIngredients.length - 2}`}
                </span>
              </div>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 transition-colors duration-200" style={{ color: pantryMode ? "rgba(232,98,26,0.5)" : "rgba(255,255,255,0.15)" }}>
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.button>

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
              className="absolute inset-0 rounded-[28px] pointer-events-none"
              style={{
                background: "linear-gradient(180deg, rgba(255,231,202,0.05) 0%, rgba(26,20,14,0.95) 100%)",
                border: "1px solid rgba(245,237,224,0.085)",
              }}
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
            className={`relative rounded-[28px] overflow-hidden w-full ${isRecommendationCard ? "bg-[#070504]" : "bg-[#2A2420]"} cursor-grab select-none touch-none z-10 shadow-[0_10px_40px_rgba(0,0,0,0.35)] active:cursor-grabbing`}
          >
            {/* Layer 1 — Food image */}
            {imgErrors.has(meal.id) || !meal.image ? (
              <MealImageFallback mealName={meal.name} />
            ) : isRecommendationCard ? (
              /* Recommendation card: spotlight-masked image with entrance brightness ramp */
              <motion.img
                key={`rec-img-${meal.id}`}
                src={meal.image}
                alt={`Recommended: ${meal.name}`}
                draggable={false}
                onError={() => setImgErrors((prev) => new Set(prev).add(meal.id))}
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  WebkitMaskImage: "radial-gradient(ellipse 60% 52% at 50% 43%, #000 26%, rgba(0,0,0,0.5) 52%, transparent 74%)",
                  maskImage: "radial-gradient(ellipse 60% 52% at 50% 43%, #000 26%, rgba(0,0,0,0.5) 52%, transparent 74%)",
                }}
                initial={prefersReducedMotion ? { filter: "brightness(1.14) saturate(1.14)" } : { filter: "brightness(0) saturate(1.14)" }}
                animate={{ filter: "brightness(1.14) saturate(1.14)" }}
                transition={{ duration: 1.1, delay: 0.15, ease: "easeOut" }}
              />
            ) : (
              <img
                src={meal.image}
                alt={meal.name}
                draggable={false}
                onError={() => setImgErrors((prev) => new Set(prev).add(meal.id))}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* Layer 2 — Top spotlight (plain cards only; rec card uses light cone instead) */}
            {!isRecommendationCard && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse 58% 46% at 50% 2%, rgba(255,248,235,0.70) 0%, rgba(255,228,190,0.16) 30%, transparent 58%)",
                  mixBlendMode: "screen",
                }}
              />
            )}

            {/* Layer 3 — Bottom scrim + vignette */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse 90% 70% at 50% 122%, rgba(0,0,0,0.62), transparent 60%), linear-gradient(180deg, transparent 38%, rgba(6,4,3,0.82))",
              }}
            />

            {/* Layer 4 — Warm edge vignette */}
            <div className="absolute inset-0 pointer-events-none rounded-[28px]" style={{ boxShadow: "inset 0 0 60px 10px rgba(0,0,0,0.28)" }} />

            {/* ── Recommendation Card exclusive layers (deck index 0 only) ── */}
            {isRecommendationCard && (
              <>
                {/* Volumetric light cone from top-center */}
                <motion.div
                  key={`rec-cone-${meal.id}`}
                  className="absolute pointer-events-none rec-cone-anim"
                  style={{
                    left: "50%", top: "-8%", transform: "translateX(-50%)",
                    width: 250, height: 330, zIndex: 4,
                    background: "linear-gradient(180deg, rgba(255,236,200,0.32) 0%, rgba(255,224,180,0.11) 40%, transparent 76%)",
                    clipPath: "polygon(42% 0, 58% 0, 90% 100%, 10% 100%)",
                    filter: "blur(3px)",
                    animation: prefersReducedMotion ? undefined : "rec-cone-flick 4.4s ease-in-out infinite",
                  }}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.9, delay: 0.1 }}
                />
                {/* Lamp source */}
                <motion.div
                  key={`rec-lamp-${meal.id}`}
                  className="absolute pointer-events-none"
                  style={{
                    left: "50%", top: -4, transform: "translateX(-50%)",
                    width: 34, height: 8, borderRadius: "50%", zIndex: 5,
                    background: "radial-gradient(ellipse, #FFF0D2, #E8A23A 78%)",
                    boxShadow: "0 0 18px 5px rgba(255,210,150,0.55)",
                  }}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.9, delay: 0.1 }}
                />
                {/* Dust motes drifting through the beam */}
                {!prefersReducedMotion && (
                  <motion.div
                    key={`rec-motes-${meal.id}`}
                    className="absolute inset-0 pointer-events-none"
                    style={{ zIndex: 5 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                  >
                    {[
                      { left: "44%", top: "32%", delay: "0s" },
                      { left: "56%", top: "44%", delay: "1.6s" },
                      { left: "50%", top: "24%", delay: "3.1s" },
                      { left: "60%", top: "36%", delay: "4.4s" },
                      { left: "40%", top: "40%", delay: "5.6s" },
                    ].map((m, i) => (
                      <span
                        key={i}
                        className="absolute rounded-full"
                        style={{
                          width: 3, height: 3,
                          background: "rgba(255,235,200,0.7)",
                          filter: "blur(0.5px)",
                          left: m.left, top: m.top,
                          animation: `rec-drift 7s linear ${m.delay} infinite`,
                        }}
                      />
                    ))}
                  </motion.div>
                )}
                {/* Gold foil frame */}
                <motion.div
                  key={`rec-frame-${meal.id}`}
                  className="absolute inset-0 pointer-events-none rec-foil-anim"
                  style={{
                    borderRadius: 28, padding: 2, zIndex: 7,
                    background: "linear-gradient(135deg, #8A642A 0%, #F4D98A 22%, #D8B45E 40%, #FBE6AE 55%, #9A6E2A 75%, #F4D98A 100%)",
                    backgroundSize: "280% 280%",
                    WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                    WebkitMaskComposite: "xor",
                    maskComposite: "exclude",
                    animation: prefersReducedMotion ? undefined : "rec-foil 5.5s linear infinite",
                    boxShadow: "0 0 18px rgba(216,180,94,0.3), inset 0 0 14px rgba(216,180,94,0.12)",
                  }}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.75 }}
                />
              </>
            )}

            {/* YES stamp (shows when dragging right) */}
            <motion.div
              style={{ opacity: chooseOpacity }}
              className="absolute top-8 right-5 z-10 pointer-events-none rotate-12"
            >
              <span style={{
                fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 22,
                color: "#86C796", border: "3px solid #86C796",
                borderRadius: 12, padding: "3px 12px", display: "inline-block",
                textShadow: "0 0 12px rgba(134,199,150,0.5)",
              }}>
                YES ✓
              </span>
            </motion.div>

            {/* NOPE stamp (shows when dragging left) */}
            <motion.div
              style={{ opacity: passOpacity }}
              className="absolute top-8 left-5 z-10 pointer-events-none -rotate-12"
            >
              <span style={{
                fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 22,
                color: "#E88A7A", border: "3px solid #E88A7A",
                borderRadius: 12, padding: "3px 12px", display: "inline-block",
                textShadow: "0 0 12px rgba(232,138,122,0.5)",
              }}>
                NOPE
              </span>
            </motion.div>

            {/* Category + AI badge row (top of card) */}
            <div className="absolute top-0 left-0 right-0 p-4 z-10 flex items-start justify-between gap-2">
              {/* Category badge — hidden on rec card (gold frame provides the container feel) */}
              {!isRecommendationCard && (
                <div className="inline-flex rounded-full px-3 py-1 text-xs backdrop-blur-sm" style={{ background: "rgba(8,5,3,0.50)", border: "1px solid rgba(245,237,224,0.16)", color: "#C7BDAC", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
                  {meal.category}
                </div>
              )}
              {isRecommendationCard ? (
                /* Details button — replaces W seal on first card */
                <button
                  className="ml-auto inline-flex rounded-full px-3 py-1 text-xs backdrop-blur-sm"
                  style={{ background: "rgba(8,5,3,0.50)", border: "1px solid rgba(245,237,224,0.16)", color: "#F6EEE2", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setDrawerMeal(meal);
                    setDrawerOpen(true);
                    dismissDrawerHint();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  Details
                </button>
              ) : (
                <div className="flex flex-col items-end gap-1.5">
                  {aiMealIds.has(meal.id) && (
                    <div
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium backdrop-blur-sm"
                      style={meal.aiLabel === "Made from your pantry"
                        ? { border: "1px solid rgba(232,98,26,0.26)", background: "rgba(8,5,3,0.40)", color: "#FF8A3D" }
                        : { border: "1px solid rgba(245,237,224,0.16)", background: "rgba(8,5,3,0.40)", color: "#C7BDAC" }}
                    >
                      <span style={meal.aiLabel === "Made from your pantry"
                        ? { filter: "drop-shadow(0 0 4px rgba(232,98,26,0.5))", color: "#E8621A" }
                        : { color: "rgba(255,255,255,0.4)" }}>✦</span>
                      {meal.aiLabel ?? "Fresh pick"}
                    </div>
                  )}
                  {/* More trigger */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDrawerMeal(meal);
                      setDrawerOpen(true);
                      dismissDrawerHint();
                    }}
                    className={`inline-flex rounded-full px-3 py-1 text-xs backdrop-blur-sm ${
                      !drawerHintSeen && currentIndex === 0 && !showSwipeHint ? "animate-pulse" : ""
                    }`}
                    style={{ background: "rgba(8,5,3,0.50)", border: "1px solid rgba(245,237,224,0.16)", color: "#C7BDAC", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}
                  >
                    more details
                  </button>
                </div>
              )}
            </div>

            {/* Card content (bottom of card) */}
            {isRecommendationCard ? (
              /* ── Recommendation Card: centered voice line + meal name + cuisine ── */
              <div className="absolute bottom-0 left-0 right-0 px-5 pb-6 z-[8] flex flex-col items-center text-center">
                {/* Voice line */}
                <motion.div
                  key={`rec-voice-${meal.id}`}
                  initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 1.05, ease: [0.2, 0.7, 0.2, 1] }}
                  className="flex items-center gap-2"
                  style={{ marginBottom: 8 }}
                >
                  <span style={{ display: "block", width: 18, height: 1, background: "linear-gradient(90deg, transparent, #D8B45E)" }} />
                  <span style={{
                    fontFamily: "'Instrument Serif', Georgia, serif",
                    fontStyle: "italic",
                    fontSize: 17,
                    lineHeight: 1,
                    color: "#FBE6AE",
                    textShadow: "0 2px 12px rgba(0,0,0,0.8)",
                  }}>
                    {recVoiceLine}
                  </span>
                  <span style={{ display: "block", width: 18, height: 1, background: "linear-gradient(90deg, #D8B45E, transparent)" }} />
                </motion.div>
                {/* Meal name */}
                <motion.h2
                  key={`rec-name-${meal.id}`}
                  initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 1.18, ease: [0.2, 0.7, 0.2, 1] }}
                  style={{
                    fontFamily: "'Quicksand', sans-serif",
                    fontWeight: 700, fontSize: 30,
                    color: "#F6EEE2", lineHeight: 1.05,
                    letterSpacing: "-0.01em",
                    textShadow: "0 2px 14px rgba(0,0,0,0.7)",
                  }}
                >
                  {meal.name}
                </motion.h2>
                {/* Cuisine · time */}
                {recCuisineTime && (
                  <motion.p
                    key={`rec-cz-${meal.id}`}
                    initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1.3, ease: [0.2, 0.7, 0.2, 1] }}
                    style={{
                      marginTop: 6,
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 300, fontSize: 12,
                      color: "#C7BDAC",
                    }}
                  >
                    {recCuisineTime}
                  </motion.p>
                )}
              </div>
            ) : (
              /* ── Plain cards: existing left-aligned layout ── */
              <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                <h2 style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 30, color: "#F6EEE2", lineHeight: 1.05, letterSpacing: "-0.01em", textShadow: "0 2px 14px rgba(0,0,0,0.6)" }}>
                  {meal.name}
                </h2>
                <p className="mt-2 leading-relaxed line-clamp-2" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: 13, color: "#C7BDAC" }}>
                  {meal.description}
                </p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {meal.tags.map((tag) => (
                    <span
                      key={tag}
                      className="backdrop-blur-sm"
                      style={{
                        fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 11.5,
                        color: "#F6EEE2",
                        background: "rgba(255,231,202,0.045)",
                        border: "1px solid rgba(245,237,224,0.085)",
                        borderRadius: 100, padding: "5px 12px",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {pantryMode && pantryMatchCount >= 2 && (
                  <p className="text-xs mt-2" style={{ color: "#FF8A3D" }}>
                    ✦ {pantryMatchCount >= 3 ? "You've got this" : "You've got most of this"}
                  </p>
                )}
                {reason && (
                  <p className="mt-1.5 flex items-center gap-1.5" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 11.5, color: "#FF8A3D" }}>
                    <span style={{ filter: "drop-shadow(0 0 4px rgba(232,98,26,0.5))" }}>✦</span>
                    {reason}
                  </p>
                )}
              </div>
            )}

            {/* Swipe hint — first card only, dismissed on first swipe interaction */}
            <AnimatePresence>
              {showSwipeHint && currentIndex === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.5 } }}
                  transition={{ duration: 0.6, delay: 0.9 }}
                  className="pointer-events-none absolute inset-x-4 z-20 flex justify-between items-center"
                  style={{
                    bottom: "44%",
                    padding: "11px 16px",
                    borderRadius: 100,
                    background: "rgba(8,5,3,0.55)",
                    border: "1px solid rgba(245,237,224,0.16)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 12.5, color: "#E88A7A" }}>← Swipe to pass</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 12.5, color: "#86C796" }}>Swipe to choose →</span>
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
        <div className="flex items-end justify-center gap-6 mt-auto pb-6 pt-4">
          {/* PASS button */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[11px] text-[#897E73]">Pass</span>
            <button
              onClick={handlePass}
              disabled={isExiting || isChoosing}
              className="flex items-center justify-center active:scale-90 transition-transform duration-150 disabled:opacity-40"
              style={{
                width: 54, height: 54, borderRadius: "50%",
                background: "rgba(255,231,202,0.045)",
                border: "1px solid rgba(245,237,224,0.16)",
                color: "#C7BDAC", fontSize: 20,
              }}
            >
              ✕
            </button>
          </div>

          {/* YES button — dimensional ember */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[11px] text-[#897E73]">Choose</span>
            <button
              onClick={handleChoose}
              disabled={isExiting || isChoosing}
              className="flex items-center justify-center active:scale-90 transition-transform duration-150 disabled:opacity-40"
              style={{
                width: 68, height: 68, borderRadius: "50%",
                background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 60%, #B84A12 100%)",
                color: "#fff", fontSize: 26,
                boxShadow: "0 1px 0 rgba(255,224,188,0.55) inset, 0 -2px 0 rgba(120,52,0,0.35) inset, 0 14px 30px rgba(232,98,26,0.5), 0 0 0 1px rgba(232,98,26,0.4)",
              }}
            >
              ✓
            </button>
          </div>

          {/* SAVE button — green resolution accent */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[11px] text-[#897E73]">Save</span>
            <button
              onClick={handleSave}
              disabled={isExiting || isChoosing}
              className="flex items-center justify-center active:scale-90 transition-transform duration-150 disabled:opacity-40"
              style={{
                width: 54, height: 54, borderRadius: "50%",
                background: "linear-gradient(180deg, #86C796 0%, #5E9E6E 60%, #3F744F 100%)",
                color: "#FFD86A", fontSize: 20,
                boxShadow: "0 12px 26px rgba(94,158,110,0.4)",
              }}
            >
              ★
            </button>
          </div>
        </div>
      </div>

      {/* ── Match modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {matchedMeal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 overflow-y-auto"
            style={{ background: "#0B0805" }}
          >
            <div className="pointer-events-none absolute inset-0" style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
            <div className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }} />
            <motion.div
              initial={{ y: 72, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 72, opacity: 0 }}
              transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
              className="relative flex flex-col items-center justify-start min-h-screen px-6 pt-16 pb-10"
            >
              {/* Multi-layer green ambient glow */}
              <div className="absolute inset-0 pointer-events-none z-0" style={{ background: "radial-gradient(ellipse 70% 40% at 50% 38%, rgba(94,158,110,0.18) 0%, transparent 60%), radial-gradient(ellipse 80% 50% at 50% 104%, rgba(184,74,18,0.10) 0%, transparent 66%)" }} />

              <div className="relative z-10 flex flex-col items-center w-full">
                {/* 1. Green orb with multi-ring glow */}
                <div className="flex items-center justify-center relative">
                  {/* Outer faint ring */}
                  <div className="absolute w-56 h-56 rounded-full" style={{ background: "rgba(94,158,110,0.04)" }} />
                  {/* Mid ring */}
                  <div className="absolute w-44 h-44 rounded-full animate-pulse-soft" style={{ background: "rgba(94,158,110,0.08)" }} />
                  {/* Orb */}
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      type: "spring",
                      damping: 12,
                      stiffness: 260,
                      delay: 0.2,
                    }}
                    className="w-32 h-32 rounded-full flex items-center justify-center relative z-10"
                    style={{
                      background: "radial-gradient(circle at 42% 36%, #86C796, #5E9E6E 55%, #3F744F)",
                      boxShadow: "0 0 70px rgba(94,158,110,0.5), 0 0 0 18px rgba(94,158,110,0.08), 0 0 0 38px rgba(94,158,110,0.04)",
                    }}
                  >
                    <motion.span
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        type: "spring",
                        damping: 14,
                        stiffness: 300,
                        delay: 0.35,
                      }}
                      style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 52, color: "#fff", display: "inline-block" }}
                    >✓</motion.span>
                  </motion.div>
                </div>

                {/* 2. Eyebrow label */}
                <p className="mt-8" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "3px", textTransform: "uppercase", color: "#86A972" }}>
                  IT&apos;S A MATCH.
                </p>

                {/* 3. Main headline */}
                <h1 className="text-center mt-2 leading-tight" style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 38, color: "#F6EEE2", letterSpacing: "-0.02em" }}>
                  Dinner is decided.
                </h1>

                {/* 4. Meal name in green serif italic */}
                <p className="text-center mt-1" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 26, color: "#5E9E6E" }}>
                  {matchedMeal.name}
                </p>

                {/* 5. Meal image card with studio treatment */}
                <div
                  className="w-full rounded-[20px] overflow-hidden mt-6 relative"
                  style={{ aspectRatio: "16/9", border: "1px solid rgba(245,237,224,0.085)", boxShadow: "0 18px 40px rgba(0,0,0,0.45)" }}
                >
                  <img
                    src={matchedMeal.image}
                    alt={matchedMeal.name}
                    className="w-full h-full object-cover"
                  />
                  {/* Top spotlight */}
                  <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 58% 46% at 50% 2%, rgba(255,248,235,0.60) 0%, rgba(255,228,190,0.12) 30%, transparent 58%)", mixBlendMode: "screen" }} />
                  {/* Bottom scrim */}
                  <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, transparent 50%, rgba(6,4,3,0.45))" }} />
                </div>

                {/* 6. Meal description */}
                <div className="w-full mt-4 text-center">
                  <p className="mt-1 leading-relaxed" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 300, fontSize: 13, color: "#C7BDAC" }}>{matchedMeal.description}</p>
                </div>

                {/* 7. Why this works card — ember left border */}
                {rankedMeals.find((r) => r.meal.id === matchedMeal.id)?.reason && (
                  <div className="w-full rounded-[18px] p-4 mt-4 flex items-start gap-3" style={{ background: "rgba(255,231,202,0.045)", border: "1px solid rgba(245,237,224,0.085)", borderLeft: "3px solid #E8621A" }}>
                    <span style={{ filter: "drop-shadow(0 0 6px rgba(232,98,26,0.5))", color: "#E8621A", fontSize: 16, flexShrink: 0, marginTop: 1 }}>✦</span>
                    <p className="text-sm leading-relaxed" style={{ color: "#C7BDAC" }}>
                      <span style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 700, fontSize: 13, color: "#E8621A" }}>Why this works: </span>
                      {rankedMeals.find((r) => r.meal.id === matchedMeal.id)?.reason}
                    </p>
                  </div>
                )}

                {/* 8. CTA buttons */}
                <div className="flex gap-3 w-full mt-6">
                  <button
                    onClick={() => void handleMatchConfirm()}
                    disabled={matchConfirming}
                    className="flex-1 py-4 rounded-[16px] text-base disabled:opacity-60"
                    style={{
                      fontFamily: "'Quicksand', sans-serif", fontWeight: 700, color: "#06140a",
                      background: "linear-gradient(180deg, #86C796 0%, #5E9E6E 50%, #3F744F 100%)",
                      boxShadow: "0 1px 0 rgba(220,255,228,0.5) inset, 0 -2px 0 rgba(20,60,30,0.4) inset, 0 14px 30px rgba(94,158,110,0.32)",
                    }}
                  >
                    {matchConfirming ? "Locking in…" : "Let's eat 🙌"}
                  </button>
                </div>
                {matchConfirmError && (
                  <p className="text-center text-sm text-red-400 mt-3">{matchConfirmError}</p>
                )}

                {/* 9. Footer — other matches count (solo only) */}
                {!sessionId && rejectedMatchIdsRef.current.size > 0 && (
                  <p className="text-center mt-4">
                    <span className="text-sm" style={{ color: "#897E73" }}>
                      {rejectedMatchIdsRef.current.size} other {rejectedMatchIdsRef.current.size === 1 ? "match" : "matches"} waiting.{" "}
                    </span>
                    <button onClick={handleMatchReject} className="font-semibold text-sm" style={{ color: "#E8621A" }}>
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

      {/* ── Meal detail drawer ────────────────────────────────────────────────── */}
      <MealDetailDrawer
        meal={drawerMeal}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onYes={() => {
          setDrawerOpen(false);
          handleChoose();
        }}
        onSkip={() => {
          setDrawerOpen(false);
          handlePass();
        }}
        context={sessionId ? "shared" : "solo"}
      />

      {/* ── Ingredient sheet backdrop ─────────────────────────────────────── */}
      <AnimatePresence>
        {showIngredientSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              setShowIngredientSheet(false);
              if (selectedIngredients.length === 0) {
                setPantryMode(false);
              }
            }}
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
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-[28px] px-5 pb-10 pt-4"
            style={{
              background: "linear-gradient(180deg, rgba(255,231,202,0.07) 0%, #0F0C09 6%)",
              borderTop: "1px solid rgba(245,237,224,0.085)",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
              backdropFilter: "blur(24px)",
            }}
          >
            {/* Drag handle */}
            <div className="mx-auto mb-2 h-1 w-10 rounded-full" style={{ background: "rgba(245,237,224,0.15)" }} />

            {/* Header */}
            <div className="mb-4 mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span style={{ color: "#E8621A", filter: "drop-shadow(0 0 5px rgba(232,98,26,0.5))", fontSize: 11 }}>✦</span>
                <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "2.4px", textTransform: "uppercase", color: "#E8621A" }}>
                  What&apos;s in your kitchen?
                </h3>
              </div>
              {selectedIngredients.length > 0 && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "rgba(232,98,26,0.10)", border: "1px solid rgba(232,98,26,0.26)", color: "#FF8A3D" }}>
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
              onClick={() => {
                preserveCurrentIndexRef.current = true;
                setShowIngredientSheet(false);
                if (selectedIngredients.length > 0) {
                  setPantryMode(true);
                } else {
                  setPantryMode(false);
                }
              }}
              className="mt-5 w-full rounded-full border border-white/[0.07] bg-white/[0.05] py-3 text-sm font-medium text-white/55 transition hover:bg-white/[0.09] active:scale-[0.98]"
            >
              Done
            </button>

            {/* Turn off */}
            {pantryMode && (
              <button
                onClick={() => {
                  preserveCurrentIndexRef.current = true;
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

      {showGuestLimit && (
        <GuestLimitPrompt onClose={() => setShowGuestLimit(false)} />
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
