"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { meals, type Meal } from "../data/meals";
import { inferSessionContext } from "../lib/session-tracking";
import { addToHistory, saveDecidedMeal } from "../lib/storage";
import type { SessionVibeMode } from "../lib/scoring";
import Avatar from "./Avatar";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&h=750&q=80";

// ─── Algorithm ───────────────────────────────────────────────────────────────

interface SwipeRow {
  user_id: string;
  meal_id: string;
  decision: string;
}

type Tier = "A" | "B" | "C" | "D";

interface WCEResult {
  meal: Meal;
  tier: Tier;
  myTags: string[];
  partnerTags: string[];
}

function deriveTags(yesIds: Set<string>, orderedMeals: Meal[]): string[] {
  const yesMeals = orderedMeals.filter((m) => yesIds.has(m.id));
  if (yesMeals.length === 0) return ["Open to anything"];
  const freq = new Map<string, number>();
  for (const meal of yesMeals) {
    for (const tag of [meal.cuisine, meal.category, ...meal.tags]) {
      if (tag) freq.set(tag, (freq.get(tag) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
}

function computeWCE(
  swipes: SwipeRow[],
  myUserId: string,
  partnerUserId: string,
  orderedMeals: Meal[],
): WCEResult | null {
  if (orderedMeals.length === 0) return null;

  const myYes = new Set(
    swipes.filter((s) => s.user_id === myUserId && s.decision === "yes").map((s) => s.meal_id),
  );
  const myNo = new Set(
    swipes.filter((s) => s.user_id === myUserId && s.decision === "no").map((s) => s.meal_id),
  );
  const partnerYes = new Set(
    swipes.filter((s) => s.user_id === partnerUserId && s.decision === "yes").map((s) => s.meal_id),
  );
  const partnerNo = new Set(
    swipes.filter((s) => s.user_id === partnerUserId && s.decision === "no").map((s) => s.meal_id),
  );

  const myTags = deriveTags(myYes, orderedMeals);
  const partnerTags = deriveTags(partnerYes, orderedMeals);

  // Tier A — both liked (safety net; real-time match detection should have caught this)
  for (const meal of orderedMeals) {
    if (myYes.has(meal.id) && partnerYes.has(meal.id)) {
      return { meal, tier: "A", myTags, partnerTags };
    }
  }

  // Tier B — at least one yes; scored by likes/passes/rank
  const candidates = orderedMeals
    .map((meal, rank) => {
      let s = 0;
      if (myYes.has(meal.id)) s += 4;
      if (partnerYes.has(meal.id)) s += 4;
      if (myNo.has(meal.id)) s -= 1;
      if (partnerNo.has(meal.id)) s -= 1;
      s += orderedMeals.length - rank; // rank bonus: earlier = higher
      return { meal, s };
    })
    .filter(({ meal }) => myYes.has(meal.id) || partnerYes.has(meal.id))
    .sort((a, b) => b.s - a.s);

  if (candidates.length > 0) {
    return { meal: candidates[0].meal, tier: "B", myTags, partnerTags };
  }

  // Tier C — neither explicitly rejected
  for (const meal of orderedMeals) {
    if (!myNo.has(meal.id) && !partnerNo.has(meal.id)) {
      return { meal, tier: "C", myTags, partnerTags };
    }
  }

  // Tier D — fallback
  return { meal: orderedMeals[0], tier: "D", myTags, partnerTags };
}

function tierReason(tier: Tier): string {
  switch (tier) {
    case "A":
      return "Somehow you both already said yes to this. We\u2019re just making it official.";
    case "B":
      return "One of you gave this a yes. The other didn\u2019t match it \u2014 but this was still the best overlap.";
    case "C":
      return "No strong yeses tonight. This was the safest call from the deck.";
    case "D":
      return "Our first instinct from the start. Still our best one.";
  }
}

// ─── Reveal copy ─────────────────────────────────────────────────────────────

const NO_MATCH_COPY = [
  { headline: "Nobody blinked.", sub: "A genuine standoff. We respect it." },
  { headline: "No match tonight.", sub: "You two are surprisingly hard to please together." },
  { headline: "Total deadlock.", sub: "Honestly? Kind of impressive." },
  { headline: "Not a single yes overlapped.", sub: "We were taking notes anyway." },
  { headline: "Stalemate.", sub: "Don\u2019t worry \u2014 we were watching the whole time." },
] as const;

// ─── Component ───────────────────────────────────────────────────────────────

type TBView = "loading" | "reveal" | "main" | "locking" | "locked" | "exit";

export interface WatchasCallProps {
  sessionId: string;
  userId: string;
  partnerUserId: string;
  partnerName: string;
  myName?: string;
  myAvatarUrl?: string | null;
  partnerAvatarUrl?: string | null;
  orderedMeals: Meal[];
  deckSize: number;
  aiMealIds: Set<string>;
  sessionVibeMode: SessionVibeMode | null;
  onResolve?: () => void; // called after RPC succeeds (tracking close hook)
}

export default function WatchasCall({
  sessionId,
  userId,
  partnerUserId,
  partnerName,
  myName,
  myAvatarUrl,
  partnerAvatarUrl,
  orderedMeals,
  deckSize,
  aiMealIds,
  sessionVibeMode,
  onResolve,
}: WatchasCallProps) {
  const [view, setView] = useState<TBView>("loading");
  const [result, setResult] = useState<WCEResult | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [revealStage, setRevealStage] = useState(0); // 0=none, 1=s0, 2=s0+s1, 3=all
  const [mainPlaying, setMainPlaying] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lockInitiatedRef = useRef(false);
  // Picked once per component instance — stable across re-renders and state updates
  const revealCopy = useMemo(
    () => NO_MATCH_COPY[Math.floor(Math.random() * NO_MATCH_COPY.length)],
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  // Fetch swipes + compute result on mount
  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase
        .from("swipes")
        .select("user_id, meal_id, decision")
        .eq("session_id", sessionId)
        .in("user_id", [userId, partnerUserId]);

      if (!mounted) return;
      const swipes = (data ?? []) as SwipeRow[];
      const computed = computeWCE(swipes, userId, partnerUserId, orderedMeals);
      setResult(computed);

      if (prefersReduced) {
        setView("main");
      } else {
        setView("reveal");
        playReveal();
      }
    }
    void load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function playReveal() {
    clearTimers();
    setRevealStage(0);
    timersRef.current.push(setTimeout(() => setRevealStage(1), 120));
    timersRef.current.push(setTimeout(() => setRevealStage(2), 1500));
    timersRef.current.push(
      setTimeout(() => {
        setView("main");
        setMainPlaying(true);
        setTimeout(() => setMainPlaying(false), 900);
      }, 3500),
    );
  }

  // Poll for partner lock (they tapped "Lock it in" first)
  useEffect(() => {
    if (view === "locked" || view === "exit" || view === "loading" || view === "locking") return;
    let mounted = true;
    const interval = setInterval(async () => {
      if (!mounted || lockInitiatedRef.current) return;
      const { data } = await supabase
        .from("sessions")
        .select("status, locked_meal_id")
        .eq("id", sessionId)
        .single();
      if (!mounted) return;
      if (data?.status === "matched") {
        // Save the decided meal for the waiting user — the confirmer already saved
        // it in handleConfirm(), but this user detected the lock via poll and never
        // went through that path. Without this, home has no watcha_decided_meal.
        if (data.locked_meal_id) {
          const meal = meals.find((m) => m.id === data.locked_meal_id);
          if (meal) {
            addToHistory(meal);
            saveDecidedMeal({
              ...meal,
              decidedAt: new Date().toISOString(),
              mode: "shared",
              sessionId,
            });
          }
        }
        clearTimers();
        setView("locked");
      }
    }, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLockItIn() {
    if (!result || lockInitiatedRef.current) return;
    lockInitiatedRef.current = true;
    setLockError(null);
    setView("locking");
    clearTimers();

    // Check if partner already locked (race condition guard)
    const { data: preCheck } = await supabase
      .from("sessions")
      .select("created_at, status")
      .eq("id", sessionId)
      .single();

    if (preCheck?.status === "matched") {
      setView("locked");
      return;
    }

    const sessionStart = preCheck?.created_at ?? null;
    const timeToMatch = sessionStart
      ? Math.max(0, Math.round((Date.now() - new Date(sessionStart).getTime()) / 1000))
      : null;

    const { mealPeriod, dayType } = inferSessionContext(new Date());
    const meal = result.meal;

    const { error } = await supabase.rpc("record_shared_match_decision", {
      p_session_id: sessionId,
      p_meal_id: meal.id,
      p_meal_name: meal.name,
      p_meal_period: mealPeriod,
      p_day_type: dayType,
      p_is_ai_generated: aiMealIds.has(meal.id),
      p_cuisine_tag: meal.cuisine ?? null,
      p_archetype: meal.category ?? null,
      p_vibe_selection: sessionVibeMode ?? null,
      p_time_to_match_seconds: timeToMatch,
    });

    if (error) {
      // Could be a unique-constraint error from a simultaneous lock — check
      const { data: postCheck } = await supabase
        .from("sessions")
        .select("status")
        .eq("id", sessionId)
        .single();
      if (postCheck?.status === "matched") {
        // Partner won the race — treat as success
        setView("locked");
        return;
      }
      console.error("[watcha-call] record_shared_match_decision failed:", error.message);
      setLockError("Couldn\u2019t lock it in. Try again.");
      lockInitiatedRef.current = false;
      setView("main");
      return;
    }

    // Guard: prevent home-screen polling from writing a duplicate decision row
    if (typeof window !== "undefined") {
      localStorage.setItem(`wwe_decision_written_${sessionId}_${meal.id}`, "1");
    }

    addToHistory(meal);
    saveDecidedMeal({
      ...meal,
      decidedAt: new Date().toISOString(),
      mode: "shared",
      sessionId,
    });

    onResolve?.();
    setView("locked");
  }

  async function handleLetsEat() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("wwe_active_session");
      localStorage.removeItem(`wwe_session_swiping_done_${sessionId}`);
      localStorage.removeItem(`wwe_shared_deck_index_${sessionId}`);
    }
    // Re-check auth at nav time (same pattern as handleMatchConfirm)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    window.location.href = user ? "/" : "/guest-home";
  }

  function handleNotTonight() {
    clearTimers();
    setView("exit");
  }

  function handleBackToCall() {
    setView("main");
    setMainPlaying(true);
    setTimeout(() => setMainPlaying(false), 900);
  }

  function handleGoHome() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("wwe_active_session");
      localStorage.removeItem(`wwe_session_swiping_done_${sessionId}`);
      localStorage.removeItem(`wwe_shared_deck_index_${sessionId}`);
    }
    window.location.href = "/";
  }

  const meal = result?.meal;
  const firstName = (partnerName || "them").split(" ")[0];

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (view === "loading" || !result) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "rgba(232,98,26,0.3)", borderTopColor: "#E8621A" }}
        />
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 300,
            fontSize: 13,
            color: "#897E73",
          }}
        >
          Making the call\u2026
        </p>
      </div>
    );
  }

  // ── Reveal ──────────────────────────────────────────────────────────────────
  if (view === "reveal") {
    const vis = (stage: number) => ({
      opacity: revealStage >= stage ? 1 : 0,
      transform: revealStage >= stage ? "none" : "translateY(10px)",
    });
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center text-center"
        style={{ padding: "0 36px", gap: 13 }}
      >
        {/* Pulsing ember dot */}
        <div
          style={{
            width: 13,
            height: 13,
            borderRadius: "50%",
            background: "radial-gradient(circle at 40% 35%, #FF8A3D, #E8621A 70%, #B84A12)",
            boxShadow:
              "0 0 24px rgba(232,98,26,0.5), 0 0 0 10px rgba(232,98,26,0.08), 0 0 0 22px rgba(232,98,26,0.04)",
            animation: "wce-pulse 1.8s ease-in-out infinite",
          }}
        />
        {/* Eyebrow */}
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "#E8621A",
            transition: "opacity 0.6s ease, transform 0.6s ease",
            ...vis(1),
          }}
        >
          Watcha&apos;s Call
        </div>
        {/* Headline */}
        <h2
          style={{
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 700,
            fontSize: 39,
            lineHeight: 1.0,
            letterSpacing: "-0.02em",
            color: "#F6EEE2",
            transition: "opacity 0.7s cubic-bezier(0.2,0.7,0.2,1), transform 0.7s cubic-bezier(0.2,0.7,0.2,1)",
            ...vis(1),
          }}
        >
          {revealCopy.headline}
        </h2>
        {/* Sub */}
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 300,
            fontSize: 14,
            lineHeight: 1.5,
            color: "#C7BDAC",
            maxWidth: 280,
            transition: "opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s",
            ...vis(2),
          }}
        >
          {revealCopy.sub}
        </div>
      </div>
    );
  }

  // ── Locked (green) ──────────────────────────────────────────────────────────
  if (view === "locked") {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center text-center"
        style={{ padding: "0 32px", gap: 15 }}
      >
        {/* Green ambient overlay — positioned on the parent's relative container */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            zIndex: 0,
            background:
              "radial-gradient(ellipse 80% 40% at 50% 40%, rgba(94,158,110,0.20), transparent 60%), radial-gradient(ellipse 80% 50% at 50% 104%, rgba(184,74,18,0.08), transparent 66%)",
            transition: "opacity 0.7s ease",
          }}
        />
        {/* Content (above ambient) */}
        <div
          className="relative flex flex-col items-center text-center"
          style={{ gap: 15, zIndex: 1 }}
        >
          {/* Green orb */}
          <div
            style={{
              width: 138,
              height: 138,
              borderRadius: "50%",
              background: "radial-gradient(circle at 42% 36%, #86C796, #5E9E6E 55%, #3F744F)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 54,
              boxShadow:
                "0 0 64px rgba(94,158,110,0.45), 0 0 0 16px rgba(94,158,110,0.08), 0 0 0 34px rgba(94,158,110,0.04)",
              animation: "wce-pop 0.7s cubic-bezier(0.2,0.8,0.2,1) backwards",
            }}
          >
            ✓
          </div>
          {/* Eyebrow */}
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10.5,
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "#86A972",
            }}
          >
            Watcha&apos;s Call · locked
          </div>
          {/* Headline */}
          <h2
            style={{
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 700,
              fontSize: 36,
              letterSpacing: "-0.02em",
              color: "#F6EEE2",
              lineHeight: 1,
            }}
          >
            Dinner&apos;s locked.
          </h2>
          {/* Meal name */}
          <div
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontStyle: "italic",
              fontSize: 27,
              color: "#86A972",
            }}
          >
            {meal?.name}
          </div>
          {/* Line */}
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 300,
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "#C7BDAC",
              maxWidth: 280,
            }}
          >
            You&apos;ll both take credit for this later. We&apos;ll allow it.
          </div>
          {/* CTA */}
          <button
            onClick={() => void handleLetsEat()}
            style={{
              marginTop: 8,
              padding: "15px 30px",
              borderRadius: 100,
              border: "none",
              cursor: "pointer",
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 700,
              fontSize: 15.5,
              color: "#06140a",
              background: "linear-gradient(180deg,#86C796,#5E9E6E 50%,#3F744F)",
              boxShadow:
                "0 1px 0 rgba(220,255,228,0.5) inset, 0 -2px 0 rgba(20,60,30,0.4) inset, 0 14px 30px rgba(94,158,110,0.32)",
            }}
          >
            Let&apos;s eat 🙌
          </button>
        </div>
      </div>
    );
  }

  // ── Exit ────────────────────────────────────────────────────────────────────
  if (view === "exit") {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center text-center"
        style={{ padding: "0 38px", gap: 14 }}
      >
        {/* Ring icon */}
        <div
          style={{
            width: 74,
            height: 74,
            borderRadius: "50%",
            border: "1.5px solid rgba(245,237,224,0.16)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            color: "#E8621A",
            background: "rgba(255,231,202,0.045)",
          }}
        >
          ◠
        </div>
        {/* Eyebrow */}
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "#897E73",
          }}
        >
          Called off
        </div>
        {/* Headline */}
        <h2
          style={{
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 700,
            fontSize: 32,
            letterSpacing: "-0.02em",
            color: "#F6EEE2",
            lineHeight: 1.02,
          }}
        >
          All yours tonight.
        </h2>
        {/* Sub */}
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 300,
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "#C7BDAC",
            maxWidth: 290,
          }}
        >
          No new deck, no rematch tonight. We&apos;ll be ready whenever you two are.
        </div>
        {/* Back home */}
        <button
          onClick={handleGoHome}
          style={{
            marginTop: 10,
            padding: "14px 28px",
            borderRadius: 100,
            cursor: "pointer",
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 700,
            fontSize: 15.5,
            color: "#F6EEE2",
            background: "rgba(255,231,202,0.04)",
            border: "1px solid rgba(245,237,224,0.16)",
          }}
        >
          Back home
        </button>
        {/* Back to call */}
        <button
          onClick={handleBackToCall}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500,
            fontSize: 12.5,
            color: "#897E73",
            padding: 4,
          }}
        >
          ← back to the call
        </button>
      </div>
    );
  }

  // ── Main (+ locking) ────────────────────────────────────────────────────────
  return (
    <div
      className={`flex flex-1 flex-col overflow-y-auto${mainPlaying ? " wce-play" : ""}`}
      style={{ padding: "6px 22px 22px" }}
    >
      {/* Eyebrow */}
      <div
        className="wce-s1"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "2.6px",
          textTransform: "uppercase",
          color: "#E8621A",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#E8621A",
            boxShadow: "0 0 8px rgba(232,98,26,0.5)",
            animation: "wce-breathe 2.4s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
        Watcha&apos;s Call
      </div>

      {/* Lead */}
      <div className="wce-s1" style={{ marginTop: 11 }}>
        <span
          style={{
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 700,
            fontSize: 23,
            lineHeight: 1.08,
            letterSpacing: "-0.01em",
            color: "#F6EEE2",
          }}
        >
          You deadlocked.{" "}
        </span>
        <em
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 23,
            lineHeight: 1.08,
            color: "#FF8A3D",
          }}
        >
          So we called it.
        </em>
      </div>

      {/* Overlap section */}
      <div className="wce-s2" style={{ marginTop: 15, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* You row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: "10px 12px",
            borderRadius: 15,
            background: "rgba(255,231,202,0.045)",
            border: "1px solid rgba(245,237,224,0.085)",
          }}
        >
          {/* You avatar */}
          <div
            style={{
              position: "relative",
              width: 34,
              height: 34,
              borderRadius: "50%",
              flexShrink: 0,
              background: "#3D3733",
              border: "1.5px solid rgba(245,237,224,0.12)",
              overflow: "hidden",
              boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
            }}
          >
            <Avatar
              avatarUrl={myAvatarUrl}
              name={myName}
              initialsSize={13}
              silhouetteColor="#5A5350"
              silhouetteSize={22}
            />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                letterSpacing: "1.6px",
                textTransform: "uppercase",
                color: "#897E73",
              }}
            >
              You leaned
            </div>
            <div style={{ marginTop: 5, display: "flex", gap: 5, flexWrap: "wrap" }}>
              {result.myTags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "5px 10px",
                    borderRadius: 100,
                    background: "rgba(255,231,202,0.045)",
                    border: "1px solid rgba(245,237,224,0.085)",
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 500,
                    fontSize: 11,
                    color: "#F6EEE2",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Converge line */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "3px 4px" }}>
          <div
            style={{
              flex: 1,
              height: 1,
              background: "linear-gradient(90deg, transparent, rgba(232,98,26,0.26), transparent)",
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "#E8621A",
              whiteSpace: "nowrap",
            }}
          >
            Where you both land
          </span>
          <div
            style={{
              flex: 1,
              height: 1,
              background: "linear-gradient(90deg, transparent, rgba(232,98,26,0.26), transparent)",
            }}
          />
        </div>

        {/* Partner row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: "10px 12px",
            borderRadius: 15,
            background: "rgba(255,231,202,0.045)",
            border: "1px solid rgba(245,237,224,0.085)",
          }}
        >
          {/* Partner avatar */}
          <div
            style={{
              position: "relative",
              width: 34,
              height: 34,
              borderRadius: "50%",
              flexShrink: 0,
              background: "#3D3733",
              border: "1.5px solid rgba(245,237,224,0.12)",
              overflow: "hidden",
              boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
            }}
          >
            <Avatar
              avatarUrl={partnerAvatarUrl}
              name={firstName}
              initialsSize={13}
              silhouetteColor="#5A5350"
              silhouetteSize={22}
            />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                letterSpacing: "1.6px",
                textTransform: "uppercase",
                color: "#897E73",
              }}
            >
              {firstName} leaned
            </div>
            <div style={{ marginTop: 5, display: "flex", gap: 5, flexWrap: "wrap" }}>
              {result.partnerTags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "5px 10px",
                    borderRadius: 100,
                    background: "rgba(255,231,202,0.045)",
                    border: "1px solid rgba(245,237,224,0.085)",
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 500,
                    fontSize: 11,
                    color: "#F6EEE2",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pick card */}
      <div
        className="wce-s3"
        style={{
          position: "relative",
          height: 286,
          borderRadius: 22,
          overflow: "hidden",
          marginTop: 8,
          border: "1px solid rgba(245,237,224,0.16)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Photo */}
        <img
          src={meal?.image || FALLBACK_IMAGE}
          alt={meal?.name ?? ""}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        {/* Top spotlight */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 58% 46% at 50% 2%, rgba(255,248,235,0.55) 0%, rgba(255,228,190,0.10) 30%, transparent 58%)",
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
        {/* Scrim */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(0deg, rgba(7,4,2,0.97) 16%, rgba(7,4,2,0.5) 50%, transparent 80%)",
          }}
        />
        {/* Watcha's Call badge */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: "1.6px",
            textTransform: "uppercase",
            color: "#1c0c03",
            background: "linear-gradient(180deg,#FF8A3D,#E8621A)",
            padding: "6px 11px",
            borderRadius: 100,
            boxShadow: "0 6px 16px rgba(232,98,26,0.4)",
          }}
        >
          Watcha&apos;s Call
        </div>
        {/* Info overlay */}
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 15 }}>
          <h3
            style={{
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 700,
              fontSize: 29,
              color: "#F6EEE2",
              letterSpacing: "-0.01em",
              textShadow: "0 2px 14px rgba(0,0,0,0.6)",
            }}
          >
            {meal?.name}
          </h3>
          <div
            style={{
              marginTop: 3,
              fontFamily: "'Inter', sans-serif",
              fontWeight: 400,
              fontSize: 12,
              color: "#C7BDAC",
            }}
          >
            {meal?.cuisine} · {meal?.category}
          </div>
          <div
            style={{
              marginTop: 11,
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontStyle: "italic",
              fontSize: 16.5,
              lineHeight: 1.32,
              color: "#F6EEE2",
            }}
          >
            {tierReason(result.tier)}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="wce-s4" style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 5 }}>
        {lockError && (
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              color: "#E8621A",
              textAlign: "center",
              marginBottom: 4,
            }}
          >
            {lockError}
          </div>
        )}
        <button
          onClick={() => void handleLockItIn()}
          disabled={view === "locking"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: 16,
            borderRadius: 100,
            border: "none",
            width: "100%",
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 700,
            fontSize: 15.5,
            letterSpacing: "-0.01em",
            cursor: view === "locking" ? "default" : "pointer",
            color: "#1c0c03",
            background: "linear-gradient(180deg,#FF8A3D,#E8621A 48%,#B84A12)",
            boxShadow:
              "0 1px 0 rgba(255,224,188,0.6) inset, 0 -2px 0 rgba(120,52,0,0.4) inset, 0 14px 30px rgba(232,98,26,0.4), 0 0 0 1px rgba(232,98,26,0.3)",
            opacity: view === "locking" ? 0.7 : 1,
            transition: "opacity 0.15s ease",
          }}
        >
          {view === "locking" ? "Locking in\u2026" : "Lock it in"}
        </button>
        <div
          style={{
            textAlign: "center",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 300,
            fontSize: 11,
            color: "#897E73",
            padding: "5px 0 1px",
          }}
        >
          This locks in for both of you \u2014 just like a match.
        </div>
        <button
          onClick={handleNotTonight}
          disabled={view === "locking"}
          style={{
            background: "none",
            border: "none",
            cursor: view === "locking" ? "default" : "pointer",
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 14,
            color: "#C7BDAC",
            padding: 9,
            textAlign: "center",
          }}
        >
          Not tonight
        </button>
      </div>
    </div>
  );
}
