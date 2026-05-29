import type { BaseFlavorType } from "./flavor-type";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CompatibilityPairing = {
  name: string;
  description: string;
};

// ── Key generation ────────────────────────────────────────────────────────────

function pairingKey(a: BaseFlavorType, b: BaseFlavorType): string {
  return [a, b].sort().join("_");
}

// ── Pairing table ─────────────────────────────────────────────────────────────
// 36 unique pairings: 8 same-type + 28 cross-type.
// Keys are always sorted so argument order does not matter.

const PAIRINGS: Record<string, CompatibilityPairing> = {
  // ── anchor (8) ────────────────────────────────────────────────────────────

  [pairingKey("anchor", "anchor")]: {
    name: "The Comfortable Rut",
    description:
      "You always know what you're getting. Whether that's good depends on the night.",
  },
  [pairingKey("anchor", "explorer")]: {
    name: "The Perfect Push",
    description:
      "One of you wants comfort. The other won't let it happen. You always end up somewhere new.",
  },
  [pairingKey("anchor", "creature_of_habit")]: {
    name: "The Loyal Duo",
    description:
      "Two people who found their thing and stuck with it. Respect.",
  },
  [pairingKey("anchor", "comfort_seeker")]: {
    name: "The Safe House",
    description: "Nobody's suggesting sushi tonight. And that's fine.",
  },
  [pairingKey("anchor", "night_owl")]: {
    name: "The Late Night Regular",
    description: "Same spot, same time, same order. You've earned it.",
  },
  [pairingKey("anchor", "diplomat")]: {
    name: "The Steady Hand",
    description: "One of you has opinions. The other makes it work.",
  },
  [pairingKey("anchor", "wildcard")]: {
    name: "The Chaos Anchor",
    description: "You keep things grounded. They keep things interesting.",
  },
  [pairingKey("anchor", "purist")]: {
    name: "The Unbreakable Standard",
    description:
      "Between your hard NOs and their loyalty, the menu writes itself.",
  },

  // ── explorer (7) ──────────────────────────────────────────────────────────

  [pairingKey("explorer", "explorer")]: {
    name: "The Restless Duo",
    description: "You've never ordered the same thing twice. Combined.",
  },
  [pairingKey("explorer", "creature_of_habit")]: {
    name: "The Push and Pull",
    description:
      "One of you wants adventure. The other wants the usual. You negotiate every time.",
  },
  [pairingKey("explorer", "comfort_seeker")]: {
    name: "The Gentle Stretch",
    description:
      "They bring the comfort. You bring the curiosity. Usually works.",
  },
  [pairingKey("explorer", "night_owl")]: {
    name: "The Late Night Experiment",
    description:
      "You both end up somewhere unexpected at midnight. On purpose.",
  },
  [pairingKey("explorer", "diplomat")]: {
    name: "The Discovery Team",
    description: "One finds it. The other makes everyone agree to it.",
  },
  [pairingKey("explorer", "wildcard")]: {
    name: "The Beautiful Chaos",
    description: "Nobody knows what's happening. It works out somehow.",
  },
  [pairingKey("explorer", "purist")]: {
    name: "The Negotiation",
    description:
      "Your adventure score meets their hard NOs. Compromise is the menu.",
  },

  // ── creature_of_habit (6) ─────────────────────────────────────────────────

  [pairingKey("creature_of_habit", "creature_of_habit")]: {
    name: "The Ritual Keepers",
    description:
      "Tuesday means tacos. Friday means that one place. It's not a rut. It's culture.",
  },
  [pairingKey("creature_of_habit", "comfort_seeker")]: {
    name: "The Cozy Corner",
    description: "You've found your spot. You stay there. Zero regrets.",
  },
  [pairingKey("creature_of_habit", "night_owl")]: {
    name: "The Midnight Ritual",
    description:
      "Late night, same place, every time. Some people call it a problem. You call it a system.",
  },
  [pairingKey("creature_of_habit", "diplomat")]: {
    name: "The Reliable Machine",
    description:
      "One picks the usual. The other makes sure everyone's happy with it. Efficient.",
  },
  [pairingKey("creature_of_habit", "wildcard")]: {
    name: "The Anchor and the Storm",
    description:
      "One of you has a system. The other blows it up occasionally. It balances out.",
  },
  [pairingKey("creature_of_habit", "purist")]: {
    name: "The Deeply Specific",
    description:
      "Combined you have eliminated 40% of all restaurants. The remaining ones are perfect.",
  },

  // ── comfort_seeker (5) ────────────────────────────────────────────────────

  [pairingKey("comfort_seeker", "comfort_seeker")]: {
    name: "The Rut Risk",
    description:
      "You will be eating pasta on a Tuesday in six months. You already know this.",
  },
  [pairingKey("comfort_seeker", "night_owl")]: {
    name: "The Midnight Comfort",
    description: "Late night comfort food every time. Your bodies have accepted this.",
  },
  [pairingKey("comfort_seeker", "diplomat")]: {
    name: "The Easy Agreement",
    description:
      "One wants comfort. The other just wants everyone to be happy. Done in 47 seconds.",
  },
  [pairingKey("comfort_seeker", "wildcard")]: {
    name: "The Surprising Soft Landing",
    description:
      "They throw something unexpected. You somehow make it feel like home.",
  },
  [pairingKey("comfort_seeker", "purist")]: {
    name: "The Vetted Comfort Zone",
    description:
      "Only comfort food that passes inspection. The list is short. It is perfect.",
  },

  // ── night_owl (4) ─────────────────────────────────────────────────────────

  [pairingKey("night_owl", "night_owl")]: {
    name: "The 11pm Regulars",
    description:
      "You don't eat dinner. You eat a very late second lunch. Together.",
  },
  [pairingKey("night_owl", "diplomat")]: {
    name: "The Late Night Consensus",
    description:
      "One of you is hungry at midnight. The other finds something everyone agrees on.",
  },
  [pairingKey("night_owl", "wildcard")]: {
    name: "The Midnight Experiment",
    description:
      "Late, hungry, no plan. This is either great or a story you tell later.",
  },
  [pairingKey("night_owl", "purist")]: {
    name: "The Specific Midnight Craving",
    description: "Late night but only the right thing. The search is real.",
  },

  // ── diplomat (3) ──────────────────────────────────────────────────────────

  [pairingKey("diplomat", "diplomat")]: {
    name: "The Endless Consensus",
    description:
      "You both just want everyone to be happy. Someone has to actually pick something.",
  },
  [pairingKey("diplomat", "purist")]: {
    name: "The Guided Elimination",
    description:
      "One rules out half the options. The other makes the remaining half work for everyone.",
  },
  [pairingKey("diplomat", "wildcard")]: {
    name: "The Managed Surprise",
    description:
      "One brings chaos. The other makes it work for everyone. Somehow.",
  },

  // ── purist (2) ────────────────────────────────────────────────────────────

  [pairingKey("purist", "purist")]: {
    name: "The Vetocracy",
    description:
      "Combined you have said no to everything. Finding the one thing you both allow is a sport.",
  },
  [pairingKey("purist", "wildcard")]: {
    name: "The Impossible Brief",
    description:
      "One of you wants anything. The other will veto most of it. Somehow you always eat.",
  },

  // ── wildcard (1) ──────────────────────────────────────────────────────────

  [pairingKey("wildcard", "wildcard")]: {
    name: "The Complete Mystery",
    description: "Nobody knows what's happening. You both love it.",
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export function getCompatibilityPairing(
  typeA: BaseFlavorType,
  typeB: BaseFlavorType
): CompatibilityPairing | null {
  return PAIRINGS[pairingKey(typeA, typeB)] ?? null;
}
