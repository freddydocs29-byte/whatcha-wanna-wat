"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import BottomNav from "./components/BottomNav";
import { AnimatedHeadlineWord } from "./components/AnimatedHeadlineWord";
import SplashScreen from "./components/SplashScreen";
import { supabase } from "./lib/supabase";
import { getUserId } from "./lib/identity";
import {
  getSavedMeals,
  getFavorites,
  getHistory,
  hasCompletedOnboarding,
  markOnboardingDone,
  getTodaysPick,
  getDecidedMeal,
  clearDecidedMeal,
  getStreak,
  clearTodaysPick,
  saveMeal,
  removeSavedMeal,
  getSavedMealsEnriched,
  addFavorite,
  addToHistory,
  saveDecidedMeal,
  HistoryEntry,
  type DecidedMeal,
  mealWasManuallyClearedAfter,
} from "./lib/storage";
import { meals, type Meal } from "./data/meals";
import { MealDetailDrawer } from "./components/MealDetailDrawer";
import { fetchProfileByAuthUserId } from "./lib/supabase-profile";
import type { Profile } from "./lib/supabase";
import { trackEvent } from "./lib/analytics";
import { getLockedMealHeadline, type LockedMealHeadlineResult } from "./lib/locked-copy";
import { generateSessionCode } from "./lib/session-code";
import FlavorTypeReveal from "./components/FlavorTypeReveal";
import { checkAndTriggerTypeReveal } from "./lib/type-reveal-trigger";
import V3AppShell from "./components/v3/V3AppShell";
import V3WatchaHeader from "./components/v3/V3WatchaHeader";
import V3PeopleSelector from "./components/v3/V3PeopleSelector";
import V3VibeCard from "./components/v3/V3VibeCard";
import V3ContextReadCard from "./components/v3/V3ContextReadCard";
import type { SessionVibeMode } from "./lib/scoring";
import V3PrimaryDecisionCTA from "./components/v3/V3PrimaryDecisionCTA";
import V3PostMatchHome from "./components/v3/V3PostMatchHome";
import V3LockedMealCard from "./components/v3/V3LockedMealCard";
import V3MealActionRows from "./components/v3/V3MealActionRows";
import V3MealActionDrawer from "./components/v3/V3MealActionDrawer";
import V3RecentWins, { type WinItem } from "./components/v3/V3RecentWins";
import V3InviteDrawer from "./components/v3/V3InviteDrawer";
import V3MenuDrawer from "./components/v3/V3MenuDrawer";
import V3NotificationsDrawer from "./components/v3/V3NotificationsDrawer";
import { getAllPartners, type PartnerInfo } from "./lib/dna";
import { motion, AnimatePresence } from "framer-motion";
import type { PersonV3 } from "./components/v3/V3PeopleSelector";

