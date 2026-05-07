"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { savePreferences, markOnboardingDone, hasCompletedOnboarding, saveNoveltyBias } from "../lib/storage";

const TOTAL_STEPS = 3;

// ── Option data ───────────────────────────────────────────────────────────────

/**
 * Step 1 options. field="dietary" → dietaryRestrictions; field="hardno" → hardNoFoods.
 * Kept on one screen so the user makes one decision about what they can't/won't eat.
 */
const STEP1_OPTIONS: { label: string; emoji: string; field: "dietary" | "hardno" }[] = [
  // Dietary restrictions → dietary_restrictions Supabase column
  { label: "Vegetarian",  emoji: "🥦", field: "dietary" },
  { label: "Vegan",       emoji: "🌱", field: "dietary" },
  { label: "Gluten-free", emoji: "🌾", field: "dietary" }, // maps to "Gluten / Pasta" in hardGate
  { label: "Dairy-free",  emoji: "🥛", field: "dietary" }, // maps to "Dairy" in hardGate
  { label: "Halal",       emoji: "☪️",  field: "dietary" },
  { label: "Kosher",      emoji: "✡️",  field: "dietary" },
  // Hard NOs → hard_no_foods Supabase column
  { label: "No pork",     emoji: "🐷", field: "hardno" },
  { label: "No seafood",  emoji: "🦐", field: "hardno" },
  { label: "No beef",     emoji: "🥩", field: "hardno" },
];

const CUISINES = [
  { label: "Italian",      emoji: "🍝" },
  { label: "Mexican",      emoji: "🌮" },
  { label: "Asian",        emoji: "🥢" },
  { label: "American",     emoji: "🍔" },
  { label: "Mediterranean",emoji: "🫒" },
  { label: "Japanese",     emoji: "🍱" },
  { label: "Indian",       emoji: "🍛" },
  { label: "Middle Eastern",emoji: "🧆" },
];

/** Step 3 options — map directly to novelty_bias float on profiles. */
const NOVELTY_OPTIONS = [
  { label: "I like what I know",      value: 0.2 },
  { label: "Mix of both",             value: 0.5 },
  { label: "I love trying new things",value: 0.8 },
];

