"use client";

/**
 * /v3-preview
 *
 * Visual QA sandbox for V3 components.
 * Mock data only — zero connection to real app state, Supabase, or scoring logic.
 * Production home route (src/app/page.tsx) is NOT modified.
 */

import { useState } from "react";
import { Dancing_Script } from "next/font/google";

import V3AppShell from "../components/v3/V3AppShell";
import V3WatchaHeader from "../components/v3/V3WatchaHeader";
import V3PeopleSelector from "../components/v3/V3PeopleSelector";
import V3VibeCard from "../components/v3/V3VibeCard";
import V3ActionDrawer from "../components/v3/V3ActionDrawer";
import V3BottomNav from "../components/v3/V3BottomNav";
import V3PrimaryDecisionCTA from "../components/v3/V3PrimaryDecisionCTA";
import V3RecentWins from "../components/v3/V3RecentWins";
import V3LockedMealCard from "../components/v3/V3LockedMealCard";
import V3PostMatchHome from "../components/v3/V3PostMatchHome";
import V3MealActionRows from "../components/v3/V3MealActionRows";

// Dancing Script loaded here only — not added to root layout
const dancingScript = Dancing_Script({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

// ── Preview state types ─────────────────────────────────────────────
type PreviewMode =
  | "shared-home"
  | "solo-home"
  | "drawer-open"
  | "post-match";

const MODES: { key: PreviewMode; label: string }[] = [
  { key: "shared-home", label: "Shared Home" },
  { key: "solo-home", label: "Solo Home" },
  { key: "drawer-open", label: "Action Drawer" },
  { key: "post-match", label: "Post-Match" },
];

// ── Mock people ─────────────────────────────────────────────────────
const MOCK_PEOPLE = [
  { id: "bree", name: "Bree" },
  { id: "jaylen", name: "Jaylen" },
];

// ── Shared Home screen ──────────────────────────────────────────────
function SharedHomeScreen({
  onOpenDrawer,
}: {
  onOpenDrawer: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasGuests, setHasGuests] = useState(false);

  const handleOpen = () => {
    onOpenDrawer();
    setDrawerOpen(true);
  };

  return (
    <V3AppShell>
      <V3WatchaHeader hasNotification />

      {/* Greeting */}
      <div
        className="text-[19px] font-semibold text-[#E8621A] px-5 mb-[3px]"
        style={{ fontFamily: "'Dancing Script', cursive" }}
      >
        Good evening, Fred.
      </div>
      <div
        className="text-[28px] font-black text-white leading-[1.15] px-5 mb-4"
        style={{ fontFamily: "var(--font-nunito)" }}
      >
        Let&apos;s figure out
        <br />
        tonight&apos;s move. 🍴
      </div>

      <V3PeopleSelector
        people={MOCK_PEOPLE}
        onChange={(ids) => setHasGuests(ids.length > 0)}
      />
      <V3VibeCard isSolo={false} />
      <V3RecentWins />

      <V3PrimaryDecisionCTA
        isSolo={false}
        hasGuests={hasGuests}
        onClick={handleOpen}
      />

      <V3BottomNav active="home" />

      {/* Drawer lives inside shell so it overlays correctly */}
      <V3ActionDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </V3AppShell>
  );
}

// ── Solo Home screen ────────────────────────────────────────────────
function SoloHomeScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleOpen = () => {
    onOpenDrawer();
    setDrawerOpen(true);
  };

  return (
    <V3AppShell>
      <V3WatchaHeader hasNotification />

      <div
        className="text-[19px] font-semibold text-[#E8621A] px-5 mb-[3px]"
        style={{ fontFamily: "'Dancing Script', cursive" }}
      >
        Good evening, Fred.
      </div>
      <div
        className="text-[28px] font-black text-white leading-[1.15] px-5 mb-4"
        style={{ fontFamily: "var(--font-nunito)" }}
      >
        What are you
        <br />
        feeling tonight?
      </div>

      {/* Solo people row — only "You" selected */}
      <V3PeopleSelector people={[]} />
      <V3VibeCard isSolo />
      <V3RecentWins />

      <V3PrimaryDecisionCTA isSolo hasGuests={false} onClick={handleOpen} />

      <V3BottomNav active="home" />

      <V3ActionDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        options={[
          { icon: "👤", title: "Just me", sub: "Solo deck, fast for you", primary: true },
          { icon: "👥", title: "Invite someone", sub: "Decide together" },
          { icon: "🏆", title: "Top 5 tonight", sub: "See the best picks now" },
          { icon: "🎲", title: "Surprise me", sub: "Let Watcha choose" },
        ]}
      />
    </V3AppShell>
  );
}

// ── Drawer-open screen ──────────────────────────────────────────────
function DrawerOpenScreen({ onClose }: { onClose: () => void }) {
  const [drawerOpen, setDrawerOpen] = useState(true);

  return (
    <V3AppShell>
      <V3WatchaHeader hasNotification />

      <div
        className="text-[19px] font-semibold text-[#E8621A] px-5 mb-[3px]"
        style={{ fontFamily: "'Dancing Script', cursive" }}
      >
        Good evening, Fred.
      </div>
      <div
        className="text-[28px] font-black text-white leading-[1.15] px-5 mb-4"
        style={{ fontFamily: "var(--font-nunito)" }}
      >
        Let&apos;s figure out
        <br />
        tonight&apos;s move. 🍴
      </div>

      <V3PeopleSelector people={MOCK_PEOPLE} />
      <V3VibeCard />
      <V3RecentWins />

      <V3PrimaryDecisionCTA isSolo={false} hasGuests />

      <V3BottomNav active="home" />

      <V3ActionDrawer
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          onClose();
        }}
      />
    </V3AppShell>
  );
}

