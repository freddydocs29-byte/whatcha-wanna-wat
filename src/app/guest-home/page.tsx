"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDecidedMeal, type DecidedMeal } from "../lib/storage";
import { getLockedMealHeadline, type LockedMealHeadlineResult } from "../lib/locked-copy";

export default function GuestHomePage() {
  const router = useRouter();
  const [decidedMeal, setDecidedMeal] = useState<DecidedMeal | null | undefined>(undefined);
  const [headline, setHeadline] = useState<LockedMealHeadlineResult | null>(null);

  useEffect(() => {
    const meal = getDecidedMeal();
    setDecidedMeal(meal);
    if (meal) {
      const generated = getLockedMealHeadline({
        meal,
        userName: null,
        mode: "shared",
        history: [],
      });
      setHeadline(generated);
    }
  }, []);

  const missing = decidedMeal === null;

  const GRAIN_SVG =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

  return (
    <main
      className="min-h-screen flex flex-col items-center px-6 pt-14 pb-16 relative overflow-hidden"
      style={{ background: "#0B0805" }}
    >
      {/* Ember ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 30% at 60% 0%, rgba(232,98,26,0.12) 0%, transparent 55%), radial-gradient(ellipse 40% 25% at 0% 80%, rgba(232,98,26,0.04) 0%, transparent 50%)",
        }}
      />
      {/* Grain */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: GRAIN_SVG, opacity: 0.05, mixBlendMode: "overlay" }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: "inset 0 0 100px 20px rgba(0,0,0,0.5)" }}
      />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Wordmark — Quicksand + Instrument Serif italic, matching Splash */}
        <div className="flex flex-col items-center" style={{ lineHeight: 0.85 }}>
          <span
            style={{
              fontFamily: "var(--font-quicksand)",
              fontWeight: 700,
              fontSize: 28,
              color: "#F6EEE2",
              letterSpacing: "-0.01em",
              lineHeight: 1,
            }}
          >
            Watcha
          </span>
          <span
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: 16,
              color: "#E8621A",
              marginTop: 2,
              lineHeight: 1.1,
            }}
          >
            wanna eat?
          </span>
        </div>

        {/* ── Decided meal card ── */}
        {missing ? (
          <div
            className="mt-12 w-full rounded-[20px] p-6 text-center"
            style={{
              background: "rgba(255,231,202,0.04)",
              border: "1px solid rgba(245,237,224,0.10)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <p className="font-display font-black text-lg text-white leading-tight">
              Your match is saved on the host&apos;s session.
            </p>
            <p className="font-body text-sm text-[#8A7F78] mt-2 leading-relaxed">
              Ask them to resend the link.
            </p>
          </div>
        ) : decidedMeal ? (
          <div className="mt-10 w-full">
            {/* Headline */}
            <h1 className="font-display font-black text-4xl text-white leading-tight">
              {headline?.headline ?? "Good call."}
            </h1>
            <h1 className="font-display font-black text-4xl text-[#E8621A] leading-tight text-balance">
              {headline?.subheadline ?? "Stop thinking about it."}
            </h1>

            {/* Card */}
            <div
              className="w-full rounded-[20px] p-5 mt-6"
              style={{
                background: "rgba(255,231,202,0.05)",
                border: "1px solid rgba(74,124,89,0.30)",
                boxShadow: "0 0 30px rgba(74,124,89,0.12), inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[#4A7C59] text-[11px] font-semibold tracking-widest uppercase">
                  TONIGHT&apos;S PICK
                </p>
              </div>

              {decidedMeal.image && (
                <div
                  className="w-full rounded-[14px] overflow-hidden mb-4"
                  style={{
                    aspectRatio: "16/9",
                    background: "rgba(255,231,202,0.04)",
                    border: "1px solid rgba(245,237,224,0.08)",
                  }}
                >
                  <img
                    src={decidedMeal.image}
                    alt={decidedMeal.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#4A7C59] flex items-center justify-center font-display font-black text-lg text-white flex-shrink-0">
                  ✓
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-display font-black text-xl text-white">
                    🍽️ {decidedMeal.name}
                  </span>
                  <p className="font-body text-xs text-[#8A7F78] mt-1">
                    Decided with your partner
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null /* loading — render nothing until resolved */}

        {/* ── Account creation prompt ── */}
        <div className="mt-10 w-full">
          <h2 className="font-display font-black text-2xl text-white leading-tight">
            Want picks like this again?
          </h2>
          <p className="font-body text-sm text-[#8A7F78] mt-2 leading-relaxed">
            Create an account and we&apos;ll remember what you like.
          </p>

          <button
            onClick={() => router.push("/auth?mode=signup&from=guest-match")}
            className="mt-6 w-full bg-[#E8621A] text-white font-display font-black text-base py-4 rounded-full"
            style={{ boxShadow: "0 0 30px rgba(232,98,26,0.3)" }}
          >
            Create an account →
          </button>

          <button
            onClick={() => router.push("/auth?mode=signin&from=guest-match")}
            className="mt-3 w-full font-body text-sm text-[#8A7F78] text-center py-3"
          >
            Already have an account? Sign in
          </button>
        </div>

        {/* ── Guest-safe continue option ── */}
        <button
          onClick={() => router.push("/deck")}
          className="mt-6 w-full rounded-full border border-white/10 bg-transparent py-4 text-center font-display font-black text-base text-white/70"
        >
          Start your own pick →
        </button>
      </div>
    </main>
  );
}
