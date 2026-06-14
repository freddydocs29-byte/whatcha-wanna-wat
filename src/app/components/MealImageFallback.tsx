"use client";

import type { CSSProperties } from "react";

const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * Designed fallback rendered whenever a meal image is missing or fails to load.
 * Replaces all ad hoc emoji/icon/grey-box fallbacks with a consistent
 * dark-gradient card with an ember glow and the meal name in cream — feels
 * intentional, not broken.
 *
 * Renders with `position: absolute; inset: 0` so it fills whatever
 * `position: relative` container the meal image normally occupies.
 */
export function MealImageFallback({
  mealName,
  style,
}: {
  mealName: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-label={`Image unavailable for ${mealName}`}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, #0B0805 0%, #1C1A18 100%)",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Ember radial glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(232,98,26,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      {/* Grain overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: GRAIN_SVG,
          opacity: 0.06,
          mixBlendMode: "overlay" as CSSProperties["mixBlendMode"],
          pointerEvents: "none",
        }}
      />
      {/* Meal name */}
      <p
        style={{
          position: "relative",
          zIndex: 1,
          color: "#F6EEE2",
          fontFamily: "var(--font-nunito, 'Quicksand', sans-serif)",
          fontWeight: 700,
          fontSize: 13,
          lineHeight: 1.25,
          textAlign: "center",
          padding: "0 12px",
          maxWidth: "100%",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical" as CSSProperties["WebkitBoxOrient"],
        }}
      >
        {mealName}
      </p>
    </div>
  );
}
