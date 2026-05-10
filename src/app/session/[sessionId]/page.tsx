"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, Session } from "../../lib/supabase";
import { getUserId } from "../../lib/identity";
import { buildSharedDeckForSession } from "../../lib/deck";
import { upsertProfilePreferences, syncBehavioralSignalsToSupabase } from "../../lib/supabase-profile";
import type { SessionVibeMode, CookingIntent } from "../../lib/scoring";
import {
  hasCompletedOnboarding,
  savePreferences,
  markOnboardingDone,
  type UserPreferences,
} from "../../lib/storage";
import { trackEvent } from "../../lib/analytics";

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

const GUEST_HEAT: { value: UserPreferences["spiceLevel"]; label: string; emoji: string }[] = [
  { value: "mild", label: "Mild", emoji: "🌿" },
  { value: "medium", label: "Medium", emoji: "🌶️" },
  { value: "hot", label: "Hot", emoji: "🔥" },
  { value: "any", label: "No preference", emoji: "🤷" },
];

type ViewerRole = "host" | "guest" | "full" | "unknown";

const POLL_INTERVAL_MS = 3000;

const BUILD_PHRASES = [
  "Finding what you'll both actually want...",
  "Filtering out the hard nos...",
  "Building your deck...",
  "Almost there...",
];

