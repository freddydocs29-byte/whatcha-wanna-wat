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
    <main className="min-h-screen bg-[#FAF6F1]">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-8 pt-6">
        {/* Background blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#E8621A]/[0.06] blur-3xl" />
          <div className="absolute bottom-24 right-[-60px] h-52 w-52 rounded-full bg-[#E8621A]/[0.03] blur-3xl" />
        </div>

        <div className="relative z-10 flex min-h-screen flex-col">
          {/* Header */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-2 opacity-90">
              <Image src="/logoheader.png" alt="WWE logo" height={18} width={18} className="h-[18px] w-auto" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#1C1A18]/40">
                Whatcha Wanna Eat?
              </p>
            </div>
            {step > 1 && (
              <button
                onClick={goBack}
                className="text-sm text-[#1C1A18]/50 transition hover:text-[#1C1A18]/80"
              >
                Back
              </button>
            )}
          </header>

          {/* Segmented progress bar */}
          <div className="mt-6 flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-[#F0E9DF]">
                <div
                  className="h-full bg-[#E8621A] rounded-full transition-all duration-500"
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
                <p className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase">
                  {step} of {TOTAL_STEPS}
                </p>
                <h1 className="mt-4 whitespace-pre-line font-display font-black text-3xl text-[#1C1A18] leading-tight">
                  {currentStep.title}
                </h1>
                <p className="mt-3 max-w-[34ch] font-body text-base text-[#1C1A18]/60">
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
                        className={`flex items-center gap-2 rounded-[12px] border px-5 py-3 font-body text-sm font-semibold transition-all duration-150 active:scale-[0.96] ${
                          selected
                            ? "bg-[#E8621A]/15 text-[#E8621A] border-[#E8621A]/60"
                            : "bg-[#3D3733] text-white/80 border-transparent"
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
                    className="flex items-center gap-2 rounded-[12px] border border-transparent bg-[#3D3733] px-5 py-3 font-body text-sm font-semibold text-white/80 transition-all duration-150 active:scale-[0.96]"
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
                        className={`flex items-center gap-2 rounded-[12px] border px-5 py-3 font-body text-sm font-semibold transition-all duration-150 active:scale-[0.96] ${
                          selected
                            ? "bg-[#E8621A]/15 text-[#E8621A] border-[#E8621A]/60"
                            : "bg-[#3D3733] text-white/80 border-transparent"
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
                        className={`flex items-center gap-4 rounded-[12px] border p-4 text-left transition-all duration-150 active:scale-[0.99] ${
                          selected
                            ? "bg-[#E8621A]/15 text-[#E8621A] border-[#E8621A]/60"
                            : "bg-[#3D3733] text-white/80 border-transparent"
                        }`}
                      >
                        <div className="flex-1">
                          <p className="text-[15px] font-semibold tracking-[-0.03em]">{opt.label}</p>
                        </div>
                        <div
                          className={`h-5 w-5 shrink-0 rounded-full border-2 transition-all duration-150 ${
                            selected ? "border-[#E8621A] bg-[#E8621A]" : "border-white/30"
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
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent to-[#FAF6F1]" />
            <button
              onClick={advance}
              disabled={!canContinue()}
              className={`w-full rounded-full bg-[#E8621A] text-white font-display font-black text-base py-4 text-center transition active:scale-[0.99] ${
                canContinue() ? "" : "opacity-40 pointer-events-none"
              }`}
            >
              Continue
            </button>
            {step <= 2 && !canContinue() && (
              <p className="mt-3 text-center text-xs text-[#1C1A18]/30">
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
