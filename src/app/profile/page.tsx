"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  fetchOrCreateProfile,
  fetchSoftAvoids,
  updateProfileMeta,
  uploadAvatar,
} from "../lib/supabase-profile";
import { detectRituals, getRitualLabel, type RitualDetection } from "../lib/rituals";
import { getUserId, getAuthUserId, clearAllLocalState, resetAnonymousId } from "../lib/identity";
import { supabase, type SoftAvoid } from "../lib/supabase";

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

/** Returns up to 2 uppercase initials from a display name. */
function initials(name: string | null | undefined): string {
  if (!name) return "Y";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();

  // ── Sync state (localStorage — available immediately after mount) ──────────
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [noveltyBias, setNoveltyBias] = useState<number>(0.5);

  // ── Auth + profile state ───────────────────────────────────────────────────
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ── Async state (Supabase) ─────────────────────────────────────────────────
  const [asyncLoading, setAsyncLoading] = useState(true);
  const [softAvoids, setSoftAvoids] = useState<SoftAvoid[]>([]);
  const [rituals, setRituals] = useState<RitualDetection[]>([]);

  // ── Saved toast ────────────────────────────────────────────────────────────
  const [savedVisible, setSavedVisible] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Dietary / Hard NOs add mode ───────────────────────────────────────────
  const [showAddDietary, setShowAddDietary] = useState(false);
  const [showAddHardNo, setShowAddHardNo] = useState(false);

  useEffect(() => {
    // Sync reads — all available immediately from localStorage.
    // Fall back to empty defaults if localStorage was wiped (e.g. after sign-out)
    // so the page never gets stuck on a blank screen from a null prefs guard.
    setPrefs(getPreferences() ?? {
      cuisines: [],
      dietaryRestrictions: [],
      hardNoFoods: [],
      spiceLevel: "any",
      cookOrOrder: "either",
      kidFriendly: null,
    });
    setTasteProfile(getTasteProfile());
    setHistory(getHistory());
    setNoveltyBias(getNoveltyBias());

    const userId = getUserId();

    // Check auth session and load full profile in parallel
    Promise.all([
      getAuthUserId(),
      fetchOrCreateProfile(userId),
      fetchSoftAvoids(userId),
      detectRituals(userId),
    ])
      .then(([authUid, profile, avoids, _rituals]) => {
        setAuthUserId(authUid);

        if (profile?.display_name) {
          setDisplayName(profile.display_name);
          setNameInput(profile.display_name);
        }
        if (profile?.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        }
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

  // ── Auth action helpers ────────────────────────────────────────────────────

  async function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setDisplayName(trimmed);
    setEditingName(false);
    await updateProfileMeta(getUserId(), { displayName: trimmed });
    flashSaved();
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarError(null);

    const userId = getUserId();
    const url = await uploadAvatar(userId, file);

    if (!url) {
      setAvatarError("Photo didn't upload. Try again.");
      setAvatarUploading(false);
      return;
    }

    const saved = await updateProfileMeta(userId, { avatarUrl: url });

    if (!saved) {
      setAvatarError("Photo uploaded, but didn't save. Try again.");
      setAvatarUploading(false);
      return;
    }

    // Only update the visible avatar after both upload and profile save succeed.
    setAvatarUrl(url);
    setAvatarUploading(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    clearAllLocalState();
    resetAnonymousId();
    router.push("/");
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

  // Guard for the single render frame before the useEffect fires.
  // After that frame prefs is guaranteed non-null (defaults are set in the effect above).
  if (!prefs) {
    return (
      <div className="min-h-screen bg-[#1C1A18] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-[#E8621A] rounded-full animate-spin" />
      </div>
    );
  }

  const avatarInitials = initials(displayName || null);

  return (
    <main className="min-h-screen overflow-hidden bg-[#1C1A18] text-white pb-24">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-24 right-[-60px] h-52 w-52 rounded-full bg-white/[0.04] blur-3xl" />
      </div>

      {/* ── Saved toast ──────────────────────────────────────────────────────── */}
      <span
        className={`fixed top-4 right-4 z-50 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1 text-xs text-white/55 transition-all duration-300 ${
          savedVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        Saved
      </span>

      {/* ── 1. Profile header ─────────────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-2">

        {/* Avatar top right */}
        <div className="flex items-center justify-end mb-6">
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="relative">
              <button
                onClick={() => authUserId && avatarInputRef.current?.click()}
                className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-display font-black text-lg text-white ${
                  avatarUrl ? "" : "bg-[#E8621A]"
                } ${authUserId ? "cursor-pointer" : "cursor-default"}`}
                title={authUserId ? "Change photo" : undefined}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  avatarInitials
                )}
              </button>
              {avatarUploading && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
              {authUserId && (
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#E8621A] rounded-full flex items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-white">✎</span>
                </div>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            {avatarError && (
              <p className="text-red-400 text-[10px] font-body text-center leading-tight max-w-[72px]">
                {avatarError}
              </p>
            )}
          </div>
        </div>

        {/* Page headline + name */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-black text-3xl text-white">Profile</h1>
            {editingName ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void saveName(); if (e.key === "Escape") setEditingName(false); }}
                  autoFocus
                  className="font-body text-sm text-white bg-transparent border-b border-[#E8621A] outline-none flex-1 min-w-0 py-0.5"
                />
                <button onClick={() => void saveName()} className="text-[#E8621A] font-semibold text-sm flex-shrink-0">Save</button>
                <button onClick={() => setEditingName(false)} className="text-[#8A7F78] text-sm flex-shrink-0">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="font-body text-sm text-[#8A7F78]">
                  {displayName || "You"}{memberSince ? ` · Member since ${memberSince}` : ""} · {history.length} decisions
                </p>
                {authUserId && (
                  <button
                    onClick={() => { setNameInput(displayName); setEditingName(true); }}
                    className="text-[#8A7F78] text-xs flex-shrink-0"
                    title="Edit name"
                  >
                    ✎
                  </button>
                )}
              </div>
            )}
          </div>
          <Link
            href="/profile/edit"
            className="bg-[#2A2420] text-white font-body font-semibold text-sm px-4 py-2 rounded-full flex-shrink-0 ml-4"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* ── 1b. Auth CTA ──────────────────────────────────────────────────────── */}
      {!asyncLoading && (
        <div className="mx-5 mt-4">
          {authUserId ? (
            <div className="flex items-center justify-between bg-[#2A2420] rounded-[14px] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[#E8621A] text-sm">✓</span>
                <p className="font-body text-sm text-white/70">Account connected</p>
              </div>
              <button
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="font-body text-xs text-[#8A7F78] disabled:opacity-50"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push("/auth")}
              className="w-full flex items-center justify-between bg-[#2A2420] rounded-[14px] px-4 py-3.5 border border-white/[0.06]"
            >
              <div>
                <p className="font-display font-black text-sm text-white text-left">Create an account</p>
                <p className="font-body text-xs text-[#8A7F78] mt-0.5 text-left">Sync your profile across devices</p>
              </div>
              <span className="text-[#E8621A] text-lg flex-shrink-0">→</span>
            </button>
          )}
        </div>
      )}

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

      {/* ── 3. Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mx-5 mt-6">
        <div className="bg-[#2A2420] rounded-[16px] p-4 flex flex-col items-center justify-center">
          <span className="font-display font-black text-3xl text-[#E8621A]">{history.length}</span>
          <span className="font-body text-xs text-[#8A7F78] text-center mt-1">Decisions</span>
        </div>
        <div className="bg-[#2A2420] rounded-[16px] p-4 flex flex-col items-center justify-center">
          <span className="font-display font-black text-3xl text-[#E8621A]">{mealsTriedCount}</span>
          <span className="font-body text-xs text-[#8A7F78] text-center mt-1">Meals tried</span>
        </div>
        <div className="bg-[#2A2420] rounded-[16px] p-4 flex flex-col items-center justify-center">
          <span className="font-display font-black text-3xl text-[#E8621A]">0</span>
          <span className="font-body text-xs text-[#8A7F78] text-center mt-1">With others</span>
        </div>
      </div>

      {/* ── 3b. Flavor Profile entry card ────────────────────────────────────── */}
      <div className="mx-5 mt-5">
        <button
          onClick={() => router.push("/profile/card")}
          className="w-full flex items-center justify-between bg-[#2A2420] rounded-[18px] px-5 py-4 border border-[#E8621A20]"
        >
          <div className="text-left">
            <p className="font-display font-black text-base text-white">
              View my Flavor Profile
            </p>
            <p className="font-body text-xs text-[#8A7F78] mt-0.5">
              See what your dinner decisions say about you.
            </p>
          </div>
          <span className="text-[#E8621A] text-lg flex-shrink-0 ml-4">Open →</span>
        </button>
      </div>

      {/* ── 4. Flavor profile bars ───────────────────────────────────────────── */}
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

      {/* ── 5. Dietary restrictions ──────────────────────────────────────────── */}
      <div className="px-5 mt-8">
        <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-3">
          DIETARY RESTRICTIONS
        </p>
        <div className="flex flex-wrap gap-2">
          {(prefs.dietaryRestrictions ?? []).map((item) => (
            <button
              key={item}
              onClick={() => toggleDietary(item)}
              className="flex items-center gap-1.5 bg-[#2A2420] text-white/80 font-body font-semibold text-sm px-4 py-2 rounded-full border border-white/10"
            >
              <span className="font-black">×</span>
              {item}
            </button>
          ))}
          <button
            onClick={() => setShowAddDietary((v) => !v)}
            className="flex items-center gap-1 bg-[#2A2420] text-[#8A7F78] font-body font-semibold text-sm px-4 py-2 rounded-full"
          >
            + Add
          </button>
        </div>
        {/* Inline add picker */}
        {showAddDietary && (
          <div className="flex flex-wrap gap-2 mt-3">
            {DIETARY_OPTIONS.filter(
              (d) => !(prefs.dietaryRestrictions ?? []).includes(d.label)
            ).map((d) => (
              <button
                key={d.label}
                onClick={() => { toggleDietary(d.label); setShowAddDietary(false); }}
                className="flex items-center gap-1.5 bg-[#2A2420] text-white/70 font-body font-semibold text-sm px-4 py-2 rounded-full border border-white/10"
              >
                {d.emoji} {d.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 6. Hard NOs ──────────────────────────────────────────────────────── */}
      <div className="px-5 mt-8">
        <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-3">
          HARD NOs — NEVER SHOWING THESE
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

      {/* ── Bottom nav ───────────────────────────────────────────────────────── */}
      <BottomNav />

    </main>
  );
}
