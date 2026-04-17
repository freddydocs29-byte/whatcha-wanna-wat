"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getFlavorProfile, saveFlavorProfile, type FlavorProfile } from "../lib/storage";

const TOTAL_STEPS = 5;

type AdventureValue = FlavorProfile["adventurousness"];
type TimeValue = FlavorProfile["timeAvailable"];
type EnergyValue = FlavorProfile["energyLevel"];
type BudgetValue = FlavorProfile["budgetSensitivity"];
type ConfidenceValue = FlavorProfile["cookingConfidence"];

const ADVENTURE_OPTIONS: { value: AdventureValue; label: string; desc: string; emoji: string }[] = [
  { value: "familiar", label: "Familiar", desc: "I like what I like, and that's fine", emoji: "🏠" },
  { value: "balanced", label: "Balanced", desc: "Mix it up sometimes", emoji: "⚖️" },
  { value: "adventurous", label: "Adventurous", desc: "Push me toward something new", emoji: "🌍" },
];

const TIME_OPTIONS: { value: TimeValue; label: string; desc: string; emoji: string }[] = [
  { value: "quick", label: "Quick", desc: "Under 25 minutes please", emoji: "⚡" },
  { value: "normal", label: "Normal", desc: "30–45 minutes is fine", emoji: "🕐" },
  { value: "relaxed", label: "Relaxed", desc: "I enjoy the process", emoji: "🍷" },
];

const ENERGY_OPTIONS: { value: EnergyValue; label: string; desc: string; emoji: string }[] = [
  { value: "low", label: "Low", desc: "Minimal effort is key tonight", emoji: "😴" },
  { value: "medium", label: "Medium", desc: "The usual dinner energy", emoji: "😊" },
  { value: "high", label: "High", desc: "Happy to put in the work", emoji: "💪" },
];

const BUDGET_OPTIONS: { value: BudgetValue; label: string; desc: string; emoji: string }[] = [
  { value: "frugal", label: "Frugal", desc: "Keep it cost-effective", emoji: "💰" },
  { value: "moderate", label: "Moderate", desc: "I'm reasonable about it", emoji: "💳" },
  { value: "generous", label: "Generous", desc: "Worth it if it's great", emoji: "🎁" },
];

const CONFIDENCE_OPTIONS: { value: ConfidenceValue; label: string; desc: string; emoji: string }[] = [
  { value: "beginner", label: "Beginner", desc: "Keep it approachable, please", emoji: "🌱" },
  { value: "intermediate", label: "Getting there", desc: "I can follow most recipes", emoji: "🔪" },
  { value: "confident", label: "Confident", desc: "I love a bit of a challenge", emoji: "👨‍🍳" },
];

const STEPS = [
  {
    title: "How adventurous\nare you?",
    subtitle: "This shapes whether we push the familiar or the exciting.",
  },
  {
    title: "How much time do\nyou usually have?",
    subtitle: "Think typical weeknight — not your best or worst.",
  },
  {
    title: "What's your kitchen\nenergy like?",
    subtitle: "Honest answer. We're not judging.",
  },
  {
    title: "How budget-conscious\nare you?",
    subtitle: "Helps us match the right kind of meal.",
  },
  {
    title: "How confident are\nyou in the kitchen?",
    subtitle: "So we can pitch meals at the right level.",
  },
];

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 32 : -32 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -32 : 32 }),
};

