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
import { meals } from "./data/meals";
import { fetchProfileByAuthUserId } from "./lib/supabase-profile";
import type { Profile } from "./lib/supabase";
import { trackEvent } from "./lib/analytics";
import { getLockedMealHeadline, type LockedMealHeadlineResult } from "./lib/locked-copy";
import { generateSessionCode } from "./lib/session-code";
import FlavorTypeReveal from "./components/FlavorTypeReveal";
import { checkAndTriggerTypeReveal } from "./lib/type-reveal-trigger";

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
      if (pick) setSaved(getSavedMealsEnriched().some((s) => s.meal.id === pick.meal.id));
      setStreak(getStreak());
      fetchProfileByAuthUserId(session.user.id).then(setProfile).catch(() => {});
      setReady(true);

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
              console.log('[type-reveal] decision recorded — firing background check');
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
    console.log('[type-reveal] home mount — checking pending flag:', localStorage.getItem('wwe_type_reveal_pending'));
    checkPendingTypeReveal();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Check on window focus (tab switch / app return) and visibilitychange.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onFocus = () => checkPendingTypeReveal();
    const onVisibility = () => {
      console.log('[type-reveal] visibility changed to:', document.visibilityState);
      console.log('[type-reveal] pending flag value:', localStorage.getItem('wwe_type_reveal_pending'));
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
            vibe: "mix-it-up",
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
      router.push(`/session/${data.id}`);
    } catch (e) {
      console.error("[session] Unexpected error:", e);
      setSessionError("Something went wrong. Please try again.");
      setCreatingSession(false);
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
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

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
    <main className="min-h-screen overflow-hidden bg-[#1C1A18] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-24 right-[-60px] h-52 w-52 rounded-full bg-white/[0.04] blur-3xl" />
      </div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-32 safe-top">
        <div className="relative z-10 flex min-h-screen flex-col">

          {/* 1. TOP HEADER ROW */}
          <header className="flex items-center justify-between pt-4">
            <div />
            <Link
              href="/profile"
              className="w-11 h-11 rounded-full bg-[#E8621A] overflow-hidden flex items-center justify-center font-display font-black text-lg text-white cursor-pointer"
            >
              {profile?.avatar_url
                ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Profile" />
                : <span>{profile?.display_name?.[0]?.toUpperCase() ?? '?'}</span>
              }
            </Link>
          </header>

          {todaysPick ? (
            <>
              {/* DECIDED STATE — Good Call layout */}

              {/* 2. Headline */}
              <section className="mt-8">
                <h1 className="font-display font-black text-4xl text-white leading-tight">
                  {lockedHeadline?.headline ?? "Good call."}
                </h1>
                <h1 className="font-display font-black text-4xl text-[#E8621A] leading-tight text-balance">
                  {lockedHeadline?.subheadline ?? "Stop thinking about it."}
                </h1>
                <p className="font-body text-base text-[#8A7F78] mt-2">
                  Tonight&apos;s decision is done.
                </p>
              </section>

              {/* 3. Tonight's match card */}
              <div
                className="w-full bg-[#2A2420] rounded-[20px] p-5 mt-6 border border-[#4A7C59]/30"
                style={{ boxShadow: "0 0 30px rgba(74,124,89,0.12)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[#4A7C59] text-[11px] font-semibold tracking-widest uppercase">
                    TONIGHT&apos;S MATCH
                  </p>
                  <button
                    onClick={() => setShowDismissConfirm(true)}
                    className="text-[#8A7F78] text-base leading-none hover:text-white/60 active:scale-90 transition-all duration-[150ms] w-6 h-6 flex items-center justify-center"
                    aria-label="Dismiss tonight's pick"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#4A7C59] flex items-center justify-center font-display font-black text-lg text-white flex-shrink-0">
                    ✓
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-black text-xl text-white">
                        🍽️ {todaysPick.meal.name}
                      </span>
                    </div>
                    <p className="font-body text-xs text-[#8A7F78] mt-1">
                      {decidedMeal?.mode === "shared" ? "Decided with your partner" : "Decided just for you"} · just now
                    </p>
                  </div>
                  <button
                    onClick={() => { trackEvent("lets_eat_clicked", { mealId: todaysPick.meal.id }); setShowEatModal(true); }}
                    className="bg-[#4A7C59] text-white font-display font-black text-sm px-4 py-2.5 rounded-full whitespace-nowrap flex-shrink-0"
                  >
                    Let&apos;s eat 🙌
                  </button>
                </div>
              </div>

              {/* 4. Action cards */}
              <div className="flex flex-col gap-3 mt-4">
                <Link
                  href="/deck?change=1"
                  className="w-full bg-[#2A2420] rounded-[18px] p-4 flex items-center gap-4 text-left"
                >
                  <div className="w-12 h-12 rounded-[12px] bg-[#3D3733] flex items-center justify-center text-2xl flex-shrink-0">
                    🔄
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-black text-base text-white">Changed your mind?</p>
                    <p className="font-body text-sm text-[#8A7F78] mt-0.5">Start a new deck any time.</p>
                  </div>
                  <span className="text-[#8A7F78] text-lg">→</span>
                </Link>

                <button
                  onClick={toggleSave}
                  className="w-full bg-[#2A2420] rounded-[18px] p-4 flex items-center gap-4 text-left"
                >
                  <div className="w-12 h-12 rounded-[12px] bg-[#3D3733] flex items-center justify-center text-2xl flex-shrink-0">
                    ⭐
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-black text-base text-white">
                      {saved ? `Saved — ${todaysPick.meal.name}` : `Save ${todaysPick.meal.name}`}
                    </p>
                    <p className="font-body text-sm text-[#8A7F78] mt-0.5">
                      {saved ? "Tap to remove from favorites." : "Add to your favorites."}
                    </p>
                  </div>
                  <span className="text-[#8A7F78] text-lg">{saved ? "✓" : "→"}</span>
                </button>
              </div>

              {/* 5. Streak section */}
              <div className="mt-8">
                <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-3">
                  YOUR STREAK
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#2A2420] rounded-[16px] p-4 flex flex-col items-center justify-center">
                    <span className="font-display font-black text-3xl text-[#E8621A]">
                      {historyCount}
                    </span>
                    <span className="font-body text-xs text-[#8A7F78] text-center mt-1">
                      Decisions made
                    </span>
                  </div>
                  <div className="bg-[#2A2420] rounded-[16px] p-4 flex flex-col items-center justify-center">
                    <span className="font-display font-black text-3xl text-[#E8621A]">
                      {streak}
                    </span>
                    <span className="font-body text-xs text-[#8A7F78] text-center mt-1">
                      Days in a row
                    </span>
                  </div>
                  <div className="bg-[#2A2420] rounded-[16px] p-4 flex flex-col items-center justify-center">
                    <span className="font-display font-black text-3xl text-[#E8621A]">
                      2min
                    </span>
                    <span className="font-body text-xs text-[#8A7F78] text-center mt-1">
                      Avg. decision time
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* UNDECIDED STATE — normal home layout */}

              {/* 2. GREETING BLOCK */}
              <section className="mt-8">
                <h1 className="font-display font-black text-4xl text-white leading-tight">
                  It&apos;s {timeOfDay} in Detroit.
                  <br />
                  <span className="text-[#E8621A]">Watcha wanna eat?</span>
                </h1>
                <p className="font-body text-base text-[#8A7F78] mt-2">
                  Your deck is ready.
                </p>
                {streak >= 1 && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs text-white/70">
                    🔥 {streak} day streak
                  </div>
                )}
              </section>

              {/* 3. HERO CARD — Active session banner OR Deciding Together */}
              {activeSession ? (
                <section
                  className={`rounded-[24px] p-5 mt-6 border bg-[#2A2420] cursor-pointer transition-all duration-300 ${bannerBorderClass}`}
                  style={{ boxShadow: bannerBoxShadow }}
                  onClick={handleResumeBanner}
                >
                  <div className="flex items-center justify-between mb-3">
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
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${bannerVariant === 'partner-done' ? 'bg-[#4A7C59]/10' : 'bg-[#E8621A]/10'}`}>
                      👥
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-black text-base text-white">
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
              ) : (
                <section className="bg-[#E8621A] rounded-[24px] p-6 mt-6">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col">
                      <div className="w-14 h-14 rounded-[14px] bg-white/20 flex items-center justify-center text-3xl">
                        👥
                      </div>
                      <h2 className="font-display font-black text-xl text-white mt-3">
                        Deciding Together
                      </h2>
                      <p className="font-body text-sm text-white/80 mt-1">
                        Swipe with your group. Match on what everyone actually wants.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { trackEvent("decide_with_someone_clicked"); void handleDecideWithSomeone(); }}
                    disabled={creatingSession}
                    className="w-full bg-[#1C1A18] text-white font-display font-black text-base py-4 rounded-full mt-5 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {creatingSession ? "Creating…" : "Start shared session →"}
                  </button>
                  {sessionError && (
                    <p className="mt-3 text-center text-sm text-red-400">
                      {sessionError}
                    </p>
                  )}
                </section>
              )}

              {/* 4. SECONDARY CARDS ROW */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link href="/deck" className="bg-[#2A2420] rounded-[20px] p-5 flex flex-col">
                  <span className="text-2xl">🎯</span>
                  <p className="font-display font-black text-lg text-white mt-3">Just Me</p>
                  <p className="font-body text-sm text-[#8A7F78] mt-1">Solo swipe. Fast answer.</p>
                </Link>
                <Link href="/top5" className="bg-white rounded-[20px] p-5 flex flex-col">
                  <span className="text-2xl">✨</span>
                  <p className="font-display font-black text-lg text-[#1C1A18] mt-3">Tonight&apos;s Top 5</p>
                  <p className="font-body text-sm text-[#8A7F78] mt-1">Your best options, ranked.</p>
                </Link>
              </div>
            </>
          )}

          {/* RECENTLY DECIDED SECTION — always visible */}
          {recentHistory.length > 0 && (
            <div className="mt-8">
              <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-3">
                Recently Decided
              </p>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {recentHistory.map((entry) => (
                  <span
                    key={entry.meal.id + entry.chosenAt}
                    className="flex items-center gap-2 bg-[#2A2420] text-white font-body text-sm font-medium px-4 py-2 rounded-full whitespace-nowrap"
                  >
                    🍽️ {entry.meal.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 6. BOTTOM NAV */}
          <BottomNav />
        </div>
      </div>
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-5 pb-10">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeClearModal}
          />
          <div className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-[#111] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">

            {/* Step 1 — always visible */}
            <p className="text-lg font-semibold tracking-[-0.03em]">
              Clear today&apos;s decision?
            </p>
            <p className="mt-2 text-sm leading-6 text-white/50">
              You can always pick something new — this just resets today.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={closeClearModal}
                className="flex-1 rounded-full border border-white/10 bg-white/[0.05] py-3 text-sm font-medium text-white/70 transition active:scale-[0.98]"
              >
                Keep it
              </button>
              <button
                onClick={() => setClearStep("completed")}
                className="flex-1 rounded-full border border-white/15 bg-white/10 py-3 text-sm font-medium text-white transition hover:bg-white/15 active:scale-[0.98]"
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
                <div className="mt-5 border-t border-white/10 pt-5">
                  <p className="text-base font-semibold tracking-[-0.02em]">
                    Did you cook or order this?
                  </p>
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => setClearStep("save")}
                      className="flex-1 rounded-full border border-white/10 bg-white/[0.05] py-3 text-sm font-medium text-white/70 transition active:scale-[0.98]"
                    >
                      Yes
                    </button>
                    <button
                      onClick={handleClearDecision}
                      className="flex-1 rounded-full border border-white/15 bg-white/10 py-3 text-sm font-medium text-white transition hover:bg-white/15 active:scale-[0.98]"
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
                <div className="mt-5 border-t border-white/10 pt-5">
                  <p className="text-base font-semibold tracking-[-0.02em]">
                    Save it for later?
                  </p>
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => {
                        if (todaysPick) addFavorite(todaysPick.meal);
                        handleClearDecision();
                      }}
                      className="flex-1 rounded-full border border-white/10 bg-white/[0.05] py-2.5 text-sm font-medium text-white/70 transition active:scale-[0.98]"
                    >
                      ⭐ Favorite
                    </button>
                    <button
                      onClick={() => {
                        if (todaysPick) saveMeal(todaysPick.meal);
                        handleClearDecision();
                      }}
                      className="flex-1 rounded-full border border-white/10 bg-white/[0.05] py-2.5 text-sm font-medium text-white/70 transition active:scale-[0.98]"
                    >
                      🔖 Save
                    </button>
                    <button
                      onClick={handleClearDecision}
                      className="flex-1 rounded-full border border-white/15 bg-white/10 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 active:scale-[0.98]"
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
      {showEatModal && todaysPick && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowEatModal(false)}
          />
          <div className="relative w-full bg-[#2A2420] rounded-t-[28px] px-6 pt-6 pb-10">
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
          </div>
        </div>
      )}

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
    </main>
  );
}
