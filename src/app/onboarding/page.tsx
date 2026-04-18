"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { savePreferences, markOnboardingDone, hasCompletedOnboarding, type UserPreferences } from "../lib/storage";

const TOTAL_STEPS = 5;

const CUISINES = [
  { label: "Italian", emoji: "🍝" },
  { label: "Mexican", emoji: "🌮" },
  { label: "Asian", emoji: "🥢" },
  { label: "American", emoji: "🍔" },
  { label: "Mediterranean", emoji: "🫒" },
  { label: "Japanese", emoji: "🍱" },
  { label: "Indian", emoji: "🍛" },
  { label: "Middle Eastern", emoji: "🧆" },
];

const DISLIKED_FOODS = [
  { label: "Seafood", emoji: "🦐" },
  { label: "Dairy", emoji: "🧀" },
  { label: "Gluten / Pasta", emoji: "🌾" },
  { label: "Beef", emoji: "🥩" },
  { label: "Pork", emoji: "🐷" },
  { label: "Chicken", emoji: "🍗" },
  { label: "None of these", emoji: "✓" },
];

const SPICE_OPTIONS: { value: UserPreferences["spiceLevel"]; label: string; desc: string; emoji: string }[] = [
  { value: "mild", label: "Mild", desc: "Keep it gentle, no heat", emoji: "🌿" },
  { value: "medium", label: "Medium", desc: "Some kick is welcome", emoji: "🌶️" },
  { value: "hot", label: "Hot", desc: "The hotter the better", emoji: "🔥" },
  { value: "any", label: "No preference", desc: "Whatever, I'll survive", emoji: "🤷" },
];

const COOK_OPTIONS: { value: UserPreferences["cookOrOrder"]; label: string; desc: string; emoji: string }[] = [
  { value: "cook", label: "Cooking tonight", desc: "Got the pots ready", emoji: "🍳" },
  { value: "order", label: "Ordering in", desc: "Not feeling the kitchen", emoji: "📱" },
  { value: "either", label: "Either works", desc: "I'm flexible tonight", emoji: "⚖️" },
];

const KID_OPTIONS: { value: string; label: string; desc: string; emoji: string }[] = [
  { value: "yes", label: "Yeah, there are kids", desc: "Keep it crowd-pleasing", emoji: "👶" },
  { value: "no", label: "Just adults", desc: "We can get adventurous", emoji: "🙌" },
];