// ── Post-Match / Decided home ───────────────────────────────────────
function PostMatchScreen({ onClear }: { onClear: () => void }) {
  return (
    <V3AppShell>
      <V3WatchaHeader hasNotification showShare />

      <V3PostMatchHome
        mealName="Tikka Masala"
        headline={"Great minds\neat alike."}
        avatarCount={3}
      />

      <V3LockedMealCard
        mealName="Tikka Masala"
        tags="Indian • Creamy • Spicy"
        cookTime="30-40 min"
        spice="🌶️🌶️🌶️"
        matchScore="98% Match"
        onClear={onClear}
      />

      <V3MealActionRows mealName="Tikka Masala" />

      <V3RecentWins />

      <V3BottomNav active="home" />
    </V3AppShell>
  );
}

// ── Preview page ────────────────────────────────────────────────────
export default function V3PreviewPage() {
  const [mode, setMode] = useState<PreviewMode>("shared-home");
  const [drawerLog, setDrawerLog] = useState<string[]>([]);

  const log = (msg: string) =>
    setDrawerLog((prev) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev.slice(0, 4)]);

  return (
    // Dancing Script injected at page level only
    <div className={dancingScript.className} style={{ background: "#0A0908", minHeight: "100vh" }}>
      {/* Override Dancing Script globally within this page */}
      <style>{`
        .${dancingScript.className} { font-family: inherit; }
        [style*="Dancing Script"] { font-family: 'Dancing Script', cursive !important; }
      `}</style>

      {/* Page header */}
      <div className="text-center py-10 px-4">
        <div
          className="inline-block px-4 py-[6px] bg-[#E8621A] rounded-full text-xs font-black text-white mb-4 tracking-wide"
          style={{ fontFamily: "var(--font-nunito)" }}
        >
          V3 Preview · Visual QA Only
        </div>
        <h1
          className="text-4xl font-black text-white mb-2"
          style={{ fontFamily: "var(--font-nunito)" }}
        >
          Watcha V3 <span className="text-[#E8621A]">UI Preview</span>
        </h1>
        <p
          className="text-sm text-[#8A7F78] max-w-md mx-auto"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Mock data only. No real state, Supabase, or scoring logic. Toggle
          screens below.
        </p>
      </div>

      {/* Toggle buttons */}
      <div className="flex flex-wrap gap-2 justify-center mb-10 px-4">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-4 py-2 rounded-full text-xs font-extrabold border transition-all cursor-pointer ${
              mode === m.key
                ? "bg-[#E8621A] border-[#E8621A] text-white"
                : "bg-[#2A2420] border-white/10 text-[#8A7F78] hover:border-[#E8621A] hover:text-white"
            }`}
            style={{ fontFamily: "var(--font-nunito)" }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Phone frame */}
      <div className="flex flex-col lg:flex-row gap-10 justify-center items-start px-4 pb-20 max-w-5xl mx-auto">
        {/* Phone shell */}
        <div className="shrink-0" style={{ width: 375 }}>
          <div
            className="rounded-[50px] p-3"
            style={{
              background: "#0A0908",
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.08), 0 40px 80px rgba(0,0,0,0.6), 0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            <div
              className="rounded-[40px] overflow-hidden bg-[#1C1A18] relative"
              style={{ minHeight: 780 }}
            >
              {/* Dynamic island */}
              <div
                className="absolute top-3 left-1/2 -translate-x-1/2 z-20 rounded-[20px]"
                style={{ width: 120, height: 34, background: "#000" }}
              />

              {/* Status bar */}
              <div className="flex justify-between items-center px-6 pt-[14px] pb-2 relative z-10">
                <span
                  className="text-[15px] font-extrabold text-white"
                  style={{ fontFamily: "var(--font-nunito)" }}
                >
                  6:12
                </span>
                <div className="flex gap-[6px] items-center text-white text-xs">
                  <span>●●●</span>
                  <span>WiFi</span>
                  <span>⬛</span>
                </div>
              </div>

              {/* Rendered screen */}
              <div className="flex flex-col" style={{ minHeight: 700 }}>
                {mode === "shared-home" && (
                  <SharedHomeScreen onOpenDrawer={() => log("Drawer opened (shared)")} />
                )}
                {mode === "solo-home" && (
                  <SoloHomeScreen onOpenDrawer={() => log("Drawer opened (solo)")} />
                )}
                {mode === "drawer-open" && (
                  <DrawerOpenScreen onClose={() => log("Drawer closed")} />
                )}
                {mode === "post-match" && (
                  <PostMatchScreen
                    onClear={() => {
                      log("Meal cleared → switching to shared-home");
                      setMode("shared-home");
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Annotation panel */}
        <div className="flex-1 max-w-sm">
          <div
            className="text-xl font-black text-white mb-2"
            style={{ fontFamily: "var(--font-nunito)" }}
          >
            {MODES.find((m) => m.key === mode)?.label}
          </div>
          <div
            className="text-sm text-[#8A7F78] mb-6 leading-relaxed"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            {mode === "shared-home" &&
              "People-first home. Tap Bree or Jaylen to toggle them into the group. Watch the CTA label update. Tap the slide CTA to open the action drawer."}
            {mode === "solo-home" &&
              "Solo mode — people row shows only You. Vibe card context updates. CTA reads 'Start my deck'."}
            {mode === "drawer-open" &&
              "Action drawer open state. Tap overlay or ✕ to close. Four paths: Together, Just me, Top 5, Surprise me."}
            {mode === "post-match" &&
              "Post-match decided home. Hero card with match copy. Locked meal card with Let's Eat swipe. Action rows below. ✕ clears the meal and resets."}
          </div>

          {/* Component list for this mode */}
          <div
            className="bg-[#2A2420] rounded-[16px] p-5 border border-white/[0.05] mb-4"
          >
            <div
              className="text-[10px] font-bold tracking-[2px] uppercase text-[#E8621A] mb-3"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              Components in view
            </div>
            <ul className="flex flex-col gap-2">
              {(mode === "shared-home" || mode === "solo-home"
                ? [
                    "V3AppShell",
                    "V3WatchaHeader",
                    "V3PeopleSelector",
                    "V3VibeCard",
                    "V3RecentWins",
                    "V3PrimaryDecisionCTA",
                    "V3BottomNav",
                    "V3ActionDrawer",
                  ]
                : mode === "drawer-open"
                ? [
                    "V3AppShell",
                    "V3WatchaHeader",
                    "V3PeopleSelector",
                    "V3VibeCard",
                    "V3RecentWins",
                    "V3PrimaryDecisionCTA",
                    "V3BottomNav",
                    "V3ActionDrawer (open)",
                  ]
                : [
                    "V3AppShell",
                    "V3WatchaHeader",
                    "V3PostMatchHome",
                    "V3LockedMealCard",
                    "V3MealActionRows",
                    "V3RecentWins",
                    "V3BottomNav",
                  ]
              ).map((name) => (
                <li key={name} className="flex items-center gap-2">
                  <span className="w-[6px] h-[6px] rounded-full bg-[#E8621A] shrink-0" />
                  <span
                    className="text-[13px] text-white font-medium"
                    style={{ fontFamily: "var(--font-manrope)" }}
                  >
                    {name}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Event log */}
          {drawerLog.length > 0 && (
            <div className="bg-[#2A2420] rounded-[16px] p-5 border border-white/[0.05]">
              <div
                className="text-[10px] font-bold tracking-[2px] uppercase text-[#8A7F78] mb-3"
                style={{ fontFamily: "var(--font-manrope)" }}
              >
                Interaction log
              </div>
              {drawerLog.map((entry, i) => (
                <div
                  key={i}
                  className="text-[12px] text-[#8A7F78] mb-1"
                  style={{ fontFamily: "var(--font-manrope)" }}
                >
                  {entry}
                </div>
              ))}
            </div>
          )}

          {/* Safety note */}
          <div
            className="mt-6 p-4 rounded-[12px] border border-[#4A7C59]/30 bg-[#4A7C59]/[0.06] text-[12px] text-[#6BAF7A] leading-relaxed"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            ✓ Production home route unchanged
            <br />
            ✓ No real state connected
            <br />
            ✓ No Supabase calls
            <br />
            ✓ No scoring or deck logic touched
          </div>
        </div>
      </div>
    </div>
  );
}
