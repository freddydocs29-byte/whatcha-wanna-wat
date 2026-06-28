"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type Meal } from "../data/meals";
import {
  getSavedMealsEnriched,
  saveMeal,
  removeSavedMeal,
  clearDecidedMeal,
  getDecidedMeal,
} from "../lib/storage";
import { trackEvent } from "../lib/analytics";
import { EVENT_LOCKED_RESULT_VIEWED, EVENT_POST_DECISION_ACTION, EVENT_GUEST_LIMIT_REACHED, EVENT_MEAL_SAVED } from "../lib/analytics-events";
import BottomNav from "../components/BottomNav";
import FeedbackModal from "../components/FeedbackModal";
import { getAuthUserId } from "../lib/identity";
import { fetchProfileByAuthUserId } from "../lib/supabase-profile";
import { guestDeckBudgetExhausted, tryConsumeGuestDeckBudget, getGuestAttempts } from "../lib/guestLimit";
import GuestLimitPrompt from "../components/GuestLimitPrompt";
import V3PostMatchHome from "../components/v3/V3PostMatchHome";
import V3LockedMealCard from "../components/v3/V3LockedMealCard";
import V3MealActionRows from "../components/v3/V3MealActionRows";
import V3MealActionDrawer from "../components/v3/V3MealActionDrawer";
import { MealDetailDrawer } from "../components/MealDetailDrawer";

type Props = {
  meal: Meal;
  recipeQuery: string;
  pickedForYou: boolean;
};

