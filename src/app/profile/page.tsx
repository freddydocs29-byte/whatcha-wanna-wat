"use client";

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

// ── Category display name map ─────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  "Comfort food": "Comfort",
  "Fresh & Healthy": "Fresh",
  "Crowd-pleasers": "Crowd",
  "Indulgent": "Indulgent",
  "Quick & Easy": "Quick",
  "Adventurous": "Bold",
};

function shortCategory(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat.split(" ")[0];
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

  // ── Hard NOs add mode ─────────────────────────────────────────────────────
  const [showAddHardNo, setShowAddHardNo] = useState(false);

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

  // ── Flavor profile bars ────────────────────────────────────────────────────

  const flavorBars = tasteProfile
    ? Object.entries(tasteProfile.likedCategories)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
    : [];

  const maxFlavor = flavorBars[0]?.[1] ?? 1;

  // ── Top cuisines (from prefs + history counts) ────────────────────────────

  const cuisineCountMap: Record<string, number> = {};
  for (const e of history) {
    if (e.meal.cuisine) {
      cuisineCountMap[e.meal.cuisine] = (cuisineCountMap[e.meal.cuisine] ?? 0) + 1;
    }
  }
  const topCuisines = (prefs?.cuisines ?? [])
    .map((label) => ({
      label,
      emoji: CUISINES.find((c) => c.label === label)?.emoji ?? "🍽️",
      count: cuisineCountMap[label] ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  // ── Member since ──────────────────────────────────────────────────────────

  const memberSince = (() => {
    if (history.length === 0) return null;
    const oldest = history[history.length - 1];
    return new Date(oldest.chosenAt).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  })();

  // ── Insight text ─────────────────────────────────────────────────────────

  const insightText = (() => {
    if (topLikedTags.length === 0 && !topCategory) return null;
    const parts: string[] = [];
    if (topCategory) parts.push(topCategory);
    if (topLikedTags[0]) parts.push(topLikedTags[0]);
    return parts;
  })();

  if (!prefs) return null;

  return (
    <main className="min-h-screen bg-[#1C1A18] text-white pb-24">

      {/* ── Saved toast ──────────────────────────────────────────────────────── */}
      <span
        className={`fixed top-4 right-4 z-50 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1 text-xs text-white/55 transition-all duration-300 ${
          savedVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        Saved
      </span>

      {/* ── 1. Profile header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-5 pt-6">
        <div className="w-16 h-16 rounded-full bg-[#E8621A] flex items-center justify-center font-display font-black text-2xl text-white flex-shrink-0">
          Y
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-black text-2xl text-white leading-tight">You</p>
          <p className="font-body text-sm text-[#8A7F78] mt-0.5">
            {memberSince ? `Member since ${memberSince} · ` : ""}
            {history.length} decisions
          </p>
        </div>
        <Link
          href="/onboarding"
          className="bg-[#2A2420] text-white font-body font-semibold text-sm px-4 py-2 rounded-full flex-shrink-0"
        >
          Edit
        </Link>
      </div>

      {/* ── 2. Insight card ───────────────────────────────────────────────────── */}
      {insightText && (
        <div className="mx-5 mt-5 bg-[#2A2420] rounded-[18px] p-5 border-l-4 border-[#E8621A]">
          <p className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase">
            WATCHA? KNOWS YOU
          </p>
          <p className="font-display font-black text-base text-white leading-snug mt-2">
            You tend to go for{" "}
            {insightText[0] && (
              <span className="text-[#E8621A]">{insightText[0]}</span>
            )}
            {insightText[1] && (
              <>
                {" "}with a{" "}
                <span className="text-[#E8621A]">{insightText[1]}</span>
                {" "}vibe
              </>
            )}
            .
          </p>
        </div>
      )}

      {/* ── 3. Flavor profile bars ───────────────────────────────────────────── */}
      {flavorBars.length > 0 && (
        <div className="px-5 mt-8">
          <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-4">
            FLAVOR PROFILE
          </p>
          {flavorBars.map(([cat, val]) => {
            const pct = Math.round((val / maxFlavor) * 100);
            return (
              <div key={cat} className="flex items-center gap-3 mb-3">
                <span className="font-body text-sm text-white/80 w-16 flex-shrink-0">
                  {shortCategory(cat)}
                </span>
                <div className="flex-1 h-2 bg-[#3D3733] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#E8621A] rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-display font-bold text-sm text-[#E8621A] w-10 text-right flex-shrink-0">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 4. Top cuisines ──────────────────────────────────────────────────── */}
      {topCuisines.length > 0 && (
        <div className="px-5 mt-8">
          <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-3">
            TOP CUISINES
          </p>
          <div className="grid grid-cols-2 gap-3">
            {topCuisines.map(({ label, emoji, count }) => (
              <div key={label} className="bg-[#2A2420] rounded-[16px] p-4 flex items-center gap-3">
                <span className="text-2xl flex-shrink-0">{emoji}</span>
                <div className="min-w-0">
                  <p className="font-display font-bold text-base text-white">{label}</p>
                  <p className="font-body text-xs text-[#8A7F78] mt-0.5">
                    {count > 0 ? `Decided ${count}×` : "In your list"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. Hard NOs ──────────────────────────────────────────────────────── */}
      <div className="px-5 mt-8">
        <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-3">
          HARD NOS — NEVER SHOWING THESE
        </p>
        <div className="flex flex-wrap gap-2">
          {prefs.hardNoFoods.map((food) => (
            <button
              key={food}
              onClick={() => toggleDisliked(food)}
              className="flex items-center gap-1.5 bg-red-950/50 text-red-400 font-body font-semibold text-sm px-4 py-2 rounded-full border border-red-900/40"
            >
              <span className="font-black">×</span>
              {food}
            </button>
          ))}
          <button
            onClick={() => setShowAddHardNo((v) => !v)}
            className="flex items-center gap-1 bg-[#2A2420] text-[#8A7F78] font-body font-semibold text-sm px-4 py-2 rounded-full"
          >
            + Add
          </button>
        </div>
        {/* Inline add picker */}
        {showAddHardNo && (
          <div className="flex flex-wrap gap-2 mt-3">
            {DISLIKED_FOODS.filter(
              (f) => f.label !== "None of these" && !prefs.hardNoFoods.includes(f.label)
            ).map((f) => (
              <button
                key={f.label}
                onClick={() => { toggleDisliked(f.label); setShowAddHardNo(false); }}
                className="flex items-center gap-1.5 bg-[#2A2420] text-white/70 font-body font-semibold text-sm px-4 py-2 rounded-full border border-white/10"
              >
                {f.emoji} {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 6. Deciding with — hidden when no partner data ────────────────────── */}
      {/* No partner name data in the current auth model (localStorage UUIDs only) */}

      {/* ── Bottom nav ───────────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <BottomNav />
      </div>

    </main>
  );
}
