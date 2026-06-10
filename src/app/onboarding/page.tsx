"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { savePreferences, markOnboardingDone, hasCompletedOnboarding, saveNoveltyBias } from "../lib/storage";

const TOTAL_STEPS = 5;

// ── Option data ───────────────────────────────────────────────────────────────

/** Step 1: dietary restrictions → dietary_restrictions Supabase column */
const DIETARY_OPTIONS: { label: string; emoji: string }[] = [
  { label: "Vegetarian",  emoji: "🥦" },
  { label: "Vegan",       emoji: "🌱" },
  { label: "Gluten-free", emoji: "🌾" },
  { label: "Dairy-free",  emoji: "🥛" },
  { label: "Halal",       emoji: "☪️"  },
  { label: "Kosher",      emoji: "✡️"  },
];

/** Step 2: hard NOs → hard_no_foods Supabase column (stored as direct HARD_NO_KEYWORDS keys) */
const HARD_NO_OPTIONS: { label: string; emoji: string }[] = [
  { label: "Seafood",      emoji: "🦐" },
  { label: "Beef",         emoji: "🥩" },
  { label: "Pork",         emoji: "🐷" },
  { label: "Chicken",      emoji: "🍗" },
  { label: "Dairy",        emoji: "🧀" },
  { label: "Gluten / Pasta", emoji: "🌾" },
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
    title: "Any dietary\nrestrictions?",
    subtitle: "We'll never show you meals that don't work for you.",
  },
  {
    title: "Anything you absolutely\nwon't eat?",
    subtitle: "Hard NOs are never shown. Ever.",
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

// ── Shared style constants ────────────────────────────────────────────────────

const gradientPrimaryStyle = {
  background: "linear-gradient(180deg, #FF8A3D, #E8621A 50%, #B84A12)",
  boxShadow:
    "0 1px 0 rgba(255,210,170,0.45) inset, 0 -2px 0 rgba(120,52,0,0.35) inset, 0 16px 34px rgba(232,98,26,0.42), 0 0 0 1px rgba(232,98,26,0.32)",
};

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';
  const [step, setStep] = useState(0);
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

  // Redirect if onboarding already done — unless we're in edit mode.
  useEffect(() => {
    if (!isEditMode && hasCompletedOnboarding()) router.replace("/");
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
      router.replace(isEditMode ? '/profile/edit' : '/');
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

  // ── Toggle helpers ────────────────────────────────────────────────────────

  function toggleDietary(label: string) {
    setDietaryRestrictions((prev) =>
      prev.includes(label) ? prev.filter((v) => v !== label) : [...prev, label]
    );
  }

  function toggleHardNo(label: string) {
    setHardNoFoods((prev) =>
      prev.includes(label) ? prev.filter((v) => v !== label) : [...prev, label]
    );
  }

  /** "None of these" on the dietary step — clears dietary and advances. */
  function handleNoDietary() {
    setDietaryRestrictions([]);
    setDirection(1);
    setStep((s) => s + 1);
  }

  /** "None of these" on the hard NO step — clears hard NOs and advances. */
  function handleNoHardNos() {
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
    if (step === 1) return dietaryRestrictions.length > 0;
    if (step === 2) return hardNoFoods.length > 0;
    if (step === 3) return cuisines.length > 0;
    // Step 4 auto-advances on selection; no Continue needed unless navigated back.
    return noveltyBias !== null;
  }

  const currentStep = STEPS[step - 1];

  // Emojis for step 3 novelty options (no emoji field on NOVELTY_OPTIONS)
  const noveltyEmojis = ["🔁", "⚖️", "🌟"];

  return (
    <main className="relative min-h-screen overflow-y-auto bg-[#0B0805] text-white">
      <div className="mx-auto w-full max-w-md pb-32">

        {/* 1. PROGRESS BAR */}
        <div className="flex items-center gap-3 px-5 pt-4">
          {step > 1 && (
            <button
              onClick={goBack}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white/60 flex-shrink-0 transition active:scale-[0.98]"
            >
              ←
            </button>
          )}
          <div className="flex flex-1 gap-2">
            {Array.from({ length: TOTAL_STEPS + 1 }).map((_, i) => (
              <div
                key={i}
                className="h-[4px] flex-1 rounded-full overflow-hidden"
                style={{ background: "rgba(255,231,202,0.08)" }}
              >
                {i <= step && (
                  <div
                    className="h-full w-full rounded-full"
                    style={{
                      background: "linear-gradient(90deg, #B84A12, #E8621A)",
                      boxShadow: "0 0 8px rgba(232,98,26,0.5)",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Ember background ambience */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 30% at 50% -6%, rgba(232,98,26,0.13) 0%, transparent 62%)",
          }}
        />

        {/* ── Step 0: "Here's the deal" intro ─────────────────────────────── */}
        {step === 0 && (
          <div className="flex flex-col px-5 pt-10 pb-32">
            <p
              className="text-[11px] tracking-[2.4px] uppercase mb-5"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                color: "#E8621A",
              }}
            >
              In 90 seconds
            </p>
            <h1
              className="leading-tight text-white"
              style={{
                fontFamily: "var(--font-quicksand)",
                fontWeight: 700,
                fontSize: 44,
              }}
            >
              Here&apos;s the deal<span style={{ color: "#E8621A" }}>.</span>
            </h1>
            <p
              className="mt-3"
              style={{
                fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                fontWeight: 300,
                fontSize: 15,
                lineHeight: 1.5,
                color: "#C7BDAC",
              }}
            >
              Watcha turns &ldquo;what do you want to eat?&rdquo; into a quick swipe &mdash; solo or with someone.
            </p>
            <div className="mt-7 flex flex-col">
              {[
                { title: "Takes less than a minute.", subtitle: "A few answers now. A real answer every time you're hungry." },
                { title: "Swipe solo or decide together.", subtitle: "Use it alone or share a session — both work." },
                { title: "We learn your taste over time.", subtitle: "Your swipes shape what shows up next." },
                { title: "Save the good picks when you want.", subtitle: "Bookmark anything you'd actually order." },
              ].map((item, index) => (
                <div
                  key={index}
                  className="flex gap-[18px] py-[18px]"
                  style={{
                    borderBottom: index < 3 ? "1px solid rgba(245,237,224,0.085)" : "none",
                  }}
                >
                  <span
                    className="flex-shrink-0 w-[30px] leading-none pt-0.5"
                    style={{
                      fontFamily: "var(--font-quicksand)",
                      fontWeight: 700,
                      fontSize: 24,
                      color: "#E8621A",
                    }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p
                      className="text-white"
                      style={{
                        fontFamily: "var(--font-quicksand)",
                        fontWeight: 700,
                        fontSize: 19,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {item.title}
                    </p>
                    <p
                      className="mt-1.5"
                      style={{
                        fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                        fontWeight: 300,
                        fontSize: 13.5,
                        lineHeight: 1.5,
                        color: "#C7BDAC",
                      }}
                    >
                      {item.subtitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Animated step content — steps 1–4 only */}
        {step >= 1 && step < 5 && (
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
              {/* 2. STEP COUNTER */}
              <p
                className="mt-8 px-5 uppercase"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: 11,
                  letterSpacing: "2px",
                  color: "#897E73",
                }}
              >
                {step < 4 ? `${step} of 4` : "Last one"}
              </p>

              {/* 3. QUESTION HEADLINE */}
              <h1
                className="text-white leading-tight mt-3 px-5 whitespace-pre-line"
                style={{
                  fontFamily: "var(--font-quicksand)",
                  fontWeight: 700,
                  fontSize: 38,
                  letterSpacing: "-0.02em",
                }}
              >
                {currentStep.title}
              </h1>

              {/* 4. SUBTEXT */}
              <p
                className="mt-3 px-5"
                style={{
                  fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
                  fontWeight: 300,
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: "#C7BDAC",
                }}
              >
                {currentStep.subtitle}
              </p>

              {/* 4. OPTIONS LIST */}
              <div className="flex flex-col gap-3 mt-6 px-5">

                {/* ── Step 1: dietary restrictions ───────────────────────── */}
                {step === 1 && (
                  <>
                    {DIETARY_OPTIONS.map((opt) => {
                      const selected = dietaryRestrictions.includes(opt.label);
                      return (
                        <button
                          key={opt.label}
                          onClick={() => toggleDietary(opt.label)}
                          className="w-full flex items-center gap-4 rounded-[18px] p-4 border cursor-pointer transition-all duration-150"
                          style={
                            selected
                              ? {
                                  background: "rgba(232,98,26,0.07)",
                                  border: "1.5px solid #E8621A",
                                  boxShadow: "0 0 26px rgba(232,98,26,0.12)",
                                }
                              : {
                                  background: "rgba(255,231,202,0.045)",
                                  border: "1px solid rgba(245,237,224,0.085)",
                                }
                          }
                        >
                          <div
                            className="w-[50px] h-[50px] rounded-[14px] flex items-center justify-center text-2xl flex-shrink-0"
                            style={{
                              background: "rgba(255,231,202,0.08)",
                              border: "1px solid rgba(245,237,224,0.085)",
                            }}
                          >
                            {opt.emoji}
                          </div>
                          <span
                            className="flex-1 text-white text-left"
                            style={{
                              fontFamily: "var(--font-quicksand)",
                              fontWeight: 700,
                              fontSize: 18,
                            }}
                          >
                            {opt.label}
                          </span>
                          <div
                            className="w-[26px] h-[26px] rounded-full flex-shrink-0 flex items-center justify-center"
                            style={
                              selected
                                ? {
                                    background: "#E8621A",
                                    boxShadow: "0 0 14px rgba(232,98,26,0.5)",
                                  }
                                : {
                                    border: "2px solid rgba(245,237,224,0.16)",
                                  }
                            }
                          >
                            {selected && (
                              <span className="text-[13px] font-bold text-white">✓</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    {/* "None of these" — clears dietary and advances immediately */}
                    <button
                      onClick={handleNoDietary}
                      className="w-full flex items-center gap-4 rounded-[18px] p-4 cursor-pointer transition-all duration-150"
                      style={{
                        background: "rgba(255,231,202,0.045)",
                        border: "1px solid rgba(245,237,224,0.085)",
                      }}
                    >
                      <div
                        className="w-[50px] h-[50px] rounded-[14px] flex items-center justify-center text-2xl flex-shrink-0"
                        style={{
                          background: "rgba(255,231,202,0.08)",
                          border: "1px solid rgba(245,237,224,0.085)",
                        }}
                      >
                        🚫
                      </div>
                      <span
                        className="flex-1 text-white text-left"
                        style={{
                          fontFamily: "var(--font-quicksand)",
                          fontWeight: 700,
                          fontSize: 18,
                        }}
                      >
                        None of these
                      </span>
                      <div
                        className="w-[26px] h-[26px] rounded-full flex-shrink-0"
                        style={{ border: "2px solid rgba(245,237,224,0.16)" }}
                      />
                    </button>
                  </>
                )}

                {/* ── Step 2: hard NOs ───────────────────────────────────── */}
                {step === 2 && (
                  <>
                    {HARD_NO_OPTIONS.map((opt) => {
                      const selected = hardNoFoods.includes(opt.label);
                      return (
                        <button
                          key={opt.label}
                          onClick={() => toggleHardNo(opt.label)}
                          className="w-full flex items-center gap-4 rounded-[18px] p-4 cursor-pointer transition-all duration-150"
                          style={
                            selected
                              ? {
                                  background: "rgba(232,98,26,0.07)",
                                  border: "1.5px solid #E8621A",
                                  boxShadow: "0 0 26px rgba(232,98,26,0.12)",
                                }
                              : {
                                  background: "rgba(255,231,202,0.045)",
                                  border: "1px solid rgba(245,237,224,0.085)",
                                }
                          }
                        >
                          <div
                            className="w-[50px] h-[50px] rounded-[14px] flex items-center justify-center text-2xl flex-shrink-0"
                            style={{
                              background: "rgba(255,231,202,0.08)",
                              border: "1px solid rgba(245,237,224,0.085)",
                            }}
                          >
                            {opt.emoji}
                          </div>
                          <span
                            className="flex-1 text-white text-left"
                            style={{
                              fontFamily: "var(--font-quicksand)",
                              fontWeight: 700,
                              fontSize: 18,
                            }}
                          >
                            {opt.label}
                          </span>
                          <div
                            className="w-[26px] h-[26px] rounded-full flex-shrink-0 flex items-center justify-center"
                            style={
                              selected
                                ? {
                                    background: "#E8621A",
                                    boxShadow: "0 0 14px rgba(232,98,26,0.5)",
                                  }
                                : {
                                    border: "2px solid rgba(245,237,224,0.16)",
                                  }
                            }
                          >
                            {selected && (
                              <span className="text-[13px] font-bold text-white">✓</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    {/* "None of these" — clears hard NOs and advances immediately */}
                    <button
                      onClick={handleNoHardNos}
                      className="w-full flex items-center gap-4 rounded-[18px] p-4 cursor-pointer transition-all duration-150"
                      style={{
                        background: "rgba(255,231,202,0.045)",
                        border: "1px solid rgba(245,237,224,0.085)",
                      }}
                    >
                      <div
                        className="w-[50px] h-[50px] rounded-[14px] flex items-center justify-center text-2xl flex-shrink-0"
                        style={{
                          background: "rgba(255,231,202,0.08)",
                          border: "1px solid rgba(245,237,224,0.085)",
                        }}
                      >
                        🚫
                      </div>
                      <span
                        className="flex-1 text-white text-left"
                        style={{
                          fontFamily: "var(--font-quicksand)",
                          fontWeight: 700,
                          fontSize: 18,
                        }}
                      >
                        None of these
                      </span>
                      <div
                        className="w-[26px] h-[26px] rounded-full flex-shrink-0"
                        style={{ border: "2px solid rgba(245,237,224,0.16)" }}
                      />
                    </button>
                  </>
                )}

                {/* ── Step 3: cuisine preferences ────────────────────────── */}
                {step === 3 && (
                  <>
                    {CUISINES.map((c) => {
                      const selected = cuisines.includes(c.label);
                      return (
                        <button
                          key={c.label}
                          onClick={() => toggleCuisine(c.label)}
                          className="w-full flex items-center gap-4 rounded-[18px] p-4 cursor-pointer transition-all duration-150"
                          style={
                            selected
                              ? {
                                  background: "rgba(232,98,26,0.07)",
                                  border: "1.5px solid #E8621A",
                                  boxShadow: "0 0 26px rgba(232,98,26,0.12)",
                                }
                              : {
                                  background: "rgba(255,231,202,0.045)",
                                  border: "1px solid rgba(245,237,224,0.085)",
                                }
                          }
                        >
                          <div
                            className="w-[50px] h-[50px] rounded-[14px] flex items-center justify-center text-2xl flex-shrink-0"
                            style={{
                              background: "rgba(255,231,202,0.08)",
                              border: "1px solid rgba(245,237,224,0.085)",
                            }}
                          >
                            {c.emoji}
                          </div>
                          <span
                            className="flex-1 text-white text-left"
                            style={{
                              fontFamily: "var(--font-quicksand)",
                              fontWeight: 700,
                              fontSize: 18,
                            }}
                          >
                            {c.label}
                          </span>
                          <div
                            className="w-[26px] h-[26px] rounded-full flex-shrink-0 flex items-center justify-center"
                            style={
                              selected
                                ? {
                                    background: "#E8621A",
                                    boxShadow: "0 0 14px rgba(232,98,26,0.5)",
                                  }
                                : {
                                    border: "2px solid rgba(245,237,224,0.16)",
                                  }
                            }
                          >
                            {selected && (
                              <span className="text-[13px] font-bold text-white">✓</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}

                {/* ── Step 4: familiarity vs novelty (auto-advances on pick) ─ */}
                {step === 4 && (
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
                          className="w-full flex items-center gap-4 rounded-[18px] p-4 cursor-pointer transition-all duration-150"
                          style={
                            selected
                              ? {
                                  background: "rgba(232,98,26,0.07)",
                                  border: "1.5px solid #E8621A",
                                  boxShadow: "0 0 26px rgba(232,98,26,0.12)",
                                }
                              : {
                                  background: "rgba(255,231,202,0.045)",
                                  border: "1px solid rgba(245,237,224,0.085)",
                                }
                          }
                        >
                          <div
                            className="w-[50px] h-[50px] rounded-[14px] flex items-center justify-center text-2xl flex-shrink-0"
                            style={{
                              background: "rgba(255,231,202,0.08)",
                              border: "1px solid rgba(245,237,224,0.085)",
                            }}
                          >
                            {noveltyEmojis[i]}
                          </div>
                          <span
                            className="flex-1 text-white text-left"
                            style={{
                              fontFamily: "var(--font-quicksand)",
                              fontWeight: 700,
                              fontSize: 18,
                            }}
                          >
                            {opt.label}
                          </span>
                          <div
                            className="w-[26px] h-[26px] rounded-full flex-shrink-0 flex items-center justify-center"
                            style={
                              selected
                                ? {
                                    background: "#E8621A",
                                    boxShadow: "0 0 14px rgba(232,98,26,0.5)",
                                  }
                                : {
                                    border: "2px solid rgba(245,237,224,0.16)",
                                  }
                            }
                          >
                            {selected && (
                              <span className="text-[13px] font-bold text-white">✓</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}

              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Step 5: brand poster ─────────────────────────────────────────── */}
        {step === 5 && (
          <div className="relative flex flex-col items-center justify-center px-5 pt-16 pb-40 min-h-[calc(100vh-56px)]">
            {/* Radial orange glow behind the ? */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-[#E8621A] blur-3xl opacity-[0.12] pointer-events-none" />

            {/* Wordmark */}
            <p
              className="tracking-[0.25em] uppercase mb-10 relative z-10"
              style={{
                fontFamily: "var(--font-quicksand)",
                fontWeight: 700,
                fontSize: 12,
                color: "#897E73",
              }}
            >
              Watcha?
            </p>

            {/* "Stop asking." */}
            <h1
              className="text-white leading-none text-center relative z-10"
              style={{
                fontFamily: "var(--font-quicksand)",
                fontWeight: 700,
                fontSize: 48,
              }}
            >
              Stop asking.
            </h1>

            {/* Giant decorative ? */}
            <div
              className="leading-none my-2 relative z-10 select-none"
              style={{
                fontFamily: "var(--font-quicksand)",
                fontWeight: 700,
                fontSize: "40vh",
                color: "#E8621A",
              }}
            >
              ?
            </div>

            {/* "Start eating." */}
            <h1
              className="text-white leading-none text-center relative z-10"
              style={{
                fontFamily: "var(--font-quicksand)",
                fontWeight: 700,
                fontSize: 48,
              }}
            >
              Start eating.
            </h1>

          </div>
        )}

      </div>

      {/* 5. CONTINUE BUTTON — fixed at bottom
           Steps 1-3 (multi-select): always shown.
           Step 4 (auto-advance): shown only if the user navigated back and already
           has a noveltyBias set so they can proceed without re-selecting. */}
      {step >= 1 && step < 5 && (step <= 3 || (step === 4 && noveltyBias !== null)) && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#0B0805]">
          <div className="mx-auto w-full max-w-md px-5 pt-10 relative" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 32px)" }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent to-[#0B0805]" />
            <button
              onClick={advance}
              disabled={!canContinue()}
              className="w-full text-white font-bold text-base py-4 rounded-full transition active:scale-[0.99]"
              style={
                canContinue()
                  ? gradientPrimaryStyle
                  : { background: "#E8621A", opacity: 0.4, pointerEvents: "none" }
              }
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 0 CTA */}
      {step === 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#0B0805]">
          <div className="mx-auto w-full max-w-md px-5 pt-10 relative" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 32px)" }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent to-[#0B0805]" />
            <button
              onClick={advance}
              className="w-full text-white font-bold text-base py-4 rounded-full transition active:scale-[0.99]"
              style={gradientPrimaryStyle}
            >
              Got it →
            </button>
          </div>
        </div>
      )}

      {/* Step 5 CTA */}
      {step === 5 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#0B0805]">
          <div className="mx-auto w-full max-w-md px-5 pt-10 relative" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 32px)" }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent to-[#0B0805]" />
            <button
              onClick={advance}
              className="w-full text-white font-bold text-base py-4 rounded-full transition active:scale-[0.99]"
              style={gradientPrimaryStyle}
            >
              Let&apos;s eat →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
