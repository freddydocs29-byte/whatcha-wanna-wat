/**
 * Feature flags — per-improvement kill switches.
 *
 * Every flag here corresponds to one phase of the recommendation system
 * redesign (branch: shared-mode-v2). Setting a flag to `false` reverts
 * that specific behaviour to the pre-redesign logic without touching any
 * other part of the system.
 *
 * Revert guide:
 *   Phase 1A  TIME_DECAY_PENALTIES        → flat -4/-2.5 history/seen penalties
 *   Phase 1B  BEHAVIORAL_DIMINISHING_RETURNS → raw cumulative tag/category counts
 *   Phase 2   ARCHETYPE_SUPPRESSION       → no archetype gate on Zone 1
 *   Phase 3   THREE_ZONE_DECK             → back to flat rankMeals sort
 *   Phase 4A  AI_ALWAYS_ON               → back to shouldGenerateAI() check
 *   Phase 4B  AI_DIVERSIFIER              → no cuisineGaps sent to AI
 *   Phase 4C  AI_CHALLENGER               → no challenger mode prompt
 *   Phase 6   DECK_OVERLAP_CHECK          → no cross-session overlap penalty
 */
export const FEATURES = {
  /** Phase 1A — time-decay on seen/history penalties */
  TIME_DECAY_PENALTIES: true,

  /** Phase 1B — log₂ diminishing returns on behavioral learning */
  BEHAVIORAL_DIMINISHING_RETURNS: true,

  /** Phase 2 — archetype-level suppression gates Zone 1 */
  ARCHETYPE_SUPPRESSION: true,

  /** Phase 3 — three-zone deck composition replaces flat sort */
  THREE_ZONE_DECK: true,

  /** Phase 4A — AI always generates Zone 3 content */
  AI_ALWAYS_ON: true,

  /** Phase 4B — AI receives cuisine gaps to act as diversifier */
  AI_DIVERSIFIER: true,

  /** Phase 4C — AI challenger mode fires every 3 sessions */
  AI_CHALLENGER: true,

  /** Phase 6 — deck-level overlap penalty vs last session */
  DECK_OVERLAP_CHECK: true,
} as const;
