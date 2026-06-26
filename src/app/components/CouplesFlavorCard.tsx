"use client";

import { useRef, useState } from "react";
import type { CouplesFlavor } from "../lib/couples-flavor-types";
import { COUPLES_TYPES } from "../lib/couples-flavor-types";

interface CouplesFlavorCardProps {
  flavor: CouplesFlavor;
  onShare: () => void;
  onSave: () => void;
  onClose: () => void;
}

/** Dots leader: pads with dots between label and value */
function ReceiptRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 4, width: "100%" }}>
      <span
        style={{
          fontFamily: "var(--font-jetbrains-mono), monospace",
          fontSize: 9,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: "#897E73",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      {/* Dotted leader */}
      <span
        style={{
          flex: 1,
          borderBottom: "1px dotted rgba(137,126,115,0.4)",
          minWidth: 12,
          marginBottom: 3,
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-quicksand), system-ui",
          fontWeight: 700,
          fontSize: 15,
          color: "#F6EEE2",
          whiteSpace: "nowrap",
          flexShrink: 0,
          ...valueStyle,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** Avatar circle with initials fallback */
function CardAvatar({
  name,
  avatarUrl,
  size = 50,
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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: "0 0 12px rgba(216,180,94,0.2)",
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
            fontSize: 14,
            color: "#D8B45E",
            fontWeight: 500,
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}

/** Corner tick — L-shaped gold accent */
function CornerTick({
  corner,
}: {
  corner: "tl" | "tr" | "bl" | "br";
}) {
  const style: React.CSSProperties = {
    position: "absolute",
    width: 14,
    height: 14,
    pointerEvents: "none",
  };
  const borderColor = "rgba(216,180,94,0.7)";
  const t = 1.5;

  if (corner === "tl")
    return (
      <span
        style={{
          ...style,
          top: 9,
          left: 9,
          borderTop: `${t}px solid ${borderColor}`,
          borderLeft: `${t}px solid ${borderColor}`,
        }}
      />
    );
  if (corner === "tr")
    return (
      <span
        style={{
          ...style,
          top: 9,
          right: 9,
          borderTop: `${t}px solid ${borderColor}`,
          borderRight: `${t}px solid ${borderColor}`,
        }}
      />
    );
  if (corner === "bl")
    return (
      <span
        style={{
          ...style,
          bottom: 9,
          left: 9,
          borderBottom: `${t}px solid ${borderColor}`,
          borderLeft: `${t}px solid ${borderColor}`,
        }}
      />
    );
  return (
    <span
      style={{
        ...style,
        bottom: 9,
        right: 9,
        borderBottom: `${t}px solid ${borderColor}`,
        borderRight: `${t}px solid ${borderColor}`,
      }}
    />
  );
}

/** The 390×693 card surface. Exported separately for html2canvas capture. */
export function CouplesFlavorCardSurface({
  flavor,
  cardRef,
}: {
  flavor: CouplesFlavor;
  cardRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const { type, people, totalMatches, topMeal, topCuisine, avgMatchTime } = flavor;
  const typeData = COUPLES_TYPES[type];

  return (
    <div
      ref={cardRef}
      style={{
        width: 390,
        height: 693,
        position: "relative",
        overflow: "hidden",
        borderRadius: 24,
        background: "linear-gradient(180deg, #120C09 0%, #0A0705 60%, #07050B 100%)",
        border: "1px solid rgba(216,180,94,0.28)",
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    >
      {/* Grain */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.06,
          pointerEvents: "none",
          zIndex: 0,
        }}
        aria-hidden="true"
      >
        <filter id="cfc-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#cfc-grain)" />
      </svg>

      {/* Type-tint aura at top */}
      <div
        style={{
          position: "absolute",
          top: -60,
          left: "50%",
          transform: "translateX(-50%)",
          width: 340,
          height: 220,
          borderRadius: "50%",
          background: `radial-gradient(ellipse 70% 60% at 50% 40%, ${typeData.tint}29, transparent 75%)`,
          pointerEvents: "none",
          zIndex: 0,
        }}
        aria-hidden="true"
      />

      {/* Ember glow at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: -30,
          left: "50%",
          transform: "translateX(-50%)",
          width: 280,
          height: 160,
          borderRadius: "50%",
          background: "radial-gradient(ellipse 70% 60% at 50% 60%, rgba(232,98,26,0.10), transparent 75%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
        aria-hidden="true"
      />

      {/* Inner gold frame */}
      <div
        style={{
          position: "absolute",
          inset: 9,
          borderRadius: 16,
          border: "1px solid rgba(216,180,94,0.34)",
          pointerEvents: "none",
          zIndex: 1,
        }}
        aria-hidden="true"
      />

      {/* Corner ticks */}
      <CornerTick corner="tl" />
      <CornerTick corner="tr" />
      <CornerTick corner="bl" />
      <CornerTick corner="br" />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          height: "100%",
          padding: "22px 26px 20px",
        }}
      >
        {/* ── Header row ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            marginBottom: 18,
          }}
        >
          {/* Wordmark */}
          <span
            style={{
              fontFamily: "var(--font-quicksand), system-ui",
              fontWeight: 700,
              fontSize: 16,
              color: "#F6EEE2",
              letterSpacing: "-0.01em",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Watcha
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#E8621A",
                boxShadow: "0 0 6px rgba(232,98,26,0.7)",
              }}
            />
          </span>

          {/* Type marque pill */}
          <span
            style={{
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: 9,
              letterSpacing: "1.8px",
              textTransform: "uppercase",
              color: "#D8B45E",
              border: "1px solid rgba(216,180,94,0.4)",
              borderRadius: 100,
              padding: "4px 9px",
              background: "rgba(216,180,94,0.07)",
            }}
          >
            TYPE {typeData.index} / 06
          </span>
        </div>

        {/* ── Avatars row ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              position: "relative",
            }}
          >
            {/* Avatar A — shifted left */}
            <div style={{ transform: "translateX(16px)", zIndex: 2 }}>
              <CardAvatar name={people[0].name} avatarUrl={people[0].avatarUrl} />
            </div>

            {/* Gold link node */}
            <div
              style={{
                position: "relative",
                zIndex: 3,
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "radial-gradient(circle, #FBE6AE 30%, #D8B45E 100%)",
                boxShadow: "0 0 10px rgba(216,180,94,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              {/* Small flame icon */}
              <span style={{ fontSize: 11, lineHeight: 1 }}>✦</span>
            </div>

            {/* Avatar B — shifted right */}
            <div style={{ transform: "translateX(-16px)", zIndex: 2 }}>
              <CardAvatar name={people[1].name} avatarUrl={people[1].avatarUrl} />
            </div>
          </div>

          {/* Names line */}
          <p
            style={{
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: 9.5,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "#897E73",
              marginTop: 9,
            }}
          >
            {people[0].name} &amp; {people[1].name} · {totalMatches} dinners
          </p>
        </div>

        {/* ── Hero ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            marginBottom: 20,
            width: "100%",
            overflow: "hidden",
          }}
        >
          {/* Glyph */}
          <div
            style={{
              color: "#D8B45E",
              width: 40,
              height: 40,
              filter: "drop-shadow(0 0 6px rgba(216,180,94,0.5))",
              marginBottom: 10,
            }}
            dangerouslySetInnerHTML={{ __html: typeData.glyph }}
            aria-hidden="true"
          />

          {/* Eyebrow */}
          <p
            style={{
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: 8.5,
              letterSpacing: "2.5px",
              textTransform: "uppercase",
              color: "#897E73",
              marginBottom: 8,
            }}
          >
            Couples Flavor Type
          </p>

          {/* Type name */}
          <svg
            width="100%"
            height="60"
            viewBox="0 0 340 60"
            preserveAspectRatio="xMidYMid meet"
            style={{ marginBottom: 8, overflow: "visible" }}
            aria-label={typeData.name}
          >
            <defs>
              <linearGradient id="cfc-name-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FBE6AE" />
                <stop offset="50%" stopColor="#D8B45E" />
                <stop offset="100%" stopColor="#9A6E2A" />
              </linearGradient>
            </defs>
            <text
              x="170"
              y="48"
              textAnchor="middle"
              fill="url(#cfc-name-grad)"
              fontFamily="'Instrument Serif', Georgia, serif"
              fontStyle="italic"
              fontWeight="400"
              fontSize="40"
              letterSpacing="-0.4"
            >
              {typeData.name}
            </text>
          </svg>

          {/* Tagline */}
          <p
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontStyle: "italic",
              fontSize: 16.5,
              fontWeight: 400,
              color: "#F6EEE2",
              lineHeight: 1.35,
            }}
          >
            {typeData.tagline}
          </p>
        </div>

        {/* ── Divider ── */}
        <div
          style={{
            width: "100%",
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(216,180,94,0.4), transparent)",
            marginBottom: 18,
          }}
          aria-hidden="true"
        />

        {/* ── Receipt stats ── */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <ReceiptRow
            label="Your #1 Together"
            value={topMeal || "—"}
            valueStyle={{ color: "#FBE6AE" }}
          />
          <ReceiptRow label="Matches Made" value={String(totalMatches)} />
          <ReceiptRow label="Your Shared Lane" value={topCuisine || "—"} />
          <ReceiptRow label="Decision Speed" value={avgMatchTime || "—"} />
        </div>

        {/* ── Footer ── */}
        <div style={{ textAlign: "center", marginTop: "auto" }}>
          <p
            style={{
              fontFamily: "var(--font-geist-sans), system-ui",
              fontWeight: 500,
              fontSize: 12,
              color: "#C7BDAC",
              lineHeight: 1.5,
            }}
          >
            Find your flavor together on{" "}
            <span
              style={{
                color: "#FBE6AE",
                fontWeight: 700,
              }}
            >
              Watcha
            </span>
          </p>
          <p
            style={{
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: 8,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "rgba(137,126,115,0.6)",
              marginTop: 3,
            }}
          >
            watchawannaeat.com
          </p>
        </div>
      </div>
    </div>
  );
}

/** Full overlay with card + share/download actions */
export default function CouplesFlavorCard({
  flavor,
  onClose,
}: CouplesFlavorCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  async function captureCardPng(): Promise<Blob | null> {
    const el = cardRef.current;
    if (!el) return null;

    try {
      await document.fonts.ready;
      // Dynamic import — never runs server-side, never imported at module level
      const { default: html2canvas } = await import("html2canvas");
      const scale = 1080 / 390; // ≈2.769 → 1080×~1921
      const canvas = await html2canvas(el, {
        scale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false,
        width: 390,
        height: 693,
        windowWidth: 390,
        windowHeight: 693,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
      });
      return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    } catch (err) {
      console.error("[CouplesFlavorCard] html2canvas error:", err);
      return null;
    }
  }

  async function handleShare() {
    setExporting(true);
    try {
      const blob = await captureCardPng();
      if (!blob) return;

      const fileName = "watcha-couples-flavor-type.png";

      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        navigator.canShare?.({ files: [new File([blob], fileName, { type: "image/png" })] })
      ) {
        await navigator.share({
          files: [new File([blob], fileName, { type: "image/png" })],
          title: "Our Couples Flavor Type",
        });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } finally {
      setExporting(false);
    }
  }

  async function handleSave() {
    setExporting(true);
    try {
      const blob = await captureCardPng();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "watcha-couples-flavor-type.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[310] flex flex-col items-center justify-center"
      style={{ background: "rgba(7,5,11,0.95)", backdropFilter: "blur(8px)" }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close couples flavor card"
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "rgba(245,237,224,0.07)",
          border: "1px solid rgba(245,237,224,0.12)",
          color: "rgba(199,189,172,0.7)",
          fontSize: 18,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        ×
      </button>

      {/* Scrollable wrapper so card fits on small screens */}
      <div
        style={{
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          maxHeight: "100dvh",
          paddingTop: 60,
          paddingBottom: 100,
        }}
      >
        {/* Card surface */}
        <div
          style={{
            width: "100%",
            maxWidth: 390,
            display: "flex",
            justifyContent: "center",
            paddingLeft: 16,
            paddingRight: 16,
          }}
        >
          <CouplesFlavorCardSurface flavor={flavor} cardRef={cardRef} />
        </div>
      </div>

      {/* Action buttons — fixed at bottom */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 24px",
          paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
          background:
            "linear-gradient(to top, rgba(7,5,11,0.98) 60%, transparent)",
          display: "flex",
          gap: 12,
        }}
      >
        {/* Share */}
        <button
          onClick={handleShare}
          disabled={exporting}
          style={{
            flex: 1,
            minHeight: 52,
            borderRadius: 100,
            background: "linear-gradient(135deg, #FBE6AE 0%, #D8B45E 50%, #9A6E2A 100%)",
            color: "#0B0805",
            fontFamily: "var(--font-quicksand), system-ui",
            fontWeight: 700,
            fontSize: 15,
            border: "none",
            cursor: exporting ? "default" : "pointer",
            opacity: exporting ? 0.6 : 1,
            boxShadow: "0 0 20px rgba(216,180,94,0.3)",
          }}
        >
          {exporting ? "Exporting…" : "Share"}
        </button>

        {/* Download card */}
        <button
          onClick={handleSave}
          disabled={exporting}
          style={{
            flex: 1,
            minHeight: 52,
            borderRadius: 100,
            background: "rgba(245,237,224,0.07)",
            border: "1px solid rgba(245,237,224,0.15)",
            color: "#F6EEE2",
            fontFamily: "var(--font-quicksand), system-ui",
            fontWeight: 700,
            fontSize: 15,
            cursor: exporting ? "default" : "pointer",
            opacity: exporting ? 0.6 : 1,
          }}
        >
          Download card
        </button>
      </div>
    </div>
  );
}
