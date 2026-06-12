"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDecidedMeal, clearDecidedMeal, type DecidedMeal } from "../lib/storage";
import { getLockedMealHeadline, type LockedMealHeadlineResult } from "../lib/locked-copy";
import { guestSoloDeckExhausted, incrementGuestAttempts } from "../lib/guestLimit";
import GuestLimitPrompt from "../components/GuestLimitPrompt";
import V3PostMatchHome from "../components/v3/V3PostMatchHome";
import V3LockedMealCard from "../components/v3/V3LockedMealCard";
import V3MealActionDrawer from "../components/v3/V3MealActionDrawer";
import { MealDetailDrawer } from "../components/MealDetailDrawer";

export default function GuestHomePage() {
  const router = useRouter();
  const [decidedMeal, setDecidedMeal] = useState<DecidedMeal | null | undefined>(undefined);
  const [headline, setHeadline] = useState<LockedMealHeadlineResult | null>(null);
  const [mealActionMode, setMealActionMode] = useState<"cook" | "order" | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [showGuestLimit, setShowGuestLimit] = useState(false);

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
      className="min-h-screen flex flex-col overflow-hidden relative"
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

      {/* Wordmark */}
      <div className="relative z-10 flex flex-col items-center pt-14 pb-4 shrink-0">
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
      </div>

      {/* Scrollable content */}
      <div className="relative z-10 flex-1 overflow-y-auto flex flex-col pb-8">

        {/* ── Missing state ── */}
        {missing && (
          <div className="mx-[14px] mt-4 rounded-[20px] p-6 text-center"
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
        )}

        {/* ── Matched meal — current locked experience ── */}
        {decidedMeal && (
          <>
            <div className="mt-4">
              <V3PostMatchHome
                mealName={decidedMeal.name}
                headline={headline?.headline ?? "Dinner is\nlocked in."}
                sub={headline?.subheadline ?? `You matched ${decidedMeal.name}.`}
                mealImage={decidedMeal.image || undefined}
              />
            </div>
            <V3LockedMealCard
              mealName={decidedMeal.name}
              tags={[decidedMeal.cuisine, decidedMeal.category].filter(Boolean).join(" • ")}
              cookTime={decidedMeal.tags.find((t) => /\d+\s*min/i.test(t)) ?? "—"}
              spice={decidedMeal.tags.some((t) => /spic/i.test(t)) ? "🌶️🌶️" : "Mild"}
              matchScore="Matched!"
              onCook={() => setMealActionMode("cook")}
              onOrder={() => setMealActionMode("order")}
              onDetails={() => setDetailOpen(true)}
            />
          </>
        )}

        {/* Loading — render nothing until storage resolves */}
        {decidedMeal === undefined && null}

        {/* ── Account creation prompt ── */}
        <div className="px-6 mt-8">
          <h2 className="font-display font-black text-2xl text-white leading-tight">
            Want picks like this again?
          </h2>
          <p className="font-body text-sm text-[#8A7F78] mt-2 leading-relaxed">
            Create an account and we&apos;ll remember what you like.
          </p>

          <button
            onClick={() => {
              if (decidedMeal) {
                try {
                  localStorage.setItem("wwe_pending_guest_meal", JSON.stringify(decidedMeal));
                } catch { /* quota exceeded — ignore, ProfileProvider fallback still runs */ }
              }
              const params = new URLSearchParams({ mode: "signup", from: "guest-match" });
              if (decidedMeal?.id) params.set("mealId", decidedMeal.id);
              if (decidedMeal?.sessionId) params.set("sessionId", decidedMeal.sessionId);
              router.push(`/auth?${params.toString()}`);
            }}
            className="mt-6 w-full bg-[#E8621A] text-white font-display font-black text-base py-4 rounded-full"
            style={{ boxShadow: "0 0 30px rgba(232,98,26,0.3)" }}
          >
            Create an account →
          </button>

          <button
            onClick={() => {
              if (decidedMeal) {
                try {
                  localStorage.setItem("wwe_pending_guest_meal", JSON.stringify(decidedMeal));
                } catch { /* quota exceeded — ignore, ProfileProvider fallback still runs */ }
              }
              const params = new URLSearchParams({ mode: "signin", from: "guest-match" });
              if (decidedMeal?.id) params.set("mealId", decidedMeal.id);
              if (decidedMeal?.sessionId) params.set("sessionId", decidedMeal.sessionId);
              router.push(`/auth?${params.toString()}`);
            }}
            className="mt-3 w-full font-body text-sm text-[#8A7F78] text-center py-3"
          >
            Already have an account? Sign in
          </button>
        </div>

        {/* ── Guest-safe continue option ── */}
        <div className="px-6 mt-2">
          <button
            onClick={() => {
              if (guestSoloDeckExhausted()) {
                setShowGuestLimit(true);
                return;
              }
              incrementGuestAttempts();
              clearDecidedMeal();
              router.push("/deck");
            }}
            className="w-full rounded-full border border-white/10 bg-transparent py-4 text-center font-display font-black text-base text-white/70"
          >
            Start your own pick →
          </button>
        </div>
      </div>

      {/* Cook / Order action drawer */}
      {mealActionMode && decidedMeal && (
        <V3MealActionDrawer
          meal={decidedMeal}
          mode={mealActionMode}
          onClose={() => setMealActionMode(null)}
        />
      )}

      {/* Meal detail drawer — no save/profile/history CTAs at context="shared" */}
      {decidedMeal && (
        <MealDetailDrawer
          meal={decidedMeal}
          isOpen={detailOpen}
          onClose={() => setDetailOpen(false)}
          context="shared"
        />
      )}

      {showGuestLimit && (
        <GuestLimitPrompt onClose={() => setShowGuestLimit(false)} />
      )}
    </main>
  );
}
