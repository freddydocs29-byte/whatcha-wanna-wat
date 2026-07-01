export type BadgeId =
  | "first_taster"
  | "first_bite"
  | "tasty_buddy"
  | "night_owl"
  | "explorer"
  | "on_a_streak"
  | "comfort_zone";

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  description: string;       // shown on discovery page
  revealCopy: string;        // shown on unlock reveal screen
  criteria: string;          // plain English, shown under locked badge
  shape: "hexagon" | "circle" | "shield" | "square" | "diamond" | "rotated_square" | "large_hexagon";
  color: {
    primary: string;         // main badge color
    highlight: string;       // shine/top color
    shadow: string;          // depth/shadow color
    icon: string;            // emoji or symbol
  };
  computeProgress: null;     // placeholder — computation logic lives in badge-engine.ts
}

export const BADGES: Record<BadgeId, BadgeDefinition> = {
  first_taster: {
    id: "first_taster",
    name: "First Taster",
    description: "You were here before it was a thing.",
    revealCopy: "You're one of the first people helping shape Watcha. That means something.",
    criteria: "Part of the founding cohort",
    shape: "hexagon",
    color: { primary: "#D8A82E", highlight: "#FFD86E", shadow: "#8A5E0A", icon: "★" },
    computeProgress: null,
  },
  first_bite: {
    id: "first_bite",
    name: "First Bite",
    description: "You made your first decision together.",
    revealCopy: "One shared session, one match, zero back-and-forth. That's what this is for.",
    criteria: "Complete your first shared session match",
    shape: "circle",
    color: { primary: "#E8621A", highlight: "#FF9F6B", shadow: "#7A2C00", icon: "🍽" },
    computeProgress: null,
  },
  tasty_buddy: {
    id: "tasty_buddy",
    name: "Tasty Buddy",
    description: "10 dinners decided. That's a real thing.",
    revealCopy: "You and your partner matched on 10 meals together. Dinner is handled.",
    criteria: "Match on 10 meals with one person",
    shape: "square",
    color: { primary: "#3D7A4E", highlight: "#6BA87A", shadow: "#1A4028", icon: "🤝" },
    computeProgress: null,
  },
  night_owl: {
    id: "night_owl",
    name: "Night Owl",
    description: "Some decisions can't wait until morning.",
    revealCopy: "Late night, quick answer. Watcha doesn't sleep either.",
    criteria: "Make a match after 9pm",
    shape: "shield",
    color: { primary: "#5B4FA8", highlight: "#8B7FD4", shadow: "#2A1F6E", icon: "🌙" },
    computeProgress: null,
  },
  explorer: {
    id: "explorer",
    name: "Explorer",
    description: "You don't eat the same things twice. Well, mostly.",
    revealCopy: "Five different cuisines matched. Your palate goes places.",
    criteria: "Match on 5 different cuisines",
    shape: "diamond",
    color: { primary: "#C07020", highlight: "#E8A44A", shadow: "#6A3500", icon: "🧭" },
    computeProgress: null,
  },
  on_a_streak: {
    id: "on_a_streak",
    name: "On a Streak",
    description: "Three nights, three answers. No back-and-forth.",
    revealCopy: "Three days in a row. Watcha is officially part of the routine.",
    criteria: "Use Watcha 3 days in a row",
    shape: "rotated_square",
    color: { primary: "#B02020", highlight: "#E85050", shadow: "#5A0A0A", icon: "🔥" },
    computeProgress: null,
  },
  comfort_zone: {
    id: "comfort_zone",
    name: "Comfort Zone",
    description: "You found your thing. Own it.",
    revealCopy: "Same cuisine, five times. No shame — you know what works.",
    criteria: "Match the same cuisine 5 times",
    shape: "large_hexagon",
    color: { primary: "#3A80A8", highlight: "#7AB8D4", shadow: "#0A3A5A", icon: "🔁" },
    computeProgress: null,
  },
};

export interface BadgeProgress {
  badgeId: BadgeId;
  earned: boolean;
  earnedAt?: string;         // ISO date string
  progress?: number;         // 0–1 for locked badges with countable progress
  progressLabel?: string;    // e.g. "4 / 10 matches"
}

export const BADGE_ORDER: BadgeId[] = [
  "first_taster",
  "first_bite",
  "tasty_buddy",
  "night_owl",
  "explorer",
  "on_a_streak",
  "comfort_zone",
];
