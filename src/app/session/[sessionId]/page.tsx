"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, Session } from "../../lib/supabase";
import { getUserId } from "../../lib/identity";
import { buildSharedDeckForSession } from "../../lib/deck";
import { upsertProfilePreferences, syncBehavioralSignalsToSupabase, fetchOrCreateProfile } from "../../lib/supabase-profile";
import type { Profile } from "../../lib/supabase";
import type { SessionVibeMode } from "../../lib/scoring";
import {
  hasCompletedOnboarding,
  savePreferences,
  markOnboardingDone,
  type UserPreferences,
} from "../../lib/storage";
import { trackEvent } from "../../lib/analytics";
import { SessionTerminalScreen } from "../../../components/SessionTerminalScreen";

// ── Lightweight guest setup data ──────────────────────────────────────────────

const GUEST_CUISINES = [
  { label: "Italian", emoji: "🍝" },
  { label: "Mexican", emoji: "🌮" },
  { label: "Asian", emoji: "🥢" },
  { label: "American", emoji: "🍔" },
  { label: "Mediterranean", emoji: "🫒" },
  { label: "Japanese", emoji: "🍱" },
  { label: "Indian", emoji: "🍛" },
  { label: "Middle Eastern", emoji: "🧆" },
];

const GUEST_DIETARY_RESTRICTIONS = [
  { label: "Vegetarian", emoji: "🥦" },
  { label: "Vegan", emoji: "🌱" },
  { label: "Gluten-free", emoji: "🌾" },
  { label: "Dairy-free", emoji: "🥛" },
  { label: "Halal", emoji: "☪️" },
  { label: "Kosher", emoji: "✡️" },
  { label: "None of these", emoji: "✓" },
];

const GUEST_HARD_NOS = [
  { label: "Seafood", emoji: "🦐" },
  { label: "Dairy", emoji: "🧀" },
  { label: "Gluten / Pasta", emoji: "🌾" },
  { label: "Beef", emoji: "🥩" },
  { label: "Pork", emoji: "🐷" },
  { label: "Chicken", emoji: "🍗" },
  { label: "None of these", emoji: "✓" },
];

// ── Host flow constants ───────────────────────────────────────────────────────

const VIBE_OPTIONS: { value: SessionVibeMode; emoji: string; label: string; description: string }[] = [
  { value: "comfort-food", emoji: "🔥", label: "Comfort me", description: "The good stuff. Familiar, satisfying." },
  { value: "quick-easy", emoji: "⚡", label: "Keep it easy", description: "Quick, simple, no-fuss." },
  { value: "mix-it-up", emoji: "✨", label: "Surprise us", description: "Something neither of you expected." },
  { value: "healthy", emoji: "🥗", label: "Healthy reset", description: "Light, fresh, feels good." },
  { value: "something-new", emoji: "🎉", label: "Celebrate something", description: "Special occasion energy." },
];

const VIBE_COLORS: Record<SessionVibeMode, string> = {
  "comfort-food":  "#E8621A",
  "quick-easy":    "#C9983A",
  "mix-it-up":     "#9B70D4",
  "healthy":       "#3DAA72",
  "something-new": "#C9983A",
};

const vibeEmoji: Record<string, string> = Object.fromEntries(
  VIBE_OPTIONS.map((o) => [o.value, o.emoji])
);
const vibeName: Record<string, string> = Object.fromEntries(
  VIBE_OPTIONS.map((o) => [o.value, o.label])
);

const WAITING_HEADLINES = [
  "The hard part\nis deciding.",
  "At least you'll\nagree on something.",
  "Better than\nfighting over it.",
  "Two people.\nOne answer.",
  "No more\n\"I don't care.\"",
];

type ViewerRole = "host" | "guest" | "full" | "unknown";

const POLL_INTERVAL_MS = 3000;

const BUILD_PHRASES = [
  "Finding what you'll both actually want...",
  "Filtering out the hard nos...",
  "Building your deck...",
  "Almost there...",
];