export default function LockedPageClient({ meal, recipeQuery, pickedForYou }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [savedJustNow, setSavedJustNow] = useState(false);
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [mealActionMode, setMealActionMode] = useState<"cook" | "order" | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [showGuestLimit, setShowGuestLimit] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [isFoundingTaster, setIsFoundingTaster] = useState(false);

  useEffect(() => {
    setSaved(getSavedMealsEnriched().some((s) => s.meal.id === meal.id));
    getAuthUserId().then((uid) => setIsGuest(uid === null));
    const decided = getDecidedMeal();
    if (decided?.sessionId) setSessionId(decided.sessionId);
  }, [meal.id]);

  useEffect(() => {
    getAuthUserId().then(async (uid) => {
      if (!uid) return;
      const p = await fetchProfileByAuthUserId(uid);
      if (p?.is_founding_taster) setIsFoundingTaster(true);
    }).catch(() => {});
  }, []);

  const lockedViewedRef = useRef(false);
  useEffect(() => {
    if (lockedViewedRef.current) return;
    lockedViewedRef.current = true;
    const decided = getDecidedMeal();
    trackEvent(EVENT_LOCKED_RESULT_VIEWED, {
      mealId: meal.id,
      sessionMode: decided?.mode === "shared" ? "shared" : "solo",
    });
  }, []);

  function toggleSave() {
    if (saved) {
      removeSavedMeal(meal.id);
      setSaved(false);
      setSavedJustNow(false);
    } else {
      saveMeal(meal);
      trackEvent(EVENT_MEAL_SAVED, { mealId: meal.id, source_screen: "locked" });
      setSaved(true);
      setSavedJustNow(true);
      setTimeout(() => setSavedJustNow(false), 2000);
    }
  }

  function handleNewDeck() {
    trackEvent("change_mind_clicked", { mealId: meal.id });
    if (isGuest) {
      if (guestDeckBudgetExhausted()) {
        setShowGuestLimit(true);
        trackEvent(EVENT_GUEST_LIMIT_REACHED, {
          attempts_used: getGuestAttempts(),
          trigger_source: "locked",
        });
        return;
      }
      // Consume budget and start a fresh deck.
      tryConsumeGuestDeckBudget();
      // Clear the active decided meal before navigating so the deck starts fresh.
      // Without this, watcha_decided_meal would remain set in localStorage and
      // could cause stale state across the new deck session.
      clearDecidedMeal();
      router.push("/deck");
    } else {
      router.push("/");
    }
  }

  function handleCook() {
    trackEvent("cook_clicked", { mealId: meal.id });
    trackEvent(EVENT_POST_DECISION_ACTION, { mealId: meal.id, action_type: "cook" });
    setMealActionMode("cook");
  }

  function handleOrder() {
    trackEvent("order_clicked", { mealId: meal.id });
    trackEvent(EVENT_POST_DECISION_ACTION, { mealId: meal.id, action_type: "order" });
    setMealActionMode("order");
  }

  function buildAuthUrl(authMode: "signup" | "signin") {
    const params = new URLSearchParams({ mode: authMode, from: "guest-match" });
    if (meal.id) params.set("mealId", meal.id);
    if (sessionId) params.set("sessionId", sessionId);
    return `/auth?${params.toString()}`;
  }

  function handleCreateAccount() {
    const decided = getDecidedMeal();
    if (decided) {
      try {
        localStorage.setItem("wwe_pending_guest_meal", JSON.stringify(decided));
      } catch { /* quota exceeded — ignore */ }
    }
    router.push(buildAuthUrl("signup"));
  }

  function handleSignIn() {
    const decided = getDecidedMeal();
    if (decided) {
      try {
        localStorage.setItem("wwe_pending_guest_meal", JSON.stringify(decided));
      } catch { /* quota exceeded — ignore */ }
    }
    router.push(buildAuthUrl("signin"));
  }

  const headline = pickedForYou ? "Decided\nfor you." : "Tonight's pick\nis locked in.";
  const sub = `You chose ${meal.name}.`;
  const matchScore = pickedForYou ? "Decided for you" : "Your pick";

  const saveAction = isGuest
    ? {
        icon: "⭐",
        title: "Sign up to save",
        sub: "Create an account to keep your favorites.",
        onClick: () => router.push("/auth?mode=signup"),
      }
    : {
        icon: "⭐",
        title: saved ? `Saved — ${meal.name}` : `Save ${meal.name}`,
        sub: saved ? "Tap to remove from favorites." : "Add to your favorites.",
        onClick: toggleSave,
      };

  return (
    <main
      className="relative min-h-screen text-white overflow-hidden flex flex-col"
      style={{ background: "#0B0805" }}
    >
      {/* Ambient top glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 28% at 50% 0%, rgba(232,98,26,0.13) 0%, transparent 60%)",
        }}
      />

      <div className="relative flex-1 overflow-y-auto flex flex-col pt-12 pb-6">
        <V3PostMatchHome
          mealName={meal.name}
          headline={headline}
          sub={sub}
          mealImage={meal.image || undefined}
          avatars={[]}
        />

        <V3LockedMealCard
          mealName={meal.name}
          tags={[meal.cuisine, meal.category].filter(Boolean).join(" • ")}
          cookTime={meal.tags.find((t) => /\d+\s*min/i.test(t)) ?? "—"}
          spice={meal.tags.some((t) => /spic/i.test(t)) ? "🌶️🌶️" : "Mild"}
          matchScore={matchScore}
          onClear={isGuest === false ? handleNewDeck : undefined}
          onSave={isGuest ? () => router.push("/auth?mode=signup") : toggleSave}
          isSaved={saved}
          savedJustNow={savedJustNow}
          onCook={handleCook}
          onOrder={handleOrder}
          onDetails={() => setDetailOpen(true)}
        />

        <V3MealActionRows
          mealName={meal.name}
          actions={[
            {
              icon: "🔄",
              title: "Changed your mind?",
              sub: "Start a new deck any time.",
              onClick: handleNewDeck,
            },
            saveAction,
          ]}
        />

        {/* Feedback */}
        <div className="mx-5 mt-4">
          <button
            onClick={() => setFeedbackOpen(true)}
            className="flex items-center justify-between w-full rounded-[14px] px-4 py-3 text-left"
            style={{
              background: "rgba(255,231,202,0.03)",
              border: "1px solid rgba(245,237,224,0.07)",
            }}
          >
            <div>
              <p
                className="font-body text-sm"
                style={{ color: "rgba(245,237,224,0.8)", fontWeight: 500 }}
              >
                Send feedback
              </p>
              <p
                className="font-body text-xs mt-0.5"
                style={{ color: "rgba(199,189,172,0.45)" }}
              >
                Tell us what felt off or what you loved.
              </p>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(245,237,224,0.3)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {isGuest && (
          <div className="px-6 mt-8 mb-4">
            <button
              onClick={handleCreateAccount}
              className="w-full bg-[#E8621A] text-white font-display font-black text-base py-4 rounded-full"
              style={{ boxShadow: "0 0 30px rgba(232,98,26,0.3)" }}
            >
              Create account →
            </button>
            <p className="font-body text-sm text-[#8A7F78] text-center mt-2 leading-relaxed px-2">
              Keep this pick, save favorites, and build your flavor profile.
            </p>
            <button
              onClick={handleSignIn}
              className="mt-3 w-full font-body text-sm text-[#8A7F78] text-center py-3"
            >
              Already have an account? Sign in
            </button>
          </div>
        )}
      </div>

      {isGuest === false && <BottomNav activeHref="/" />}

      {mealActionMode && (
        <V3MealActionDrawer
          meal={meal}
          mode={mealActionMode}
          onClose={() => setMealActionMode(null)}
        />
      )}

      <MealDetailDrawer
        meal={meal}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        context="solo"
      />

      {showGuestLimit && (
        <GuestLimitPrompt onClose={() => setShowGuestLimit(false)} />
      )}

      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        pageContext="locked_result"
        isFoundingTaster={isFoundingTaster}
      />
    </main>
  );
}