const STEPS = [
  {
    title: "What are you usually\ndown for?",
    subtitle: "Pick everything that genuinely excites you.",
  },
  {
    title: "What's a\nhard no?",
    subtitle: "We'll make sure these never show up in your deck.",
  },
  {
    title: "How do you\nfeel about heat?",
    subtitle: "This one matters more than you'd think.",
  },
  {
    title: "Are you actually\ncooking tonight?",
    subtitle: "No judgment either way.",
  },
  {
    title: "Who else is\nat the table?",
    subtitle: "Helps us keep suggestions appropriate.",
  },
];

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 32 : -32 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -32 : 32 }),
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [isDone, setIsDone] = useState(false);

  const [cuisines, setCuisines] = useState<string[]>([]);
  const [dislikedFoods, setDislikedFoods] = useState<string[]>([]);
  const [spiceLevel, setSpiceLevel] = useState<UserPreferences["spiceLevel"] | null>(null);
  const [cookOrOrder, setCookOrOrder] = useState<UserPreferences["cookOrOrder"] | null>(null);
  const [kidFriendly, setKidFriendly] = useState<boolean | null>(null);

  // Redirect if onboarding already completed
  useEffect(() => {
    if (hasCompletedOnboarding()) {
      router.replace("/");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleMulti(value: string, current: string[], set: (v: string[]) => void) {
    if (value === "None of these") {
      set(current.includes("None of these") ? [] : ["None of these"]);
      return;
    }
    const without = current.filter((v) => v !== "None of these");
    set(without.includes(value) ? without.filter((v) => v !== value) : [...without, value]);
  }

  function advance() {
    setDirection(1);
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      savePreferences({
        cuisines,
        dislikedFoods: dislikedFoods.filter((f) => f !== "None of these"),
        spiceLevel: spiceLevel!,
        cookOrOrder: cookOrOrder!,
        kidFriendly,
      });
      markOnboardingDone();
      setIsDone(true);
    }
  }

  function goBack() {
    setDirection(-1);
    setStep((s) => s - 1);
  }

  // Auto-advance single-select steps after selection
  useEffect(() => {
    if (step === 3 && spiceLevel !== null) {
      const t = setTimeout(advance, 280);
      return () => clearTimeout(t);
    }
  }, [spiceLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step === 4 && cookOrOrder !== null) {
      const t = setTimeout(advance, 280);
      return () => clearTimeout(t);
    }
  }, [cookOrOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step === 5 && kidFriendly !== null) {
      const t = setTimeout(advance, 280);
      return () => clearTimeout(t);
    }
  }, [kidFriendly]); // eslint-disable-line react-hooks/exhaustive-deps

  function canContinue(): boolean {
    if (step === 1) return cuisines.length > 0;
    if (step === 2) return dislikedFoods.length > 0;
    return false; // steps 3-5 auto-advance
  }

  // ── Done screen ────────────────────────────────────────────────────────────
  if (isDone) {
    return (
      <main className="min-h-screen bg-[#080808] text-white">
        <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-1/2 left-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.07] blur-3xl" />
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex w-full flex-col items-center text-center"
          >
            <div className="mb-6 text-6xl">🍽️</div>
            <h1 className="text-[44px] font-semibold leading-[1.0] tracking-[-0.06em]">
              You&apos;re all set.
            </h1>
            <p className="mt-4 max-w-[28ch] text-[15px] leading-7 text-white/55">
              Your basics are saved. Want to go deeper for sharper picks?
            </p>

            <div className="mt-10 w-full max-w-xs space-y-3">
              <button
                onClick={() => router.push("/flavor-profile")}
                className="w-full rounded-full bg-white px-8 py-4 text-base font-semibold text-black shadow-[0_8px_32px_rgba(255,255,255,0.14)] transition hover:opacity-95 active:scale-[0.98]"
              >
                Build full flavor profile
              </button>
              <p className="text-[11px] text-white/25">5 quick questions · optional · takes 1 min</p>
            </div>

            <button
              onClick={() => router.replace("/")}
              className="mt-6 text-sm text-white/35 underline underline-offset-4 transition hover:text-white/55"
            >
              Skip for now, let&apos;s eat
            </button>
          </motion.div>
        </div>
      </main>
    );
  }

  const currentStep = STEPS[step - 1];

  // ── Onboarding steps ───────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-8 pt-6">
        {/* Background blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-24 right-[-60px] h-52 w-52 rounded-full bg-white/[0.04] blur-3xl" />
        </div>

        <div className="relative z-10 flex min-h-screen flex-col">
          {/* Header */}
          <header className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
              Whatcha Wanna Eat?
            </p>
            {step > 1 && (
              <button
                onClick={goBack}
                className="text-sm text-white/35 transition hover:text-white/60"
              >
                Back
              </button>
            )}
          </header>

          {/* Segmented progress bar */}
          <div className="mt-6 flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.12]"
              >
                <div
                  className="h-full rounded-full bg-white transition-all duration-500 ease-out"
                  style={{ width: i + 1 <= step ? "100%" : "0%" }}
                />
              </div>
            ))}
          </div>

          {/* Animated step content */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className={`flex flex-1 flex-col${step === 1 || step === 2 ? " pb-28" : ""}`}
            >
              {/* Question */}
              <div className="mt-10">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/30">
                  {step} of {TOTAL_STEPS}
                </p>
                <h1 className="mt-4 whitespace-pre-line text-[38px] font-semibold leading-[1.05] tracking-[-0.05em]">
                  {currentStep.title}
                </h1>
                <p className="mt-3 max-w-[34ch] text-sm leading-6 text-white/50">
                  {currentStep.subtitle}
                </p>
              </div>

              {/* Options */}
              <div className="mt-8 flex-1">
                {/* Step 1 — Cuisines */}
                {step === 1 && (
                  <div className="flex flex-wrap gap-3">
                    {CUISINES.map((c) => {
                      const selected = cuisines.includes(c.label);
                      return (
                        <button
                          key={c.label}
                          onClick={() => toggleMulti(c.label, cuisines, setCuisines)}
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

                {/* Step 2 — Disliked foods */}
                {step === 2 && (
                  <div className="flex flex-wrap gap-3">
                    {DISLIKED_FOODS.map((f) => {
                      const selected = dislikedFoods.includes(f.label);
                      return (
                        <button
                          key={f.label}
                          onClick={() => toggleMulti(f.label, dislikedFoods, setDislikedFoods)}
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

                {/* Step 3 — Spice level */}
                {step === 3 && (
                  <div className="grid gap-3">
                    {SPICE_OPTIONS.map((opt) => {
                      const selected = spiceLevel === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setSpiceLevel(opt.value)}
                          className={`flex items-center gap-4 rounded-[22px] border p-4 text-left transition-all duration-150 active:scale-[0.99] ${
                            selected
                              ? "border-white/60 bg-white/[0.10] shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_6px_28px_rgba(255,255,255,0.06)]"
                              : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]"
                          }`}
                        >
                          <span className="text-2xl">{opt.emoji}</span>
                          <div className="flex-1">
                            <p className="text-[15px] font-semibold tracking-[-0.03em]">{opt.label}</p>
                            <p className="mt-0.5 text-xs text-white/45">{opt.desc}</p>
                          </div>
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

                {/* Step 4 — Cook vs order */}
                {step === 4 && (
                  <div className="grid gap-3">
                    {COOK_OPTIONS.map((opt) => {
                      const selected = cookOrOrder === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setCookOrOrder(opt.value)}
                          className={`flex items-center gap-4 rounded-[22px] border p-4 text-left transition-all duration-150 active:scale-[0.99] ${
                            selected
                              ? "border-white/60 bg-white/[0.10] shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_6px_28px_rgba(255,255,255,0.06)]"
                              : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]"
                          }`}
                        >
                          <span className="text-2xl">{opt.emoji}</span>
                          <div className="flex-1">
                            <p className="text-[15px] font-semibold tracking-[-0.03em]">{opt.label}</p>
                            <p className="mt-0.5 text-xs text-white/45">{opt.desc}</p>
                          </div>
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

                {/* Step 5 — Kid-friendly */}
                {step === 5 && (
                  <div className="grid gap-3">
                    {KID_OPTIONS.map((opt) => {
                      const selected =
                        (opt.value === "yes" && kidFriendly === true) ||
                        (opt.value === "no" && kidFriendly === false);
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setKidFriendly(opt.value === "yes")}
                          className={`flex items-center gap-4 rounded-[22px] border p-4 text-left transition-all duration-150 active:scale-[0.99] ${
                            selected
                              ? "border-white/60 bg-white/[0.10] shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_6px_28px_rgba(255,255,255,0.06)]"
                              : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]"
                          }`}
                        >
                          <span className="text-2xl">{opt.emoji}</span>
                          <div className="flex-1">
                            <p className="text-[15px] font-semibold tracking-[-0.03em]">{opt.label}</p>
                            <p className="mt-0.5 text-xs text-white/45">{opt.desc}</p>
                          </div>
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

            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Sticky Continue button — always visible at bottom for multi-select steps */}
      {(step === 1 || step === 2) && (
        <div className="fixed bottom-0 left-0 right-0 z-30">
          <div className="mx-auto w-full max-w-md px-5 pb-8 pt-10 relative">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent to-[#080808]" />
            <button
              onClick={advance}
              disabled={!canContinue()}
              className={`w-full rounded-full bg-white px-5 py-[18px] text-center text-[15px] font-semibold text-black transition hover:opacity-95 active:scale-[0.99] disabled:opacity-30 ${
                canContinue()
                  ? "shadow-[0_8px_40px_rgba(255,255,255,0.28)]"
                  : "shadow-none"
              }`}
            >
              Continue
            </button>
            {!canContinue() && (
              <p className="mt-3 text-center text-xs text-white/30">
                Select at least one above
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