function deriveInsights(history: HistoryEntry[]): string[] {
  if (history.length < 3) return [];

  const recent = history.slice(0, Math.min(10, history.length));
  const insights: string[] = [];

  // 1. Category pattern
  const catCounts: Record<string, number> = {};
  recent.forEach(({ meal }) => {
    catCounts[meal.category] = (catCounts[meal.category] || 0) + 1;
  });
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
  const catPhrases: Record<string, string> = {
    "Comfort food": "Leaning quick and comforting",
    "Quick & casual": "Keeping things fast and easy",
    "Healthy": "Keeping things on the lighter side",
    "Bold flavors": "Going for bold flavors lately",
    "Elevated": "Going a little fancy lately",
    "Classic Italian": "On an Italian kick lately",
    "Mediterranean": "Feeling Mediterranean lately",
    "Fresh": "Craving something fresh",
    "Crowd pleaser": "Sticking to crowd pleasers",
  };
  if (topCat && topCat[1] >= 2) {
    insights.push(catPhrases[topCat[0]] ?? `Drawn to ${topCat[0].toLowerCase()}`);
  }

  // 2. Tag pattern (speed/effort)
  const tagCounts: Record<string, number> = {};
  recent.forEach(({ meal }) => {
    meal.tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const quickCount = ["15 min", "20 min", "25 min"].reduce(
    (sum, t) => sum + (tagCounts[t] || 0),
    0,
  );
  if ((tagCounts["Easy"] || 0) >= 3 && insights.length < 2) {
    insights.push("Picking easy meals more often");
  } else if (quickCount >= 3 && insights.length < 2) {
    insights.push("Going for quick meals lately");
  }

  // 3. Protein/ingredient pattern
  const proteins = ["chicken", "beef", "shrimp", "salmon", "pork", "tofu", "eggs", "tuna"];
  const proteinCounts: Record<string, number> = {};
  recent.forEach(({ meal }) => {
    (meal.ingredients ?? []).forEach((ing) => {
      const lower = ing.toLowerCase();
      proteins.forEach((p) => {
        if (lower.includes(p)) proteinCounts[p] = (proteinCounts[p] || 0) + 1;
      });
    });
  });
  const topProtein = Object.entries(proteinCounts).sort((a, b) => b[1] - a[1])[0];
  if (topProtein && topProtein[1] >= 2 && insights.length < 2) {
    insights.push(`Picking ${topProtein[0]} often`);
  }

  // 4. Time-of-day pattern
  if (insights.length < 2) {
    const buckets: Record<string, number> = { morning: 0, lunch: 0, dinner: 0, late: 0 };
    recent.forEach(({ chosenAt }) => {
      const h = new Date(chosenAt).getHours();
      if (h < 11) buckets.morning++;
      else if (h < 15) buckets.lunch++;
      else if (h < 20) buckets.dinner++;
      else buckets.late++;
    });
    const topTime = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
    const timePhrases: Record<string, string> = {
      morning: "Deciding early — breakfast person?",
      lunch: "Most active around lunchtime",
      dinner: "Most active around dinner time",
      late: "A late-night decider",
    };
    if (topTime && topTime[1] >= 3) insights.push(timePhrases[topTime[0]]);
  }

  return insights.slice(0, 3);
}

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  // showSplash: true when no Supabase session exists (logged-out user)
  // ready: true when session confirmed and home data loaded
  // While neither is set, we're waiting for the auth check — render null.
  const [showSplash, setShowSplash] = useState(false);
  const [ready, setReady] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [insights, setInsights] = useState<string[]>([]);
  const [todaysPick, setTodaysPick] = useState<HistoryEntry | null>(null);
  const [decidedMeal, setDecidedMealState] = useState<DecidedMeal | null>(null);
  const [streak, setStreak] = useState(0);
  const [recentHistory, setRecentHistory] = useState<HistoryEntry[]>([]);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearStep, setClearStep] = useState<"confirm" | "completed" | "save">(
    "confirm",
  );
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showEatModal, setShowEatModal] = useState(false);
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(null);
  const [lockedHeadline, setLockedHeadline] = useState<LockedMealHeadlineResult | null>(null);
  const [typeRevealData, setTypeRevealData] = useState<{ typeName: string; tagline: string } | null>(null);
  const [activeSession, setActiveSession] = useState<{
    sessionId: string;
    sessionCode: string | null;
    status: string;
    vibe?: string;
  } | null>(null);
  const [userDoneSwiping, setUserDoneSwiping] = useState(false);
  const [partnerDoneSwiping, setPartnerDoneSwiping] = useState(false);
  const [showMatchCelebration, setShowMatchCelebration] = useState(false);
  const matchCelebrationShownRef = useRef<Set<string>>(new Set());
  // V3 Home shell state
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);
  const [decidedSaved, setDecidedSaved] = useState(false);
  const [savedJustNow, setSavedJustNow] = useState(false);
  const [drawerMeal, setDrawerMeal] = useState<Meal | null>(null);
  const [mealActionMode, setMealActionMode] = useState<"cook" | "order" | null>(null);
  const [partners, setPartners] = useState<PartnerInfo[]>([]);
  const [showInviteDrawer, setShowInviteDrawer] = useState(false);
  const [selectedRecentMeal, setSelectedRecentMeal] = useState<Meal | null>(null);
  const [selectedVibe, setSelectedVibe] = useState<SessionVibeMode>("comfort-food");
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);
  // Pending in-app invite from a selected partner
  const [pendingInvite, setPendingInvite] = useState<{
    id: string;
    session_id: string;
    session_code: string;
    from_user_id: string;
    vibe: string | null;
    inviterName: string | null;
    inviterAvatar: string | null;
  } | null>(null);
  // Mirrors typeRevealData so event handlers added in [] effects don't get stale closures.
  const typeRevealDataRef = useRef<{ typeName: string; tagline: string } | null>(null);

  useEffect(() => {
    async function checkAndRoute() {
      // getSession() reads from the Supabase localStorage cache — no network call.
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // No active session — show splash for logged-out users.
        setShowSplash(true);
        return;
      }

      // Session exists — check whether onboarding is complete.
      // Fast path: localStorage flag (same device as previous visit).
      if (!hasCompletedOnboarding()) {
        // Slow path: fetch Supabase profile (new device or cleared localStorage).
        // A profile is considered complete when display_name and at least one
        // cuisine preference are present.
        const profile = await fetchProfileByAuthUserId(session.user.id);
        const profileComplete =
          !!profile &&
          !!(profile.display_name) &&
          (profile.favorite_cuisines?.length ?? 0) > 0;

        if (!profileComplete) {
          router.replace("/onboarding");
          return;
        }
        // Profile is complete — set the flag so the next load uses the fast path.
        markOnboardingDone();
      }

      // Load home data.
      const saved = getSavedMeals();
      const favorites = getFavorites();
      const favoriteIds = new Set(favorites.map((m) => m.id));
      const savedForLater = saved.filter((m) => !favoriteIds.has(m.id));
      setSavedCount(favorites.length + savedForLater.length);
      const history = getHistory();
      setHistoryCount(history.length);
      setInsights(deriveInsights(history));
      setRecentHistory(history.slice(0, 8));
      const pick = getTodaysPick();
      setTodaysPick(pick);
      const decided = getDecidedMeal();
      setDecidedMealState(decided);
      if (decided) setDecidedSaved(getSavedMealsEnriched().some((s) => s.meal.id === decided.id));
      if (pick) setSaved(getSavedMealsEnriched().some((s) => s.meal.id === pick.meal.id));
      setStreak(getStreak());
      fetchProfileByAuthUserId(session.user.id).then((p) => {
        setProfile(p);
        const url = p?.avatar_url ?? localStorage.getItem('wwe_avatar_url');
        if (url) setResolvedAvatarUrl(url);
      }).catch(() => {});
      setReady(true);

      // Fire-and-forget — never blocks Home from showing
      const userId = getUserId();
      getAllPartners(userId).then((list) => {
        const hiddenRaw = typeof window !== "undefined"
          ? localStorage.getItem(`wwe_hidden_home_partners_${userId}`)
          : null;
        const hiddenIds = new Set<string>(hiddenRaw ? JSON.parse(hiddenRaw) : []);
        const visible = list.filter((p) => !hiddenIds.has(p.partnerId));
        setPartners(visible.slice(0, 3));
      }).catch((err) => {
        console.warn("[home] partner_relationships fetch failed — showing only You + Invite", err);
      });

      // Track once per browser session so repeated navigations don't re-fire.
      if (!sessionStorage.getItem("wwe_app_opened")) {
        sessionStorage.setItem("wwe_app_opened", "1");
        trackEvent("app_opened");
      }
    }

    void checkAndRoute();
  }, [router]);

  // Runs on every render — syncs React state with localStorage truth
  useEffect(() => {
    const saved = localStorage.getItem('watcha_decided_meal')
    const clearedAt = localStorage.getItem('wwe_meal_cleared_at')

    if (!saved) {
      // No meal in localStorage — clear state regardless of what React thinks
      setDecidedMealState(null)
      setTodaysPick(null)
      return
    }

    try {
      const parsed = JSON.parse(saved)

      // Check if manually cleared
      if (clearedAt) {
        const clearedAtTime = parseInt(clearedAt, 10)
        const decidedAtTime = new Date(parsed.decidedAt).getTime()
        if (clearedAtTime > decidedAtTime) {
          setDecidedMealState(null)
          setTodaysPick(null)
          return
        }
      }

      // Check 6 hour expiry
      const sixHours = 6 * 60 * 60 * 1000
      if (Date.now() - new Date(parsed.decidedAt).getTime() > sixHours) {
        setDecidedMealState(null)
        setTodaysPick(null)
        localStorage.removeItem('watcha_decided_meal')
        return
      }

      // Meal is valid — sync state if it differs from localStorage truth.
      // Compare by id+decidedAt to avoid unnecessary re-renders.
      if (!decidedMeal || decidedMeal.id !== parsed.id || decidedMeal.decidedAt !== parsed.decidedAt) {
        setDecidedMealState(parsed)
      }

    } catch {
      setDecidedMealState(null)
      setTodaysPick(null)
    }
  }) // NO dependency array — runs on every render

  // Handle late restores from ProfileProvider (e.g. after Supabase hydration)
  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem('watcha_decided_meal')
      if (!saved) return
      try {
        const parsed = JSON.parse(saved)
        if (mealWasManuallyClearedAfter(parsed.decidedAt)) {
          localStorage.removeItem('watcha_decided_meal')
          setDecidedMealState(null)
          setTodaysPick(null)
          return
        }
        setDecidedMealState(parsed)
        setTodaysPick({
          meal: { id: parsed.id, name: parsed.name, image: parsed.image, description: parsed.description },
          chosenAt: parsed.decidedAt,
        } as HistoryEntry)
      } catch {}
    }
    window.addEventListener('decidedMealRestored', handler)
    return () => window.removeEventListener('decidedMealRestored', handler)
  }, [])

  // Generate a context-aware headline whenever the decided meal or profile changes.
  // No localStorage caching — the function is cheap and caching caused a race where
  // the headline was generated before the profile loaded (userName always null).
  const decidedMealId = decidedMeal?.id ?? "";
  const decidedMealDecidedAt = decidedMeal?.decidedAt ?? "";
  const resolvedUserName = profile?.display_name ?? "";
  useEffect(() => {
    if (!decidedMeal) {
      setLockedHeadline(null);
      return;
    }
    if (profile === undefined) return; // still loading — wait

    const generated = getLockedMealHeadline({
      meal: decidedMeal,
      userName: profile?.display_name ?? null,
      mode: decidedMeal.mode,
      history: getHistory(),
    });
    setLockedHeadline(generated);
  }, [decidedMealId, decidedMealDecidedAt, resolvedUserName]);

  // Load, validate, and poll any active shared session from localStorage.
  // Handles matched state directly on the home screen so the user sees their
  // match without re-entering the deck.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("wwe_active_session");
    if (!stored) return;

    let parsed: { sessionId: string; sessionCode?: string; expiresAt?: string; status?: string; vibe?: string } | null = null;
    try {
      parsed = JSON.parse(stored);
    } catch {
      localStorage.removeItem("wwe_active_session");
      return;
    }

    if (!parsed?.sessionId) {
      localStorage.removeItem("wwe_active_session");
      return;
    }

    // Client-side expiry check
    if (parsed.expiresAt && new Date(parsed.expiresAt) <= new Date()) {
      localStorage.removeItem("wwe_active_session");
      return;
    }

    const sessionId = parsed.sessionId;
    let mounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    // Read immediately on mount — don't wait for the async query to resolve
    const doneSwiping = localStorage.getItem(`wwe_session_swiping_done_${sessionId}`) === 'true';
    setUserDoneSwiping(doneSwiping);

    const checkSession = async () => {
      if (!mounted) return;
      try {
        const { data } = await supabase
          .from("sessions")
          .select("id, status, locked_meal_id, host_user_id, guest_user_id, deck_meal_ids, session_code, vibe, expires_at, created_at")
          .eq("id", sessionId)
          .single();

        if (!mounted) return;

        if (!data || data.status === "expired") {
          localStorage.removeItem("wwe_active_session");
          localStorage.removeItem(`wwe_session_swiping_done_${sessionId}`);
          setActiveSession(null);
          setUserDoneSwiping(false);
          setPartnerDoneSwiping(false);
          if (intervalId) clearInterval(intervalId);
          return;
        }

        if (data.status === "matched") {
          // Show celebration flash once per matched session, then surface the decided meal.
          // locked_meal_id is the real session field that holds the matched meal.
          if (!matchCelebrationShownRef.current.has(sessionId)) {
            matchCelebrationShownRef.current.add(sessionId);
            const meal = meals.find((m) => m.id === data.locked_meal_id);
            if (meal) {
              const decidedAt = new Date().toISOString();
              const decidedMealData: DecidedMeal = { ...meal, decidedAt, mode: "shared", sessionId };
              addToHistory(meal);
              saveDecidedMeal(decidedMealData);

              // Decision rows for both users are written atomically by the
              // record_shared_match_decision RPC when the confirming user taps
              // confirm. Nothing to write here.

              // Update React state directly so the decided-state UI appears immediately
              setDecidedMealState(decidedMealData);
              setTodaysPick({ meal, chosenAt: decidedAt });
              // Fire and forget — never blocks the match flow.
              void checkAndTriggerTypeReveal();
            } else {
              console.warn("[home] matched session has locked_meal_id not found in catalog:", data.locked_meal_id);
            }
            setShowMatchCelebration(true);
            setTimeout(() => { if (mounted) setShowMatchCelebration(false); }, 2000);
          }
          localStorage.removeItem("wwe_active_session");
          localStorage.removeItem(`wwe_session_swiping_done_${sessionId}`);
          setActiveSession(null);
          setUserDoneSwiping(false);
          setPartnerDoneSwiping(false);
          if (intervalId) clearInterval(intervalId);
          return;
        }

        // For active/swiping sessions, detect whether the partner has finished swiping.
        // deck_meal_ids.length is the canonical shared deck size.
        // Distinct meal_id count in swipes table is the partner's progress.
        const deckSize = (data.deck_meal_ids as string[] | null)?.length ?? 0;
        if (deckSize > 0) {
          const currentUserId = getUserId();
          const partnerId =
            data.host_user_id === currentUserId ? data.guest_user_id : data.host_user_id;
          if (partnerId) {
            const { data: partnerSwipes } = await supabase
              .from("swipes")
              .select("meal_id")
              .eq("session_id", sessionId)
              .eq("user_id", partnerId);
            if (mounted && partnerSwipes) {
              const distinctCount = new Set(partnerSwipes.map((s) => s.meal_id)).size;
              setPartnerDoneSwiping(distinctCount >= deckSize);
            }
          }
        }

        setActiveSession({
          sessionId,
          sessionCode: data.session_code ?? null,
          status: data.status,
          vibe: data.vibe ?? undefined,
        });
        // Re-read flag on every poll tick — the separate effect only fires when sessionId changes
        const done = localStorage.getItem(`wwe_session_swiping_done_${sessionId}`) === 'true';
        setUserDoneSwiping(done);
      } catch {}
    };

    void checkSession();
    intervalId = setInterval(() => { void checkSession(); }, 4000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for pending in-app invites addressed to this user.
  // Checks once on mount then every 12 seconds while Home is visible.
  useEffect(() => {
    const myId = getUserId();
    let mounted = true;

    async function fetchPendingInvite() {
      try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from("session_invites")
          .select("id, session_id, session_code, from_user_id, vibe, created_at")
          .eq("to_user_id", myId)
          .eq("status", "pending")
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) {
          console.warn("[invites] Failed to poll pending invites:", error.message);
          return;
        }

        if (!mounted) return;

        if (!data || data.length === 0) {
          setPendingInvite(null);
          return;
        }

        const invite = data[0];
        const { data: profileData } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("user_id", invite.from_user_id)
          .single();

        if (!mounted) return;

        setPendingInvite({
          id: invite.id,
          session_id: invite.session_id,
          session_code: invite.session_code,
          from_user_id: invite.from_user_id,
          vibe: invite.vibe ?? null,
          inviterName: profileData?.display_name ?? null,
          inviterAvatar: profileData?.avatar_url ?? null,
        });
      } catch (e) {
        console.warn("[invites] Unexpected error polling invites:", e);
      }
    }

    void fetchPendingInvite();
    const intervalId = setInterval(() => { void fetchPendingInvite(); }, 12000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleJoinInvite() {
    if (!pendingInvite) return;
    const { error } = await supabase
      .from("session_invites")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", pendingInvite.id);
    if (error) {
      console.warn("[invites] Failed to mark invite accepted:", error.message);
    }
    router.push(`/join/${pendingInvite.session_code}`);
  }

  async function handleDismissInvite() {
    if (!pendingInvite) return;
    const { error } = await supabase
      .from("session_invites")
      .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
      .eq("id", pendingInvite.id);
    if (error) {
      console.warn("[invites] Failed to mark invite dismissed:", error.message);
    }
    setPendingInvite(null);
  }

  // Keep the ref in sync so event handlers wired with [] deps always see the
  // latest typeRevealData without needing a stale closure.
  useEffect(() => { typeRevealDataRef.current = typeRevealData; }, [typeRevealData]);

  // Consumes wwe_type_reveal_pending and fires the overlay exactly once.
  // Guarded against SSR and double-show.
  function checkPendingTypeReveal() {
    if (typeof window === "undefined") return;
    if (typeRevealDataRef.current) return; // already showing — don't double-fire

    const revealPending = localStorage.getItem("wwe_type_reveal_pending");
    if (!revealPending) return;

    try {
      const { typeName, tagline } = JSON.parse(revealPending) as { typeName: string; tagline: string };
      // Mark revealed before updating state — prevents any race if component
      // unmounts before onDismiss fires.
      localStorage.setItem("wwe_type_revealed", "true");
      localStorage.removeItem("wwe_type_reveal_pending");
      setTypeRevealData({ typeName, tagline });
    } catch {
      localStorage.removeItem("wwe_type_reveal_pending");
    }
  }

  // 1. Check on home mount.
  useEffect(() => {
    checkPendingTypeReveal();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Check on window focus (tab switch / app return) and visibilitychange.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onFocus = () => checkPendingTypeReveal();
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkPendingTypeReveal();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 3. Check whenever the client-side pathname becomes "/" (bottom-nav navigation).
  useEffect(() => {
    if (pathname === "/") checkPendingTypeReveal();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // 4. After a decision locks in, give the background type-reveal check ~3 s to
  //    finish, then poll once more — so the reveal fires without requiring a
  //    focus/visibility event or a Profile visit.
  useEffect(() => {
    if (!decidedMeal) return;
    const timer = setTimeout(() => checkPendingTypeReveal(), 3000);
    return () => clearTimeout(timer);
  }, [decidedMealId, decidedMealDecidedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync userDoneSwiping from localStorage whenever the active session changes.
  // partnerDoneSwiping resets to false here; the polling updates it independently.
  useEffect(() => {
    if (!activeSession) {
      setUserDoneSwiping(false);
      setPartnerDoneSwiping(false);
      return;
    }
    const done = typeof window !== 'undefined' &&
      localStorage.getItem(`wwe_session_swiping_done_${activeSession.sessionId}`) === 'true';
    setUserDoneSwiping(done);
  }, [activeSession?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleResumeBanner() {
    if (!activeSession) return;
    if (activeSession.status === "swiping") {
      router.push(`/deck?sessionId=${activeSession.sessionId}&vibe=${activeSession.vibe ?? "mix-it-up"}`);
    } else {
      router.push(`/session/${activeSession.sessionId}`);
    }
  }

  function handleDismissBanner() {
    localStorage.removeItem("wwe_active_session");
    setActiveSession(null);
  }

  function handleRevealDismiss() {
    setTypeRevealData(null);
  }

  function handleRevealViewProfile() {
    setTypeRevealData(null);
    router.push("/profile");
  }

  function openClearModal() {
    setClearStep("confirm");
    setShowClearModal(true);
  }

  function closeClearModal() {
    setShowClearModal(false);
    setClearStep("confirm");
  }

  async function handleDecideWithSomeone() {
    setCreatingSession(true);
    setSessionError(null);

    // Diagnostic: log env var presence (not values) so preview failures are immediately visible
    console.log("[session] env check — NEXT_PUBLIC_SUPABASE_URL present:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("[session] env check — NEXT_PUBLIC_SUPABASE_ANON_KEY present:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    try {
      const hostId = getUserId();
      // 12-hour window — matches the DB column default
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

      // Retry up to 3 times on session_code uniqueness collision
      let data = null;
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const sessionCode = generateSessionCode();
        const result = await supabase
          .from("sessions")
          .insert({
            host_user_id: hostId,
            status: "waiting",
            expires_at: expiresAt,
            vibe: selectedVibe,
            cooking_intent: "either",
            session_code: sessionCode,
          })
          .select()
          .single();

        if (!result.error) {
          data = result.data;
          lastError = null;
          break;
        }
        // 23505 = unique_violation — retry with a new code; anything else bail immediately
        if (result.error.code !== "23505") {
          lastError = result.error;
          break;
        }
        lastError = result.error;
      }

      if (!data) {
        console.error("[session] Failed to create session:", {
          message: lastError?.message,
          code: lastError?.code,
          details: lastError?.details,
          hint: lastError?.hint,
        });
        const detail = [lastError?.code, lastError?.message].filter(Boolean).join(" — ");
        setSessionError(
          detail
            ? `Couldn't start a session: ${detail}`
            : "Couldn't start a session. Check your connection and try again.",
        );
        setCreatingSession(false);
        return;
      }

      // Persist the active session for 12 hours so other parts of the app can read it
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "wwe_active_session",
          JSON.stringify({
            sessionId: data.id,
            sessionCode: data.session_code,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
            status: "waiting",
          }),
        );
      }

      trackEvent("shared_session_created", { sessionId: data.id, sessionCode: data.session_code });

      // Fire-and-forget invite rows for any explicitly selected partners.
      // Does not block session creation — failure is logged and swallowed.
      if (selectedPeopleIds.length > 0) {
        void createInviteRows(data.id, data.session_code, expiresAt, selectedPeopleIds, selectedVibe);
      }

      router.push(`/session/${data.id}`);
    } catch (e) {
      console.error("[session] Unexpected error:", e);
      setSessionError("Something went wrong. Please try again.");
      setCreatingSession(false);
    }
  }

  // Creates a shared session for the invite drawer without navigating away.
  // Separate from handleDecideWithSomeone so that function remains unchanged.
  async function createSessionForInvite(): Promise<{ sessionId: string; sessionCode: string } | null> {
    try {
      const hostId = getUserId();
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      for (let attempt = 0; attempt < 3; attempt++) {
        const sessionCode = generateSessionCode();
        const result = await supabase
          .from("sessions")
          .insert({
            host_user_id: hostId,
            status: "waiting",
            expires_at: expiresAt,
            vibe: "mix-it-up",
            cooking_intent: "either",
            session_code: sessionCode,
          })
          .select()
          .single();
        if (!result.error) {
          if (typeof window !== "undefined") {
            localStorage.setItem(
              "wwe_active_session",
              JSON.stringify({
                sessionId: result.data.id,
                sessionCode: result.data.session_code,
                createdAt: new Date().toISOString(),
                expiresAt,
                status: "waiting",
              }),
            );
          }
          trackEvent("shared_session_created", { sessionId: result.data.id, sessionCode: result.data.session_code });
          return { sessionId: result.data.id, sessionCode: result.data.session_code };
        }
        if (result.error.code !== "23505") break;
      }
    } catch (e) {
      console.error("[session] createSessionForInvite error:", e);
    }
    return null;
  }

  // Inserts session_invites rows for each selected partner.
  // Fire-and-forget — callers should not await this.
  async function createInviteRows(
    sessionId: string,
    sessionCode: string,
    expiresAt: string,
    partnerIds: string[],
    vibe: string,
  ): Promise<void> {
    const fromUserId = getUserId();
    const rows = partnerIds.map((toUserId) => ({
      session_id: sessionId,
      session_code: sessionCode,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      status: "pending",
      vibe,
      expires_at: expiresAt,
    }));
    const { error } = await supabase.from("session_invites").insert(rows);
    if (error) {
      console.warn("[invites] Failed to create invite rows:", error.message);
    }
  }

  function recordPickIfNew() {
    if (!todaysPick) return;
    const today = new Date().toLocaleDateString();
    const alreadyToday = getHistory().some(
      (e) =>
        e.meal.id === todaysPick.meal.id &&
        new Date(e.chosenAt).toLocaleDateString() === today,
    );
    if (!alreadyToday) addToHistory(todaysPick.meal);
  }

  function handleClearDecision() {
    clearTodaysPick();
    clearDecidedMeal();
    setTodaysPick(null);
    setStreak(getStreak());
    setShowClearModal(false);
    setClearStep("confirm");
  }

  function toggleSave() {
    if (!todaysPick) return;
    if (saved) {
      removeSavedMeal(todaysPick.meal.id);
      setSaved(false);
    } else {
      saveMeal(todaysPick.meal);
      setSaved(true);
    }
  }

  function handleCookDirect() {
    if (!decidedMeal) return;
    recordPickIfNew();
    setMealActionMode("cook");
  }

  function handleOrderDirect() {
    if (!decidedMeal) return;
    recordPickIfNew();
    setMealActionMode("order");
  }

  function toggleSaveDecidedMeal() {
    if (!decidedMeal) return;
    if (decidedSaved) {
      removeSavedMeal(decidedMeal.id);
      setDecidedSaved(false);
    } else {
      saveMeal(decidedMeal);
      setDecidedSaved(true);
      setSavedJustNow(true);
      setTimeout(() => setSavedJustNow(false), 2000);
    }
  }

  // Auth check in flight — render nothing to avoid a flash of splash for signed-in users.
  if (!showSplash && !ready) return null;

  // No session — logged-out user sees the splash.
  if (showSplash) {
    return (
      <SplashScreen
        onLetsGo={() => router.push("/auth?mode=signup")}
        onSignIn={() => router.push("/auth?mode=signin")}
      />
    );
  }

  const hour = new Date().getHours();
  const timeOfDay =
    hour < 12 ? "morning" :
    hour < 17 ? "afternoon" :
    hour < 21 ? "evening" :
    "latenight";

  // Rotating headlines keyed by time-of-day. Cycles daily (by day-of-month)
  // so the headline feels fresh without jumping on every re-render.
  const headlinesByTime: Record<string, string[]> = {
    morning: [
      "What are we eating today?",
      "Let's plan today's meals.",
      "Good food starts with a plan.",
      "Let's make today delicious.",
    ],
    afternoon: [
      "What's the plan for dinner?",
      "Let's figure out tonight's move.",
      "Time to decide what we're eating.",
      "Dinner won't plan itself.",
    ],
    evening: [
      "Let's figure out tonight's move.",
      "What's for dinner tonight?",
      "Time to make the call.",
      "Tonight's menu — let's decide.",
    ],
    latenight: [
      "Late night snack? Let's figure it out.",
      "Still hungry? We've got you.",
      "Night owl eats. Let's decide.",
      "What are we doing about food?",
    ],
  };
  const dayOfMonth = new Date().getDate();
  const headlineOptions = headlinesByTime[timeOfDay];
  const rotatingHeadline = headlineOptions[dayOfMonth % headlineOptions.length];

  // Greeting line — late night gets its own phrasing instead of "Good latenight"
  const greetingPhrase =
    timeOfDay === "latenight" ? "Still up" : `Good ${timeOfDay}`;

  // Banner variant drives copy and visual styling.
  // Evaluated once per render from stable state so the JSX stays declarative.
  const bannerVariant: 'waiting' | 'ready' | 'swiping' | 'partner-done' | 'user-done' | 'both-done' =
    !activeSession ? 'swiping' :
    activeSession.status === 'waiting' ? 'waiting' :
    activeSession.status === 'ready' ? 'ready' :
    (activeSession.status === 'swiping' || activeSession.status === 'active') && !userDoneSwiping && partnerDoneSwiping ? 'partner-done' :
    (activeSession.status === 'swiping' || activeSession.status === 'active') && userDoneSwiping && partnerDoneSwiping ? 'both-done' :
    (activeSession.status === 'swiping' || activeSession.status === 'active') && userDoneSwiping && !partnerDoneSwiping ? 'user-done' :
    'swiping';

  const bannerBorderClass =
    bannerVariant === 'partner-done' ? 'border-[#4A7C59]/50' :
    bannerVariant === 'both-done' ? 'border-[#C9983A]/40' :
    'border-[#E8621A]/40';

  const bannerBoxShadow =
    bannerVariant === 'partner-done' ? '0 0 24px rgba(74,124,89,0.2)' :
    '0 0 20px rgba(232,98,26,0.15)';

  const bannerDotClass =
    bannerVariant === 'partner-done' ? 'bg-[#4A7C59]' :
    bannerVariant === 'both-done' ? 'bg-[#C9983A]' :
    'bg-[#E8621A]';

  const bannerDotPingClass =
    bannerVariant === 'partner-done' ? 'bg-[#4A7C59]/70' : 'bg-[#E8621A]/70';

  const bannerHeadline =
    bannerVariant === 'waiting' ? 'Waiting for your partner' :
    bannerVariant === 'ready' ? 'Your partner joined! Tap to continue' :
    bannerVariant === 'partner-done' ? 'Your partner finished swiping' :
    bannerVariant === 'user-done' ? "You\u2019re done swiping" :
    bannerVariant === 'both-done' ? 'No match yet' :
    'Session in progress \u00b7 Tap to keep swiping';

  const bannerSubtext: string | null =
    bannerVariant === 'partner-done' ? 'Your turn to finish \u00b7 Tap to keep swiping' :
    bannerVariant === 'user-done' ? `Waiting on their picks\u00b7 Code: ${activeSession?.sessionCode ?? ''}` :
    bannerVariant === 'both-done' ? 'You both finished swiping \u00b7 See what they liked' :
    bannerVariant === 'waiting' && activeSession?.sessionCode ? `Code: ${activeSession.sessionCode}` :
    null;

  return (
    <V3AppShell>
      {/* ── V3 Header ───────────────────────────────────────── */}
      <V3WatchaHeader
        hasNotification={!!(pendingInvite || activeSession)}
        onMenuClick={() => setShowMenuDrawer(true)}
        onNotificationsClick={() => setShowNotificationsDrawer(true)}
      />

      {/* ── Active session banner (preserved, inline) ──────── */}
      {activeSession && (
        <section
          className={`mx-[14px] mb-2 rounded-[20px] p-4 border bg-[#2A2420] cursor-pointer transition-all duration-300 shrink-0 ${bannerBorderClass}`}
          style={{ boxShadow: bannerBoxShadow }}
          onClick={handleResumeBanner}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${bannerDotPingClass} opacity-75`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${bannerDotClass}${bannerVariant === 'partner-done' ? ' animate-pulse' : ''}`} />
              </span>
              <span className="text-[#8A7F78] text-[10px] font-semibold tracking-widest uppercase">
                Active session
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleDismissBanner(); }}
              className="text-[#8A7F78] text-base leading-none hover:text-white/50 w-6 h-6 flex items-center justify-center"
              aria-label="Dismiss session banner"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${bannerVariant === 'partner-done' ? 'bg-[#4A7C59]/10' : 'bg-[#E8621A]/10'}`}>
              👥
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-black text-sm text-white">
                {bannerHeadline}
              </p>
              {bannerSubtext && (
                <p className="font-body text-xs text-[#8A7F78] mt-0.5">
                  {bannerSubtext}
                </p>
              )}
            </div>
            <span className={`text-lg flex-shrink-0 ${bannerVariant === 'partner-done' ? 'text-[#4A7C59]' : 'text-[#E8621A]'}`}>→</span>
          </div>
        </section>
      )}

      {/* ── Pending invite banner ───────────────────────────── */}
      {pendingInvite && (
        <section
          className="mx-[14px] mb-2 rounded-[20px] p-4 border border-[#4A7C59]/50 bg-[#1E2A22] shrink-0"
          style={{ boxShadow: "0 0 24px rgba(74,124,89,0.15)" }}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#4A7C59]/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {pendingInvite.inviterAvatar ? (
                <Image
                  src={pendingInvite.inviterAvatar}
                  alt=""
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-base font-bold text-[#4A7C59]">
                  {pendingInvite.inviterName ? pendingInvite.inviterName[0].toUpperCase() : "?"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-black text-sm text-white">
                {pendingInvite.inviterName ?? "Someone"} wants to decide dinner.
              </p>
              <p className="font-body text-xs text-[#8A7F78] mt-0.5">
                Join their Watcha session.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { void handleJoinInvite(); }}
                  className="flex-1 rounded-full bg-[#4A7C59] py-2 font-display font-black text-xs text-white transition active:scale-[0.98]"
                >
                  Join
                </button>
                <button
                  onClick={() => { void handleDismissInvite(); }}
                  className="flex-1 rounded-full border border-[#3A3530] py-2 font-display font-black text-xs text-[#8A7F78] transition active:scale-[0.98]"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {decidedMeal ? (
        /* ── POST-DECISION STATE ─────────────────────────────── */
        <div className="flex-1 overflow-y-auto flex flex-col pb-2">
          <V3PostMatchHome
            mealName={decidedMeal.name}
            headline={lockedHeadline?.headline ?? "Dinner is\nlocked in."}
            sub={lockedHeadline?.subheadline ?? `You chose ${decidedMeal.name}.`}
            avatars={(() => {
              const meInitials = profile?.display_name
                ? profile.display_name.split(" ").filter(Boolean).map((n) => n[0].toUpperCase()).join("").slice(0, 2)
                : null;
              const meAvatar = { avatarUrl: resolvedAvatarUrl, initials: meInitials ?? "?" };
              if (decidedMeal.mode === "shared" && partners.length > 0) {
                const partner = partners[0];
                const partnerInitials = partner.displayName
                  ? partner.displayName.split(" ").filter(Boolean).map((n) => n[0].toUpperCase()).join("").slice(0, 2)
                  : null;
                return [meAvatar, { avatarUrl: partner.avatarUrl ?? null, initials: partnerInitials ?? "?" }];
              }
              return [meAvatar];
            })()}
            mealImage={decidedMeal.image || undefined}
          />
          <V3LockedMealCard
            mealName={decidedMeal.name}
            tags={[decidedMeal.cuisine, decidedMeal.category].filter(Boolean).join(" • ")}
            cookTime={decidedMeal.tags.find((t) => /\d+\s*min/i.test(t)) ?? "—"}
            spice={decidedMeal.tags.some((t) => /spic/i.test(t)) ? "🌶️🌶️" : "Mild"}
            matchScore={decidedMeal.mode === "shared" ? "Matched!" : "Your pick"}
            onClear={() => setShowDismissConfirm(true)}
            onSave={toggleSaveDecidedMeal}
            isSaved={decidedSaved}
            savedJustNow={savedJustNow}
            onDetails={() => setDrawerMeal(decidedMeal)}
            onCook={handleCookDirect}
            onOrder={handleOrderDirect}
          />
          <V3MealActionRows
            mealName={decidedMeal.name}
            actions={[
              {
                icon: "🔄",
                title: "Change my mind",
                sub: "Start a new deck",
                onClick: () => router.push("/deck?change=1"),
              },
            ]}
          />

          {/* Cook / Order action drawer */}
          {mealActionMode && (
            <V3MealActionDrawer
              meal={decidedMeal}
              mode={mealActionMode}
              onClose={() => setMealActionMode(null)}
            />
          )}
        </div>
      ) : (
        /* ── PRE-DECISION STATE ──────────────────────────────── */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* ── Hero greeting ─────────────────────────────── */}
            {(() => {
              // First name only — "Fred" not "Fred Paul" or a full username
              const firstName = profile?.display_name?.split(" ")[0] ?? null;

              // Split the headline so the last word gets the Candlelight gleam gradient.
              // The gleam is a CSS text-gradient: cream → warm → orange → cream.
              const headlineWords = rotatingHeadline.split(" ");
              const lastWord = headlineWords[headlineWords.length - 1];
              const precedingWords = headlineWords.slice(0, -1).join(" ");

              return (
                <div className="shrink-0" style={{ padding: "20px 30px 10px" }}>
                  {/* Greeting — Instrument Serif italic, ember orange */}
                  <p
                    style={{
                      fontFamily: "var(--font-instrument-serif)",
                      fontStyle: "italic",
                      fontWeight: 400,
                      fontSize: 23,
                      color: "#E8621A",
                      lineHeight: 1,
                    }}
                  >
                    {`${greetingPhrase}${firstName ? `, ${firstName}` : ""}.`}
                  </p>

                  {/* Headline — Instrument Serif regular, large, with gleam on last word */}
                  <p
                    style={{
                      fontFamily: "var(--font-instrument-serif)",
                      fontWeight: 400,
                      fontSize: 43,
                      lineHeight: 1.0,
                      letterSpacing: "-0.015em",
                      color: "#F6EEE2",
                      marginTop: 7,
                    }}
                  >
                    {precedingWords && <>{precedingWords} </>}
                    {/* Gleam gradient on the final word */}
                    <span
                      style={{
                        background:
                          "linear-gradient(92deg, #F6EEE2 0%, #FFE6C9 40%, #FF8A3D 60%, #F6EEE2 88%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }}
                    >
                      {lastWord}
                    </span>
                  </p>
                </div>
              );
            })()}

            <V3PeopleSelector
              people={(() => {
                // Suppress multiple anonymous bubbles — allow at most one,
                // relabeled "Recent" to feel intentional rather than broken.
                let anonSeen = false;
                return partners
                  .map<PersonV3>((p) => ({
                    id: p.partnerId,
                    name: p.displayName ? p.displayName.split(" ")[0] : "Someone",
                    avatarUrl: p.avatarUrl ?? null,
                  }))
                  .filter((person) => {
                    const isAnon = person.name === "Someone" && !person.avatarUrl;
                    if (!isAnon) return true;
                    if (anonSeen) return false;
                    anonSeen = true;
                    return true;
                  })
                  .map((person) =>
                    person.name === "Someone" && !person.avatarUrl
                      ? { ...person, name: "Recent" }
                      : person
                  );
              })()}
              avatarUrl={resolvedAvatarUrl}
              displayName={profile?.display_name}
              onChange={(ids) => setSelectedPeopleIds(ids)}
              onInvite={() => setShowInviteDrawer(true)}
              onHidePartner={(id) => {
                const userId = getUserId();
                const key = `wwe_hidden_home_partners_${userId}`;
                const existing: string[] = JSON.parse(
                  localStorage.getItem(key) ?? "[]"
                );
                if (!existing.includes(id)) {
                  localStorage.setItem(key, JSON.stringify([...existing, id]));
                }
                setPartners((prev) => prev.filter((p) => p.partnerId !== id));
                setSelectedPeopleIds((prev) => prev.filter((s) => s !== id));
              }}
            />
            {/* ── Have a code? chip — hidden when active session banner is showing ── */}
            {!activeSession && (
              <div className="flex justify-center shrink-0" style={{ marginTop: 16, marginBottom: 8 }}>
                <button
                  onClick={() => setShowCodeEntry(true)}
                  className="inline-flex items-center cursor-pointer transition-all hover:bg-[rgba(255,231,202,0.08)]"
                  style={{
                    gap: 8,
                    padding: "9px 16px",
                    borderRadius: 100,
                    background: "rgba(255,231,202,0.045)",
                    border: "1px solid rgba(245,237,224,0.085)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    color: "#C7BDAC",
                    fontFamily: "var(--font-sans, Inter, system-ui)",
                    fontWeight: 400,
                    fontSize: 12.5,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      fontSize: 9,
                      letterSpacing: "1.4px",
                      color: "#E8621A",
                      textTransform: "uppercase",
                      fontWeight: 500,
                    }}
                  >
                    JOIN
                  </span>
                  Have a code?
                  <span style={{ color: "#E8621A" }}>›</span>
                </button>
              </div>
            )}
            {selectedPeopleIds.length === 0 ? (
              <V3ContextReadCard
                timeOfDay={timeOfDay}
                insights={insights}
                hardNos={profile?.hard_no_foods ?? []}
                recentHistory={recentHistory}
                onSeeTop5={() => router.push("/top5")}
              />
            ) : (
              <V3VibeCard
                onSeeTop5={() => router.push("/top5")}
                onVibeChange={(vibe) => setSelectedVibe(vibe)}
              />
            )}
            {/* ── Recent Wins ───────────────────────────────── */}
            {(() => {
              const MEAL_EMOJI: Record<string, string> = {
                "Comfort food": "🍲",
                "Quick & casual": "🍔",
                "Healthy": "🥗",
                "Bold flavors": "🌶️",
                "Elevated": "✨",
                "Classic Italian": "🍝",
                "Mediterranean": "🥙",
                "Fresh": "🥗",
                "Crowd pleaser": "🍕",
              };
              const wins: WinItem[] = recentHistory.map((entry) => ({
                image: entry.meal.image || undefined,
                emoji: MEAL_EMOJI[entry.meal.category] ?? "🍽️",
                name: entry.meal.name,
                day: new Date(entry.chosenAt).toLocaleDateString("en-US", { weekday: "short" }),
                isFavorite: false,
              }));
              return (
                <V3RecentWins
                  wins={wins}
                  onSeeAll={() => router.push("/history")}
                  onMealClick={(index) => {
                    const entry = recentHistory[index];
                    if (!entry) return;
                    const fullMeal = meals.find((m) => m.id === entry.meal.id) ?? null;
                    setSelectedRecentMeal(fullMeal);
                  }}
                />
              );
            })()}
          </div>

          {/* CTA — pinned at the bottom, with safe-area spacing */}
          <div
            className="shrink-0"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
          >
            <V3PrimaryDecisionCTA
              isSolo={selectedPeopleIds.length === 0}
              hasGuests={selectedPeopleIds.length > 0}
              onClick={() => {
                if (selectedPeopleIds.length === 0) {
                  router.push("/deck");
                } else {
                  trackEvent("decide_with_someone_clicked");
                  void handleDecideWithSomeone();
                }
              }}
              onDecideTogether={() => setShowInviteDrawer(true)}
            />
            {sessionError && (
              <p className="text-center text-sm text-red-400 px-4 pb-2">
                {sessionError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Code entry bottom sheet ────────────────────────── */}
      <AnimatePresence>
        {showCodeEntry && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <motion.div
              key="code-entry-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowCodeEntry(false)}
            />
            <motion.div
              key="code-entry-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              drag="y"
              dragDirectionLock
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.25 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 500) setShowCodeEntry(false);
              }}
              className="relative rounded-t-[28px] p-6"
              style={{
                background:
                  "radial-gradient(ellipse 80% 35% at 50% 0%, rgba(232,98,26,0.09) 0%, transparent 60%), " +
                  "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%), " +
                  "#211E1B",
                border: "1px solid rgba(245,237,224,0.07)",
                borderBottom: "none",
                boxShadow: "0 -8px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(245,237,224,0.07)",
              }}
            >
              <div className="w-9 h-1 rounded-full mx-auto mb-6" style={{ background: "rgba(245,237,224,0.15)" }} />
              <p className="font-display font-black text-2xl text-white mb-1">Enter a code</p>
              <p className="font-body text-sm text-[#8A7F78] mb-6">Your friend&apos;s session code — like RICE-64</p>
              <input
                type="text"
                placeholder="e.g. RICE-64"
                maxLength={10}
                autoFocus
                className="w-full rounded-[16px] px-4 py-4 font-display font-black text-2xl text-white text-center uppercase tracking-widest placeholder:text-[#3D3733] focus:outline-none mb-4 transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(245,237,224,0.10)",
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                }}
                onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(232,98,26,0.55)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,98,26,0.10)"; }}
                onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(245,237,224,0.10)"; e.currentTarget.style.boxShadow = "none"; }}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase().trim())}
              />
              <button
                onClick={() => router.push(`/join/${codeInput}`)}
                disabled={codeInput.length < 3}
                className="w-full disabled:opacity-40 text-white font-display font-black text-lg py-4 rounded-full mb-3 transition active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #F07840 0%, #E8621A 60%, #C94E10 100%)",
                  boxShadow: "0 0 24px rgba(232,98,26,0.28)",
                }}
              >
                Join session →
              </button>
              <button
                onClick={() => setShowCodeEntry(false)}
                className="w-full font-body text-sm py-2.5 rounded-full transition active:scale-[0.97]"
                style={{
                  color: "#8A7F78",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(245,237,224,0.08)",
                }}
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Preserved modals (fixed/z-50, untouched) ──────── */}

      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-5 pb-10">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeClearModal}
          />
          <div className="relative w-full max-w-md rounded-[28px] border border-white/[0.06] bg-[#2A2420] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">

            {/* Step 1 — always visible */}
            <p className="font-display font-black text-xl text-white tracking-tight">
              Clear today&apos;s decision?
            </p>
            <p className="font-body text-sm text-[#8A7F78] mt-2 leading-relaxed">
              You can always pick something new — this just resets today.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={closeClearModal}
                className="flex-1 rounded-full border border-[#3D3733] bg-[#1C1A18] py-3 font-display font-black text-sm text-[#8A7F78] transition active:scale-[0.98]"
              >
                Keep it
              </button>
              <button
                onClick={() => setClearStep("completed")}
                className="flex-1 rounded-full bg-[#E8621A] py-3 font-display font-black text-sm text-white shadow-[0_0_20px_rgba(232,98,26,0.25)] transition active:scale-[0.98] hover:bg-[#F27B35]"
              >
                Clear
              </button>
            </div>

            {/* Step 2 — did you eat it? */}
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                clearStep !== "confirm"
                  ? "grid-rows-[1fr]"
                  : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="mt-5 border-t border-[#3D3733] pt-5">
                  <p className="font-display font-black text-base text-white tracking-tight">
                    Did you cook or order this?
                  </p>
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => setClearStep("save")}
                      className="flex-1 rounded-full border border-[#3D3733] bg-[#1C1A18] py-3 font-display font-black text-sm text-[#8A7F78] transition active:scale-[0.98]"
                    >
                      Yes
                    </button>
                    <button
                      onClick={handleClearDecision}
                      className="flex-1 rounded-full bg-[#E8621A] py-3 font-display font-black text-sm text-white shadow-[0_0_20px_rgba(232,98,26,0.25)] transition active:scale-[0.98] hover:bg-[#F27B35]"
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 — save for later? */}
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                clearStep === "save"
                  ? "grid-rows-[1fr]"
                  : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="mt-5 border-t border-[#3D3733] pt-5">
                  <p className="font-display font-black text-base text-white tracking-tight">
                    Save it for later?
                  </p>
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => {
                        if (todaysPick) addFavorite(todaysPick.meal);
                        handleClearDecision();
                      }}
                      className="flex-1 rounded-full border border-[#3D3733] bg-[#1C1A18] py-2.5 font-display font-black text-xs text-[#8A7F78] transition active:scale-[0.98]"
                    >
                      ⭐ Favorite
                    </button>
                    <button
                      onClick={() => {
                        if (todaysPick) saveMeal(todaysPick.meal);
                        handleClearDecision();
                      }}
                      className="flex-1 rounded-full border border-[#3D3733] bg-[#1C1A18] py-2.5 font-display font-black text-xs text-[#8A7F78] transition active:scale-[0.98]"
                    >
                      🔖 Save
                    </button>
                    <button
                      onClick={handleClearDecision}
                      className="flex-1 rounded-full bg-[#E8621A] py-2.5 font-display font-black text-xs text-white shadow-[0_0_20px_rgba(232,98,26,0.25)] transition active:scale-[0.98] hover:bg-[#F27B35]"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Let's eat modal */}
      <AnimatePresence>
        {showEatModal && todaysPick && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div
              key="eat-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowEatModal(false)}
            />
            <motion.div
              key="eat-modal-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              drag="y"
              dragDirectionLock
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.25 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 500) setShowEatModal(false);
              }}
              className="relative w-full bg-[#2A2420] rounded-t-[28px] px-6 pt-6 pb-10"
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
              <p className="font-display font-black text-2xl text-white text-center">
                How are you eating?
              </p>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <a
                  href={`https://www.google.com/search?q=how+to+cook+${encodeURIComponent(todaysPick.meal.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { setShowEatModal(false); recordPickIfNew(); }}
                  className="bg-[#1C1A18] rounded-[20px] p-5 flex flex-col items-center gap-3 border border-transparent hover:border-[#E8621A]/40"
                >
                  <span className="text-4xl">🍳</span>
                  <p className="font-display font-black text-lg text-white">Cook it</p>
                  <p className="font-body text-xs text-[#8A7F78] text-center mt-1">See what you need</p>
                </a>
                <a
                  href={`https://www.google.com/search?q=order+${encodeURIComponent(todaysPick.meal.name)}+delivery`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { setShowEatModal(false); recordPickIfNew(); }}
                  className="bg-[#1C1A18] rounded-[20px] p-5 flex flex-col items-center gap-3 border border-transparent hover:border-[#E8621A]/40"
                >
                  <span className="text-4xl">🚗</span>
                  <p className="font-display font-black text-lg text-white">Order in</p>
                  <p className="font-body text-xs text-[#8A7F78] text-center mt-1">Find delivery options</p>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dismiss tonight's pick confirmation */}
      {showDismissConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-5 pb-10">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDismissConfirm(false)}
          />

          <div className="relative w-full max-w-md rounded-[28px] border border-white/[0.06] bg-[#2A2420] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">

            <p className="font-display font-black text-xl text-white tracking-tight">Clear meal?</p>
            <p className="font-body text-sm text-[#8A7F78] mt-2 leading-relaxed">
              This will remove tonight&apos;s pick and take you back to the home screen.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowDismissConfirm(false)}
                className="flex-1 rounded-full border border-white/10 bg-[#1C1A18] py-3 font-body text-sm font-semibold text-[#8A7F78] transition active:scale-[0.98]"
              >
                No
              </button>
              <button
                onClick={async () => {
                  console.log('[X button] clearing meal, setting cleared_at to:', Date.now())
                  // 1. Set cleared timestamp first — synchronously
                  localStorage.setItem('wwe_meal_cleared_at', Date.now().toString())
                  localStorage.removeItem('watcha_decided_meal')

                  // 2. Clear React state immediately
                  setShowDismissConfirm(false)
                  setDecidedMealState(null)
                  setTodaysPick(null)

                  // 3. Await Supabase clear BEFORE anything else
                  const userId = getUserId()
                  if (userId) {
                    await supabase
                      .from('profiles')
                      .update({ last_decided_meal: null })
                      .eq('user_id', userId)
                    console.log('[decidedMeal] cleared from home and Supabase')
                  }

                  // 4. NOW dispatch the event to update ProfileProvider in-memory state
                  window.dispatchEvent(new CustomEvent('clearDecidedMeal'))
                }}
                className="flex-1 rounded-full bg-[#E8621A] py-3 font-display font-black text-sm text-white shadow-[0_0_20px_rgba(232,98,26,0.35)] transition active:scale-[0.98] hover:bg-[#F27B35]"
              >
                Yes, clear it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flavor type reveal — shown once when solo type is first assigned */}
      {typeRevealData && (
        <FlavorTypeReveal
          typeName={typeRevealData.typeName}
          tagline={typeRevealData.tagline}
          onDismiss={handleRevealDismiss}
          onViewProfile={handleRevealViewProfile}
        />
      )}

      {/* Match celebration flash — shown once for 2 s when the partner completes a match */}
      {showMatchCelebration && (
        <div className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center px-5 pt-safe-top pt-4">
          <div
            className="w-full max-w-md rounded-[20px] bg-[#4A7C59] px-6 py-4 text-center"
            style={{ boxShadow: "0 0 40px rgba(74,124,89,0.5)" }}
          >
            <p className="font-display font-black text-xl text-white">You matched! 🎉</p>
            <p className="font-body text-sm text-white/80 mt-1">Dinner is decided.</p>
          </div>
        </div>
      )}

      {/* Locked meal detail drawer — opened from the info icon on the post-match card */}
      <MealDetailDrawer
        meal={drawerMeal}
        isOpen={drawerMeal !== null}
        onClose={() => setDrawerMeal(null)}
        context="solo"
      />

      {/* Recent Wins meal detail drawer */}
      <MealDetailDrawer
        meal={selectedRecentMeal}
        isOpen={selectedRecentMeal !== null}
        onClose={() => setSelectedRecentMeal(null)}
        context="home-win"
        onLockIn={() => {
          if (!selectedRecentMeal) return;
          const decidedAt = new Date().toISOString();
          // Use "solo" mode — this is a personal re-selection from history
          // TODO: if a dedicated session_type for "recent_win" is added to the schema, use it here
          const decidedMealData: DecidedMeal = { ...selectedRecentMeal, decidedAt, mode: "solo" };
          addToHistory(selectedRecentMeal);
          saveDecidedMeal(decidedMealData);
          setDecidedMealState(decidedMealData);
          setTodaysPick({ meal: selectedRecentMeal, chosenAt: decidedAt });
          void checkAndTriggerTypeReveal();
          setSelectedRecentMeal(null);
        }}
      />

      {/* Invite drawer */}
      <V3InviteDrawer
        open={showInviteDrawer}
        onClose={() => setShowInviteDrawer(false)}
        activeSessionCode={activeSession?.sessionCode ?? null}
        onCreateSession={createSessionForInvite}
        onSessionCreated={(session) => {
          setActiveSession({
            sessionId: session.sessionId,
            sessionCode: session.sessionCode,
            status: "waiting",
          });
        }}
      />

      {/* ── Menu drawer (hamburger) ─────────────────────────── */}
      <V3MenuDrawer
        open={showMenuDrawer}
        onClose={() => setShowMenuDrawer(false)}
      />

      {/* ── Notifications drawer (bell) ─────────────────────── */}
      {/* Reads from pendingInvite + activeSession already loaded on Home — no second Supabase query */}
      <V3NotificationsDrawer
        open={showNotificationsDrawer}
        onClose={() => setShowNotificationsDrawer(false)}
        pendingInvite={pendingInvite}
        activeSession={activeSession}
        onJoinInvite={() => { void handleJoinInvite(); }}
        onDismissInvite={() => { void handleDismissInvite(); }}
        onResume={handleResumeBanner}
      />
    </V3AppShell>
  );
}

