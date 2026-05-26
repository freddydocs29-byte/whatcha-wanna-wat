"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Meal } from "../data/meals";
import {
  HistoryEntry,
  getHistory,
  clearHistory,
  getSavedMealsEnriched,
  addFavorite,
  removeFavorite,
} from "../lib/storage";
import BottomNav from "../components/BottomNav";
import { fetchOrCreateProfile } from "../lib/supabase-profile";
import { getUserId } from "../lib/identity";
import type { Profile } from "../lib/supabase";
import { MealDetailDrawer } from "../components/MealDetailDrawer";


function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor(
    (now.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) /
      86_400_000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMeal, setDrawerMeal] = useState<Meal | null>(null);

  useEffect(() => {
    setEntries(getHistory());
    const enriched = getSavedMealsEnriched();
    setFavoriteIds(new Set(enriched.filter((s) => s.isFavorite).map((s) => s.meal.id)));
    setLoaded(true);
    fetchOrCreateProfile(getUserId()).then(setProfile).catch(() => {});
  }, []);

  function handleFavoriteToggle(meal: Meal) {
    if (favoriteIds.has(meal.id)) {
      removeFavorite(meal.id);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        next.delete(meal.id);
        return next;
      });
    } else {
      addFavorite(meal);
      setFavoriteIds((prev) => new Set(prev).add(meal.id));
    }
  }

  async function handleShare(mealName: string) {
    const text = `We're eating ${mealName} tonight 🍽️`;
    if (navigator.share) {
      try {
        await navigator.share({ title: text, text });
        return;
      } catch {
        // user cancelled or share failed
      }
    }
    await navigator.clipboard.writeText(text);
  }

  function handleClear() {
    clearHistory();
    setEntries([]);
    setConfirming(false);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#1C1A18] text-white pb-28">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-24 right-[-60px] h-52 w-52 rounded-full bg-white/[0.04] blur-3xl" />
      </div>
      <div className="relative mx-auto w-full max-w-md">

        <div className="px-5 pt-6 pb-2">
          {/* Avatar top right only */}
          <div className="flex items-center justify-end mb-6">
            <button
              onClick={() => router.push('/profile')}
              className="w-11 h-11 rounded-full bg-[#E8621A] overflow-hidden flex items-center justify-center font-display font-black text-lg text-white flex-shrink-0"
            >
              {profile?.avatar_url
                ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Profile" />
                : <span>{profile?.display_name?.[0]?.toUpperCase() ?? '?'}</span>
              }
            </button>
          </div>

          {/* Title row */}
          <h1 className="font-display font-black text-3xl text-white">
            History
          </h1>
          <p className="font-body text-sm text-[#8A7F78] mt-1">
            Every meal you&apos;ve decided on.
          </p>
        </div>

        {loaded && entries.length > 0 && (
          <div className="flex items-center justify-between px-5 mt-4 mb-1">
            <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase">
              {entries.length} meal{entries.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => setConfirming(true)}
              className="text-xs text-[#8A7F78] transition hover:text-white/60 active:scale-[0.97]"
            >
              Clear history
            </button>
          </div>
        )}

        {loaded && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center pt-24 px-5">
            <div className="mb-5 text-4xl">📋</div>
            <p className="font-display font-black text-base text-white">No history yet</p>
            <p className="font-body text-sm text-[#8A7F78] mt-2 max-w-[26ch]">
              Choose a meal on the deck and it&apos;ll show up here.
            </p>
            <Link
              href="/deck"
              className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:opacity-95 active:scale-[0.99]"
            >
              Go to deck
            </Link>
          </div>
        )}

        <div className="mt-4">
          {entries.map((entry, i) => (
            <div
              key={i}
              className="bg-[#2A2420] rounded-[20px] p-5 mx-5 mb-3"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-[14px] bg-[#3D3733] flex items-center justify-center text-3xl flex-shrink-0">
                  🍽️
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-base text-white">{entry.meal.name}</p>
                  <p className="font-body text-xs text-[#8A7F78] mt-0.5">
                    {formatDate(entry.chosenAt)} · {formatTime(entry.chosenAt)}
                  </p>
                </div>
                <button
                  onClick={() => { setDrawerMeal(entry.meal); setDrawerOpen(true); }}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/25 transition hover:text-white/50 active:scale-[0.95] flex-shrink-0"
                  aria-label="More details"
                >
                  <span className="font-body text-sm font-semibold">i</span>
                </button>
              </div>

              {/* Action row */}
              <div className="mt-4 flex items-center gap-2 border-t border-white/[0.07] pt-4">
                <button
                  onClick={() => handleFavoriteToggle(entry.meal)}
                  className={`flex-1 rounded-full border px-3 py-2 text-xs font-medium transition active:scale-[0.97] ${
                    favoriteIds.has(entry.meal.id)
                      ? "border-white/15 bg-white/10 text-amber-400"
                      : "border-white/[0.08] bg-transparent text-white/35 hover:text-white/60"
                  }`}
                >
                  {favoriteIds.has(entry.meal.id) ? "Unfavorite" : "Favorite"}
                </button>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(entry.meal.name + " recipe")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-full border border-white/[0.08] bg-transparent px-3 py-2 text-center text-xs font-medium text-white/35 transition hover:text-white/60 active:scale-[0.97]"
                >
                  Cook it
                </a>
                <button
                  onClick={() => handleShare(entry.meal.name)}
                  className="flex-1 rounded-full border border-white/[0.08] bg-transparent px-3 py-2 text-xs font-medium text-white/35 transition hover:text-white/60 active:scale-[0.97]"
                >
                  Share
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>

      <BottomNav />
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-5 pb-10">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirming(false)}
          />
          <div className="relative w-full max-w-md rounded-[28px] border border-white/[0.06] bg-[#2A2420] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <p className="font-display font-black text-xl text-white tracking-tight">
              Clear history?
            </p>
            <p className="font-body text-sm text-[#8A7F78] mt-2 leading-relaxed">
              This will permanently remove all {entries.length} meal
              {entries.length !== 1 ? "s" : ""} from your history.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-full border border-white/10 bg-[#1C1A18] py-3 font-body text-sm font-semibold text-[#8A7F78] transition active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="flex-1 rounded-full bg-[#E8621A] py-3 font-display font-black text-sm text-white shadow-[0_0_20px_rgba(232,98,26,0.35)] transition hover:bg-[#F27B35] active:scale-[0.98]"
              >
                Yes, clear it
              </button>
            </div>
          </div>
        </div>
      )}

      <MealDetailDrawer
        meal={drawerMeal}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        context="history"
      />
    </main>
  );
}
