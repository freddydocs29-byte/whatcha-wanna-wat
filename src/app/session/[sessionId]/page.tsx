"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, Session } from "../../lib/supabase";
import { getUserId } from "../../lib/identity";
import { buildSharedDeck } from "../../lib/deck";
import {
  hasCompletedOnboarding,
  savePreferences,
  markOnboardingDone,
  type UserPreferences,
} from "../../lib/storage";

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

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<ViewerRole>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [joining, setJoining] = useState(false);
  const [startingDeck, setStartingDeck] = useState(false);

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
  }, [sessionId, loadSession]);

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

  // Navigate guest to deck as soon as host has built the deck
  useEffect(() => {
    if (role === "guest" && session?.deck_meal_ids && session.deck_meal_ids.length > 0) {
      router.push(`/deck?sessionId=${sessionId}`);
    }
  }, [role, session?.deck_meal_ids, sessionId, router]);

  // Poll for changes:
  // - Host: detect when guest joins (for status indicator)
  // - Guest: detect when host has started the deck
  useEffect(() => {
    const shouldPoll =
      (role === "host" && session?.status === "waiting") ||
      (role === "guest" && !(session?.deck_meal_ids?.length));

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

  // Host generates and persists the shared deck, then navigates to the deck page.
  // Guest can join any time — even after host has started swiping.
  async function handleStartSwiping() {
    if (role === "host") {
      setStartingDeck(true);
      const mealIds = buildSharedDeck();
      await supabase
        .from("sessions")
        .update({ deck_meal_ids: mealIds })
        .eq("id", sessionId);
      setStartingDeck(false);
    }
    router.push(`/deck?sessionId=${sessionId}`);
  }

  function handleCopy() {
    navigator.clipboard.writeText(sessionUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function completeGuestSetup() {
    savePreferences({
      cuisines: guestCuisines,
      dislikedFoods: guestHardNos.filter((f) => f !== "None of these"),
      spiceLevel: guestSpice ?? "any",
      cookOrOrder: "either",
      kidFriendly: null,
    });
    markOnboardingDone();
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

    function advanceSetup() {
      if (setupStep === "cuisines") setSetupStep("hardNos");
      else if (setupStep === "hardNos") setSetupStep("heat");
      else completeGuestSetup();
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
              disabled={!canAdvance}
              className={`w-full rounded-full bg-white px-5 py-[18px] text-center text-[15px] font-semibold text-black transition hover:opacity-95 active:scale-[0.99] disabled:opacity-30 ${
                canAdvance ? "shadow-[0_8px_40px_rgba(255,255,255,0.28)]" : "shadow-none"
              }`}
            >
              {setupStep === "heat" ? "Join session" : "Continue"}
            </button>
            {setupStep === "heat" && (
              <button
                onClick={completeGuestSetup}
                className="mt-3 w-full text-center text-sm text-white/35 transition hover:text-white/55"
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

  // ── Guest waiting for host to start ──────────────────────────────────────
  // Guest joined but host hasn't built the deck yet — poll until ready.
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
                  Waiting for host
                </p>
              </div>
              <h1 className="mt-4 text-[32px] font-semibold leading-tight tracking-[-0.04em]">
                You&apos;re in!
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/55">
                The host hasn&apos;t started the deck yet. You&apos;ll be taken there
                automatically once they do.
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

  // ── Host lobby (async-friendly) ───────────────────────────────────────────
  // Host can start swiping at any time — no need to wait for guest.
  const bothConnected = session?.status === "active" || session?.status === "matched";

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
            {bothConnected ? (
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">
                  Both connected
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
              {bothConnected ? "Ready to decide" : "Session created"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/55">
              {bothConnected
                ? "You're both in. Start swiping — matches happen when you both say yes to the same meal."
                : "Share this link, then start swiping whenever you're ready. They can join at any time — even after you start."}
            </p>

            {/* Invite link */}
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

            {/* Start swiping — available immediately, no guest required */}
            <button
              onClick={handleStartSwiping}
              disabled={startingDeck}
              className="mt-6 w-full rounded-full bg-white py-4 text-base font-semibold text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
            >
              {startingDeck ? "Preparing deck…" : "Start swiping"}
            </button>
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