const STEPS = [
  {
    title: "Anything you\ncan't or won't eat?",
    subtitle: "We'll make sure these never show up in your deck.",
  },
  {
    title: "What are you usually\ndown for?",
    subtitle: "Pick everything that genuinely excites you.",
  },
  {
    title: "Do you prefer what\nyou know, or love\ntrying new things?",
    subtitle: "Shapes how adventurous your picks are.",
  },
];

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 32 : -32 }),
  center: { opacity: 1, x: 0 },
  exit:  (dir: number) => ({ opacity: 0, x: dir > 0 ? -32 : 32 }),
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);

  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [hardNoFoods, setHardNoFoods] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [noveltyBias, setNoveltyBias] = useState<number | null>(null);

  // Always-current ref — safe to read from inside setTimeout callbacks.
  const latestRef = useRef({ dietaryRestrictions, hardNoFoods, cuisines, noveltyBias });
  latestRef.current = { dietaryRestrictions, hardNoFoods, cuisines, noveltyBias };

  // Pending auto-advance timer for step 3 — cancelled on goBack so it can't
  // fire after the user has navigated away from step 3.
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Redirect if onboarding already done.
  useEffect(() => {
    if (hasCompletedOnboarding()) router.replace("/");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function advance() {
    if (step < TOTAL_STEPS) {
      setDirection(1);
      setStep((s) => s + 1);
    } else {
      // Step 3 complete — save all data and navigate directly to home.
      const vals = latestRef.current;
      savePreferences({
        cuisines: vals.cuisines,
        dietaryRestrictions: vals.dietaryRestrictions,
        hardNoFoods: vals.hardNoFoods,
        spiceLevel: "any",
        cookOrOrder: "either",
        kidFriendly: null,
      });
      saveNoveltyBias(vals.noveltyBias ?? 0.5);
      markOnboardingDone();
      router.replace("/");
    }
  }

  function goBack() {
    // Cancel any pending auto-advance before going back so it can't fire
    // after we've left step 3.
    if (pendingRef.current) {
      clearTimeout(pendingRef.current);
      pendingRef.current = null;
    }
    setDirection(-1);
    setStep((s) => s - 1);
  }

  /** Schedules auto-advance for step 3 (280ms so the selection highlight is visible). */
  function scheduleNoveltyAdvance() {
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(() => {
      advance();
      pendingRef.current = null;
    }, 280);
  }

  // ── Step 1 toggle helpers ─────────────────────────────────────────────────

  function toggleOption(label: string, field: "dietary" | "hardno") {
    if (field === "dietary") {
      setDietaryRestrictions((prev) =>
        prev.includes(label) ? prev.filter((v) => v !== label) : [...prev, label]
      );
    } else {
      setHardNoFoods((prev) =>
        prev.includes(label) ? prev.filter((v) => v !== label) : [...prev, label]
      );
    }
  }

  /** "No restrictions" — clears both arrays and immediately advances to step 2. */
  function handleNoRestrictions() {
    setDietaryRestrictions([]);
    setHardNoFoods([]);
    setDirection(1);
    setStep((s) => s + 1);
  }

  function toggleCuisine(label: string) {
    setCuisines((prev) =>
      prev.includes(label) ? prev.filter((v) => v !== label) : [...prev, label]
    );
  }

  function canContinue(): boolean {
    if (step === 1) return dietaryRestrictions.length > 0 || hardNoFoods.length > 0;
    if (step === 2) return cuisines.length > 0;
    // Step 3 auto-advances on selection; no Continue needed unless navigated back.
    return noveltyBias !== null;
  }

  const currentStep = STEPS[step - 1];

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
            <div className="flex items-center gap-2 opacity-90">
              <Image src="/logoheader.png" alt="WWE logo" height={18} width={18} className="h-[18px] w-auto" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
                Whatcha Wanna Eat?
              </p>
            </div>
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
              <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.12]">
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
              className={`flex flex-1 flex-col${step <= 2 ? " pb-28" : ""}`}
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

              {/* ── Step 1: dietary constraints + hard NOs ─────────────────── */}
              {step === 1 && (
                <div className="mt-8 flex flex-wrap gap-3">
                  {STEP1_OPTIONS.map((opt) => {
                    const arr = opt.field === "dietary" ? dietaryRestrictions : hardNoFoods;
                    const selected = arr.includes(opt.label);
                    return (
                      <button
                        key={opt.label}
                        onClick={() => toggleOption(opt.label, opt.field)}
                        className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.96] ${
                          selected
                            ? "border-white bg-white text-black shadow-[0_0_0_1px_rgba(255,255,255,0.3),0_4px_20px_rgba(255,255,255,0.10)]"
                            : "border-white/15 bg-white/[0.05] text-white/70 hover:border-white/25 hover:bg-white/[0.09]"
                        }`}
                      >
                        <span>{opt.emoji}</span>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                  {/* "No restrictions" advances immediately without requiring Continue */}
                  <button
                    onClick={handleNoRestrictions}
                    className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white/70 transition-all duration-150 hover:border-white/25 hover:bg-white/[0.09] active:scale-[0.96]"
                  >
                    <span>✓</span>
                    <span>No restrictions</span>
                  </button>
                </div>
              )}

              {/* ── Step 2: cuisine preferences (unchanged from original) ───── */}
              {step === 2 && (
                <div className="mt-8 flex flex-wrap gap-3">
                  {CUISINES.map((c) => {
                    const selected = cuisines.includes(c.label);
                    return (
                      <button
                        key={c.label}
                        onClick={() => toggleCuisine(c.label)}
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

              {/* ── Step 3: familiarity vs novelty (auto-advances on selection) */}
              {step === 3 && (
                <div className="mt-8 grid gap-3">
                  {NOVELTY_OPTIONS.map((opt) => {
                    const selected = noveltyBias === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setNoveltyBias(opt.value);
                          scheduleNoveltyAdvance();
                        }}
                        className={`flex items-center gap-4 rounded-[22px] border p-4 text-left transition-all duration-150 active:scale-[0.99] ${
                          selected
                            ? "border-white/60 bg-white/[0.10] shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_6px_28px_rgba(255,255,255,0.06)]"
                            : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]"
                        }`}
                      >
                        <div className="flex-1">
                          <p className="text-[15px] font-semibold tracking-[-0.03em]">{opt.label}</p>
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
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Sticky Continue button:
           Steps 1-2 (multi-select): always shown.
           Step 3 (auto-advance): shown only if the user navigated back and already
           has a noveltyBias set so they can proceed without re-selecting. */}
      {(step <= 2 || (step === 3 && noveltyBias !== null)) && (
        <div className="fixed bottom-0 left-0 right-0 z-30">
          <div className="mx-auto w-full max-w-md px-5 pb-8 pt-10 relative">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent to-[#080808]" />
            <button
              onClick={advance}
              disabled={!canContinue()}
              className={`w-full rounded-full bg-white px-5 py-[18px] text-center text-[15px] font-semibold text-black transition hover:opacity-95 active:scale-[0.99] disabled:opacity-30 ${
                canContinue() ? "shadow-[0_8px_40px_rgba(255,255,255,0.28)]" : "shadow-none"
              }`}
            >
              Continue
            </button>
            {step <= 2 && !canContinue() && (
              <p className="mt-3 text-center text-xs text-white/30">
                {step === 1
                  ? "Select above or tap No restrictions"
                  : "Select at least one above"}
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
