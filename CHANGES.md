# Recommendation System Redesign — Branch `shared-mode-v2`

## Overview

Evolves the meal recommendation engine from "show the highest-scoring meals" to "show meals that fit me, feel fresh, and help me make a decision." All changes are isolated behind feature flags in `feature-flags.ts` — each flag can be toggled to `false` to revert exactly that phase without touching anything else.

---

## Quick Revert Reference

| Flag | Off → reverts to |
|------|-----------------|
| `TIME_DECAY_PENALTIES` | Flat -4 history / -2.5 seen penalties |
| `BEHAVIORAL_DIMINISHING_RETURNS` | Raw cumulative tag/category counts |
| `ARCHETYPE_SUPPRESSION` | No archetype gate on Zone 1 |
| `THREE_ZONE_DECK` | Flat `rankMeals()` sort, legacy `interleaveAI()` |
| `AI_ALWAYS_ON` | Legacy `shouldGenerateAI()` conditional check |
| `AI_DIVERSIFIER` | No `cuisineGaps` sent to AI |
| `AI_CHALLENGER` | No challenger-mode prompt |
| `DECK_OVERLAP_CHECK` | No cross-session overlap penalty |

To revert a single phase: open `src/app/lib/feature-flags.ts`, set the corresponding flag to `false`.

---

## Files Changed

### `src/app/lib/feature-flags.ts` — NEW FILE
**Phase:** All  
**Purpose:** Kill-switch constants for every improvement. One flag per phase.  
**Revert:** Delete this file and remove all `FEATURES.*` checks in the files below (or set all flags to `false`).

```
FEATURES.TIME_DECAY_PENALTIES        Phase 1A
FEATURES.BEHAVIORAL_DIMINISHING_RETURNS Phase 1B
FEATURES.ARCHETYPE_SUPPRESSION       Phase 2
FEATURES.THREE_ZONE_DECK             Phase 3
FEATURES.AI_ALWAYS_ON                Phase 4A
FEATURES.AI_DIVERSIFIER              Phase 4B
FEATURES.AI_CHALLENGER               Phase 4C
FEATURES.DECK_OVERLAP_CHECK          Phase 6
```

---

### `src/app/lib/storage.ts` — MODIFIED
**Phases:** 1A, 1B, 2, 4C

#### New types exported
- `ArchetypeEntry` — `{ cuisine, category, keyTags, chosenAt }`
- `ArchetypeHistory` — `{ entries: ArchetypeEntry[] }`

#### New constants
- `ARCHETYPE_KEY = "wwe_archetype_history"` — localStorage key for archetype history
- `CHALLENGER_KEY = "wwe_challenger_count"` — localStorage key for challenger session counter

#### Modified: `TasteProfile`
Added optional `lastUpdatedAt?: string` field. Written by `updateTasteProfile()`.

#### Modified: `updateTasteProfile()`
Now writes `profile.lastUpdatedAt = new Date().toISOString()` so time-decay functions know when the profile was last updated.

#### New: `getDecayedTasteProfile()`
Read-time time-decay applied to `TasteProfile`:
- Profile updated > 90 days ago → all weights × 0.25
- Profile updated > 30 days ago → all weights × 0.75
- Otherwise → unchanged

Used by `buildDeck()` when `TIME_DECAY_PENALTIES` is on.

#### New: `getRecentlySeenWithWeights()`
Returns `Map<string, number>` (mealId → weight) instead of a flat `Set<string>`:
- Seen < 1 day ago → weight 1.0
- Seen < 7 days ago → weight 0.65
- Seen < 30 days ago → weight 0.25
- Seen ≥ 30 days ago → omitted (effectively 0)

Used by `scoreMeal()` (Phase 1A) and `composeDeck()` (Phase 2).

#### New: `getLastSeenSession()`
Returns `sessions[0] ?? null` — the most recent seen session record.  
Used by `composeDeck()` for the deck-level overlap check (Phase 6).

#### New: `getArchetypeHistory()`, `addToArchetypeHistory(meal, mealCuisine)`, `getOverexposedArchetypes(windowDays?, threshold?)`
Archetype tracking system for Phase 2. An archetype fingerprint is `"cuisine|category|tag1+tag2"`.
- `addToArchetypeHistory` — appends to localStorage, called from `handleChoose()` and `handleMatchConfirm()` in `deck/page.tsx`. Takes `mealCuisine` as a separate param to avoid circular imports with `scoring.ts`.
- `getOverexposedArchetypes(windowDays=7, threshold=2)` — returns `Set<string>` of archetypes seen > threshold times in the window.

