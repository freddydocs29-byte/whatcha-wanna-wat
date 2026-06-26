"use client";

import { useEffect, useRef, useState } from "react";
import type { CouplesFlavor } from "../lib/couples-flavor-types";
import { COUPLES_TYPES } from "../lib/couples-flavor-types";

interface CouplesTypeRevealProps {
  flavor: CouplesFlavor;
  onDismiss: () => void;
  onViewCard: () => void;
}

/** Render an avatar circle. Falls back to initials on image error. */
function AvatarCircle({
  name,
  avatarUrl,
  size = 68,
}: {
  name: string;
  avatarUrl: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        border: "1.5px solid rgba(216,180,94,0.5)",
        background: "linear-gradient(135deg,#1E1610,#2A1E14)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 18px rgba(216,180,94,0.18)",
      }}
    >
      {!failed && avatarUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={avatarUrl}
          alt={name}
          crossOrigin="anonymous"
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span
          style={{
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontSize: 20,
            color: "#D8B45E",
            fontWeight: 500,
            letterSpacing: "0.05em",
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}

export default function CouplesTypeReveal({
  flavor,
  onDismiss,
  onViewCard,
}: CouplesTypeRevealProps) {
  const { type, people, totalMatches } = flavor;
  const typeData = COUPLES_TYPES[type];

  // Last-resort guards — source and parser should already normalize these,
  // but defend against any future call path that passes bad data.
  const person0Name = people?.[0]?.name ?? "You";
  const person0Avatar = people?.[0]?.avatarUrl ?? "";
  const person1Name = people?.[1]?.name ?? "Partner";
  const person1Avatar = people?.[1]?.avatarUrl ?? "";

  const modalRef = useRef<HTMLDivElement>(null);
  const announceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;

    const reduced =
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;

    if (reduced) {
      el.classList.add("ctr-go", "ctr-done");
      return;
    }

    // Trigger animation chain synchronously (setTimeout avoids rAF pause in backgrounded views)
    const t1 = setTimeout(() => el.classList.add("ctr-go"), 100);
    // Haptic at the type strike (1.5s)
    const t2 = setTimeout(() => {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([6, 30, 10]);
      }
    }, 1500);
    // Lock end-state so modal is never left mid-reveal
    const t3 = setTimeout(() => el.classList.add("ctr-done"), 2750);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Aria live announcement fires once after the name is visible (~1.5s)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (announceRef.current) {
        announceRef.current.textContent = `Your couples flavor type: ${typeData.name} — ${typeData.tagline}`;
      }
    }, 1600);
    return () => clearTimeout(timer);
  }, [typeData.name, typeData.tagline]);

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "rgba(7,5,11,0.92)", backdropFilter: "blur(8px)" }}
    >
      {/* Keyframes + transition CSS */}
      <style>{`
        /* ── Base: all children invisible, positioned at start ── */
        .ctr-avatar-a {
          transform: translateX(-34px);
          opacity: 0;
          transition: transform 0.8s cubic-bezier(0.4,0,0.2,1), opacity 0.5s ease;
          transition-delay: 0.4s;
        }
        .ctr-avatar-b {
          transform: translateX(34px);
          opacity: 0;
          transition: transform 0.8s cubic-bezier(0.4,0,0.2,1), opacity 0.5s ease;
          transition-delay: 0.4s;
        }
        .ctr-thread {
          opacity: 0;
          transform: scaleX(0.3);
          transition: opacity 0.5s ease, transform 0.6s ease;
          transition-delay: 0.5s;
        }
        .ctr-node {
          opacity: 0;
          transform: scale(0);
          transition: opacity 0.3s ease, transform 0.45s cubic-bezier(0.34,1.56,0.64,1);
          transition-delay: 0.9s;
        }
        .ctr-names {
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 0.45s ease, transform 0.45s ease;
          transition-delay: 0.5s;
        }
        .ctr-setup {
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 0.5s ease, transform 0.5s ease;
          transition-delay: 0.95s;
        }
        .ctr-aura {
          opacity: 0;
          transition: opacity 1s ease;
          transition-delay: 1.5s;
        }
        .ctr-reveal {
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.55s ease, transform 0.55s ease;
          transition-delay: 1.5s;
        }
        .ctr-ctas {
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 0.45s ease, transform 0.45s ease;
          transition-delay: 1.95s;
        }

        /* ── .ctr-go — fire all transitions ── */
        .ctr-go .ctr-avatar-a { transform: translateX(-20px); opacity: 1; }
        .ctr-go .ctr-avatar-b { transform: translateX(20px);  opacity: 1; }
        .ctr-go .ctr-thread   { opacity: 1; transform: scaleX(1); }
        .ctr-go .ctr-node     { opacity: 1; transform: scale(1); }
        .ctr-go .ctr-names    { opacity: 1; transform: translateY(0); }
        .ctr-go .ctr-setup    { opacity: 1; transform: translateY(0); }
        .ctr-go .ctr-aura     { opacity: 0.55; }
        .ctr-go .ctr-reveal   { opacity: 1; transform: translateY(0); }
        .ctr-go .ctr-ctas     { opacity: 1; transform: translateY(0); }

        /* ── .ctr-done — lock end-state, strip transitions ── */
        .ctr-done .ctr-avatar-a,
        .ctr-done .ctr-avatar-b,
        .ctr-done .ctr-thread,
        .ctr-done .ctr-node,
        .ctr-done .ctr-names,
        .ctr-done .ctr-setup,
        .ctr-done .ctr-aura,
        .ctr-done .ctr-reveal,
        .ctr-done .ctr-ctas { transition: none; }
        .ctr-done .ctr-avatar-a { transform: translateX(-20px); opacity: 1; }
        .ctr-done .ctr-avatar-b { transform: translateX(20px);  opacity: 1; }
        .ctr-done .ctr-thread   { opacity: 1; transform: scaleX(1); }
        .ctr-done .ctr-node     { opacity: 1; transform: scale(1); }
        .ctr-done .ctr-names    { opacity: 1; transform: translateY(0); }
        .ctr-done .ctr-setup    { opacity: 1; transform: translateY(0); }
        .ctr-done .ctr-aura     { opacity: 0.55; }
        .ctr-done .ctr-reveal   { opacity: 1; transform: translateY(0); }
        .ctr-done .ctr-ctas     { opacity: 1; transform: translateY(0); }

        /* ── Gold name gradient ── */
        .ctr-name-text {
          background: linear-gradient(135deg, #FBE6AE 0%, #D8B45E 50%, #9A6E2A 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* ── Gold sheen sweep ── */
        .ctr-name-wrap { position: relative; display: inline-block; }
        .ctr-sheen {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .ctr-sheen::after {
          content: '';
          position: absolute;
          top: 0; bottom: 0;
          left: 0; width: 60%;
          background: linear-gradient(105deg, transparent 30%, rgba(251,230,174,0.55) 50%, transparent 70%);
          transform: translateX(-150%);
          animation: none;
        }
        .ctr-go .ctr-sheen::after {
          animation: ctr-sheen-sweep 0.7s ease forwards;
          animation-delay: 1.75s;
        }
        @keyframes ctr-sheen-sweep {
          from { transform: translateX(-150%); }
          to   { transform: translateX(250%); }
        }

        /* ── Reduced motion — everything lit immediately ── */
        @media (prefers-reduced-motion: reduce) {
          .ctr-avatar-a { transform: translateX(-20px) !important; opacity: 1 !important; transition: none !important; }
          .ctr-avatar-b { transform: translateX(20px) !important;  opacity: 1 !important; transition: none !important; }
          .ctr-thread   { opacity: 1 !important; transform: scaleX(1) !important; transition: none !important; }
          .ctr-node     { opacity: 1 !important; transform: scale(1) !important; transition: none !important; }
          .ctr-names    { opacity: 1 !important; transform: translateY(0) !important; transition: none !important; }
          .ctr-setup    { opacity: 1 !important; transform: translateY(0) !important; transition: none !important; }
          .ctr-aura     { opacity: 0.55 !important; transition: none !important; }
          .ctr-reveal   { opacity: 1 !important; transform: translateY(0) !important; transition: none !important; }
          .ctr-ctas     { opacity: 1 !important; transform: translateY(0) !important; transition: none !important; }
          .ctr-go .ctr-sheen::after { animation: none !important; }
        }
      `}</style>

      {/* Grain texture */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: 0.05 }}
        aria-hidden="true"
      >
        <filter id="ctr-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#ctr-grain)" />
      </svg>

      {/* Scrim tap-to-dismiss */}
      <button
        className="absolute inset-0 cursor-default"
        aria-label="Dismiss"
        onClick={onDismiss}
        tabIndex={-1}
      />

      {/* Close button top-right */}
      <button
        onClick={onDismiss}
        aria-label="Close couples flavor type reveal"
        className="absolute top-5 right-5 z-10 flex items-center justify-center"
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "rgba(245,237,224,0.07)",
          border: "1px solid rgba(245,237,224,0.12)",
          color: "rgba(199,189,172,0.7)",
          fontSize: 18,
          cursor: "pointer",
        }}
      >
        ×
      </button>

      {/* Aria live announcer (visually hidden) */}
      <div
        ref={announceRef}
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
        }}
      />

      {/* Modal content */}
      <div
        ref={modalRef}
        className="relative flex flex-col items-center w-full max-w-sm px-8 gap-0"
        style={{ paddingTop: 56 }}
      >

        {/* Aura glow — type-tinted radial, centered at ~33% */}
        <div
          className="ctr-aura absolute pointer-events-none"
          style={{
            top: "0%",
            left: "50%",
            transform: "translate(-50%, -20%)",
            width: 380,
            height: 380,
            borderRadius: "50%",
            background: `radial-gradient(ellipse 70% 60% at 50% 40%, ${typeData.tint}88, transparent 72%)`,
          }}
          aria-hidden="true"
        />

        {/* ── Connected Avatars ── */}
        <div
          className="relative flex items-center justify-center"
          style={{ marginBottom: 14 }}
        >
          {/* Avatar A */}
          <div className="ctr-avatar-a">
            <AvatarCircle name={person0Name} avatarUrl={person0Avatar} />
          </div>

          {/* Gold thread + node */}
          <div
            style={{
              position: "relative",
              width: 40,
              height: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {/* Thread line */}
            <div
              className="ctr-thread absolute"
              style={{
                left: 0,
                right: 0,
                height: 1.5,
                background:
                  "linear-gradient(90deg, rgba(216,180,94,0.3), rgba(251,230,174,0.8), rgba(216,180,94,0.3))",
                transformOrigin: "center",
              }}
            />
            {/* Spark node */}
            <div
              className="ctr-node absolute"
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "radial-gradient(circle, #FBE6AE 30%, #D8B45E 100%)",
                boxShadow: "0 0 8px rgba(216,180,94,0.9), 0 0 18px rgba(216,180,94,0.4)",
              }}
            />
          </div>

          {/* Avatar B */}
          <div className="ctr-avatar-b">
            <AvatarCircle name={person1Name} avatarUrl={person1Avatar} />
          </div>
        </div>

        {/* Names line */}
        <p
          className="ctr-names text-center"
          style={{
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontSize: 10,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            color: "rgba(199,189,172,0.75)",
            marginBottom: 28,
          }}
        >
          {person0Name} &amp; {person1Name}
        </p>

        {/* Setup copy */}
        <div className="ctr-setup text-center" style={{ marginBottom: 32 }}>
          <p
            style={{
              fontFamily: "var(--font-quicksand), system-ui",
              fontWeight: 700,
              fontSize: 22,
              color: "#F6EEE2",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
              marginBottom: 8,
            }}
          >
            You two have a flavor.
          </p>
          <p
            style={{
              fontFamily: "var(--font-geist-sans), system-ui",
              fontWeight: 300,
              fontSize: 14,
              color: "rgba(199,189,172,0.8)",
              lineHeight: 1.5,
            }}
          >
            After {totalMatches} matches, Watcha found your rhythm.
          </p>
        </div>

        {/* ── Type reveal block ── */}
        <div className="ctr-reveal text-center" style={{ marginBottom: 24 }}>

          {/* Eyebrow */}
          <p
            style={{
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: 9,
              letterSpacing: "2.8px",
              textTransform: "uppercase",
              color: "rgba(137,126,115,0.9)",
              marginBottom: 14,
            }}
          >
            Your Couples Flavor Type
          </p>

          {/* Glyph */}
          <div
            style={{
              color: "#D8B45E",
              width: 44,
              height: 44,
              margin: "0 auto 12px",
              filter: "drop-shadow(0 0 8px rgba(216,180,94,0.55))",
            }}
            dangerouslySetInnerHTML={{ __html: typeData.glyph }}
            aria-hidden="true"
          />

          {/* Type name (gold gradient + sheen) */}
          <div className="ctr-name-wrap" style={{ marginBottom: 12 }}>
            <h1
              className="ctr-name-text"
              style={{
                fontFamily: "var(--font-instrument-serif), Georgia, serif",
                fontStyle: "italic",
                fontSize: 50,
                fontWeight: 400,
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
              }}
            >
              {typeData.name}
            </h1>
            {/* Sheen overlay */}
            <span className="ctr-sheen" aria-hidden="true" />
          </div>

          {/* Tagline */}
          <p
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontStyle: "italic",
              fontSize: 19,
              fontWeight: 400,
              color: "#F6EEE2",
              lineHeight: 1.4,
              marginBottom: 12,
            }}
          >
            {typeData.tagline}
          </p>

          {/* Emotional line */}
          <p
            style={{
              fontFamily: "var(--font-geist-sans), system-ui",
              fontWeight: 300,
              fontSize: 13,
              color: "#C7BDAC",
              lineHeight: 1.65,
              maxWidth: "34ch",
              margin: "0 auto",
            }}
          >
            {typeData.emotionalLine}
          </p>
        </div>

        {/* ── CTAs ── */}
        <div
          className="ctr-ctas flex flex-col items-center gap-3 w-full"
          style={{ marginTop: 4, paddingBottom: 32 }}
        >
          {/* Primary — "See our card" */}
          <button
            onClick={onViewCard}
            style={{
              width: "100%",
              minHeight: 52,
              borderRadius: 100,
              background: "linear-gradient(135deg, #FBE6AE 0%, #D8B45E 50%, #9A6E2A 100%)",
              color: "#0B0805",
              fontFamily: "var(--font-quicksand), system-ui",
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "0.01em",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 0 24px rgba(216,180,94,0.35), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            See our card →
          </button>

          {/* Secondary — "Not now" */}
          <button
            onClick={onDismiss}
            style={{
              minHeight: 44,
              padding: "10px 20px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-geist-sans), system-ui",
              fontWeight: 400,
              fontSize: 14,
              color: "rgba(137,126,115,0.85)",
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
