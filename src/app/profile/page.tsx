"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import BottomNav from "../components/BottomNav";
import {
  getPreferences,
  savePreferences,
  getTasteProfile,
  getHistory,
  getNoveltyBias,
  saveNoveltyBias,
  type UserPreferences,
  type TasteProfile,
  type HistoryEntry,
} from "../lib/storage";
import { fetchOrCreateProfile, fetchSoftAvoids } from "../lib/supabase-profile";
import { detectRituals, getRitualLabel, type RitualDetection } from "../lib/rituals";
import { getUserId } from "../lib/identity";
import { type SoftAvoid } from "../lib/supabase";

// ── Option constants ──────────────────────────────────────────────────────────

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

const DIETARY_OPTIONS = [
  { label: "Vegetarian", emoji: "🥦" },
  { label: "Vegan", emoji: "🌱" },
  { label: "Gluten-free", emoji: "🌾" },
  { label: "Dairy-free", emoji: "🥛" },
  { label: "Halal", emoji: "☪️" },
  { label: "Kosher", emoji: "✡️" },
];

const NOVELTY_OPTIONS: { value: number; label: string; desc: string }[] = [
  { value: 0.2, label: "I like what I know",       desc: "Stick to tried and tested" },
  { value: 0.5, label: "Mix of both",               desc: "Some variety, some comfort" },
  { value: 0.8, label: "I love trying new things",  desc: "Surprise me every time" },
];

// ── Section header ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/30">
      {children}
    </p>
  );
}

// ── Divider with label ────────────────────────────────────────────────────────

function DividerLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-12 mb-[-4px] flex items-center gap-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/20">
        {children}
      </p>
      <div className="h-px flex-1 bg-white/[0.06]" />
    </div>
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
  label,
  desc,
  selected,
  onSelect,
}: {
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

// ── Loading pulse ─────────────────────────────────────────────────────────────

function PulseLine() {
  return <div className="h-4 w-28 animate-pulse rounded-full bg-white/[0.06]" />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  // ── Sync state (localStorage — available immediately after mount) ──────────
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [noveltyBias, setNoveltyBias] = useState<number>(0.5);

  // ── Async state (Supabase) ─────────────────────────────────────────────────
  const [asyncLoading, setAsyncLoading] = useState(true);
  const [softAvoids, setSoftAvoids] = useState<SoftAvoid[]>([]);
  const [rituals, setRituals] = useState<RitualDetection[]>([]);

  // ── Saved toast ────────────────────────────────────────────────────────────
  const [savedVisible, setSavedVisible] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Sync reads — all available immediately from localStorage
    setPrefs(getPreferences());
    setTasteProfile(getTasteProfile());
    setHistory(getHistory());
    setNoveltyBias(getNoveltyBias());

    // Async reads — fire all three in parallel
    const userId = getUserId();
    Promise.all([
      fetchOrCreateProfile(userId),
      fetchSoftAvoids(userId),
      detectRituals(userId),
    ])
      .then(([profile, avoids, _rituals]) => {
        // Supabase novelty_bias wins over localStorage value if set
        if (profile?.novelty_bias != null) {
          setNoveltyBias(profile.novelty_bias);
        }
        const now = Date.now();
        setSoftAvoids(avoids.filter((sa) => new Date(sa.expiresAt).getTime() > now));
        setRituals(_rituals.filter((r) => r.confidence >= 0.6));
      })
      .catch((err) => {
        console.warn("[profile] async load error:", err);
      })
      .finally(() => {
        setAsyncLoading(false);
      });
  }, []);

  // ── Preference update helpers ──────────────────────────────────────────────

  function flashSaved() {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedVisible(true);
    savedTimer.current = setTimeout(() => setSavedVisible(false), 1500);
  }

  function update(partial: Partial<UserPreferences>) {
    if (!prefs) return;
    const next = { ...prefs, ...partial };
    setPrefs(next);
    savePreferences(next);
    flashSaved();
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
      update({ hardNoFoods: [] });
      return;
    }
    const next = prefs.hardNoFoods.includes(label)
      ? prefs.hardNoFoods.filter((f) => f !== label)
      : [...prefs.hardNoFoods, label];
    update({ hardNoFoods: next });
  }

  function toggleDietary(label: string) {
    if (!prefs) return;
    const current = prefs.dietaryRestrictions ?? [];
    const next = current.includes(label)
      ? current.filter((d) => d !== label)
      : [...current, label];
    update({ dietaryRestrictions: next });
  }

  function selectNoveltyBias(value: number) {
    setNoveltyBias(value);
    saveNoveltyBias(value);
    flashSaved();
  }

  // ── Section 2 derived data (sync — from localStorage taste profile) ────────

  const isTimeTag = (tag: string) => /^\d+ min$/i.test(tag);

  const topLikedTags = tasteProfile
    ? Object.entries(tasteProfile.likedTags)
        .filter(([tag]) => !isTimeTag(tag))
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([tag]) => tag)
    : [];

  const topDislikedTags = tasteProfile
    ? Object.entries(tasteProfile.dislikedTags)
        .filter(([tag]) => !isTimeTag(tag))
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([tag]) => tag)
    : [];

  // ── Section 3 derived data (sync — from localStorage history) ─────────────

  const interactionCount = tasteProfile?.interactionCount ?? 0;
  const mealsTriedCount = new Set(history.map((e) => e.meal.id)).size;

  const topCategory: string | null = (() => {
    if (history.length < 5) return null;
    const freq: Record<string, number> = {};
    for (const e of history) {
      freq[e.meal.category] = (freq[e.meal.category] ?? 0) + 1;
    }
    return Object.entries(freq).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
  })();

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

          {/* ── Header ───────────────────────────────────────────────────────── */}
          <header className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 opacity-90">
              <Image
                src="/logoheader.png"
                alt="WWE logo"
                height={18}
                width={18}
                className="h-[18px] w-auto"
              />
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
                Whatcha Wanna Eat?
              </p>
            </Link>
            <span
              className={`rounded-full border border-white/15 bg-white/[0.07] px-3 py-1 text-xs text-white/55 transition-all duration-300 ${
                savedVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              Saved
            </span>
          </header>

          {/* ── Page title ───────────────────────────────────────────────────── */}
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

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* SECTION 1 — YOUR PREFERENCES                                       */}
          {/* ═══════════════════════════════════════════════════════════════════ */}

          <DividerLabel>Your preferences</DividerLabel>

          {/* What you love */}
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

          {/* Hard NOs */}
          <section className="mt-8">
            <SectionLabel>Hard NOs</SectionLabel>
            <div className="flex flex-wrap gap-3">
              {DISLIKED_FOODS.map((f) => {
                const selected =
                  f.label === "None of these"
                    ? prefs.hardNoFoods.length === 0
                    : prefs.hardNoFoods.includes(f.label);
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

          {/* Dietary restrictions */}
          <section className="mt-8">
            <SectionLabel>Dietary restrictions</SectionLabel>
            <div className="flex flex-wrap gap-3">
              {DIETARY_OPTIONS.map((opt) => (
                <Chip
                  key={opt.label}
                  emoji={opt.emoji}
                  label={opt.label}
                  selected={(prefs.dietaryRestrictions ?? []).includes(opt.label)}
                  onToggle={() => toggleDietary(opt.label)}
                />
              ))}
            </div>
          </section>

          {/* How adventurous? */}
          <section className="mt-8">
            <SectionLabel>How adventurous?</SectionLabel>
            <div className="grid gap-3">
              {NOVELTY_OPTIONS.map((opt) => (
                <RadioCard
                  key={opt.value}
                  label={opt.label}
                  desc={opt.desc}
                  selected={noveltyBias === opt.value}
                  onSelect={() => selectNoveltyBias(opt.value)}
                />
              ))}
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* SECTION 2 — WHAT WE'VE LEARNED                                     */}
          {/* ═══════════════════════════════════════════════════════════════════ */}

          <DividerLabel>What we&apos;ve learned</DividerLabel>

          {/* Gravitating toward — sync from localStorage, hide if empty */}
          {topLikedTags.length > 0 && (
            <section className="mt-6">
              <SectionLabel>Gravitating toward</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {topLikedTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-xs text-emerald-300/70"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Avoiding lately — sync from localStorage, hide if empty */}
          {topDislikedTags.length > 0 && (
            <section className="mt-6">
              <SectionLabel>Avoiding lately</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {topDislikedTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-rose-400/20 bg-rose-400/[0.06] px-3 py-1.5 text-xs text-rose-300/55"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Temporarily dialed back — async from Supabase soft_avoids */}
          {asyncLoading ? (
            <section className="mt-6">
              <SectionLabel>Temporarily dialed back</SectionLabel>
              <PulseLine />
            </section>
          ) : softAvoids.length > 0 ? (
            <section className="mt-6">
              <SectionLabel>Temporarily dialed back</SectionLabel>
              <div className="flex flex-col gap-2">
                {softAvoids.map((sa, i) => {
                  const daysLeft = Math.ceil(
                    (new Date(sa.expiresAt).getTime() - Date.now()) / 86400000,
                  );
                  return (
                    <div
                      key={i}
                      className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/55"
                    >
                      {sa.category}
                      <span className="ml-2 text-white/30">
                        · resets in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Your patterns — async from Supabase decisions, hide if none */}
          {asyncLoading ? (
            <section className="mt-6">
              <SectionLabel>Your patterns</SectionLabel>
              <PulseLine />
            </section>
          ) : rituals.length > 0 ? (
            <section className="mt-6">
              <SectionLabel>Your patterns</SectionLabel>
              <div className="flex flex-col gap-2">
                {rituals.map((r) => (
                  <div
                    key={r.context}
                    className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/55"
                  >
                    {getRitualLabel(r.context)}
                    <span className="text-white/30"> · {r.category}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* SECTION 3 — YOUR STATS                                             */}
          {/* ═══════════════════════════════════════════════════════════════════ */}

          {interactionCount > 0 && (
            <>
              <DividerLabel>Your stats</DividerLabel>

              <section className="mt-6">
                <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] divide-y divide-white/[0.06]">
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <span className="text-sm text-white/50">Decisions made</span>
                    <span className="text-sm font-semibold tabular-nums">{interactionCount}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <span className="text-sm text-white/50">Meals tried</span>
                    <span className="text-sm font-semibold tabular-nums">{mealsTriedCount}</span>
                  </div>
                  {topCategory && (
                    <div className="flex items-center justify-between px-4 py-3.5">
                      <span className="text-sm text-white/50">Most accepted</span>
                      <span className="text-sm font-semibold">{topCategory}</span>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          <div className="mt-auto pt-10">
            <BottomNav />
          </div>

        </div>
      </div>
    </main>
  );
}
