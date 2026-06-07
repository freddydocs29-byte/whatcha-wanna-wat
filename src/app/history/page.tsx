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

const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

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

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
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
    <main
      className="relative min-h-screen overflow-hidden text-white pb-28"
      style={{ background: "#0B0805" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 36% at 50% -4%, rgba(232,98,26,0.16) 0%, transparent 60%)," +
            "radial-gradient(ellipse 70% 40% at 50% 104%, rgba(184,74,18,0.16) 0%, transparent 66%)," +
            "radial-gradient(ellipse 40% 22% at 84% 30%, rgba(230,178,106,0.06) 0%, transparent 70%)",
        }}
      />
      {/* Film grain */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{ opacity: 0.05, mixBlendMode: "overlay", backgroundImage: GRAIN_SVG }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{ boxShadow: "inset 0 0 120px 28px rgba(0,0,0,0.55)" }}
      />

      <div className="relative z-[2] mx-auto w-full max-w-md">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-5 pt-6 pb-2">
          <div className="flex items-center justify-end mb-6">
            <button
              onClick={() => router.push("/profile")}
              className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-display font-black text-lg text-white flex-shrink-0"
              style={{ background: "#E8621A" }}
            >
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Profile" />
              ) : (
                <span>{profile?.display_name?.[0]?.toUpperCase() ?? "?"}</span>
              )}
            </button>
          </div>
          <h1 className="font-display font-black text-3xl text-white tracking-tight">History</h1>
          <p className="font-body text-sm mt-1" style={{ color: "#897E73" }}>
            Every meal you&apos;ve decided on.
          </p>
        </div>

        {/* ── Count row ──────────────────────────────────────────────────── */}
        {loaded && entries.length > 0 && (
          <div className="flex items-center justify-between px-5 mt-5 mb-1">
            <p
              className="font-display font-black text-sm tracking-widest"
              style={{ color: "rgba(245,237,224,0.4)" }}
            >
              {entries.length} MEAL{entries.length !== 1 ? "S" : ""}
            </p>
            <button
              onClick={() => setConfirming(true)}
              className="font-body text-xs transition hover:opacity-75 active:scale-[0.97]"
              style={{ color: "#897E73" }}
            >
              Clear history
            </button>
          </div>
        )}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {loaded && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center pt-24 px-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 text-3xl"
              style={{ background: "rgba(255,231,202,0.06)", border: "1px solid rgba(245,237,224,0.1)" }}
            >
              📋
            </div>
            <p className="font-display font-black text-lg text-white">No history yet</p>
            <p className="font-body text-sm mt-2 max-w-[26ch]" style={{ color: "#897E73" }}>
              Choose a meal on the deck and it&apos;ll show up here.
            </p>
            <Link
              href="/deck"
              className="mt-6 rounded-full px-6 py-3.5 font-display font-black text-sm text-white transition hover:opacity-95 active:scale-[0.99]"
              style={{
                background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 48%, #B84A12 100%)",
                boxShadow: "0 0 24px rgba(232,98,26,0.35)",
              }}
            >
              Go to deck
            </Link>
          </div>
        )}

        {/* ── Entries ───────────────────────────────────────────────────── */}
        <div className="mt-4 px-5 flex flex-col gap-3">
          {entries.map((entry, i) => (
            <div
              key={i}
              className="rounded-[20px] overflow-hidden"
              style={{
                background: "rgba(255,231,202,0.055)",
                border: "1px solid rgba(245,237,224,0.09)",
                backdropFilter: "blur(12px)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(245,237,224,0.05)",
              }}
            >
              {/* Meal row */}
              <div className="flex items-center gap-4 p-5 pb-4">
                {/* Thumbnail */}
                <div
                  className="w-14 h-14 rounded-[14px] flex items-center justify-center text-2xl flex-shrink-0"
                  style={{
                    background: "rgba(255,231,202,0.06)",
                    border: "1px solid rgba(232,98,26,0.18)",
                  }}
                >
                  🍽️
                </div>
                {/* Name + time */}
                <div className="flex-1 min-w-0">
                  <p className="font-display font-black text-base text-white leading-tight">
                    {entry.meal.name}
                  </p>
                  <p className="font-body text-xs mt-0.5" style={{ color: "#897E73" }}>
                    {formatDate(entry.chosenAt)} · {formatTime(entry.chosenAt)}
                  </p>
                </div>
                {/* Info */}
                <button
                  onClick={() => { setDrawerMeal(entry.meal); setDrawerOpen(true); }}
                  className="flex h-9 w-9 items-center justify-center rounded-full transition hover:opacity-80 active:scale-[0.95] flex-shrink-0"
                  style={{
                    background: "rgba(255,231,202,0.06)",
                    border: "1px solid rgba(245,237,224,0.1)",
                    color: "rgba(245,237,224,0.4)",
                  }}
                  aria-label="More details"
                >
                  <InfoIcon />
                </button>
              </div>

              {/* Action pills */}
              <div
                className="flex items-center gap-2 px-5 pb-5 pt-4"
                style={{ borderTop: "1px solid rgba(245,237,224,0.06)" }}
              >
                <button
                  onClick={() => handleFavoriteToggle(entry.meal)}
                  className="flex-1 rounded-full py-2 font-body text-xs font-medium transition active:scale-[0.97]"
                  style={
                    favoriteIds.has(entry.meal.id)
                      ? {
                          background: "rgba(251,191,36,0.14)",
                          border: "1px solid rgba(251,191,36,0.28)",
                          color: "#FBB124",
                        }
                      : {
                          background: "rgba(255,231,202,0.04)",
                          border: "1px solid rgba(245,237,224,0.08)",
                          color: "rgba(245,237,224,0.4)",
                        }
                  }
                >
                  {favoriteIds.has(entry.meal.id) ? "Unfavorite" : "Favorite"}
                </button>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(entry.meal.name + " recipe")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-full py-2 font-body text-center text-xs font-medium transition hover:opacity-75 active:scale-[0.97]"
                  style={{
                    background: "rgba(255,231,202,0.04)",
                    border: "1px solid rgba(245,237,224,0.08)",
                    color: "rgba(245,237,224,0.4)",
                  }}
                >
                  Cook it
                </a>
                <button
                  onClick={() => handleShare(entry.meal.name)}
                  className="flex-1 rounded-full py-2 font-body text-xs font-medium transition hover:opacity-75 active:scale-[0.97]"
                  style={{
                    background: "rgba(255,231,202,0.04)",
                    border: "1px solid rgba(245,237,224,0.08)",
                    color: "rgba(245,237,224,0.4)",
                  }}
                >
                  Share
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />

      {/* ── Clear history confirmation ───────────────────────────────────── */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-5 pb-10">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: "rgba(0,0,0,0.65)" }}
            onClick={() => setConfirming(false)}
          />
          <div
            className="relative w-full max-w-md rounded-[28px] p-6"
            style={{
              background:
                "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(232,98,26,0.07) 0%, transparent 60%), rgba(14,9,5,0.98)",
              border: "1px solid rgba(245,237,224,0.08)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(245,237,224,0.05)",
            }}
          >
            <p className="font-display font-black text-xl text-white tracking-tight">
              Clear history?
            </p>
            <p className="font-body text-sm mt-2 leading-relaxed" style={{ color: "#897E73" }}>
              This will permanently remove all {entries.length} meal
              {entries.length !== 1 ? "s" : ""} from your history.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-full py-3 font-body text-sm font-semibold transition active:scale-[0.98]"
                style={{
                  background: "rgba(255,231,202,0.04)",
                  border: "1px solid rgba(245,237,224,0.08)",
                  color: "#897E73",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="flex-1 rounded-full py-3 font-display font-black text-sm text-white transition hover:opacity-95 active:scale-[0.98]"
                style={{
                  background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 48%, #B84A12 100%)",
                  boxShadow: "0 0 20px rgba(232,98,26,0.35)",
                }}
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