#### New: `getChallengerSessionCount()`, `incrementChallengerCount()`, `resetChallengerCount()`
Phase 4C challenger session counter. Counter increments each deck build; resets (to 0) when challenger mode fires.

---

### `src/app/lib/scoring.ts` — MODIFIED
**Phases:** 1A, 1B, 2, 3

#### New type exported: `ScoredMeal`
`{ meal, score, reason, vibeScore, behaviorScore }` — intermediate result used by `composeDeck()`.

#### New export: `getMealArchetype(meal)`
Returns the archetype fingerprint string: `"PrimaryCuisine|category|sortedTag1+sortedTag2"`.  
Used by `composeDeck()` and passed by callers (not computed in storage.ts to avoid circular deps).

#### Modified: `scoreMeal()` — Phase 1A: time-decayed seen penalty
Added optional 16th parameter `recentlySeenWeights?: Map<string, number>`.

- **History penalty** (chosen meals): replaced flat `-4` with timestamp-based decay:
  - `< 1 day → -4.0`, `< 7 days → -3.0`, `< 30 days → -1.5`, `≥ 30 days → 0`
- **Seen penalty** (scrolled-past meals): when `recentlySeenWeights` is provided, uses `weight × -2.5` (decayed). Falls back to flat `-2.5` for callers passing `Set<string>`.

**Revert Phase 1A:** Set `TIME_DECAY_PENALTIES = false`. `buildDeck()` will call `getTasteProfile()` instead of `getDecayedTasteProfile()`, and `scoreMeal()` will receive `recentlySeenWeights = undefined`, triggering the flat-penalty fallback path.

#### Modified: `scoreMeal()` — Phase 1B: log₂ diminishing returns
Replaced raw cumulative tag/category count accumulation with log₂ scaling:
- `LOG_SCALE = 4.4` (≈ log₂(21)) — maps rawCount=20 to ≈ 1.0 contribution
- Per tag: `Math.min(1, Math.log2(rawCount + 1) / LOG_SCALE)`
- Tag total cap: `+3.0` (unchanged), category cap: `+1.5`, dislike floor: `-1.5`

**Revert Phase 1B:** Set `BEHAVIORAL_DIMINISHING_RETURNS = false`. The flag gates the log₂ branch; when off, raw counts are used instead.

#### New export: `scoreAllMeals()`
Scores all meals in a pool and returns `ScoredMeal[]`. Accepts the same parameters as `rankMeals()` plus optional `recentlySeenWeights`. Used by `buildDeck()` (Phase 3 path) and could be used by testing/debugging code.

#### Modified: `rankMeals()`
Now calls `scoreAllMeals()` internally instead of an inline `meals.map(scoreMeal)`. No behavioral change — existing callers (shared-mode, nudge re-ranking) are unaffected.

---

### `src/app/lib/deck-composer.ts` — NEW FILE
**Phases:** 2, 3, 6  
**Purpose:** Three-zone deck composition replacing flat sort + spread.

#### `composeDeck(scoredMeals, options) → RankedMeal[]`
Builds a three-zone deck:

**Zone 1 (positions 0–4)** — 5 high-confidence anchors  
Gates (when `ARCHETYPE_SUPPRESSION` on):
1. Strict: not recently chosen + archetype not overexposed + seen weight < 0.8
2. Relax archetype gate
3. Relax seen gate
4. No gates (score order only)  
Max 2 same-cuisine meals.

**Zone 2 (positions 5–13)** — 9 variety meals  
Greedy fill in score order with cuisine budget: max 2 same-cuisine meals. Falls back to any cuisine if budget leaves gaps.

**Zone 3 (positions 14+)** — Exploration tail  
Remaining scored meals. Replaced/augmented by AI in `enrichDeckWithAI()`.

**Phase 6: Deck overlap check**  
When `DECK_OVERLAP_CHECK` is on: if > 50% of top-10 overlaps with `lastSessionTopTen`, all overlapping meals receive a -1.5 score penalty and composition runs once more (no infinite loop — second pass passes empty `lastSessionTopTen`).

**Band shuffle:** Fisher-Yates shuffle within 1-point score bands, applied independently to Zones 1 and 2.

**Revert Phase 3:** Set `THREE_ZONE_DECK = false`. `buildDeck()` falls back to `rankMeals()` → `bandShuffle` → `spreadByCuisine`.

#### `computeCuisineGaps(composedDeck, scoredPool, zone1Size?, zone2Size?) → string[]`
Returns cuisines present in the full pool but absent from Zones 1+2. Used to populate `cuisineGaps` for the AI diversifier prompt.

---

### `src/app/lib/ai-meals.ts` — MODIFIED
**Phases:** 4B, 4C

