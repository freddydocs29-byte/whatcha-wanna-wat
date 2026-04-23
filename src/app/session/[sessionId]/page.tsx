"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, Session } from "../../lib/supabase";
import { getUserId } from "../../lib/identity";
import { buildSharedDeck } from "../../lib/deck";

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
      setRole("unknown"); // Will attempt to join
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

  // Join if we're an unknown visitor (guest slot is open)
  useEffect(() => {
    if (role === "unknown" && session && !joining) {
      joinSession();
    }
  }, [role, session, joining, joinSession]);

  // Poll while host is waiting
  useEffect(() => {
    if (role === "host" && session?.status === "waiting") {
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
  }, [role, session?.status, loadSession]);

  // Host generates and persists the shared deck when tapping "Start swiping".
  // The await ensures deck_meal_ids is written before the deck page loads.
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

  // Loading state
  if (!session && !error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
        <p className="text-white/40 text-sm">Loading session…</p>
      </main>
    );
  }

  // Error state
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

  // Session full — guest slot taken by someone else
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
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 text-sm backdrop-blur-md transition active:scale-[0.98]"
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
            {bothConnected ? (
              <>
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                  <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">
                    Both connected
                  </p>
                </div>
                <h1 className="mt-4 text-[32px] font-semibold leading-tight tracking-[-0.04em]">
                  {role === "host" ? "Your partner joined!" : "You're in!"}
                </h1>
                <p className="mt-3 text-sm leading-6 text-white/55">
                  You&apos;re both in. Swipe through meals independently — when you
                  both say yes to the same one, you&apos;ve got a match.
                </p>
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
                      Host
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Guest — joined
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleStartSwiping}
                  disabled={startingDeck}
                  className="mt-6 w-full rounded-full bg-white py-4 text-base font-semibold text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
                >
                  {startingDeck ? "Preparing deck…" : "Start swiping"}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/40 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white/70" />
                  </span>
                  <p className="text-xs font-medium uppercase tracking-widest text-white/50">
                    Waiting for someone
                  </p>
                </div>
                <h1 className="mt-4 text-[32px] font-semibold leading-tight tracking-[-0.04em]">
                  Session created
                </h1>
                <p className="mt-3 text-sm leading-6 text-white/55">
                  Send the link below to whoever you want to decide with. They just need to open it.
                </p>

                {/* Link display */}
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="truncate text-xs text-white/40">{sessionUrl}</p>
                </div>

                {/* Actions */}
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleShare}
                    className="flex-1 rounded-full bg-white px-4 py-3.5 text-sm font-semibold text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition active:scale-[0.98]"
                  >
                    Share link
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex-1 rounded-full border border-white/10 bg-white/[0.06] px-4 py-3.5 text-sm font-medium text-white transition active:scale-[0.98]"
                  >
                    {copied ? "Copied!" : "Copy link"}
                  </button>
                </div>

                <p className="mt-5 text-center text-xs text-white/25">
                  This page updates automatically once they join
                </p>
              </>
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
