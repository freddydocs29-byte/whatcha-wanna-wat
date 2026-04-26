"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, Session } from "../../lib/supabase";
import { getUserId } from "../../lib/identity";
import { buildSharedDeckForSession } from "../../lib/deck";
import { upsertProfilePreferences } from "../../lib/supabase-profile";
import type { SessionVibeMode } from "../../lib/scoring";
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

const VIBE_OPTIONS: { value: SessionVibeMode; label: string }[] = [
  { value: "mix-it-up",     label: "Mix It Up" },
  { value: "comfort-food",  label: "Comfort Food" },
  { value: "quick-easy",    label: "Quick & Easy" },
  { value: "healthy",       label: "Healthy" },
  { value: "something-new", label: "Something New" },
  { value: "kid-friendly",  label: "Kid Friendly" },
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
  const [completingSetup, setCompletingSetup] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState<SessionVibeMode>("mix-it-up");

  // Guard so generateDeckIfNeeded only fires once per session load
  const deckTriggeredRef = useRef(false);

  // Guest quick-setup state (null = not yet checked)
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [setupStep, setSetupStep] = useState<"cuisines" | "hardNos" | "heat">("cuisines");
  const [guestCuisines, setGuestCuisines] = useState<string[]>([]);
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
      setBuildingDeck(true);

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
      } finally {
        setBuildingDeck(false);
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

  // Saves the host's vibe choice to the session row so the guest can read it.
  // Fire-and-forget — requires a `vibe` column on the sessions table.
  async function handleVibeChange(vibe: SessionVibeMode) {
    setSelectedVibe(vibe);
    supabase
      .from("sessions")
      .update({ vibe, updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .then(({ error: err }) => {
        if (err) console.warn("[session] vibe save failed:", err.message);
      });
  }

  // Host locks the chosen vibe, generates the shared deck, then enters the deck page.
  // This is the explicit gate that controls when the guest can start swiping.
  async function handleStartSwiping() {
    if (!session) return;
    // Persist the vibe choice so deck page and guest screen both reflect it
    await supabase
      .from("sessions")
      .update({ vibe: selectedVibe, updated_at: new Date().toISOString() })
      .eq("id", sessionId);
    // Build the shared deck (safe to call even if already built — returns early)
    if (!session.deck_meal_ids?.length) {
      await generateDeckIfNeeded(session);
    }
    trackEvent("shared_deck_started", { sessionId, vibe: selectedVibe });
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
      dislikedFoods: guestHardNos.filter((f) => f !== "None of these"),
      spiceLevel: guestSpice ?? "any",
      cookOrOrder: "either",
      kidFriendly: null,
    };
    savePreferences(prefs);
    markOnboardingDone();
    // Sync to Supabase before joining so deck generation can read this profile
    await upsertProfilePreferences(getUserId(), {
      cuisines: prefs.cuisines,
      dislikedFoods: prefs.dislikedFoods,
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
        : setupStep === "hardNos"
        ? guestHardNos.length > 0
        : true; // heat is optional

    async function advanceSetup() {
      if (setupStep === "cuisines") setSetupStep("hardNos");
      else if (setupStep === "hardNos") setSetupStep("heat");
      else await completeGuestSetup();
    }

    const stepNum = setupStep === "cuisines" ? 1 : setupStep === "hardNos" ? 2 : 3;

    return (
      <main className="min-h-screen overflow-hidden bg-[#080808] text-white">
        <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-28 safe-top">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col gap-6 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              {setupStep !== "cuisines" ? (
                <button
                  onClick={() =>
                    setSetupStep(setupStep === "heat" ? "hardNos" : "cuisines")
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white/60 backdrop-blur-md transition active:scale-[0.98]"
                >
                  ←
                </button>
              ) : (
                <div className="w-10" />
              )}
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
                Quick setup
              </span>
              <div className="w-10" />
            </div>

            {/* Progress dots */}
            <div className="flex gap-1.5">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.12]">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-500 ease-out"
                    style={{ width: n <= stepNum ? "100%" : "0%" }}
                  />
                </div>
              ))}
            </div>

            {/* Question */}
            <div className="mt-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/30">
                {stepNum} of 3
              </p>
              <h1 className="mt-3 text-[34px] font-semibold leading-tight tracking-[-0.04em]">
                {setupStep === "cuisines" && "What are you\ndown for?"}
                {setupStep === "hardNos" && "Any hard nos\nor allergies?"}
                {setupStep === "heat" && "How do you feel\nabout heat?"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-white/50">
                {setupStep === "cuisines" && "Pick everything that sounds good to you."}
                {setupStep === "hardNos" && "These will never show up in your deck."}
                {setupStep === "heat" && "Optional — skip if you don't mind either way."}
              </p>
            </div>

            {/* Options */}
            {setupStep === "cuisines" && (
              <div className="flex flex-wrap gap-3">
                {GUEST_CUISINES.map((c) => {
                  const selected = guestCuisines.includes(c.label);
                  return (
                    <button
                      key={c.label}
                      onClick={() => toggleMulti(c.label, guestCuisines, setGuestCuisines)}
                      className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.96] ${
                        selected
                          ? "border-white bg-white text-black shadow-[0_0_0_1px_rgba(255,255,255,0.3),0_4px_20px_rgba(255,255,255,0.10)]"
                          : "border-white/15 bg-white/[0.05] text-white/70 hover:border-white/25 hover:bg-white/[0.09]"
                      }`}
                    >
                      <span>{c.emoji}</span>
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {setupStep === "hardNos" && (
              <div className="flex flex-wrap gap-3">
                {GUEST_HARD_NOS.map((f) => {
                  const selected = guestHardNos.includes(f.label);
                  return (
                    <button
                      key={f.label}
                      onClick={() => toggleMulti(f.label, guestHardNos, setGuestHardNos)}
                      className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.96] ${
                        selected
                          ? "border-white bg-white text-black shadow-[0_0_0_1px_rgba(255,255,255,0.3),0_4px_20px_rgba(255,255,255,0.10)]"
                          : "border-white/15 bg-white/[0.05] text-white/70 hover:border-white/25 hover:bg-white/[0.09]"
                      }`}
                    >
                      <span>{f.emoji}</span>
                      <span>{f.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {setupStep === "heat" && (
              <div className="grid gap-3">
                {GUEST_HEAT.map((opt) => {
                  const selected = guestSpice === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setGuestSpice(opt.value)}
                      className={`flex items-center gap-4 rounded-[22px] border p-4 text-left transition-all duration-150 active:scale-[0.99] ${
                        selected
                          ? "border-white/60 bg-white/[0.10] shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_6px_28px_rgba(255,255,255,0.06)]"
                          : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]"
                      }`}
                    >
                      <span className="text-2xl">{opt.emoji}</span>
                      <p className="flex-1 text-[15px] font-semibold tracking-[-0.03em]">{opt.label}</p>
                      <div
                        className={`h-5 w-5 shrink-0 rounded-full border-2 transition-all duration-150 ${
                          selected ? "border-white bg-white" : "border-white/20"
                        }`}
                      />
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
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent to-[#080808]" />
            <button
              onClick={advanceSetup}
              disabled={!canAdvance || completingSetup}
              className={`w-full rounded-full bg-white px-5 py-[18px] text-center text-[15px] font-semibold text-black transition hover:opacity-95 active:scale-[0.99] disabled:opacity-30 ${
                canAdvance && !completingSetup ? "shadow-[0_8px_40px_rgba(255,255,255,0.28)]" : "shadow-none"
              }`}
            >
              {completingSetup ? "Joining…" : setupStep === "heat" ? "Join session" : "Continue"}
            </button>
            {setupStep === "heat" && (
              <button
                onClick={() => completeGuestSetup()}
                disabled={completingSetup}
                className="mt-3 w-full text-center text-sm text-white/35 transition hover:text-white/55 disabled:opacity-30"
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

  // ── Guest: waiting for host to pick vibe / generate deck ─────────────────
  if (role === "guest" && !(session?.deck_meal_ids?.length)) {
    return (
      <main className="min-h-screen overflow-hidden bg-[#080808] text-white">
        <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 safe-top">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col gap-8 pt-6">
            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white/60 backdrop-blur-md transition active:scale-[0.98]"
              >
                ←
              </Link>
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
                Shared session
              </span>
              <div className="w-10" />
            </div>

            <div className="rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.14] via-white/[0.08] to-white/[0.04] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/40 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white/70" />
                </span>
                <p className="text-xs font-medium uppercase tracking-widest text-white/50">
                  Waiting
                </p>
              </div>
              <h1 className="mt-4 text-[32px] font-semibold leading-tight tracking-[-0.04em]">
                Hang tight…
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/55">
                Waiting for the host to start the deck.
              </p>
            </div>

            <p className="text-center text-[11px] text-white/20">
              Session · {sessionId?.slice(0, 8)}
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ── Guest: deck ready — show intentional entry screen ────────────────────
  if (role === "guest" && !!(session?.deck_meal_ids?.length)) {
    const guestVibe = (session?.vibe ?? "mix-it-up") as SessionVibeMode;
    const vibeLabel = VIBE_OPTIONS.find((v) => v.value === guestVibe)?.label ?? "Mix It Up";

    return (
      <main className="min-h-screen overflow-hidden bg-[#080808] text-white">
        <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 safe-top">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-400/[0.06] blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col gap-8 pt-6">
            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white/60 backdrop-blur-md transition active:scale-[0.98]"
              >
                ←
              </Link>
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
                Shared session
              </span>
              <div className="w-10" />
            </div>

            <div className="rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.14] via-white/[0.08] to-white/[0.04] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">
                  Ready
                </p>
              </div>
              <h1 className="mt-4 text-[32px] font-semibold leading-tight tracking-[-0.04em]">
                You&apos;re in
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/55">
                We&apos;ll use both profiles to build your shared deck.
              </p>

              {/* Vibe — read-only, set by host */}
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="text-[11px] font-medium uppercase tracking-widest text-white/30">
                  Vibe
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.06] px-3 py-1 text-xs text-white/60">
                  {vibeLabel}
                </span>
              </div>

              <button
                onClick={() => router.push(`/deck?sessionId=${sessionId}&vibe=${guestVibe}`)}
                className="mt-6 w-full rounded-full bg-white py-4 text-base font-semibold text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition hover:opacity-95 active:scale-[0.99]"
              >
                Start swiping
              </button>
            </div>

            <p className="text-center text-[11px] text-white/20">
              Session · {sessionId?.slice(0, 8)}
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ── Host lobby ────────────────────────────────────────────────────────────
  const bothConnected = session?.status === "active" || session?.status === "matched";
  const deckReady = !!(session?.deck_meal_ids?.length);

  return (
    <main className="min-h-screen overflow-hidden bg-[#080808] text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 safe-top">
        {/* Background glows */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-24 right-[-60px] h-52 w-52 rounded-full bg-white/[0.04] blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col gap-8 pt-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white/60 backdrop-blur-md transition active:scale-[0.98]"
            >
              ←
            </Link>
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
              Shared session
            </span>
            <div className="w-10" />
          </div>

          {/* Status card */}
          <div className="rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.14] via-white/[0.08] to-white/[0.04] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            {/* Status indicator */}
            {deckReady ? (
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">
                  Ready
                </p>
              </div>
            ) : bothConnected ? (
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-white/70" />
                <p className="text-xs font-medium uppercase tracking-widest text-white/50">
                  Ready to start
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/40 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white/70" />
                </span>
                <p className="text-xs font-medium uppercase tracking-widest text-white/50">
                  Waiting for someone
                </p>
              </div>
            )}

            <h1 className="mt-4 text-[32px] font-semibold leading-tight tracking-[-0.04em]">
              {deckReady
                ? "Ready to decide"
                : bothConnected
                ? "Both connected"
                : "Session created"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/55">
              {deckReady
                ? "Your shared deck is ready. Start swiping — matches happen when you both say yes to the same meal."
                : bothConnected
                ? "Tap Start swiping to build your shared deck."
                : "Share this link and wait for them to join."}
            </p>

            {/* Invite link — always visible so host can share while waiting */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="truncate text-xs text-white/40">{sessionUrl}</p>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleShare}
                className="flex-1 rounded-full border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-medium text-white transition active:scale-[0.98]"
              >
                Share link
              </button>
              <button
                onClick={handleCopy}
                className="flex-1 rounded-full border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition active:scale-[0.98]"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>

            {/* Vibe — editable while waiting for guest, locked once both are connected */}
            {!deckReady && (
              <div className="mt-5">
                {!bothConnected ? (
                  <>
                    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-white/30">
                      Vibe
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {VIBE_OPTIONS.map(({ value, label }) => {
                        const isActive = selectedVibe === value;
                        return (
                          <button
                            key={value}
                            onClick={() => handleVibeChange(value)}
                            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors duration-150 active:scale-[0.96] ${
                              isActive
                                ? "border-white/30 bg-white/[0.14] text-white/90"
                                : "border-white/[0.08] bg-transparent text-white/35 hover:border-white/18 hover:text-white/60"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-widest text-white/30">
                      Vibe
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/[0.1] bg-white/[0.06] px-3 py-1 text-xs text-white/60">
                      {VIBE_OPTIONS.find((v) => v.value === selectedVibe)?.label ?? "Mix It Up"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Start swiping — shown once both users are connected.
                First click generates the deck (locked to the chosen vibe) then enters. */}
            {bothConnected && (
              <button
                onClick={handleStartSwiping}
                disabled={buildingDeck}
                className="mt-6 w-full rounded-full bg-white py-4 text-base font-semibold text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
              >
                {buildingDeck ? "Building deck…" : "Start swiping"}
              </button>
            )}
          </div>

          {/* Session ID footer */}
          <p className="text-center text-[11px] text-white/20">
            Session · {sessionId?.slice(0, 8)}
          </p>
        </div>
      </div>
    </main>
  );
}
