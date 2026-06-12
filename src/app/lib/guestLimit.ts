/**
 * Guest retry limit utilities.
 *
 * Soft-launch policy:
 *   1. Guest may start their first solo deck.
 *   2. Guest may lock a meal.
 *   3. Guest gets one "Changed your mind?" retry.
 *   After that, they are prompted to create an account.
 *
 * Invited shared sessions are never gated — only solo deck starts
 * and the changed-your-mind retry action are tracked.
 *
 * Keys are intentionally excluded from clearAllLocalState() so they
 * persist across sign-in/sign-out cycles on the same device.
 */

const ATTEMPTS_KEY = "wwe_guest_decision_attempts";
const RETRY_KEY = "wwe_guest_retry_used";

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
