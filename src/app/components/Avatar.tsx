"use client";
import { useState } from "react";

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// Names that indicate anonymous/guest users — show silhouette, not initials
const ANONYMOUS_NAMES = new Set(["Someone", "Recent", "Guest", "them"]);

interface AvatarProps {
  avatarUrl?: string | null;
  /** Display name — used to derive initials. Anonymous names ("Someone", "Recent", "Guest", "them") show silhouette instead. */
  name?: string | null;
  initialsSize?: number;
  initialsColor?: string;
  silhouetteColor?: string;
  silhouetteSize?: number;
}

/**
 * Renders avatar content as a position:absolute layer that fills its parent.
 * Parent MUST have `position: relative` and `overflow: hidden`.
 *
 * Fallback chain: image → initials (from name) → silhouette.
 * Broken image URLs trigger onError and fall through to the same chain.
 */
export default function Avatar({
  avatarUrl,
  name,
  initialsSize = 17,
  initialsColor = "white",
  silhouetteColor = "#4A3F3A",
  silhouetteSize = 28,
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const showImage = !!(avatarUrl && !imgFailed);
  const initials =
    !showImage && name && !ANONYMOUS_NAMES.has(name.trim())
      ? getInitials(name)
      : null;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl!}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {initials ? (
        <span
          style={{
            fontSize: initialsSize,
            fontWeight: 700,
            color: initialsColor,
            fontFamily: "var(--font-nunito)",
          }}
        >
          {initials}
        </span>
      ) : (
        <svg
          width={silhouetteSize}
          height={silhouetteSize}
          viewBox="0 0 30 30"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="15" cy="10" r="5.5" fill={silhouetteColor} />
          <path
            d="M2 28c0-7.18 5.82-13 13-13s13 5.82 13 13"
            fill={silhouetteColor}
          />
        </svg>
      )}
    </span>
  );
}