function RadioCard({
  emoji,
  label,
  desc,
  selected,
  onSelect,
}: {
  emoji: string;
  label: string;
  desc: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-4 rounded-[22px] border p-4 text-left transition-all duration-150 active:scale-[0.99] ${
        selected
          ? "border-white/60 bg-white/[0.10] shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_6px_28px_rgba(255,255,255,0.06)]"
          : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]"
      }`}
    >
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1">
        <p className="text-[15px] font-semibold tracking-[-0.03em]">{label}</p>
        <p className="mt-0.5 text-xs text-white/45">{desc}</p>
      </div>
      <div
        className={`h-5 w-5 shrink-0 rounded-full border-2 transition-all duration-150 ${
          selected ? "border-white bg-white" : "border-white/20"
        }`}
      />
    </button>
  );
}

export default function FlavorProfilePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [isDone, setIsDone] = useState(false);

  const [adventurousness, setAdventurousness] = useState<AdventureValue | null>(null);
  const [timeAvailable, setTimeAvailable] = useState<TimeValue | null>(null);
  const [energyLevel, setEnergyLevel] = useState<EnergyValue | null>(null);
  const [budgetSensitivity, setBudgetSensitivity] = useState<BudgetValue | null>(null);
  const [cookingConfidence, setCookingConfidence] = useState<ConfidenceValue | null>(null);

  // Pre-populate from saved profile if updating
  useEffect(() => {
    const existing = getFlavorProfile();
    if (existing) {
      setAdventurousness(existing.adventurousness);
      setTimeAvailable(existing.timeAvailable);
      setEnergyLevel(existing.energyLevel);
      setBudgetSensitivity(existing.budgetSensitivity);
      setCookingConfidence(existing.cookingConfidence);
    }
  }, []);

  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function advance() {
    setDirection(1);
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      saveFlavorProfile({
        adventurousness: adventurousness!,
        timeAvailable: timeAvailable!,
        energyLevel: energyLevel!,
        budgetSensitivity: budgetSensitivity!,
        cookingConfidence: cookingConfidence!,
      });
      setIsDone(true);
    }
  }

  // Called from RadioCard onSelect — auto-advances after a short delay so
  // the selection highlight is visible before the step transitions.
  function scheduleAutoAdvance() {
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(() => {
      advance();
      pendingRef.current = null;
    }, 280);
  }

  // Called from the Continue button — cancels any pending auto-advance so
  // advance() is never called twice.
  function handleContinue() {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current);
      pendingRef.current = null;
    }
    advance();
  }

  function goBack() {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current);
      pendingRef.current = null;
    }
    setDirection(-1);
    setStep((s) => s - 1);
  }

  function currentStepValue() {
    if (step === 1) return adventurousness;
    if (step === 2) return timeAvailable;
    if (step === 3) return energyLevel;
    if (step === 4) return budgetSensitivity;
    return cookingConfidence;
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
            className="relative z-10 flex flex-col items-center text-center"
          >
            <div className="mb-6 text-6xl">✦</div>
            <h1 className="text-[44px] font-semibold leading-[1.0] tracking-[-0.06em]">
              Profile complete.
            </h1>
            <p className="mt-4 max-w-[28ch] text-[15px] leading-7 text-white/55">
              Your flavor profile is saved and shaping every recommendation.
            </p>
            <button
              onClick={() => router.push("/profile")}
              className="mt-10 rounded-full bg-white px-8 py-4 text-base font-semibold text-black shadow-[0_8px_32px_rgba(255,255,255,0.14)] transition hover:opacity-95 active:scale-[0.98]"
            >
              View your profile
            </button>
            <button
              onClick={() => router.replace("/")}
              className="mt-4 text-sm text-white/35 underline underline-offset-4 transition hover:text-white/55"
            >
              Let&apos;s eat
            </button>
          </motion.div>
        </div>
      </main>
    );
  }

  const currentStep = STEPS[step - 1];

  // ── Wizard steps ───────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-8 pt-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-24 right-[-60px] h-52 w-52 rounded-full bg-white/[0.04] blur-3xl" />
        </div>

        <div className="relative z-10 flex min-h-screen flex-col">
          {/* Header */}
          <header className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
              Flavor Profile
            </p>
            {step > 1 ? (
              <button
                onClick={goBack}
                className="text-sm text-white/35 transition hover:text-white/60"
              >
                Back
              </button>
            ) : (
              <button
                onClick={() => router.back()}
                className="text-sm text-white/35 transition hover:text-white/60"
              >
                Cancel
              </button>
            )}
          </header>

          {/* Progress bar */}
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
              className="flex flex-1 flex-col"
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
                {step === 1 && (
                  <div className="grid gap-3">
                    {ADVENTURE_OPTIONS.map((opt) => (
                      <RadioCard
                        key={opt.value}
                        emoji={opt.emoji}
                        label={opt.label}
                        desc={opt.desc}
                        selected={adventurousness === opt.value}
                        onSelect={() => { setAdventurousness(opt.value); scheduleAutoAdvance(); }}
                      />
                    ))}
                  </div>
                )}

                {step === 2 && (
                  <div className="grid gap-3">
                    {TIME_OPTIONS.map((opt) => (
                      <RadioCard
                        key={opt.value}
                        emoji={opt.emoji}
                        label={opt.label}
                        desc={opt.desc}
                        selected={timeAvailable === opt.value}
                        onSelect={() => { setTimeAvailable(opt.value); scheduleAutoAdvance(); }}
                      />
                    ))}
                  </div>
                )}

                {step === 3 && (
                  <div className="grid gap-3">
                    {ENERGY_OPTIONS.map((opt) => (
                      <RadioCard
                        key={opt.value}
                        emoji={opt.emoji}
                        label={opt.label}
                        desc={opt.desc}
                        selected={energyLevel === opt.value}
                        onSelect={() => { setEnergyLevel(opt.value); scheduleAutoAdvance(); }}
                      />
                    ))}
                  </div>
                )}

                {step === 4 && (
                  <div className="grid gap-3">
                    {BUDGET_OPTIONS.map((opt) => (
                      <RadioCard
                        key={opt.value}
                        emoji={opt.emoji}
                        label={opt.label}
                        desc={opt.desc}
                        selected={budgetSensitivity === opt.value}
                        onSelect={() => { setBudgetSensitivity(opt.value); scheduleAutoAdvance(); }}
                      />
                    ))}
                  </div>
                )}

                {step === 5 && (
                  <div className="grid gap-3">
                    {CONFIDENCE_OPTIONS.map((opt) => (
                      <RadioCard
                        key={opt.value}
                        emoji={opt.emoji}
                        label={opt.label}
                        desc={opt.desc}
                        selected={cookingConfidence === opt.value}
                        onSelect={() => { setCookingConfidence(opt.value); scheduleAutoAdvance(); }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-8">
                <button
                  onClick={handleContinue}
                  disabled={currentStepValue() === null}
                  className="w-full rounded-full bg-white px-5 py-4 text-center text-base font-semibold text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition hover:opacity-95 active:scale-[0.99] disabled:opacity-25"
                >
                  {step === TOTAL_STEPS ? "Save profile" : "Continue"}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
