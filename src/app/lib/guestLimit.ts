/**
 * Guest retry limit utilities.
 *
 * Soft-launch policy (v2):
 *   A guest gets a total budget of 2 solo decks.
 *   Deck 1 is granted via "Start your own pick" on guest-home.
 *   One reset from any surface (end-of-deck CTAs, vibe-select "Build my deck",
 *   or /locked's "Changed your mind?") grants deck 2.
 *   Any further request is blocked and shows GuestLimitPrompt.
 *
 *   Invited shared sessions are never gated — only solo deck starts are tracked.
 *
 * Keys are intentionally excluded from clearAllLocalState() so they
 * persist across sign-in/sign-out cycles on the same device.
 */

const ATTEMPTS_KEY = "wwe_guest_decision_attempts";
const RETRY_KEY = "wwe_guest_retry_used";
const GUEST_DECK_ENTRY_GRANT_KEY = "wwe_guest_deck_entry_granted";

export const GUEST_DECK_BUDGET = 2;

/** Number of solo deck starts this guest has initiated. */
export function getGuestAttempts(): number {
  if (typeof window === "undefined") return 0;
  const val = parseInt(localStorage.getItem(ATTEMPTS_KEY) ?? "0", 10);
  console.log('[guest-limit-v2] action:', 'read', 'value:', val, 'location:', 'getGuestAttempts');
  return val;
}

/** Record one more solo deck start. */
export function incrementGuestAttempts(): void {
  if (typeof window === "undefined") return;
  const next = getGuestAttempts() + 1;
  localStorage.setItem(ATTEMPTS_KEY, String(next));
  console.log('[guest-limit-v2] action:', 'increment', 'value:', next, 'location:', 'incrementGuestAttempts');
}

/** Whether the guest has already used their one "Changed your mind?" retry. */
export function isGuestRetryUsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(RETRY_KEY) === "true";
}

/** Consume the retry — call once when the guest confirms "Changed your mind?". */
export function markGuestRetryUsed(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RETRY_KEY, "true");
}

/**
 * Returns true when a guest tries to use "Changed your mind?" but has
 * already spent their one retry.
 *
 * Use this gate inside the locked-page handler.
 */
export function guestRetryExhausted(): boolean {
  return isGuestRetryUsed();
}

/**
 * Returns true when a guest tries to start a brand-new solo deck
 * (splash or guest-home) but has already had their deck + retry.
 *
 * We only block when they have BOTH spent their retry AND already
 * started at least one solo deck — this way a guest who joined a
 * shared session but hasn't touched a solo deck yet can still begin one.
 */
export function guestSoloDeckExhausted(): boolean {
  return isGuestRetryUsed() && getGuestAttempts() >= 1;
}

// ── Budget-based API (v2) ─────────────────────────────────────────────────────

/** Returns true when the guest has used up their 2-deck budget. */
export function guestDeckBudgetExhausted(): boolean {
  return getGuestAttempts() >= GUEST_DECK_BUDGET;
}

/**
 * Stamps a one-time entry grant so the /deck mount gate knows the
 * navigation was authorised by a budget-consuming action.
 */
export function grantGuestDeckEntry(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_DECK_ENTRY_GRANT_KEY, "true");
}

/**
 * Reads and clears the entry grant in one step.
 * Returns true if the grant was present (and has now been consumed).
 */
export function consumeGuestDeckEntryGrant(): boolean {
  if (typeof window === "undefined") return false;
  const granted = window.localStorage.getItem(GUEST_DECK_ENTRY_GRANT_KEY) === "true";
  if (granted) {
    window.localStorage.removeItem(GUEST_DECK_ENTRY_GRANT_KEY);
  }
  return granted;
}

/**
 * Tries to consume one unit of the guest deck budget.
 * Returns true and increments the counter + writes an entry grant if allowed.
 * Returns false (counter untouched, no grant) if the budget is already exhausted.
 */
export function tryConsumeGuestDeckBudget(): boolean {
  if (getGuestAttempts() >= GUEST_DECK_BUDGET) return false;
  incrementGuestAttempts();
  grantGuestDeckEntry();
  return true;
}