export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<ViewerRole>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionMatched, setSessionMatched] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joining, setJoining] = useState(false);
  const [buildingDeck, setBuildingDeck] = useState(false);
  const [buildPhrase, setBuildPhrase] = useState(0);
  const [completingSetup, setCompletingSetup] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState<SessionVibeMode>("mix-it-up");

  // Host flow state
  const [hostStep, setHostStep] = useState<"sharing" | "waiting">("sharing");
  // false = re-entry (skip intro steps); true = first-time host flow
  const [hostNeedsOnboarding, setHostNeedsOnboarding] = useState(true);
  const [showStartSwiping, setShowStartSwiping] = useState(false);
  const [cancellingSession, setCancellingSession] = useState(false);
  const [waitingHeadlineIdx, setWaitingHeadlineIdx] = useState(0);
  const [savingVibe, setSavingVibe] = useState(false);

  // Guard so generateDeckIfNeeded only fires once per session load
  const deckTriggeredRef = useRef(false);
  // Guard so loadSession polling never resets a vibe the user has already selected
  const vibeInitializedRef = useRef(false);

  const [myProfile, setMyProfile] = useState<Profile | null>(null);

  // Guest quick-setup state (null = not yet checked)
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [setupStep, setSetupStep] = useState<"intro" | "cuisines" | "dietary" | "hardNos">("intro");
  const [guestCuisines, setGuestCuisines] = useState<string[]>([]);
  const [guestDietaryRestrictions, setGuestDietaryRestrictions] = useState<string[]>([]);
  const [guestHardNos, setGuestHardNos] = useState<string[]>([]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prefer the short code URL; fall back to UUID path if code is absent (older rows)
  const sessionUrl =
    typeof window !== "undefined"
      ? session?.session_code
        ? `${window.location.origin}/join/${session.session_code}`
        : `${window.location.origin}/session/${sessionId}`
      : "";

  // Load session and determine role
  const loadSession = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (fetchError || !data) {
      setError("Session not found or has expired.");
      return;
    }

    const s = data as Session;

    // Enforce expiry: if expires_at has passed and session is not terminal, mark it
    const now = new Date();
    if (s.status !== "expired" && s.status !== "matched" && new Date(s.expires_at) <= now) {
      void supabase
        .from("sessions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", sessionId)
        .not("status", "in", '("expired","matched")');
      s.status = "expired";
    }
    if (s.status === "expired") {
      if (typeof window !== "undefined") localStorage.removeItem("wwe_active_session");
      setSessionExpired(true);
      setSession(s);
      return;
    }

    if (s.status === "matched") {
      if (typeof window !== "undefined") localStorage.removeItem("wwe_active_session");
      setSessionMatched(true);
      setSession(s);
      return;
    }

    setSession(s);

    const myId = getUserId();

    if (myId === s.host_user_id) {
      setRole("host");
      // Only initialize selectedVibe once — don't let polls reset what the user picked
      if (s.vibe && !vibeInitializedRef.current) {
        setSelectedVibe(s.vibe as SessionVibeMode);
        vibeInitializedRef.current = true;
      }
      // Re-entry detection: if status is already swiping, skip intro flow
      if (s.status === "swiping") {
        setHostNeedsOnboarding(false);
      }
      // If guest already joined when host loads (status ready/active),
      // jump directly to the waiting step to avoid a vibe-selector flash
      if (s.status === "ready" || s.status === "active") {
        setHostStep("waiting");
        prevBothConnectedRef.current = true;
      }
    } else if (myId === s.guest_user_id) {
      setRole("guest");
    } else if (s.guest_user_id !== null) {
      setRole("full");
    } else {
      setRole("unknown");
      // First time landing here as a new guest — check if setup is needed.
      setNeedsSetup((prev) => {
        if (prev !== null) return prev; // don't overwrite once decided
        return !hasCompletedOnboarding();
      });
    }
  }, [sessionId]);

  // Generates the shared deck from both users' profiles and stores it on the
  // session row. Safe to call from either participant — the DB guard
  // (deck_meal_ids IS NULL) ensures only one deck is ever written.
  const generateDeckIfNeeded = useCallback(
    async (currentSession: Session) => {
      if (!currentSession.guest_user_id) return; // guest hasn't joined yet
      if (currentSession.deck_meal_ids?.length) return; // deck already built
      if (deckTriggeredRef.current) return; // already in progress on this client

      deckTriggeredRef.current = true;

      try {
        const mealIds = await buildSharedDeckForSession(
          currentSession.id,
          currentSession.host_user_id,
          currentSession.guest_user_id,
        );

        // Advance status to swiping — idempotent if another client already did this
        await supabase
          .from("sessions")
          .update({ status: "swiping", updated_at: new Date().toISOString() })
          .eq("id", currentSession.id)
          .in("status", ["ready", "active"]); // only transition forward

        setSession((prev) =>
          prev ? { ...prev, deck_meal_ids: mealIds, status: "swiping" } : prev,
        );
      } catch (err) {
        console.error("[session] deck generation failed:", err);
        // Reset so polling can retry
        deckTriggeredRef.current = false;
      }
    },
    [], // sessionId is stable; no deps needed
  );

  // Guest joins the session
  const joinSession = useCallback(async () => {
    setJoining(true);
    const myId = getUserId();

    const { data, error: joinError } = await supabase
      .from("sessions")
      .update({
        guest_user_id: myId,
        status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .is("guest_user_id", null) // only join if slot is still open
      .select()
      .single();

    if (joinError || !data) {
      // Slot may have just been taken — reload to show "full" state
      await loadSession();
      setJoining(false);
      return;
    }

    const s = data as Session;
    setSession(s);
    setRole("guest");
    setJoining(false);
    syncBehavioralSignalsToSupabase(myId).catch((err) =>
      console.warn("[sync] behavioral signals failed:", err),
    );
    trackEvent("shared_session_joined", { sessionId });
  }, [sessionId, loadSession]);

  // Initial load
  useEffect(() => {
    loadSession();
    fetchOrCreateProfile(getUserId()).then(setMyProfile).catch(() => {});
  }, [loadSession]);

  // Auto-join if guest slot is open — only after setup is confirmed not needed
  useEffect(() => {
    if (role === "unknown" && session && !joining && needsSetup === false) {
      joinSession();
    }
  }, [role, session, joining, needsSetup, joinSession]);

  // Cycle through build phrases while deck is generating
  useEffect(() => {
    if (!buildingDeck) return;
    setBuildPhrase(0);
    const interval = setInterval(() => {
      setBuildPhrase((p) => (p + 1) % BUILD_PHRASES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [buildingDeck]);

  // Auto-trigger deck generation when both are ready.
  // Fires on both host and guest — deckTriggeredRef ensures at most one attempt per client;
  // the DB guard (deck_meal_ids IS NULL) ensures only one deck is ever written.
  // For guests, setBuildingDeck(false) is delayed to enforce a minimum 3s animation display.
  useEffect(() => {
    if (session?.status !== "ready") return;
    if (deckTriggeredRef.current) return;
    if (!session) return;

    syncBehavioralSignalsToSupabase(getUserId()).catch((err) =>
      console.warn("[sync] behavioral signals failed:", err),
    );

    const isGuest = role === "guest";
    const startTime = Date.now();
    setBuildingDeck(true);
    generateDeckIfNeeded(session).finally(() => {
      if (isGuest) {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 3000 - elapsed);
        setTimeout(() => setBuildingDeck(false), remaining);
      } else {
        setBuildingDeck(false);
      }
    });
  }, [session?.status, generateDeckIfNeeded, session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for changes
  useEffect(() => {
    const shouldPoll =
      (role === "host" && (session?.status === "waiting" || session?.status === "ready")) ||
      ((role === "host" || role === "guest") && !(session?.deck_meal_ids?.length));

    if (shouldPoll) {
      pollRef.current = setInterval(loadSession, POLL_INTERVAL_MS);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [role, session?.status, session?.deck_meal_ids, loadSession]);

  // Detect guest join from any host step (vibe, sharing, or waiting).
  // Auto-advances hostStep to "waiting" so the celebration UI renders,
  // then shows "Start swiping →" after 2s.
  const bothConnected =
    session?.status === "ready" ||
    session?.status === "active" ||
    session?.status === "swiping" ||
    session?.status === "matched";

  const prevBothConnectedRef = useRef(false);
  useEffect(() => {
    if (!bothConnected || prevBothConnectedRef.current) return;
    if (role !== "host") return;
    prevBothConnectedRef.current = true;
    setHostStep("waiting");
    const timer = setTimeout(() => setShowStartSwiping(true), 2000);
    return () => clearTimeout(timer);
  }, [bothConnected, role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rotate waiting headlines every 2.5s
  useEffect(() => {
    if (role !== "host" || hostStep !== "waiting" || bothConnected) return;
    const interval = setInterval(() => {
      setWaitingHeadlineIdx((i) => (i + 1) % WAITING_HEADLINES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [role, hostStep, bothConnected]);

  function handleCopy() {
    navigator.clipboard.writeText(sessionUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Saves guest preferences locally AND to Supabase (so deck generation can
  // read them immediately). Awaited before setNeedsSetup to guarantee the
  // profile row exists when buildSharedDeckForSession fires.
  async function completeGuestSetup() {
    setCompletingSetup(true);
    const prefs: UserPreferences = {
      cuisines: guestCuisines,
      dietaryRestrictions: guestDietaryRestrictions.filter((f) => f !== "None of these"),
      hardNoFoods: guestHardNos.filter((f) => f !== "None of these"),
      spiceLevel: "any",
      cookOrOrder: "either",
      kidFriendly: null,
    };
    savePreferences(prefs);
    markOnboardingDone();
    // Sync to Supabase before joining so deck generation can read this profile
    await upsertProfilePreferences(getUserId(), {
      cuisines: prefs.cuisines,
      dietaryRestrictions: prefs.dietaryRestrictions,
      hardNoFoods: prefs.hardNoFoods,
    });
    setCompletingSetup(false);
    setNeedsSetup(false);
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: "Join my Whatcha Wanna Eat session",
        text: "Help me pick what we're eating tonight",
        url: sessionUrl,
      });
    } else {
      handleCopy();
    }
  }

  async function handleVibeSelect(vibe: SessionVibeMode | null) {
    if (vibe) {
      setSavingVibe(true);
      setSelectedVibe(vibe);
      vibeInitializedRef.current = true;
      await supabase
        .from("sessions")
        .update({ vibe, updated_at: new Date().toISOString() })
        .eq("id", sessionId);
      setSession((prev) => prev ? { ...prev, vibe } : prev);
      setSavingVibe(false);
    }
    setHostStep("sharing");
  }

  async function handleCancelSession() {
    setCancellingSession(true);
    await supabase
      .from("sessions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (typeof window !== "undefined") {
      localStorage.removeItem("wwe_active_session");
    }
    router.push("/");
  }

  function handleStartSwiping() {
    // Update localStorage so the home banner knows we're swiping
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("wwe_active_session");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          localStorage.setItem("wwe_active_session", JSON.stringify({ ...parsed, status: "swiping" }));
        } catch {}
      }
    }
    const vibe = (session?.vibe ?? "mix-it-up") as SessionVibeMode;
    trackEvent("shared_deck_started", { sessionId, vibe });
    router.push(`/deck?sessionId=${sessionId}&vibe=${vibe}`);
  }

  // ── Guest quick setup ─────────────────────────────────────────────────────
  if (role === "unknown" && needsSetup === true) {
    const toggleMulti = (value: string, current: string[], set: (v: string[]) => void) => {
      if (value === "None of these") {
        set(current.includes("None of these") ? [] : ["None of these"]);
        return;
      }
      const without = current.filter((v) => v !== "None of these");
      set(without.includes(value) ? without.filter((v) => v !== value) : [...without, value]);
    };

    const canAdvance =
      setupStep === "intro"
        ? true
        : setupStep === "cuisines"
        ? guestCuisines.length > 0
        : setupStep === "dietary"
        ? guestDietaryRestrictions.length > 0
        : guestHardNos.length > 0;

    async function advanceSetup() {
      if (setupStep === "intro") setSetupStep("cuisines");
      else if (setupStep === "cuisines") setSetupStep("dietary");
      else if (setupStep === "dietary") setSetupStep("hardNos");
      else await completeGuestSetup();
    }

    const stepNum = setupStep === "intro" ? 0 : setupStep === "cuisines" ? 1 : setupStep === "dietary" ? 2 : 3;

    // ── Intro screen ────────────────────────────────────────────────────────
    if (setupStep === "intro") {
      return (
        <main className="relative min-h-screen overflow-hidden bg-[#1C1A18] text-white">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 90% 28% at 50% 0%, rgba(232,98,26,0.09) 0%, transparent 70%)",
            }}
          />
          <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-28">
            <div className="pt-10">
              <p className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase mb-6">
                REAL QUICK
              </p>
              <h1 className="font-display font-black text-4xl text-white leading-tight">
                Here&apos;s the deal<span className="text-[#E8621A]">.</span>
              </h1>
              <div className="mt-8 flex flex-col">
                {[
                  { title: "Takes 30 seconds.", subtitle: "Your answers make tonight's picks way better for both of you." },
                  { title: "No account needed.", subtitle: "Just swipe. We handle the rest." },
                  { title: "We build the deck together.", subtitle: "Your preferences + theirs = a deck you'll both actually want." },
                  { title: "Your picks stay private.", subtitle: "We only share the match." },
                ].map((item, index) => (
                  <div key={index} className="flex gap-4 py-4 border-b border-white/[0.06]">
                    <span className="font-display font-black text-lg text-[#E8621A] w-6 flex-shrink-0">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="font-display font-bold text-base text-white">{item.title}</p>
                      <p className="font-body text-sm text-[#8A7F78] mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="fixed bottom-0 left-0 right-0 z-30">
            <div className="mx-auto w-full max-w-md px-5 pb-8 pt-10 relative">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent to-[#1C1A18]" />
              <button
                onClick={advanceSetup}
                className="w-full rounded-full bg-[#E8621A] px-5 py-[18px] text-center text-[15px] font-display font-black text-white transition hover:opacity-95 active:scale-[0.99] shadow-[0_8px_40px_rgba(232,98,26,0.28)]"
              >
                Let&apos;s do it →
              </button>
            </div>
          </div>
        </main>
      );
    }

    return (
      <main className="relative min-h-screen overflow-hidden bg-[#1C1A18] text-white">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 90% 28% at 50% 0%, rgba(232,98,26,0.11) 0%, transparent 70%), radial-gradient(ellipse 70% 20% at 50% 100%, rgba(28,16,8,0.55) 0%, transparent 65%)",
          }}
        />
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-28">

          <div className="flex flex-col gap-6 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              {setupStep !== "cuisines" ? (
                <button
                  onClick={() => {
                    if (setupStep === "hardNos") setSetupStep("dietary");
                    else setSetupStep("cuisines");
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white/60 transition active:scale-[0.98]"
                >
                  ←
                </button>
              ) : (
                <div className="w-10" />
              )}
              <span className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase">
                Quick setup
              </span>
              <div className="w-10" />
            </div>

            {/* Progress bar */}
            <div className="flex gap-1.5">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.12]">
                  <div
                    className="h-full rounded-full bg-[#E8621A] transition-all duration-500 ease-out"
                    style={{ width: n <= stepNum ? "100%" : "0%" }}
                  />
                </div>
              ))}
            </div>

            {/* Question */}
            <div className="mt-2">
              <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase">
                {stepNum} of 3
              </p>
              <h1 className="mt-3 font-display font-black text-3xl text-white leading-tight">
                {setupStep === "cuisines" && "What are you down for?"}
                {setupStep === "dietary" && "Any dietary restrictions?"}
                {setupStep === "hardNos" && "Anything you absolutely won't eat?"}
              </h1>
              <p className="mt-2 font-body text-sm text-[#8A7F78]">
                {setupStep === "cuisines" && "Pick everything that sounds good to you."}
                {setupStep === "dietary" && "We'll never show you meals that don't work for you."}
                {setupStep === "hardNos" && "Hard NOs are never shown. Ever."}
              </p>
            </div>

            {/* Options */}
            {setupStep === "cuisines" && (
              <div className="flex flex-col gap-3">
                {GUEST_CUISINES.map((c) => {
                  const selected = guestCuisines.includes(c.label);
                  return (
                    <button
                      key={c.label}
                      onClick={() => toggleMulti(c.label, guestCuisines, setGuestCuisines)}
                      className={`flex items-center gap-4 rounded-[18px] p-4 border transition-all duration-150 active:scale-[0.99] ${
                        selected
                          ? "border-[#E8621A] bg-[#E8621A]/10"
                          : "border-white/[0.06] bg-[#2A2420]"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-[12px] bg-[#3D3733] flex items-center justify-center text-2xl flex-shrink-0">
                        {c.emoji}
                      </div>
                      <span className="flex-1 font-display font-black text-lg text-white text-left">{c.label}</span>
                      <div className={`w-7 h-7 rounded-full flex-shrink-0 ${
                        selected ? "bg-[#E8621A] flex items-center justify-center" : "border-2 border-[#3D3733]"
                      }`}>
                        {selected && <span className="text-sm font-black text-white">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {setupStep === "dietary" && (
              <div className="flex flex-col gap-3">
                {GUEST_DIETARY_RESTRICTIONS.map((f) => {
                  const selected = guestDietaryRestrictions.includes(f.label);
                  return (
                    <button
                      key={f.label}
                      onClick={() => toggleMulti(f.label, guestDietaryRestrictions, setGuestDietaryRestrictions)}
                      className={`flex items-center gap-4 rounded-[18px] p-4 border transition-all duration-150 active:scale-[0.99] ${
                        selected
                          ? "border-[#E8621A] bg-[#E8621A]/10"
                          : "border-white/[0.06] bg-[#2A2420]"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-[12px] bg-[#3D3733] flex items-center justify-center text-2xl flex-shrink-0">
                        {f.emoji}
                      </div>
                      <span className="flex-1 font-display font-black text-lg text-white text-left">{f.label}</span>
                      <div className={`w-7 h-7 rounded-full flex-shrink-0 ${
                        selected ? "bg-[#E8621A] flex items-center justify-center" : "border-2 border-[#3D3733]"
                      }`}>
                        {selected && <span className="text-sm font-black text-white">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {setupStep === "hardNos" && (
              <div className="flex flex-col gap-3">
                {GUEST_HARD_NOS.map((f) => {
                  const selected = guestHardNos.includes(f.label);
                  return (
                    <button
                      key={f.label}
                      onClick={() => toggleMulti(f.label, guestHardNos, setGuestHardNos)}
                      className={`flex items-center gap-4 rounded-[18px] p-4 border transition-all duration-150 active:scale-[0.99] ${
                        selected
                          ? "border-[#E8621A] bg-[#E8621A]/10"
                          : "border-white/[0.06] bg-[#2A2420]"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-[12px] bg-[#3D3733] flex items-center justify-center text-2xl flex-shrink-0">
                        {f.emoji}
                      </div>
                      <span className="flex-1 font-display font-black text-lg text-white text-left">{f.label}</span>
                      <div className={`w-7 h-7 rounded-full flex-shrink-0 ${
                        selected ? "bg-[#E8621A] flex items-center justify-center" : "border-2 border-[#3D3733]"
                      }`}>
                        {selected && <span className="text-sm font-black text-white">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

          </div>
        </div>

        {/* Sticky CTA */}
        <div className="fixed bottom-0 left-0 right-0 z-30">
          <div className="mx-auto w-full max-w-md px-5 pb-8 pt-10 relative">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent to-[#1C1A18]" />
            <button
              onClick={advanceSetup}
              disabled={!canAdvance || completingSetup}
              className={`w-full rounded-full bg-[#E8621A] px-5 py-[18px] text-center text-[15px] font-display font-black text-white transition hover:opacity-95 active:scale-[0.99] disabled:opacity-30 ${
                canAdvance && !completingSetup ? "shadow-[0_8px_40px_rgba(232,98,26,0.28)]" : "shadow-none"
              }`}
            >
              {completingSetup ? "Joining…" : setupStep === "hardNos" ? "Join session" : "Continue"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!session && !error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#1C1A18] text-white">
        <div className="flex flex-col items-center gap-4">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E8621A]/60 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#E8621A]/80" />
          </span>
          <p className="font-body text-sm text-[#8A7F78]">Loading session…</p>
        </div>
      </main>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-[#1C1A18] px-6 text-center text-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          <div
            className="absolute top-1/3 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ background: "rgba(232,98,26,0.08)" }}
          />
        </div>
        <div
          className="w-20 h-20 rounded-[20px] bg-[#E8621A]/10 flex items-center justify-center"
          style={{ boxShadow: "0 0 40px rgba(232,98,26,0.18)" }}
        >
          <span className="font-display font-black text-4xl text-[#E8621A]">!</span>
        </div>
        <div>
          <p className="font-display font-black text-2xl text-white">Something went wrong</p>
          <p className="mt-2 font-body text-sm text-[#8A7F78] max-w-[28ch] mx-auto">{error}</p>
        </div>
        <Link
          href="/"
          className="w-full max-w-xs rounded-full border border-white/10 bg-white/[0.06] px-6 py-4 font-display font-black text-sm text-white transition hover:opacity-80 active:scale-[0.99]"
        >
          Back to home
        </Link>
      </main>
    );
  }

  // ── Session expired ───────────────────────────────────────────────────────
  if (sessionExpired || session?.status === "expired") {
    return <SessionTerminalScreen variant="expired" />;
  }

  // ── Session already matched ───────────────────────────────────────────────
  if (sessionMatched) {
    return <SessionTerminalScreen variant="matched" />;
  }

  // ── Session full ──────────────────────────────────────────────────────────
  if (role === "full") {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-[#1C1A18] px-6 text-center text-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          <div
            className="absolute top-1/3 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ background: "rgba(232,98,26,0.08)" }}
          />
        </div>
        <div
          className="w-20 h-20 rounded-[20px] bg-[#E8621A]/10 flex items-center justify-center"
          style={{ boxShadow: "0 0 40px rgba(232,98,26,0.18)" }}
        >
          <span className="text-3xl">🔒</span>
        </div>
        <div>
          <p className="font-display font-black text-2xl text-white">Session is full</p>
          <p className="mt-2 font-body text-sm text-[#8A7F78] max-w-[28ch] mx-auto leading-relaxed">
            This session already has two people. Ask the host to start a new one.
          </p>
        </div>
        <Link
          href="/"
          className="w-full max-w-xs rounded-full border border-white/10 bg-white/[0.06] px-6 py-4 font-display font-black text-sm text-white transition hover:opacity-80 active:scale-[0.99]"
        >
          Back to home
        </Link>
      </main>
    );
  }

  // ── Guest: waiting for deck to build ────────────────────────────────────
  if (role === "guest" && !(session?.deck_meal_ids?.length)) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#1C1A18] flex flex-col items-center justify-center px-6 text-center">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 90% 28% at 50% 0%, rgba(232,98,26,0.11) 0%, transparent 70%), radial-gradient(ellipse 70% 20% at 50% 100%, rgba(28,16,8,0.55) 0%, transparent 65%)",
          }}
        />
        <Link
          href="/"
          className="absolute top-12 left-5 w-10 h-10 rounded-full bg-[#2A2420] flex items-center justify-center text-white text-lg"
        >
          ←
        </Link>

        <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-12">
          Shared session
        </p>

        <div className="relative flex items-center justify-center w-32 h-32">
          <div className="absolute w-32 h-32 rounded-full border border-[#E8621A]/20" style={{ animation: "ping 2.5s cubic-bezier(0,0,0.2,1) infinite" }} />
          <div className="absolute w-24 h-24 rounded-full border border-[#E8621A]/30 animate-pulse" />
          <div
            className="w-16 h-16 rounded-full bg-[#E8621A]/15 flex items-center justify-center"
            style={{ boxShadow: "0 0 24px rgba(232,98,26,0.2)" }}
          >
            <span className="text-2xl">👥</span>
          </div>
        </div>

        {session?.vibe && vibeEmoji[session.vibe] && (
          <div className="flex items-center gap-2 mt-4">
            <span className="text-lg">{vibeEmoji[session.vibe]}</span>
            <span className="font-body text-sm text-[#8A7F78]">
              Tonight feels like: <span className="text-white font-semibold">{vibeName[session.vibe]}</span>
            </span>
          </div>
        )}

        <h1 className="font-display font-black text-3xl text-white mt-8 leading-tight">
          Your host is deciding with you.
        </h1>
        <p className="font-body text-base text-[#8A7F78] mt-3 max-w-xs">
          Hang tight. Building a deck for both of you.
        </p>

        <div className="flex items-center gap-2 bg-[#2A2420] rounded-full px-4 py-2 mt-6">
          <span className="w-2 h-2 rounded-full bg-[#E8621A] animate-pulse" />
          <span className="font-body text-sm text-[#8A7F78]">BUILDING YOUR DECK...</span>
        </div>

        <Link
          href="/"
          className="font-body text-sm text-[#8A7F78]/50 mt-12 transition hover:text-[#8A7F78]"
        >
          Leave session
        </Link>

        <p className="font-body text-xs text-[#8A7F78]/40 mt-4">
          {session?.session_code
            ? `Code: ${session.session_code}`
            : `Session · ${sessionId?.slice(0, 8)}`}
        </p>
      </main>
    );
  }

  // ── Guest: deck ready — show intentional entry screen ────────────────────
  if (role === "guest" && !!(session?.deck_meal_ids?.length)) {
    const guestVibe = (session?.vibe ?? "mix-it-up") as SessionVibeMode;

    return (
      <main className="relative min-h-screen overflow-hidden bg-[#1C1A18] text-white flex flex-col items-center justify-center px-6 text-center">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 90% 28% at 50% 0%, rgba(232,98,26,0.11) 0%, transparent 70%), radial-gradient(ellipse 70% 20% at 50% 100%, rgba(28,16,8,0.55) 0%, transparent 65%)",
          }}
        />
        <Link
          href="/"
          className="absolute top-12 left-5 w-10 h-10 rounded-full bg-[#2A2420] flex items-center justify-center text-white text-lg"
        >
          ←
        </Link>

        <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-12">
          Shared session
        </p>

        <div className="relative flex items-center justify-center w-32 h-32">
          <div className="absolute w-32 h-32 rounded-full border border-[#4A7C59]/30" />
          <div className="absolute w-24 h-24 rounded-full border border-[#4A7C59]/50" />
          <div
            className="w-16 h-16 rounded-full bg-[#4A7C59]/20 flex items-center justify-center"
            style={{ boxShadow: "0 0 30px rgba(74,124,89,0.25)" }}
          >
            <span className="text-2xl">👥</span>
          </div>
        </div>

        <h1 className="font-display font-black text-3xl text-white mt-8 leading-tight text-center">
          You&apos;re in. Let&apos;s decide.
        </h1>
        <p className="font-body text-base text-[#8A7F78] text-center mt-3 max-w-xs">
          We&apos;ll use both of your profiles to build your shared deck.
        </p>

        <div className="flex items-center gap-2 bg-[#2A2420] rounded-full px-4 py-2 mt-6">
          <span className="w-2 h-2 rounded-full bg-[#4A7C59] animate-pulse" />
          <span className="font-body text-sm text-[#8A7F78]">DECK READY</span>
        </div>

        <button
          onClick={() => {
            trackEvent("shared_deck_started", { sessionId, vibe: guestVibe });
            router.push(`/deck?sessionId=${sessionId}&vibe=${guestVibe}`);
          }}
          className="mt-8 w-full max-w-xs bg-[#E8621A] text-white font-display font-black text-base py-4 rounded-full transition hover:opacity-95 active:scale-[0.99]"
          style={{ boxShadow: "0 0 30px rgba(232,98,26,0.25)" }}
        >
          Start swiping
        </button>

        <p className="font-body text-xs text-[#8A7F78]/40 mt-6">
          Session · {sessionId?.slice(0, 8)}
        </p>
      </main>
    );
  }

  // ── Building deck loading screen (host + guest) ───────────────────────────
  const shouldShowBuildingDeck =
    buildingDeck &&
    (role === "guest" || (role === "host" && (!hostNeedsOnboarding || hostStep === "waiting")));

  if (shouldShowBuildingDeck) {
    const myInitial = myProfile?.display_name?.[0]?.toUpperCase() ?? '?';
    const partnerInitial = "?";

    return (
      <main className="relative min-h-screen overflow-hidden bg-[#1C1A18] flex flex-col items-center justify-center">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 90% 28% at 50% 0%, rgba(232,98,26,0.11) 0%, transparent 70%), radial-gradient(ellipse 70% 20% at 50% 100%, rgba(28,16,8,0.55) 0%, transparent 65%)",
          }}
        />
        {/* Concentric rings */}
        <div
          className="relative flex items-center justify-center w-72 h-72"
          style={{ animation: "pulse 3s ease-in-out infinite" }}
        >
          <div className="absolute w-72 h-72 rounded-full border border-[#E8621A]/20" />
          <div className="absolute w-52 h-52 rounded-full border border-[#E8621A]/35" />
          <div className="absolute w-36 h-36 rounded-full border border-[#E8621A]/50" />
          <div className="w-20 h-20 rounded-full bg-[#3D1A00] flex items-center justify-center">
            <span className="font-display font-black text-3xl text-[#E8621A]">?</span>
          </div>
        </div>

        <div className="flex items-center justify-center mt-8">
          <div className="w-10 h-10 rounded-full bg-[#E8621A] flex items-center justify-center font-display font-black text-sm text-white border-2 border-[#1C1A18] z-10 relative">
            {myInitial}
          </div>
          <div className="w-10 h-10 rounded-full bg-[#3D3733] flex items-center justify-center font-display font-black text-sm text-white border-2 border-[#1C1A18] -ml-3">
            {partnerInitial}
          </div>
        </div>

        <p className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase mt-4">
          COMBINING YOUR TASTES...
        </p>

        <p
          className="font-display font-black text-3xl text-white text-center mt-4 leading-tight px-8 transition-opacity duration-500"
          style={{ opacity: 1 }}
        >
          {BUILD_PHRASES[buildPhrase]}
        </p>

        <p className="font-body text-sm text-[#8A7F78] text-center mt-3">
          Filtering out the maybes. Your deck is almost ready.
        </p>

        {/* Progress dots */}
        <div className="flex gap-2 mt-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-colors duration-[400ms]"
              style={{ background: i === buildPhrase % 3 ? "#E8621A" : "#2A2420" }}
            />
          ))}
        </div>
      </main>
    );
  }

  // ── Host: sharing screen (vibe already set from home) ───────────────────
  if (role === "host" && hostNeedsOnboarding && hostStep === "sharing") {
    const codeDisplay = session?.session_code ?? sessionId?.slice(0, 8).toUpperCase();

    return (
      <main className="relative min-h-screen overflow-hidden bg-[#1C1A18] text-white">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 90% 28% at 50% 0%, rgba(232,98,26,0.11) 0%, transparent 70%), radial-gradient(ellipse 70% 20% at 50% 100%, rgba(28,16,8,0.55) 0%, transparent 65%)",
          }}
        />
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5 pb-10 text-center">

          {/* Back */}
          <Link
            href="/"
            className="absolute top-12 left-5 w-10 h-10 rounded-full bg-[#2A2420] flex items-center justify-center text-white text-lg"
          >
            ←
          </Link>

          <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-8">
            Share your session
          </p>

          <h1 className="font-display font-black text-4xl text-white leading-tight">
            Who&apos;s deciding<br />with you?
          </h1>
          <p className="font-body text-base text-[#8A7F78] mt-3 max-w-xs">
            Send this code or link. They join, you both swipe, and a match picks your dinner.
          </p>

          {/* Read-only vibe pill */}
          {session?.vibe && vibeEmoji[session.vibe] && (
            <div className="flex items-center gap-2 mt-4 bg-[#2A2420] rounded-full px-4 py-2 border border-white/[0.06]">
              <span className="text-base">{vibeEmoji[session.vibe]}</span>
              <span className="font-body text-sm text-[#8A7F78]">
                Vibe: <span className="text-white font-semibold">{vibeName[session.vibe]}</span>
              </span>
            </div>
          )}

          {/* Session code — prominent display */}
          <div className="mt-8 w-full bg-[#2A2420] rounded-[24px] p-6 border border-white/[0.06]">
            <p className="text-[#8A7F78] text-[10px] font-semibold tracking-widest uppercase mb-2">
              Session code
            </p>
            <p className="font-display font-black text-5xl text-white tracking-wide">
              {codeDisplay}
            </p>
            <p className="font-body text-xs text-[#8A7F78] mt-2">
              or share the link below
            </p>
            <div className="mt-3 bg-[#1C1A18] rounded-[12px] px-3 py-2 border border-white/[0.04]">
              <p className="font-body text-xs text-[#8A7F78] truncate">{sessionUrl}</p>
            </div>
          </div>

          {/* Share actions */}
          <div className="grid grid-cols-2 gap-3 mt-4 w-full">
            <button
              onClick={handleShare}
              className="w-full bg-[#E8621A] text-white font-display font-black text-base py-4 rounded-full transition hover:opacity-95 active:scale-[0.99]"
              style={{ boxShadow: "0 0 30px rgba(232,98,26,0.28)" }}
            >
              Share link
            </button>
            <button
              onClick={handleCopy}
              className="w-full bg-[#2A2420] text-white font-display font-black text-base py-4 rounded-full border border-white/10 transition hover:opacity-80 active:scale-[0.99]"
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          </div>

          {/* Waiting status pill */}
          <div className="flex items-center gap-2 bg-[#2A2420] rounded-full px-4 py-2 mt-6">
            <span className="w-2 h-2 rounded-full bg-[#E8621A] animate-pulse" />
            <span className="font-body text-sm text-[#8A7F78]">Waiting for someone to join...</span>
          </div>

          {/* Transition to waiting room */}
          <button
            onClick={() => setHostStep("waiting")}
            className="mt-8 font-body text-sm text-[#8A7F78] underline underline-offset-2 transition hover:text-white/60"
          >
            I shared it, now what? →
          </button>
        </div>
      </main>
    );
  }

  // ── Host: waiting room (Change 3) ─────────────────────────────────────────
  if (role === "host" && (hostStep === "waiting" || !hostNeedsOnboarding)) {
    const myInitial = myProfile?.display_name?.[0]?.toUpperCase() ?? '?';
    const codeDisplay = session?.session_code ?? sessionId?.slice(0, 8).toUpperCase();
    const deckReady = !!(session?.deck_meal_ids?.length);

    // Sub-state: guest just joined, show "Start swiping →"
    if (bothConnected && showStartSwiping) {
      return (
        <main className="relative min-h-screen overflow-hidden bg-[#1C1A18] text-white flex flex-col items-center justify-center px-6 text-center">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-24 right-[-60px] h-52 w-52 rounded-full bg-white/[0.04] blur-3xl" />
          </div>

          <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-8">
            They&apos;re in
          </p>

          {/* Two avatar circles, lit up */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-[#E8621A] flex items-center justify-center font-display font-black text-2xl text-white border-2 border-[#E8621A]/40"
                style={{ boxShadow: "0 0 24px rgba(232,98,26,0.45)" }}>
                {myInitial}
              </div>
              <span className="text-xs text-[#8A7F78]">You</span>
            </div>

            {/* Connector */}
            <div className="flex items-center gap-1.5 mb-5">
              <div className="w-2 h-2 rounded-full bg-[#E8621A]" />
              <div className="w-2 h-2 rounded-full bg-[#E8621A]" />
              <div className="w-2 h-2 rounded-full bg-[#E8621A]" />
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-[#4A7C59] flex items-center justify-center font-display font-black text-2xl text-white border-2 border-[#4A7C59]/40"
                style={{ boxShadow: "0 0 24px rgba(74,124,89,0.45)" }}>
                ✓
              </div>
              <span className="text-xs text-[#8A7F78]">Joined</span>
            </div>
          </div>

          <h1 className="font-display font-black text-4xl text-white leading-tight">
            Your crew<br />is ready.
          </h1>
          <p className="font-body text-base text-[#8A7F78] mt-3 max-w-xs">
            {deckReady
              ? "Your deck is built. Tap to start swiping — you both need to match on something."
              : "Building your shared deck now. Tap to jump in the moment it's ready."}
          </p>

          <button
            onClick={handleStartSwiping}
            disabled={!deckReady}
            className="mt-10 w-full max-w-xs bg-[#E8621A] text-white font-display font-black text-base py-5 rounded-full transition hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
            style={deckReady ? { boxShadow: "0 0 40px rgba(232,98,26,0.4)" } : {}}
          >
            {deckReady ? "Start swiping →" : "Building deck…"}
          </button>

          {!deckReady && (
            <div className="flex items-center gap-2 mt-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8621A] animate-pulse" />
              <span className="font-body text-xs text-[#8A7F78]">Almost there...</span>
            </div>
          )}
        </main>
      );
    }

    // Sub-state: guest joined but 2s animation delay not done yet
    if (bothConnected && !showStartSwiping) {
      return (
        <main className="relative min-h-screen overflow-hidden bg-[#1C1A18] text-white flex flex-col items-center justify-center px-6 text-center">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          </div>

          {/* Two avatar circles, animating in */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-[#E8621A] flex items-center justify-center font-display font-black text-2xl text-white">
                {myInitial}
              </div>
              <span className="text-xs text-[#8A7F78]">You</span>
            </div>

            <div className="flex items-center gap-1.5 mb-5">
              <div className="w-2 h-2 rounded-full bg-[#E8621A]/40 animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-[#E8621A]/40 animate-pulse" style={{ animationDelay: "0.2s" }} />
              <div className="w-2 h-2 rounded-full bg-[#E8621A]/40 animate-pulse" style={{ animationDelay: "0.4s" }} />
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-[#4A7C59] flex items-center justify-center font-display font-black text-2xl text-white animate-pulse">
                ✓
              </div>
              <span className="text-xs text-[#8A7F78]">Joined!</span>
            </div>
          </div>

          <h1 className="font-display font-black text-3xl text-white">
            They joined!
          </h1>
          <p className="font-body text-sm text-[#8A7F78] mt-2">Get ready...</p>
        </main>
      );
    }

    // Sub-state: waiting for guest (full branded waiting room)
    const expiresAt = session?.expires_at ? new Date(session.expires_at) : null;
    const hoursLeft = expiresAt
      ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)))
      : null;

    return (
      <main className="relative min-h-screen overflow-hidden bg-[#1C1A18] text-white flex flex-col px-6 pt-12 pb-10">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 90% 28% at 50% 0%, rgba(232,98,26,0.11) 0%, transparent 70%), radial-gradient(ellipse 70% 20% at 50% 100%, rgba(28,16,8,0.55) 0%, transparent 65%)",
          }}
        />

        {/* Back */}
        {hostNeedsOnboarding && (
          <button
            onClick={() => setHostStep("sharing")}
            className="w-10 h-10 rounded-full bg-[#2A2420] flex items-center justify-center text-white text-lg mb-8 self-start"
          >
            ←
          </button>
        )}

        {/* Main content — centered */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">

          {/* Avatar pair */}
          <div className="flex items-center gap-5 mb-10">
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-16 h-16 rounded-full bg-[#E8621A] flex items-center justify-center font-display font-black text-2xl text-white"
                style={{ boxShadow: "0 0 20px rgba(232,98,26,0.3)" }}
              >
                {myInitial}
              </div>
              <span className="text-xs text-[#8A7F78]">You</span>
            </div>

            {/* Dashed connector */}
            <div className="flex items-center gap-1.5 mb-5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/20" />
              ))}
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-[#2A2420] border-2 border-dashed border-white/20 flex items-center justify-center font-display font-black text-2xl text-white/30">
                ?
              </div>
              <span className="text-xs text-[#8A7F78]">Waiting...</span>
            </div>
          </div>

          {/* Rotating headline */}
          <h1
            key={waitingHeadlineIdx}
            className="font-display font-black text-4xl text-white leading-tight text-center"
            style={{
              animation: "fadeIn 0.4s ease-out",
              whiteSpace: "pre-line",
            }}
          >
            {WAITING_HEADLINES[waitingHeadlineIdx]}
          </h1>

          {/* Session code */}
          <div className="mt-8 bg-[#2A2420] rounded-[20px] px-6 py-4 w-full max-w-xs border border-white/[0.08]">
            <p className="text-[#8A7F78] text-[10px] font-semibold tracking-widest uppercase mb-1">
              Code
            </p>
            <p className="font-display font-black text-3xl text-white tracking-wide">
              {codeDisplay}
            </p>
          </div>

          {/* Expiry */}
          {hoursLeft !== null && (
            <p className="font-body text-xs text-[#8A7F78]/60 mt-3">
              Session expires in {hoursLeft}h
            </p>
          )}

          {/* Waiting pulse */}
          <div className="flex items-center gap-2 mt-6">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E8621A]/60 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E8621A]" />
            </span>
            <span className="font-body text-sm text-[#8A7F78]">Waiting for someone to join</span>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex flex-col gap-3 mt-6">
          <button
            onClick={handleShare}
            className="w-full bg-[#E8621A] text-white font-display font-black text-base py-4 rounded-full"
            style={{ boxShadow: "0 0 30px rgba(232,98,26,0.25)" }}
          >
            Resend invite
          </button>
          <button
            onClick={handleCancelSession}
            disabled={cancellingSession}
            className="w-full bg-[#2A2420] text-[#8A7F78] font-display font-black text-base py-4 rounded-full border border-white/[0.06] transition hover:text-white/60 disabled:opacity-40"
          >
            {cancellingSession ? "Cancelling…" : "Cancel session"}
          </button>
        </div>

        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </main>
    );
  }

  // ── Fallback (should not normally be reached) ─────────────────────────────
  return null;
}
