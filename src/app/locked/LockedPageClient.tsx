"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Meal } from "../data/meals";
import {
  getHistory,
  getStreak,
  getSavedMealsEnriched,
  saveMeal,
  removeSavedMeal,
} from "../lib/storage";
import { trackEvent } from "../lib/analytics";
import BottomNav from "../components/BottomNav";
import { fetchOrCreateProfile } from "../lib/supabase-profile";
import { getUserId } from "../lib/identity";
import type { Profile } from "../lib/supabase";

type Props = {
  meal: Meal;
  recipeQuery: string;
  pickedForYou: boolean;
};

export default function LockedPageClient({ meal, recipeQuery, pickedForYou }: Props) {
  const router = useRouter();
  const [decisionCount, setDecisionCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showEatModal, setShowEatModal] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const timeLabel = "just now";

  useEffect(() => {
    const history = getHistory();
    setDecisionCount(history.length);
    setStreak(getStreak());
    setSaved(getSavedMealsEnriched().some((s) => s.meal.id === meal.id));
    fetchOrCreateProfile(getUserId()).then(setProfile).catch(() => {});
  }, [meal.id]);

  function toggleSave() {
    if (saved) {
      removeSavedMeal(meal.id);
      setSaved(false);
    } else {
      saveMeal(meal);
      setSaved(true);
    }
  }

  function handleNewDeck() {
    trackEvent("change_mind_clicked", { mealId: meal.id });
    router.push("/");
  }

  const decidedWith = pickedForYou ? "just for you" : "your partner";

  return (
    <main className="relative min-h-screen px-5 pt-12 pb-10 text-white overflow-hidden" style={{ background: "#0B0805" }}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 28% at 50% 0%, rgba(232,98,26,0.13) 0%, transparent 60%), radial-gradient(ellipse 70% 20% at 50% 100%, rgba(11,8,5,0.8) 0%, transparent 65%)",
        }}
      />
      {/* Film grain */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          opacity: 0.05,
          mixBlendMode: "overlay",
        }}
      />
      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 100px 20px rgba(0,0,0,0.5)" }}
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col">

        {/* Top bar — avatar */}
        <div className="flex items-center justify-end mb-6">
          <Link
            href="/profile"
            className="w-11 h-11 rounded-full bg-[#E8621A] overflow-hidden flex items-center justify-center font-display font-black text-lg text-white cursor-pointer"
          >
            {profile?.avatar_url
              ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Profile" />
              : <span>{profile?.display_name?.[0]?.toUpperCase() ?? '?'}</span>
            }
          </Link>
        </div>

        {/* 1. Headline block */}
        <div>
          <p className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase mb-3">
            TONIGHT&apos;S PICK
          </p>
          <h1 className="font-display font-black text-4xl text-white leading-tight">
            Dinner is decided.
          </h1>
          <p className="font-body text-base text-[#8A7F78] mt-2">
            {meal.name} is locked in.
          </p>
        </div>

        {/* 2. Tonight's pick card */}
        <div
          className="w-full rounded-[20px] mt-6 overflow-hidden border border-white/[0.07]"
          style={{
            background: "rgba(255,237,210,0.04)",
            backdropFilter: "blur(12px)",
            boxShadow:
              "0 0 40px rgba(232,98,26,0.10), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Meal image */}
          {meal.image && (
            <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <img
                src={meal.image}
                alt={meal.name}
                className="w-full h-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgba(11,8,5,0.85) 0%, transparent 60%)",
                }}
              />
            </div>
          )}
          <div className="p-5">
            <div className="flex items-center justify-between gap-4">
              {/* Meal info */}
              <div className="flex-1 min-w-0">
                <p className="font-display font-black text-xl text-white truncate">
                  {meal.name}
                </p>
                <p className="font-body text-xs text-[#8A7F78] mt-1">
                  Decided with {decidedWith} · {timeLabel}
                </p>
              </div>
              {/* CTA */}
              <button
                onClick={() => {
                  trackEvent("lets_eat_clicked", { mealId: meal.id });
                  setShowEatModal(true);
                }}
                className="rounded-full px-5 py-3 font-display font-black text-sm text-white whitespace-nowrap flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, #E8621A 0%, #C4501A 100%)",
                  boxShadow: "0 4px 20px rgba(232,98,26,0.35)",
                }}
              >
                Let&apos;s eat 🙌
              </button>
            </div>
          </div>
        </div>

        {/* 3. Action cards */}
        <div className="flex flex-col gap-3 mt-4">
          {/* Changed your mind? */}
          <button
            onClick={handleNewDeck}
            className="w-full rounded-[18px] p-4 flex items-center gap-4 text-left shadow-[0_4px_20px_rgba(0,0,0,0.30)]"
            style={{
              background: "rgba(255,231,202,0.05)",
              border: "1px solid rgba(245,237,224,0.10)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 20px rgba(0,0,0,0.30)",
            }}
          >
            <div className="w-12 h-12 rounded-[12px] flex items-center justify-center text-2xl flex-shrink-0" style={{ background: "rgba(255,231,202,0.06)", border: "1px solid rgba(232,98,26,0.18)" }}>
              🔄
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-black text-base text-white">Changed your mind?</p>
              <p className="font-body text-sm text-[#8A7F78] mt-0.5">Start a new deck any time.</p>
            </div>
            <span className="text-[#8A7F78] text-lg">→</span>
          </button>

          {/* Save meal */}
          <button
            onClick={toggleSave}
            className="w-full rounded-[18px] p-4 flex items-center gap-4 text-left"
            style={{
              background: "rgba(255,231,202,0.05)",
              border: "1px solid rgba(245,237,224,0.10)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 20px rgba(0,0,0,0.30)",
            }}
          >
            <div className="w-12 h-12 rounded-[12px] flex items-center justify-center text-2xl flex-shrink-0" style={{ background: "rgba(255,231,202,0.06)", border: "1px solid rgba(232,98,26,0.18)" }}>
              ⭐
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-black text-base text-white">
                {saved ? `Saved — ${meal.name}` : `Save ${meal.name}`}
              </p>
              <p className="font-body text-sm text-[#8A7F78] mt-0.5">
                {saved ? "Tap to remove from favorites." : "Add to your favorites."}
              </p>
            </div>
            <span className="text-[#8A7F78] text-lg">{saved ? "✓" : "→"}</span>
          </button>
        </div>

        {/* 4. Streak section */}
        <div className="mt-8">
          <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-3">
            YOUR STREAK
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[16px] p-4 flex flex-col items-center justify-center" style={{ background: "rgba(255,231,202,0.05)", border: "1px solid rgba(245,237,224,0.10)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
              <span className="font-display font-black text-3xl text-[#E8621A]">
                {decisionCount}
              </span>
              <span className="font-body text-xs text-[#8A7F78] text-center mt-1">
                Decisions made
              </span>
            </div>
            <div className="rounded-[16px] p-4 flex flex-col items-center justify-center" style={{ background: "rgba(255,231,202,0.05)", border: "1px solid rgba(245,237,224,0.10)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
              <span className="font-display font-black text-3xl text-[#E8621A]">
                {streak}
              </span>
              <span className="font-body text-xs text-[#8A7F78] text-center mt-1">
                Days in a row
              </span>
            </div>
            <div className="rounded-[16px] p-4 flex flex-col items-center justify-center" style={{ background: "rgba(255,231,202,0.05)", border: "1px solid rgba(245,237,224,0.10)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
              <span className="font-display font-black text-3xl text-[#E8621A]">
                2min
              </span>
              <span className="font-body text-xs text-[#8A7F78] text-center mt-1">
                Avg. decision time
              </span>
            </div>
          </div>
        </div>

      </div>

      <BottomNav activeHref="/" />

      {/* Cook vs Order modal */}
      {showEatModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowEatModal(false)}
          />
          <div
            className="relative w-full rounded-t-[28px] px-6 pt-6 pb-10"
            style={{
              background:
                "radial-gradient(ellipse 80% 30% at 50% 0%, rgba(232,98,26,0.08) 0%, transparent 60%), #211E1B",
              border: "1px solid rgba(255,255,255,0.06)",
              borderBottom: "none",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.55)",
            }}
          >
            <div className="w-10 h-1 bg-[rgba(245,237,224,0.15)] rounded-full mx-auto mb-6" />
            <p className="font-display font-black text-2xl text-white text-center">
              How are you eating?
            </p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => { setShowEatModal(false); window.open(`https://www.google.com/search?q=${recipeQuery}`, "_blank", "noopener,noreferrer"); }}
                className="rounded-[20px] p-5 flex flex-col items-center gap-3 cursor-pointer border transition-colors active:scale-[0.98]"
                style={{
                  background: "rgba(255,231,202,0.04)",
                  borderColor: "rgba(245,237,224,0.07)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(232,98,26,0.40)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(245,237,224,0.07)")}
              >
                <span className="text-4xl">🍳</span>
                <p className="font-display font-black text-lg text-white">Cook it</p>
                <p className="font-body text-xs text-[#8A7F78] text-center mt-1">See what you need</p>
              </button>
              <button
                onClick={() => { setShowEatModal(false); window.open(`https://www.google.com/maps/search/${encodeURIComponent(meal.name + " near me")}`, "_blank", "noopener,noreferrer"); }}
                className="rounded-[20px] p-5 flex flex-col items-center gap-3 cursor-pointer border transition-colors active:scale-[0.98]"
                style={{
                  background: "rgba(255,231,202,0.04)",
                  borderColor: "rgba(245,237,224,0.07)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(232,98,26,0.40)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(245,237,224,0.07)")}
              >
                <span className="text-4xl">🚗</span>
                <p className="font-display font-black text-lg text-white">Order in</p>
                <p className="font-body text-xs text-[#8A7F78] text-center mt-1">Find delivery options</p>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
