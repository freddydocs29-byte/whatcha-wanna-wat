"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProfileReady } from "../components/ProfileProvider";
import { getAuthUserId } from "../lib/identity";
import { fetchProfileByAuthUserId } from "../lib/supabase-profile";

const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const FOUNDING_WELCOME_KEY = "founding_welcome_seen";

/** Blank Candlelight background shown while profile is still loading. */
function LoadingShell() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "#0B0805" }}
      aria-hidden
    />
  );
}

export default function FoundingWelcomePage() {
  const router = useRouter();
  const profileReady = useProfileReady();
  // null = still deciding; true = show screen; false = redirect
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    // Do not make any decision until ProfileProvider has finished its current
    // initialization cycle (which includes applyFoundingTasterFlag).
    if (!profileReady) return;

    // If the user has already seen this screen, send them to onboarding.
    if (localStorage.getItem(FOUNDING_WELCOME_KEY) === "true") {
      router.replace("/onboarding");
      return;
    }

    // Profile is stable — check is_founding_taster from Supabase.
    (async () => {
      const authId = await getAuthUserId();
      if (authId) {
        const profile = await fetchProfileByAuthUserId(authId);
        if (!profile?.is_founding_taster) {
          router.replace("/onboarding");
          return;
        }
      } else {
        // No auth session — not a founding taster path.
        router.replace("/onboarding");
        return;
      }

      // Confirmed founding taster, first visit.
      // Mark as seen now so exiting without tapping CTA still prevents a repeat.
      localStorage.setItem(FOUNDING_WELCOME_KEY, "true");
      setShow(true);
    })();
  }, [profileReady, router]);

  // While profile is loading or we're still deciding, show a blank shell.
  if (!profileReady || show === null) return <LoadingShell />;

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6"
      style={{ background: "#0B0805" }}
    >
      {/* Grain */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: GRAIN_SVG, opacity: 0.05, mixBlendMode: "overlay" }}
        aria-hidden
      />
      {/* Ember ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(232,98,26,0.14) 0%, transparent 60%), radial-gradient(ellipse 50% 30% at 50% 100%, rgba(232,98,26,0.06) 0%, transparent 50%)",
        }}
        aria-hidden
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: "inset 0 0 120px 30px rgba(0,0,0,0.55)" }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-sm flex flex-col">
        {/* Label */}
        <p
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: 11,
            letterSpacing: "2.4px",
            textTransform: "uppercase",
            color: "#E8621A",
            marginBottom: 20,
          }}
        >
          Founding Taster
        </p>

        {/* Headline */}
        <h1
          style={{
            fontFamily: "var(--font-quicksand)",
            fontWeight: 700,
            fontSize: 44,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "#F6EEE2",
            marginBottom: 28,
          }}
        >
          Welcome.{" "}
          <span style={{ color: "#F6EEE2" }}>You&apos;re in.</span>
        </h1>

        {/* Body */}
        <p
          style={{
            fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
            fontWeight: 300,
            fontSize: 15,
            lineHeight: 1.65,
            color: "#C7BDAC",
            marginBottom: 40,
          }}
        >
          You&apos;re one of the first people invited into Watcha? — a better way
          to decide what&apos;s for dinner without the back-and-forth.
          <br />
          <br />
          Your swipes, picks, and feedback will help shape what Watcha? becomes.
          <br />
          <br />
          First, let&apos;s learn your taste.
        </p>

        {/* CTA */}
        <button
          onClick={() => router.replace("/onboarding")}
          className="w-full rounded-full py-4 transition-opacity active:opacity-90"
          style={{
            background:
              "linear-gradient(180deg, #FF8A3D 0%, #E8621A 48%, #B84A12 100%)",
            boxShadow:
              "0 1px 0 rgba(255,224,188,0.6) inset, 0 -2px 0 rgba(120,52,0,0.4) inset, 0 14px 30px rgba(232,98,26,0.4), 0 0 0 1px rgba(232,98,26,0.3)",
            color: "#1c0c03",
            fontFamily: "var(--font-quicksand)",
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: "-0.01em",
          }}
        >
          Build my flavor profile
        </button>

        {/* Sign-off */}
        <p
          className="text-center"
          style={{
            fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
            fontWeight: 300,
            fontSize: 12,
            color: "#5A5248",
            marginTop: 32,
          }}
        >
          — Watcha?
        </p>
      </div>
    </main>
  );
}
