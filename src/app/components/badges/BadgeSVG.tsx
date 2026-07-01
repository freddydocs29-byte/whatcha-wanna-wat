"use client";

import type { ReactNode } from "react";
import type { BadgeId } from "../../lib/badges";
import BadgeFirstTaster from "./BadgeFirstTaster";
import BadgeFirstBite from "./BadgeFirstBite";
import BadgeTastyBuddy from "./BadgeTastyBuddy";
import BadgeNightOwl from "./BadgeNightOwl";
import BadgeExplorer from "./BadgeExplorer";
import BadgeOnAStreak from "./BadgeOnAStreak";
import BadgeComfortZone from "./BadgeComfortZone";

interface Props {
  badgeId: BadgeId;
  size?: number;
  opacity?: number;
  locked?: boolean;
}

export default function BadgeSVG({
  badgeId,
  size = 64,
  opacity = 1,
  locked,
}: Props) {
  const props = { width: size, height: size };

  let badge: ReactNode = null;

  switch (badgeId) {
    case "first_taster":
      badge = <BadgeFirstTaster {...props} />;
      break;
    case "first_bite":
      badge = <BadgeFirstBite {...props} />;
      break;
    case "tasty_buddy":
      badge = <BadgeTastyBuddy {...props} />;
      break;
    case "night_owl":
      badge = <BadgeNightOwl {...props} />;
      break;
    case "explorer":
      badge = <BadgeExplorer {...props} />;
      break;
    case "on_a_streak":
      badge = <BadgeOnAStreak {...props} />;
      break;
    case "comfort_zone":
      badge = <BadgeComfortZone {...props} />;
      break;
    default:
      badge = null;
  }

  return (
    <div
      style={{
        opacity: locked ? 0.45 : opacity,
        filter: locked ? "grayscale(100%) brightness(0.25)" : "none",
        flexShrink: 0,
        lineHeight: 0,
      }}
    >
      {badge}
    </div>
  );
}
