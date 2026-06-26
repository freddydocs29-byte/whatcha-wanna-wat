/**
 * Couples Flavor Type — static registry.
 * Single source of truth for all 6 types, shared by CouplesTypeReveal and CouplesFlavorCard.
 * Do not add runtime logic here — this module is import-safe on both client and server.
 */

export type CoupleType =
  | "explorer"
  | "anchor"
  | "comfortSeeker"
  | "purist"
  | "creatureOfHabit"
  | "wildcard";

export type Person = { name: string; avatarUrl: string };

export type CouplesFlavor = {
  /** Drives name / tagline / glyph / tint / index */
  type: CoupleType;
  people: [Person, Person];
  totalMatches: number;
  /** "Your #1 together" */
  topMeal: string;
  /** "Your shared lane" */
  topCuisine: string;
  /** "Decision speed" — pre-formatted e.g. "4 min flat" */
  avgMatchTime: string;
  /** Used for idempotency guards — not rendered */
  partnerId?: string;
};

type CouplesTypeEntry = {
  name: string;
  tagline: string;
  /** One-sentence emotional line shown in the reveal modal only */
  emotionalLine: string;
  /** Inline SVG string (viewBox="0 0 40 40"). Render via dangerouslySetInnerHTML. */
  glyph: string;
  /** Subtle aura tint — used only for glow/atmosphere, never text or fills */
  tint: string;
  /** Zero-padded index "01"–"06" for the collectible marque */
  index: string;
};

export const COUPLES_TYPES: Record<CoupleType, CouplesTypeEntry> = {
  explorer: {
    name: "The Explorers",
    tagline: "You two are adventurous together.",
    emotionalLine:
      "You never order the same thing twice. Dinner with you two is a passport — and you both packed light.",
    glyph: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="20" r="14" stroke="currentColor" stroke-width="1.5"/>
  <circle cx="20" cy="20" r="2" fill="currentColor"/>
  <path d="M20 6v4M20 30v4M6 20h4M30 20h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M24 16l-4 2-4 6 4-2 4-6Z" fill="currentColor"/>
</svg>`,
    tint: "#4FA88C",
    index: "01",
  },

  anchor: {
    name: "The Anchors",
    tagline: "You have your places.",
    emotionalLine:
      "You found the spots that feel like yours, and you keep going back. That's not a rut — that's home base.",
    glyph: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="10.5" r="3.5" stroke="currentColor" stroke-width="1.5"/>
  <line x1="20" y1="14" x2="20" y2="32" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M13 19h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M13 32Q13 37 20 37Q27 37 27 32" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
</svg>`,
    tint: "#C77A3A",
    index: "02",
  },

  comfortSeeker: {
    name: "The Comfort Seekers",
    tagline: "You know what works.",
    emotionalLine:
      "No second-guessing, no 9pm spirals. You reach for what feels good and you're almost never wrong.",
    glyph: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 35C13 29 8 22 8 16 8 11 12 7 16.5 8.5 18 9 19 10.5 20 13 21 10.5 22 9 23.5 8.5 28 7 32 11 32 16 32 22 27 29 20 35Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
  <path d="M20 29C17 25 15 21 15 17.5 15 15 17 13 20 13 23 13 25 15 25 17.5 25 21 23 25 20 29Z" fill="currentColor" opacity="0.45"/>
</svg>`,
    tint: "#D8743C",
    index: "03",
  },

  purist: {
    name: "The Purists",
    tagline: "You're particular — and it works.",
    emotionalLine:
      "You don't cast a wide net. You don't have to. When you two agree, you really agree.",
    glyph: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 5L35 20L20 35L5 20Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
  <path d="M20 11.5L28.5 20L20 28.5L11.5 20Z" fill="currentColor" opacity="0.35"/>
</svg>`,
    tint: "#8E7BD8",
    index: "04",
  },

  creatureOfHabit: {
    name: "Creatures of Habit",
    tagline: "You've found your rhythm.",
    emotionalLine:
      "Same order, different night. There's a quiet luxury in knowing exactly what you both want.",
    glyph: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M30 13A13 13 0 1 1 13 30" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
  <path d="M11 24l2 8 8-2Z" fill="currentColor"/>
</svg>`,
    tint: "#C9A24C",
    index: "05",
  },

  wildcard: {
    name: "The Wildcards",
    tagline: "Nobody knows what you two want — including you.",
    emotionalLine:
      "Tuesday it's ramen, Wednesday it's tacos at midnight. Predictable? Never. Boring? Also never.",
    glyph: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M23 5L16 20h10L17 35 31 17H21L23 5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="currentColor" fill-opacity="0.3"/>
</svg>`,
    tint: "#D8567E",
    index: "06",
  },
};

export function getCouplesTypeData(type: CoupleType): CouplesTypeEntry {
  return COUPLES_TYPES[type];
}

/**
 * Converts a BaseFlavorType string (snake_case from getFlavorType()) to the
 * camelCase CoupleType used by COUPLES_TYPES. Returns null for solo-only types
 * (night_owl, diplomat) that have no couples equivalent.
 */
export function baseTypeToCoupleType(baseType: string): CoupleType | null {
  const map: Record<string, CoupleType> = {
    explorer: "explorer",
    anchor: "anchor",
    comfort_seeker: "comfortSeeker",
    purist: "purist",
    creature_of_habit: "creatureOfHabit",
    wildcard: "wildcard",
    // camelCase pass-through (safety net for any path that pre-converts)
    comfortSeeker: "comfortSeeker",
    creatureOfHabit: "creatureOfHabit",
  };
  return map[baseType] ?? null;
}
