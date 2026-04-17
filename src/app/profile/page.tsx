"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";
import { getPreferences, savePreferences, getTasteProfile, getFlavorProfile, type UserPreferences, type TasteProfile, type FlavorProfile } from "../lib/storage";

// ── Option data ───────────────────────────────────────────────────────────────

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

// ── Section header ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/30">
      {children}
    </p>
  );
}

// ── Chip (multi-select) ───────────────────────────────────────────────────────

function Chip({
  emoji,
  label,
  selected,
  onToggle,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.96] ${
        selected
          ? "border-white bg-white text-black shadow-[0_0_0_1px_rgba(255,255,255,0.3),0_4px_20px_rgba(255,255,255,0.10)]"
          : "border-white/15 bg-white/[0.05] text-white/70 hover:border-white/25 hover:bg-white/[0.09]"
      }`}
    >
      <span>{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

// ── Radio card (single-select) ────────────────────────────────────────────────

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

// ── Flavor profile section ────────────────────────────────────────────────

const FLAVOR_LABELS: {
  key: keyof FlavorProfile;
  values: Record<string, { label: string; emoji: string }>;
}[] = [
  {
    key: "adventurousness",
    values: {
      familiar: { label: "Familiar", emoji: "🏠" },
      balanced: { label: "Balanced", emoji: "⚖️" },
      adventurous: { label: "Adventurous", emoji: "🌍" },
    },
  },
  {
    key: "timeAvailable",
    values: {
      quick: { label: "Quick nights", emoji: "⚡" },
      normal: { label: "Normal time", emoji: "🕐" },
      relaxed: { label: "Takes its time", emoji: "🍷" },
    },
  },
  {
    key: "energyLevel",
    values: {
      low: { label: "Low energy", emoji: "😴" },
      medium: { label: "Medium energy", emoji: "😊" },
      high: { label: "High energy", emoji: "💪" },
    },
  },
  {
    key: "budgetSensitivity",
    values: {
      frugal: { label: "Frugal", emoji: "💰" },
      moderate: { label: "Moderate budget", emoji: "💳" },
      generous: { label: "Generous", emoji: "🎁" },
    },
  },
  {
    key: "cookingConfidence",
    values: {
      beginner: { label: "Beginner", emoji: "🌱" },
      intermediate: { label: "Getting there", emoji: "🔪" },
      confident: { label: "Confident cook", emoji: "👨‍🍳" },
    },
  },
];

function FlavorProfileSection({
  flavorProfile,
  onBuild,
}: {
  flavorProfile: FlavorProfile | null;
  onBuild: () => void;
}) {
  return (
    <section className="mt-8">
      <SectionLabel>Full flavor profile</SectionLabel>
      <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm leading-6 text-white/60">
            {flavorProfile
              ? "Active and shaping your recommendations."
              : "Not set yet. Deeper preferences improve recommendation quality."}
          </p>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${
              flavorProfile
                ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300/70"
                : "border-white/10 bg-white/[0.05] text-white/30"
            }`}
          >
            {flavorProfile ? "Active" : "Incomplete"}
          </span>
        </div>

        {flavorProfile && (
          <div className="mt-4 flex flex-wrap gap-2">
            {FLAVOR_LABELS.map(({ key, values }) => {
              const val = flavorProfile[key];
              const meta = values[val];
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-white/55"
                >
                  <span>{meta.emoji}</span>
                  <span>{meta.label}</span>
                </span>
              );
            })}
          </div>
        )}

        <button
          onClick={onBuild}
          className={`mt-4 w-full rounded-full border py-3 text-sm transition hover:opacity-80 active:scale-[0.99] ${
            flavorProfile
              ? "border-white/10 bg-white/[0.05] text-white/40"
              : "border-white/15 bg-white/[0.07] font-medium text-white/70"
          }`}
        >
          {flavorProfile ? "Update flavor profile" : "Build your flavor profile"}
        </button>
      </div>
    </section>
  );
}

// ── Taste profile section ─────────────────────────────────────────────────────

