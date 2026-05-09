"use client";

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

  // Emojis for step 3 novelty options (no emoji field on NOVELTY_OPTIONS)
  const noveltyEmojis = ["🔁", "⚖️", "🌟"];

  return (
    <main className="min-h-screen bg-[#1C1A18] text-white">
      <div className="mx-auto w-full max-w-md pb-32">

        {/* 1. PROGRESS BAR */}
        <div className="flex items-center gap-3 px-5 pt-4">
          {step > 1 && (
            <button
              onClick={goBack}
              className="text-[#8A7F78] text-lg leading-none flex-shrink-0 pr-1"
            >
              ←
            </button>
          )}
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-[3px] flex-1 rounded-full ${
                  i + 1 <= step ? "bg-[#E8621A]" : "bg-[#3D3733]"
                }`}
              />
            ))}
          </div>
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
            className="flex flex-col"
          >
            {/* 2. QUESTION HEADLINE */}
            <h1 className="font-display font-black text-3xl text-white leading-tight mt-8 px-5 whitespace-pre-line">
              {currentStep.title}
            </h1>

            {/* 3. SUBTEXT */}
            <p className="font-body text-base text-[#8A7F78] mt-3 px-5">
              {currentStep.subtitle}
            </p>

            {/* 4. OPTIONS LIST */}
            <div className="flex flex-col gap-3 mt-8 px-5">

              {/* ── Step 1: dietary constraints + hard NOs ─────────────── */}
              {step === 1 && (
                <>
                  {STEP1_OPTIONS.map((opt) => {
                    const arr = opt.field === "dietary" ? dietaryRestrictions : hardNoFoods;
                    const selected = arr.includes(opt.label);
                    return (
                      <button
                        key={opt.label}
                        onClick={() => toggleOption(opt.label, opt.field)}
                        className={`w-full flex items-center gap-4 rounded-[18px] p-4 border cursor-pointer transition-all duration-150 ${
                          selected
                            ? "bg-[#E8621A]/10 border-[#E8621A]"
                            : "bg-[#2A2420] border-transparent"
                        }`}
                      >
                        <div className="w-12 h-12 rounded-[12px] bg-[#3D3733] flex items-center justify-center text-2xl flex-shrink-0">
                          {opt.emoji}
                        </div>
                        <span className="flex-1 font-display font-black text-lg text-white text-left">
                          {opt.label}
                        </span>
                        <div className={`w-7 h-7 rounded-full flex-shrink-0 ${
                          selected
                            ? "bg-[#E8621A] flex items-center justify-center"
                            : "border-2 border-[#3D3733]"
                        }`}>
                          {selected && <span className="text-sm font-black text-white">✓</span>}
                        </div>
                      </button>
                    );
                  })}
                  {/* "No restrictions" — advances immediately without requiring Continue */}
                  <button
                    onClick={handleNoRestrictions}
                    className="w-full flex items-center gap-4 bg-[#2A2420] rounded-[18px] p-4 border border-transparent cursor-pointer transition-all duration-150"
                  >
                    <div className="w-12 h-12 rounded-[12px] bg-[#3D3733] flex items-center justify-center text-2xl flex-shrink-0">
                      🚫
                    </div>
                    <span className="flex-1 font-display font-black text-lg text-white text-left">
                      No restrictions
                    </span>
                    <div className="w-7 h-7 rounded-full border-2 border-[#3D3733] flex-shrink-0" />
                  </button>
                </>
              )}

              {/* ── Step 2: cuisine preferences ────────────────────────── */}
              {step === 2 && (
                <>
                  {CUISINES.map((c) => {
                    const selected = cuisines.includes(c.label);
                    return (
                      <button
                        key={c.label}
                        onClick={() => toggleCuisine(c.label)}
                        className={`w-full flex items-center gap-4 rounded-[18px] p-4 border cursor-pointer transition-all duration-150 ${
                          selected
                            ? "bg-[#E8621A]/10 border-[#E8621A]"
                            : "bg-[#2A2420] border-transparent"
                        }`}
                      >
                        <div className="w-12 h-12 rounded-[12px] bg-[#3D3733] flex items-center justify-center text-2xl flex-shrink-0">
                          {c.emoji}
                        </div>
                        <span className="flex-1 font-display font-black text-lg text-white text-left">
                          {c.label}
                        </span>
                        <div className={`w-7 h-7 rounded-full flex-shrink-0 ${
                          selected
                            ? "bg-[#E8621A] flex items-center justify-center"
                            : "border-2 border-[#3D3733]"
                        }`}>
                          {selected && <span className="text-sm font-black text-white">✓</span>}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {/* ── Step 3: familiarity vs novelty (auto-advances on pick) ─ */}
              {step === 3 && (
                <>
                  {NOVELTY_OPTIONS.map((opt, i) => {
                    const selected = noveltyBias === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setNoveltyBias(opt.value);
                          scheduleNoveltyAdvance();
                        }}
                        className={`w-full flex items-center gap-4 rounded-[18px] p-4 border cursor-pointer transition-all duration-150 ${
                          selected
                            ? "bg-[#E8621A]/10 border-[#E8621A]"
                            : "bg-[#2A2420] border-transparent"
                        }`}
                      >
                        <div className="w-12 h-12 rounded-[12px] bg-[#3D3733] flex items-center justify-center text-2xl flex-shrink-0">
                          {noveltyEmojis[i]}
                        </div>
                        <span className="flex-1 font-display font-black text-lg text-white text-left">
                          {opt.label}
                        </span>
                        <div className={`w-7 h-7 rounded-full flex-shrink-0 ${
                          selected
                            ? "bg-[#E8621A] flex items-center justify-center"
                            : "border-2 border-[#3D3733]"
                        }`}>
                          {selected && <span className="text-sm font-black text-white">✓</span>}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 5. CONTINUE BUTTON — fixed at bottom
           Steps 1-2 (multi-select): always shown.
           Step 3 (auto-advance): shown only if the user navigated back and already
           has a noveltyBias set so they can proceed without re-selecting. */}
      {(step <= 2 || (step === 3 && noveltyBias !== null)) && (
        <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-4 bg-[#1C1A18]">
          <div className="mx-auto w-full max-w-md">
            <button
              onClick={advance}
              disabled={!canContinue()}
              className={`w-full bg-[#E8621A] text-white font-display font-black text-base py-4 rounded-full transition active:scale-[0.99] ${
                !canContinue() ? "opacity-40 pointer-events-none" : ""
              }`}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