#### Modified: `AIMealRequest` interface
Added two optional fields:
- `cuisineGaps?: string[]` — Phase 4B: cuisines underrepresented in Zones 1+2
- `challengerMode?: boolean` — Phase 4C: when true, AI prompt pushes outside comfort zone

#### Modified: `getCacheKey()`
Cache key now includes `cuisineGaps` (sorted) and `challengerMode` so different diversity/challenger contexts produce distinct cache entries.

---

### `src/app/api/generate-meals/route.ts` — MODIFIED
**Phases:** 4B, 4C

#### Modified: `PromptContext` interface
Added:
- `cuisineGaps: string[]`
- `challengerMode: boolean`

#### Modified: `buildPrompt()`
Two new prompt sections:

**Diversifier section** (when `cuisineGaps.length > 0`):  
Instructs the model to include ≥2 meals from underrepresented cuisines.

**Challenger section** (when `challengerMode` is true):  
Instructs the model to deliberately suggest meals outside the user's comfort zone — bold, globally-inspired, unfamiliar combinations.

#### Modified: Route handler
Destructures `cuisineGaps` and `challengerMode` from the request body. Passes them to `promptContext`.

---

### `src/app/deck/page.tsx` — MODIFIED
**Phases:** 1A, 2, 3, 4A, 4B, 4C

#### New imports
- From `storage`: `getDecayedTasteProfile`, `getRecentlySeenWithWeights`, `getLastSeenSession`, `getOverexposedArchetypes`, `addToArchetypeHistory`, `getChallengerSessionCount`, `incrementChallengerCount`, `resetChallengerCount`
- From `scoring`: `scoreAllMeals`, `MEAL_CUISINES`
- New: `composeDeck` from `./lib/deck-composer`
- New: `FEATURES` from `./lib/feature-flags`

#### Modified: `buildDeck()`
When `THREE_ZONE_DECK` is on:
1. Calls `getRecentlySeenWithWeights()` instead of `getRecentlySeenIds()`
2. Uses `getDecayedTasteProfile()` when `TIME_DECAY_PENALTIES` is on
3. Scores pool via `scoreAllMeals()` (with `recentlySeenWeights`)
4. Calls `composeDeck()` with archetype gate options and last-session data

When `THREE_ZONE_DECK` is off: identical to pre-redesign behavior (legacy `rankMeals()` path).

#### New refs
- `cuisineGapsRef` — persists cuisine gaps between the deck-build effect and `injectAIForSwipeFatigue()`
- `challengerModeRef` — persists challenger flag between deck-build effect and swipe-fatigue injection

#### Modified: `enrichDeckWithAI()`
New signature: `(baseStaticDeck, activePantryIngredients, cuisineGaps?, challengerMode?)`

- Passes `cuisineGaps` and `challengerMode` to `fetchAIMeals()` (guarded by `AI_DIVERSIFIER` / `AI_CHALLENGER` flags)
- When `THREE_ZONE_DECK` is on: AI meals fill Zone 3 (positions 14+). Zones 1+2 (0–13) are left untouched.
- When `THREE_ZONE_DECK` is off: legacy `interleaveAI()` behavior (positions 2, 5, 9, 13, 17).

#### Modified: deck-build `useEffect`
When `AI_ALWAYS_ON` is on:
- Always calls `enrichDeckWithAI()` (deduped by context key)
- Computes cuisine gaps from Zones 1+2 vs eligible pool
- Checks challenger session count; fires challenger mode every 3 sessions

When `AI_ALWAYS_ON` is off: legacy `shouldGenerateAI()` conditional path (unchanged).

#### Modified: `handleChoose()` (solo path)
Calls `addToArchetypeHistory(chosenMeal, cuisine)` after `updateTasteProfile()`.

#### Modified: `handleMatchConfirm()` (shared path)
Calls `addToArchetypeHistory(matchedMeal, cuisine)` after `addToHistory()`.

#### Modified: `injectAIForSwipeFatigue()`
Passes `cuisineGapsRef.current` and `challengerModeRef.current` to `fetchAIMeals()`.

---

## What Was NOT Changed

- `src/app/lib/deck.ts` (shared-mode server deck builder) — shared sessions still use the pre-redesign `rankMealsForSharedSession()` path. Zone composition for shared mode is a future phase.
- `src/app/lib/ai-freshness.ts` — `shouldGenerateAI()` still used as legacy path when `AI_ALWAYS_ON = false`.
- `src/app/lib/supabase-profile.ts` — cloud sync unchanged.
- `src/app/lib/session-signals.ts` — nudge/progressive onboarding logic unchanged.
- All UI components — no visual changes from this redesign.