const COOKING_INTENT_OPTIONS: { value: CookingIntent; label: string; sub: string }[] = [
  { value: "cooking",  label: "Cooking",      sub: "We'll make it at home" },
  { value: "ordering", label: "Ordering",     sub: "Delivery or takeout" },
  { value: "either",   label: "Either works", sub: "No preference" },
];

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<ViewerRole>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [joining, setJoining] = useState(false);
  const [buildingDeck, setBuildingDeck] = useState(false);
  const [buildPhrase, setBuildPhrase] = useState(0);
  const [completingSetup, setCompletingSetup] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState<SessionVibeMode>("mix-it-up");
  const [selectedCookingIntent, setSelectedCookingIntent] = useState<CookingIntent>("either");
  const [cookingIntentStep, setCookingIntentStep] = useState<"pending" | "done">("pending");

  // Guard so generateDeckIfNeeded only fires once per session load
  const deckTriggeredRef = useRef(false);

  // Guest quick-setup state (null = not yet checked)
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [setupStep, setSetupStep] = useState<"cuisines" | "dietary" | "hardNos" | "heat">("cuisines");
  const [guestCuisines, setGuestCuisines] = useState<string[]>([]);
  const [guestDietaryRestrictions, setGuestDietaryRestrictions] = useState<string[]>([]);
  const [guestHardNos, setGuestHardNos] = useState<string[]>([]);
  const [guestSpice, setGuestSpice] = useState<UserPreferences["spiceLevel"] | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sessionUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/session/${sessionId}`
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
    setSession(s);

    const myId = getUserId();

    if (myId === s.host_user_id) {
      setRole("host");
      if (s.vibe) setSelectedVibe(s.vibe as SessionVibeMode);
      if (s.cooking_intent) setSelectedCookingIntent(s.cooking_intent);
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

        setSession((prev) =>
          prev ? { ...prev, deck_meal_ids: mealIds } : prev,
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
        status: "active",
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
    // Deck generation is deferred — host triggers it explicitly by clicking "Start swiping"
  }, [sessionId, loadSession, generateDeckIfNeeded]);

  // Initial load
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Auto-join if guest slot is open — only after setup is confirmed not needed
  useEffect(() => {
    if (role === "unknown" && session && !joining && needsSetup === false) {
      joinSession();
    }
  }, [role, session, joining, needsSetup, joinSession]);

  // Auto-advance cooking intent step after 20 s if both are connected and neither has acted
  useEffect(() => {
    const isConnected = session?.status === "active" || session?.status === "matched";
    if (!isConnected || cookingIntentStep !== "pending") return;
    const timer = setTimeout(() => setCookingIntentStep("done"), 20_000);
    return () => clearTimeout(timer);
  }, [session?.status, cookingIntentStep]);

  // Cycle through build phrases while deck is generating
  useEffect(() => {
    if (!buildingDeck) return;
    setBuildPhrase(0);
    const interval = setInterval(() => {
      setBuildPhrase((p) => (p + 1) % BUILD_PHRASES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [buildingDeck]);

  // Poll for changes:
  // - Host: detect when guest joins (status: waiting → active)
  // - Both: detect when deck is ready (deck_meal_ids populated)
  useEffect(() => {
    const shouldPoll =
      (role === "host" && session?.status === "waiting") ||
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

  // Persists cooking intent selection and advances past the question step.
  // Called by both host and guest — last write wins (both are present, it's a quick choice).
  async function handleCookingIntentSelect(intent: CookingIntent) {
    setSelectedCookingIntent(intent);
    const { error: err } = await supabase
      .from("sessions")
      .update({ cooking_intent: intent, updated_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (err) console.warn("[session] cooking intent save failed:", err.message);
    setCookingIntentStep("done");
  }

  function handleCookingIntentSkip() {
    setCookingIntentStep("done");
  }

  // Host locks the chosen vibe, generates the shared deck, then enters.
  // cooking_intent is already in the DB from the question step — no need to re-write it here.
  async function handleStartSwiping() {
    if (!session) return;
    syncBehavioralSignalsToSupabase(getUserId()).catch((err) =>
      console.warn("[sync] behavioral signals failed:", err),
    );
    // Persist the vibe so deck build and guest screen both reflect it
    await supabase
      .from("sessions")
      .update({
        vibe: selectedVibe,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    // Show the Building Deck screen for a minimum of 3 seconds regardless of
    // how fast the data loads, so the animation has time to play.
    setBuildingDeck(true);
    const minDelay = new Promise<void>((resolve) => setTimeout(resolve, 3000));
    const deckBuild = !session.deck_meal_ids?.length
      ? generateDeckIfNeeded(session)
      : Promise.resolve();
    await Promise.all([minDelay, deckBuild]);
    setBuildingDeck(false);
    trackEvent("shared_deck_started", { sessionId, vibe: selectedVibe, cookingIntent: selectedCookingIntent });
    router.push(`/deck?sessionId=${sessionId}&vibe=${selectedVibe}`);
  }

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
      spiceLevel: guestSpice ?? "any",
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
      setupStep === "cuisines"
        ? guestCuisines.length > 0
        : setupStep === "dietary"
        ? guestDietaryRestrictions.length > 0
        : setupStep === "hardNos"
        ? guestHardNos.length > 0
        : true; // heat is optional

    async function advanceSetup() {
      if (setupStep === "cuisines") setSetupStep("dietary");
      else if (setupStep === "dietary") setSetupStep("hardNos");
      else if (setupStep === "hardNos") setSetupStep("heat");
      else await completeGuestSetup();
    }

    const stepNum = setupStep === "cuisines" ? 1 : setupStep === "dietary" ? 2 : setupStep === "hardNos" ? 3 : 4;

    return (
      <main className="min-h-screen bg-[#1C1A18] text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-28">

          <div className="flex flex-col gap-6 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              {setupStep !== "cuisines" ? (
                <button
                  onClick={() => {
                    if (setupStep === "heat") setSetupStep("hardNos");
                    else if (setupStep === "hardNos") setSetupStep("dietary");
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
              {[1, 2, 3, 4].map((n) => (
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
                {stepNum} of 4
              </p>
              <h1 className="mt-3 font-display font-black text-3xl text-white leading-tight">
                {setupStep === "cuisines" && "What are you down for?"}
                {setupStep === "dietary" && "Any dietary restrictions?"}
                {setupStep === "hardNos" && "Anything you absolutely won't eat?"}
                {setupStep === "heat" && "How do you feel about heat?"}
              </h1>
              <p className="mt-2 font-body text-sm text-[#8A7F78]">
                {setupStep === "cuisines" && "Pick everything that sounds good to you."}
                {setupStep === "dietary" && "We'll never show you meals that don't work for you."}
                {setupStep === "hardNos" && "Hard NOs are never shown. Ever."}
                {setupStep === "heat" && "Optional — skip if you don't mind either way."}
              </p>
            </div>

            {/* Options */}
            {setupStep === "cuisines" && (
              <div className="flex flex-col gap-2">
                {GUEST_CUISINES.map((c) => {
                  const selected = guestCuisines.includes(c.label);
                  return (
                    <button
                      key={c.label}
                      onClick={() => toggleMulti(c.label, guestCuisines, setGuestCuisines)}
                      className={`flex items-center gap-4 rounded-[18px] p-4 border transition-all duration-150 active:scale-[0.99] ${
                        selected
                          ? "border-[#E8621A] bg-[#E8621A]/10"
                          : "border-transparent bg-[#2A2420]"
                      }`}
                    >
                      <span className="text-2xl">{c.emoji}</span>
                      <span className="flex-1 font-display font-black text-base text-white text-left">{c.label}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
                        selected ? "border-[#E8621A] bg-[#E8621A]" : "border-white/20"
                      }`}>
                        {selected && <span className="text-white text-[10px] font-bold">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {setupStep === "dietary" && (
              <div className="flex flex-col gap-2">
                {GUEST_DIETARY_RESTRICTIONS.map((f) => {
                  const selected = guestDietaryRestrictions.includes(f.label);
                  return (
                    <button
                      key={f.label}
                      onClick={() => toggleMulti(f.label, guestDietaryRestrictions, setGuestDietaryRestrictions)}
                      className={`flex items-center gap-4 rounded-[18px] p-4 border transition-all duration-150 active:scale-[0.99] ${
                        selected
                          ? "border-[#E8621A] bg-[#E8621A]/10"
                          : "border-transparent bg-[#2A2420]"
                      }`}
                    >
                      <span className="text-2xl">{f.emoji}</span>
                      <span className="flex-1 font-display font-black text-base text-white text-left">{f.label}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
                        selected ? "border-[#E8621A] bg-[#E8621A]" : "border-white/20"
                      }`}>
                        {selected && <span className="text-white text-[10px] font-bold">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {setupStep === "hardNos" && (
              <div className="flex flex-col gap-2">
                {GUEST_HARD_NOS.map((f) => {
                  const selected = guestHardNos.includes(f.label);
                  return (
                    <button
                      key={f.label}
                      onClick={() => toggleMulti(f.label, guestHardNos, setGuestHardNos)}
                      className={`flex items-center gap-4 rounded-[18px] p-4 border transition-all duration-150 active:scale-[0.99] ${
                        selected
                          ? "border-[#E8621A] bg-[#E8621A]/10"
                          : "border-transparent bg-[#2A2420]"
                      }`}
                    >
                      <span className="text-2xl">{f.emoji}</span>
                      <span className="flex-1 font-display font-black text-base text-white text-left">{f.label}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
                        selected ? "border-[#E8621A] bg-[#E8621A]" : "border-white/20"
                      }`}>
                        {selected && <span className="text-white text-[10px] font-bold">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {setupStep === "heat" && (
              <div className="flex flex-col gap-2">
                {GUEST_HEAT.map((opt) => {
                  const selected = guestSpice === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setGuestSpice(opt.value)}
                      className={`flex items-center gap-4 rounded-[18px] p-4 border transition-all duration-150 active:scale-[0.99] ${
                        selected
                          ? "border-[#E8621A] bg-[#E8621A]/10"
                          : "border-transparent bg-[#2A2420]"
                      }`}
                    >
                      <span className="text-2xl">{opt.emoji}</span>
                      <p className="flex-1 font-display font-black text-base text-white text-left">{opt.label}</p>
                      <div className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${
                        selected ? "border-[#E8621A] bg-[#E8621A]" : "border-white/20"
                      }`}>
                        {selected && <span className="text-white text-[10px] font-bold">✓</span>}
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
              {completingSetup ? "Joining…" : setupStep === "heat" ? "Join session" : "Continue"}
            </button>
            {setupStep === "heat" && (
              <button
                onClick={() => completeGuestSetup()}
                disabled={completingSetup}
                className="mt-3 w-full text-center text-sm text-[#8A7F78] transition hover:text-white/55 disabled:opacity-30"
              >
                Skip heat preference
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!session && !error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
        <p className="text-white/40 text-sm">Loading session…</p>
      </main>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#080808] px-6 text-center text-white">
        <p className="text-lg font-semibold">Something went wrong</p>
        <p className="max-w-[28ch] text-sm text-white/50">{error}</p>
        <Link
          href="/"
          className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white"
        >
          Back to home
        </Link>
      </main>
    );
  }

  // ── Session full ──────────────────────────────────────────────────────────
  if (role === "full") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#080808] px-6 text-center text-white">
        <div className="text-4xl">🔒</div>
        <p className="text-lg font-semibold tracking-[-0.03em]">Session is full</p>
        <p className="max-w-[28ch] text-sm leading-6 text-white/50">
          This session already has two people. Ask the host to start a new one.
        </p>
        <Link
          href="/"
          className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-medium text-white"
        >
          Back to home
        </Link>
      </main>
    );
  }

  // ── Guest: waiting for deck / cooking intent question ────────────────────
  if (role === "guest" && !(session?.deck_meal_ids?.length)) {
    const guestBothConnected = session?.status === "active" || session?.status === "matched";

    // Cooking intent question — shown once both users are connected
    if (guestBothConnected && cookingIntentStep === "pending") {
      return (
        <main className="min-h-screen bg-[#1C1A18] text-white">
          <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 safe-top">
            <div className="flex flex-col gap-8 pt-6">
              <div className="flex items-center justify-between">
                <Link
                  href="/"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white/60 transition active:scale-[0.98]"
                >
                  ←
                </Link>
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[#8A7F78]">
                  Shared session
                </span>
                <div className="w-10" />
              </div>
              <div className="bg-[#2A2420] rounded-[24px] p-6">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#E8621A] animate-pulse" />
                  <p className="font-body text-[11px] font-semibold uppercase tracking-widest text-[#8A7F78]">
                    Both connected
                  </p>
                </div>
                <h1 className="mt-4 font-display font-black text-3xl text-white leading-tight">
                  Quick question
                </h1>
                <p className="mt-3 font-body text-base text-[#8A7F78]">
                  Cooking or ordering tonight?
                </p>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {COOKING_INTENT_OPTIONS.map(({ value, label, sub }) => {
                    const emojis: Record<CookingIntent, string> = { cooking: "🍳", ordering: "📱", either: "🤷" };
                    const isActive = selectedCookingIntent === value;
                    return (
                      <button
                        key={value}
                        onClick={() => void handleCookingIntentSelect(value)}
                        className={`flex flex-col items-center gap-1.5 rounded-[16px] border p-3 text-center transition-all duration-150 active:scale-[0.97] ${
                          isActive
                            ? "border-[#E8621A] bg-[#E8621A]/10 text-white"
                            : "border-white/[0.07] bg-[#1C1A18] text-white/35 hover:border-white/15 hover:text-white/55"
                        }`}
                      >
                        <span className="text-2xl">{emojis[value]}</span>
                        <span className="text-xs font-semibold">{label}</span>
                        <span className={`mt-0.5 text-[10px] leading-tight ${isActive ? "text-[#8A7F78]" : "text-white/20"}`}>{sub}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={handleCookingIntentSkip}
                  className="mt-4 w-full text-center font-body text-sm text-[#8A7F78]/50 transition hover:text-[#8A7F78]"
                >
                  Skip
                </button>
              </div>
              <p className="text-center font-body text-xs text-[#8A7F78]/40">
                Session · {sessionId?.slice(0, 8)}
              </p>
            </div>
          </div>
        </main>
      );
    }

    // Waiting / building deck state
    return (
      <main className="relative min-h-screen bg-[#1C1A18] flex flex-col items-center justify-center px-6 text-center">
        <Link
          href="/"
          className="absolute top-12 left-5 w-10 h-10 rounded-full bg-[#2A2420] flex items-center justify-center text-white text-lg"
        >
          ←
        </Link>

        <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-12">
          Shared session
        </p>

        <div className="w-24 h-24 rounded-full bg-[#E8621A]/10 flex items-center justify-center animate-pulse">
          <div className="w-14 h-14 rounded-full bg-[#E8621A]/20 flex items-center justify-center">
            <span className="text-3xl">👥</span>
          </div>
        </div>

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
          Session · {sessionId}
        </p>
      </main>
    );
  }

  // ── Guest: deck ready — show intentional entry screen ────────────────────
  if (role === "guest" && !!(session?.deck_meal_ids?.length)) {
    const guestVibe = (session?.vibe ?? "mix-it-up") as SessionVibeMode;

    return (
      <main className="min-h-screen bg-[#1C1A18] text-white flex flex-col items-center justify-center px-6 text-center">
        <Link
          href="/"
          className="absolute top-12 left-5 w-10 h-10 rounded-full bg-[#2A2420] flex items-center justify-center text-white text-lg"
        >
          ←
        </Link>

        <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-12">
          Shared session
        </p>

        <div className="w-24 h-24 rounded-full bg-[#E8621A]/10 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-[#E8621A]/20 flex items-center justify-center">
            <span className="text-3xl">👥</span>
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
          onClick={() => router.push(`/deck?sessionId=${sessionId}&vibe=${guestVibe}`)}
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

  // ── Building deck loading screen ─────────────────────────────────────────
  if (buildingDeck) {
    const myInitial = "Y";
    const partnerInitial = "?";

    return (
      <main className="min-h-screen bg-[#1C1A18] flex flex-col items-center justify-center">
        {/* Concentric rings */}
        <div
          className="relative flex items-center justify-center w-72 h-72"
          style={{ animation: "pulse 3s ease-in-out infinite" }}
        >
          {/* Ring 1 — outermost */}
          <div className="absolute w-72 h-72 rounded-full border border-[#E8621A]/20" />
          {/* Ring 2 — middle */}
          <div className="absolute w-52 h-52 rounded-full border border-[#E8621A]/35" />
          {/* Ring 3 — inner */}
          <div className="absolute w-36 h-36 rounded-full border border-[#E8621A]/50" />
          {/* Center circle */}
          <div className="w-20 h-20 rounded-full bg-[#3D1A00] flex items-center justify-center">
            <span className="font-display font-black text-3xl text-[#E8621A]">?</span>
          </div>
        </div>

        {/* Overlapping avatars */}
        <div className="flex items-center justify-center mt-8">
          <div className="w-10 h-10 rounded-full bg-[#E8621A] flex items-center justify-center font-display font-black text-sm text-white border-2 border-[#1C1A18] z-10 relative">
            {myInitial}
          </div>
          <div className="w-10 h-10 rounded-full bg-[#3D3733] flex items-center justify-center font-display font-black text-sm text-white border-2 border-[#1C1A18] -ml-3">
            {partnerInitial}
          </div>
        </div>

        {/* Status label */}
        <p className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase mt-4">
          COMBINING YOUR TASTES...
        </p>

        {/* Rotating headline */}
        <p
          className="font-display font-black text-3xl text-white text-center mt-4 leading-tight px-8 transition-opacity duration-500"
          style={{ opacity: 1 }}
        >
          {BUILD_PHRASES[buildPhrase]}
        </p>

        {/* Subtext */}
        <p className="font-body text-sm text-[#8A7F78] text-center mt-3">
          Filtering out the maybes. Your deck is almost ready.
        </p>
      </main>
    );
  }

  // ── Host lobby ────────────────────────────────────────────────────────────
  const bothConnected = session?.status === "active" || session?.status === "matched";
  const deckReady = !!(session?.deck_meal_ids?.length);

  // ── Host: waiting for guest to join ──────────────────────────────────────
  if (role === "host" && !bothConnected) {
    return (
      <main className="relative min-h-screen bg-[#1C1A18] flex flex-col items-center justify-center px-6 text-center">
        <Link
          href="/"
          className="absolute top-12 left-5 w-10 h-10 rounded-full bg-[#2A2420] flex items-center justify-center text-white text-lg"
        >
          ←
        </Link>

        <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-12">
          Shared session
        </p>

        <div className="w-24 h-24 rounded-full bg-[#E8621A]/10 flex items-center justify-center animate-pulse">
          <div className="w-14 h-14 rounded-full bg-[#E8621A]/20 flex items-center justify-center">
            <span className="text-3xl">👥</span>
          </div>
        </div>

        <h1 className="font-display font-black text-3xl text-white mt-8 leading-tight text-center">
          Waiting for someone to join.
        </h1>
        <p className="font-body text-base text-[#8A7F78] mt-3 max-w-xs text-center">
          Share the link below. Your deck builds the moment they join.
        </p>

        <div className="flex items-center gap-2 bg-[#2A2420] rounded-full px-4 py-2 mt-6">
          <span className="w-2 h-2 rounded-full bg-[#4A7C59] animate-pulse" />
          <span className="font-body text-sm text-[#8A7F78]">WAITING FOR SOMEONE</span>
        </div>

        <div className="w-full bg-[#2A2420] rounded-[16px] px-4 py-3 mt-8">
          <p className="font-body text-sm text-[#8A7F78] truncate">{sessionUrl}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3 w-full">
          <button
            onClick={handleShare}
            className="w-full bg-[#E8621A] text-white font-display font-black text-base py-4 rounded-[14px]"
            style={{ boxShadow: "0 0 30px rgba(232,98,26,0.25)" }}
          >
            Share link
          </button>
          <button
            onClick={handleCopy}
            className="w-full bg-[#2A2420] text-white font-display font-black text-base py-4 rounded-[14px] border border-white/10"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        <p className="font-body text-xs text-[#8A7F78]/40 mt-6">
          Session · {sessionId}
        </p>
      </main>
    );
  }

  // ── Host: both connected ──────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#1C1A18] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10">

        <div className="flex flex-col gap-6 pt-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white/60 transition active:scale-[0.98]"
            >
              ←
            </Link>
            <span className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase">
              Shared session
            </span>
            <div className="w-10" />
          </div>

          {/* Status card */}
          <div className="bg-[#2A2420] rounded-[24px] p-6">
            {/* Status pill */}
            {deckReady ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#4A7C59] animate-pulse" />
                <span className="font-body text-[11px] font-semibold tracking-widest uppercase text-[#8A7F78]">DECK READY</span>
              </div>
            ) : bothConnected ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E8621A] animate-pulse" />
                <span className="font-body text-[11px] font-semibold tracking-widest uppercase text-[#8A7F78]">BOTH CONNECTED</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E8621A]/60 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E8621A]" />
                </span>
                <span className="font-body text-[11px] font-semibold tracking-widest uppercase text-[#8A7F78]">WAITING FOR SOMEONE</span>
              </div>
            )}

            <h1 className="font-display font-black text-3xl text-white leading-tight mt-4">
              {deckReady
                ? "Ready to decide."
                : bothConnected
                ? "You're both in."
                : "Session created."}
            </h1>
            <p className="font-body text-base text-[#8A7F78] mt-3">
              {deckReady
                ? "Your shared deck is ready. Start swiping — matches happen when you both say yes."
                : bothConnected
                ? "Tap Start swiping to build your shared deck."
                : "Share this link and wait for them to join."}
            </p>

            {/* Invite link */}
            <div className="mt-5 bg-[#1C1A18] rounded-[14px] px-4 py-3">
              <p className="truncate font-body text-xs text-[#8A7F78]">{sessionUrl}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                onClick={handleShare}
                className="w-full bg-[#E8621A] text-white font-display font-black text-base py-4 rounded-full"
                style={{ boxShadow: "0 0 30px rgba(232,98,26,0.25)" }}
              >
                Share link
              </button>
              <button
                onClick={handleCopy}
                className="w-full bg-[#1C1A18] text-white font-display font-black text-base py-4 rounded-full border border-white/10"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>

            {/* Cooking intent question */}
            {bothConnected && !deckReady && cookingIntentStep === "pending" && (
              <div className="mt-6">
                <p className="font-body text-sm text-[#8A7F78] mb-3">
                  Cooking or ordering tonight?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {COOKING_INTENT_OPTIONS.map(({ value, label, sub }) => {
                    const emojis: Record<CookingIntent, string> = { cooking: "🍳", ordering: "📱", either: "🤷" };
                    const isActive = selectedCookingIntent === value;
                    return (
                      <button
                        key={value}
                        onClick={() => void handleCookingIntentSelect(value)}
                        className={`flex flex-col items-center gap-1.5 rounded-[16px] border p-3 text-center transition-all duration-150 active:scale-[0.97] ${
                          isActive
                            ? "border-[#E8621A] bg-[#E8621A]/10"
                            : "border-white/[0.07] bg-[#1C1A18]"
                        }`}
                      >
                        <span className="text-2xl">{emojis[value]}</span>
                        <span className={`text-xs font-semibold ${isActive ? "text-white" : "text-white/35"}`}>{label}</span>
                        <span className={`text-[10px] leading-tight ${isActive ? "text-[#8A7F78]" : "text-white/20"}`}>{sub}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={handleCookingIntentSkip}
                  className="mt-3 w-full text-center font-body text-sm text-[#8A7F78]/50 transition hover:text-[#8A7F78]"
                >
                  Skip
                </button>
              </div>
            )}

            {/* Start swiping */}
            {bothConnected && cookingIntentStep === "done" && (
              <button
                onClick={handleStartSwiping}
                disabled={buildingDeck}
                className="mt-6 w-full rounded-full bg-[#E8621A] py-4 text-base font-display font-black text-white transition hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
                style={{ boxShadow: "0 0 30px rgba(232,98,26,0.25)" }}
              >
                {buildingDeck ? "Building deck…" : "Start swiping"}
              </button>
            )}
          </div>

          {/* Session ID footer */}
          <p className="text-center font-body text-xs text-[#8A7F78]/40">
            Session · {sessionId?.slice(0, 8)}
          </p>
        </div>
      </div>
    </main>
  );
}