function buildSummary(profile: TasteProfile): string {
  const topCategories = Object.entries(profile.likedCategories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([cat]) => cat.toLowerCase());

  const netDislikedTags = Object.entries(profile.dislikedTags)
    .filter(([tag, count]) => count > (profile.likedTags[tag] ?? 0))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 1)
    .map(([tag]) => tag.toLowerCase());

  let sentence = "";
  if (topCategories.length >= 2) {
    sentence = `You tend to reach for ${topCategories[0]} and ${topCategories[1]} meals.`;
  } else if (topCategories.length === 1) {
    sentence = `You've been gravitating toward ${topCategories[0]} lately.`;
  } else {
    sentence = "Keep swiping — still learning your taste.";
  }

  if (netDislikedTags.length > 0) {
    sentence += ` You often pass on ${netDislikedTags[0]} options.`;
  }

  return sentence;
}

function TasteProfileSection({ profile }: { profile: TasteProfile }) {
  const hasData = profile.interactionCount >= 3;

  const topLikedTags = Object.entries(profile.likedTags)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([tag]) => tag);

  const netDislikedTags = Object.entries(profile.dislikedTags)
    .filter(([tag, count]) => count > (profile.likedTags[tag] ?? 0))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([tag]) => tag);

  return (
    <section className="mt-8">
      <SectionLabel>Your taste profile</SectionLabel>

      <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
        {/* Header row: summary + decision count */}
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm leading-6 text-white/60">
            {profile.interactionCount === 0
              ? "Start swiping to let the app learn your taste."
              : !hasData
              ? `${profile.interactionCount} decision${profile.interactionCount === 1 ? "" : "s"} in — still learning.`
              : buildSummary(profile)}
          </p>
          {profile.interactionCount > 0 && (
            <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] tabular-nums text-white/30">
              {profile.interactionCount}
            </span>
          )}
        </div>

        {/* Liked tags */}
        {hasData && topLikedTags.length > 0 && (
          <div className="mt-4">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">
              Tends to like
            </p>
            <div className="flex flex-wrap gap-2">
              {topLikedTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1 text-xs text-emerald-300/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Net disliked tags */}
        {hasData && netDislikedTags.length > 0 && (
          <div className="mt-3">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">
              Tends to pass on
            </p>
            <div className="flex flex-wrap gap-2">
              {netDislikedTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-rose-400/20 bg-rose-400/[0.06] px-3 py-1 text-xs text-rose-300/55"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const [flavorProfile, setFlavorProfile] = useState<FlavorProfile | null>(null);
  const [savedVisible, setSavedVisible] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPrefs(getPreferences());
    setTasteProfile(getTasteProfile());
    setFlavorProfile(getFlavorProfile());
  }, []);

  function update(partial: Partial<UserPreferences>) {
    if (!prefs) return;
    const next = { ...prefs, ...partial };
    setPrefs(next);
    savePreferences(next);

    // Show "Saved" badge briefly
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedVisible(true);
    savedTimer.current = setTimeout(() => setSavedVisible(false), 1500);
  }

  function toggleCuisine(label: string) {
    if (!prefs) return;
    const next = prefs.cuisines.includes(label)
      ? prefs.cuisines.filter((c) => c !== label)
      : [...prefs.cuisines, label];
    update({ cuisines: next });
  }

  function toggleDisliked(label: string) {
    if (!prefs) return;
    if (label === "None of these") {
      update({ dislikedFoods: [] });
      return;
    }
    const next = prefs.dislikedFoods.includes(label)
      ? prefs.dislikedFoods.filter((f) => f !== label)
      : [...prefs.dislikedFoods, label];
    update({ dislikedFoods: next });
  }

  if (!prefs) return null;

  return (
    <main className="min-h-screen overflow-hidden bg-[#080808] text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-6 pt-5">
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
            <span
              className={`rounded-full border border-white/15 bg-white/[0.07] px-3 py-1 text-xs text-white/55 transition-all duration-300 ${
                savedVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              Saved
            </span>
          </header>

          {/* Title */}
          <section className="pt-8">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs text-white/55 backdrop-blur-md">
              Your preferences
            </div>
            <h1 className="mt-4 text-[42px] font-semibold leading-[0.98] tracking-[-0.06em]">
              Tastes &amp; habits.
            </h1>
            <p className="mt-3 max-w-[34ch] text-sm leading-6 text-white/50">
              Tap anything to update. Changes save automatically.
            </p>
          </section>

          {/* ── Quick-start preferences ─────────────────────────────────── */}
          <div className="mt-10 mb-[-4px] flex items-center gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/20">
              Quick preferences
            </p>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>

          {/* ── What you love ───────────────────────────────────────────── */}
          <section className="mt-6">
            <SectionLabel>What you love</SectionLabel>
            <div className="flex flex-wrap gap-3">
              {CUISINES.map((c) => (
                <Chip
                  key={c.label}
                  emoji={c.emoji}
                  label={c.label}
                  selected={prefs.cuisines.includes(c.label)}
                  onToggle={() => toggleCuisine(c.label)}
                />
              ))}
            </div>
          </section>

          {/* ── Hard nos ────────────────────────────────────────────────── */}
          <section className="mt-8">
            <SectionLabel>Hard nos</SectionLabel>
            <div className="flex flex-wrap gap-3">
              {DISLIKED_FOODS.map((f) => {
                const selected =
                  f.label === "None of these"
                    ? prefs.dislikedFoods.length === 0
                    : prefs.dislikedFoods.includes(f.label);
                return (
                  <Chip
                    key={f.label}
                    emoji={f.emoji}
                    label={f.label}
                    selected={selected}
                    onToggle={() => toggleDisliked(f.label)}
                  />
                );
              })}
            </div>
          </section>

          {/* ── Heat level ──────────────────────────────────────────────── */}
          <section className="mt-8">
            <SectionLabel>Heat level</SectionLabel>
            <div className="grid gap-3">
              {SPICE_OPTIONS.map((opt) => (
                <RadioCard
                  key={opt.value}
                  emoji={opt.emoji}
                  label={opt.label}
                  desc={opt.desc}
                  selected={prefs.spiceLevel === opt.value}
                  onSelect={() => update({ spiceLevel: opt.value })}
                />
              ))}
            </div>
          </section>

          {/* ── Tonight's plan ───────────────────────────────────────────── */}
          <section className="mt-8">
            <SectionLabel>Tonight&apos;s plan</SectionLabel>
            <div className="grid gap-3">
              {COOK_OPTIONS.map((opt) => (
                <RadioCard
                  key={opt.value}
                  emoji={opt.emoji}
                  label={opt.label}
                  desc={opt.desc}
                  selected={prefs.cookOrOrder === opt.value}
                  onSelect={() => update({ cookOrOrder: opt.value })}
                />
              ))}
            </div>
          </section>

          {/* ── At the table ─────────────────────────────────────────────── */}
          <section className="mt-8">
            <SectionLabel>At the table</SectionLabel>
            <div className="grid gap-3">
              {KID_OPTIONS.map((opt) => {
                const selected =
                  (opt.value === "yes" && prefs.kidFriendly === true) ||
                  (opt.value === "no" && prefs.kidFriendly === false);
                return (
                  <RadioCard
                    key={opt.value}
                    emoji={opt.emoji}
                    label={opt.label}
                    desc={opt.desc}
                    selected={selected}
                    onSelect={() => update({ kidFriendly: opt.value === "yes" })}
                  />
                );
              })}
            </div>
          </section>

          {/* ── Full flavor profile ──────────────────────────────────── */}
          <FlavorProfileSection
            flavorProfile={flavorProfile}
            onBuild={() => router.push("/flavor-profile")}
          />

          {/* ── Your taste profile ───────────────────────────────────── */}
          {tasteProfile && <TasteProfileSection profile={tasteProfile} />}

          <div className="mt-auto pt-10">
            <BottomNav />
          </div>
        </div>
      </div>
    </main>
  );
}
