"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FlameCard from "../../components/FlameCard";
import type { FlameCardProps } from "../../components/FlameCard";
import { getSoloDNA } from "../../lib/dna";
import { getSoloInsights } from "../../lib/dna-insights";
import { getUserId } from "../../lib/identity";
import { fetchOrCreateProfile } from "../../lib/supabase-profile";
import { getPreferences } from "../../lib/storage";
import { trackEvent } from "../../lib/analytics";
import { EVENT_FLAVOR_CARD_SHARED } from "../../lib/analytics-events";

// TODO: Add couples mode toggle when getCouplesDNA is wired to a partner lookup.
// Steps needed:
//   1. Query partner_relationships for most recent partner_id
//   2. If found, call getCouplesDNA(userId, partnerId)
//   3. Call getCouplesInsights(couplesDna)
//   4. Show solo/together toggle and render couples FlameCard

type PageState =
  | { status: "loading" }
  | { status: "not-enough-data" }
  | { status: "ready"; cardProps: FlameCardProps };

export default function FlavorProfileCardPage() {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const userId = getUserId();
      if (!userId) {
        setState({ status: "not-enough-data" });
        return;
      }

      const [dna, profile] = await Promise.all([
        getSoloDNA(userId),
        fetchOrCreateProfile(userId),
      ]);

      if (dna.totalDecisions < 3) {
        setState({ status: "not-enough-data" });
        return;
      }

      const userName = profile?.display_name ?? undefined;
      const insights = await getSoloInsights(dna, userName);
      const prefs = getPreferences();

      const data: FlameCardProps["data"] = {
        totalDecisions: dna.totalDecisions,
        totalSessions: dna.totalSessions,
        topCuisine: dna.topCuisines[0]?.cuisine,
        topCuisinePct: dna.topCuisines[0]?.pct,
        cuisineBreakdown: dna.topCuisines.slice(0, 3),
        flavorTags: dna.flavorTags
          .filter((t) => t.active)
          .map((t) => t.tag)
          .slice(0, 5),
        hardNos: prefs?.hardNoFoods?.length ? prefs.hardNoFoods : undefined,
        allTimeNumber1: dna.allTimeNumber1
          ? {
              mealName: dna.allTimeNumber1.mealName,
              count: dna.allTimeNumber1.count,
            }
          : undefined,
        fastestMatchSeconds: dna.fastestMatchSeconds,
        currentStreak: dna.currentStreakDays,
        insights,
      };

      setState({
        status: "ready",
        cardProps: { mode: "solo", userName, data },
      });
    }

    load().catch(() => setState({ status: "not-enough-data" }));
  }, []);

  async function handleShare() {
    if (!cardRef.current) return;
    setSharing(true);
    setShareError(null);

    try {
      // Dynamic import keeps html2canvas out of the server bundle
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#1C1A18",
        scale: 2,
        useCORS: true,
        logging: false,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setShareError("Couldn't share. Try saving the image.");
          setSharing(false);
          return;
        }

        const file = new File([blob], "watcha-flavor-profile.png", {
          type: "image/png",
        });

        // Native share sheet if supported with file sharing
        if (
          typeof navigator.share === "function" &&
          navigator.canShare?.({ files: [file] })
        ) {
          try {
            await navigator.share({
              files: [file],
              title: "My Watcha? Flavor Profile",
            });
            trackEvent(EVENT_FLAVOR_CARD_SHARED, { share_destination: "native_share" });
          } catch (err) {
            // User cancelled — not an error
            if (err instanceof Error && err.name !== "AbortError") {
              setShareError("Couldn't share. Try saving the image.");
            }
          }
        } else {
          // Fallback: download the PNG
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "watcha-flavor-profile.png";
          a.click();
          trackEvent(EVENT_FLAVOR_CARD_SHARED, { share_destination: "copy" });
          URL.revokeObjectURL(url);
        }

        setSharing(false);
      }, "image/png");
    } catch {
      setShareError("Couldn't share. Try saving the image.");
      setSharing(false);
    }
  }

  return (
    <main
      className="min-h-screen pb-12"
      style={{ background: "#1C1A18" }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center px-5 pt-6 pb-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 font-body text-sm"
          style={{ color: "#8A7F78" }}
        >
          ← Back
        </button>
        <h1
          className="ml-4 text-white"
          style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "20px" }}
        >
          Flavor Profile
        </h1>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="px-5">
        {state.status === "loading" && (
          <div className="flex items-center justify-center py-24">
            <div
              className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: "#FFFFFF20", borderTopColor: "#E8621A" }}
            />
          </div>
        )}

        {state.status === "not-enough-data" && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div
              className="text-5xl mb-6"
              style={{ color: "#E8621A" }}
            >
              🔥
            </div>
            <h2
              className="leading-tight mb-3 text-white"
              style={{ fontFamily: "var(--font-quicksand)", fontWeight: 700, fontSize: "26px" }}
            >
              Your Flame is still warming up.
            </h2>
            <p
              className="font-body text-sm leading-relaxed mb-8"
              style={{ color: "#8A7F78", fontWeight: 300 }}
            >
              Make a few more dinner decisions and Watcha will have something
              real to say.
            </p>
            <button
              onClick={() => router.push("/")}
              className="text-sm px-6 py-3.5 rounded-full text-white"
              style={{
                fontFamily: "var(--font-quicksand)",
                fontWeight: 700,
                background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 48%, #B84A12 100%)",
                boxShadow: "0 0 24px rgba(232,98,26,0.35)",
              }}
            >
              Go decide dinner →
            </button>
          </div>
        )}

        {state.status === "ready" && (
          <div className="flex flex-col items-center gap-6">
            {/* Card — captured by html2canvas */}
            <FlameCard ref={cardRef} {...state.cardProps} />

            {/* Share button */}
            <button
              onClick={() => void handleShare()}
              disabled={sharing}
              className="w-full max-w-sm text-sm py-4 rounded-full transition-opacity disabled:opacity-60 text-white"
              style={{
                fontFamily: "var(--font-quicksand)",
                fontWeight: 700,
                background: "linear-gradient(180deg, #FF8A3D 0%, #E8621A 48%, #B84A12 100%)",
                boxShadow: "0 0 24px rgba(232,98,26,0.35)",
              }}
            >
              {sharing ? "Making your card…" : "Share card →"}
            </button>

            {shareError && (
              <p
                className="font-body text-xs text-center"
                style={{ color: "#8A7F78" }}
              >
                {shareError}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
