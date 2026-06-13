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
  return val;
}

/** Record one more solo deck start. */
export function incrementGuestAttempts(): void {
  if (typeof window === "undefined") return;
  const next = getGuestAttempts() + 1;
  localStorage.setItem(ATTEMPTS_KEY, String(next));
}

/**
 * @deprecated v1 API — wwe_guest_retry_used is never written in the v2 budget
 * flow, so this always returns false. Kept exported for reference only.
 */
export function isGuestRetryUsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(RETRY_KEY) === "true";
}

/**
 * @deprecated v1 API — never called in the v2 budget flow.
 * Kept exported for reference only.
 */
export function markGuestRetryUsed(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RETRY_KEY, "true");
}

/**
 * @deprecated v1 API — delegates to isGuestRetryUsed() which is always false
 * in the v2 budget flow. Kept exported for reference only.
 */
export function guestRetryExhausted(): boolean {
  return isGuestRetryUsed();
}

/**
 * @deprecated v1 API — depends on wwe_guest_retry_used which is never written
 * in the v2 budget flow, making this permanently return false.
 * Use guestDeckBudgetExhausted() instead. Kept exported for reference only.
 */
export function guestSoloDeckExhausted(): boolean {
  return isGuestRetryUsed() && getGuestAttempts() >= 1;
}

// ── Budget-based API (v2) ─────────────────────────────────────────────────────

/** Returns true when the guest has used up their 2-deck budget. */
export function guestDeckBudgetExhausted(): boolean {
  return getGuestAttempts() >= GUEST_DECK_BUDGET;
}

/** Grants are valid for this many ms after being written.
 *  Legitimate use (tryConsumeGuestDeckBudget → /deck navigation → mount) is
 *  sub-second. Anything older is an orphan left by a hard-close. */
const GRANT_TTL_MS = 60_000; // 60 seconds

/**
 * Stamps a one-time entry grant so the /deck mount gate knows the
 * navigation was authorised by a budget-consuming action.
 * Written as a timestamped JSON object so orphaned grants (left by a
 * hard-close before the deck mounted) can be rejected on reopen.
 */
export function grantGuestDeckEntry(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    GUEST_DECK_ENTRY_GRANT_KEY,
    JSON.stringify({ granted: true, grantedAt: Date.now() }),
  );
}

/**
 * Reads and clears the entry grant in one step.
 * Returns true only if the grant is present, well-formed, and less than
 * GRANT_TTL_MS old — rejecting both orphaned grants and the legacy bare
 * "true" string that old clients may have written.
 */
export function consumeGuestDeckEntryGrant(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(GUEST_DECK_ENTRY_GRANT_KEY);
  if (!raw) return false;
  try {
    const grant = JSON.parse(raw);
    // Always remove whatever was stored.
    window.localStorage.removeItem(GUEST_DECK_ENTRY_GRANT_KEY);
    // Reject legacy "true" grants and any other malformed shapes.
    if (
      !grant ||
      typeof grant !== "object" ||
      grant.granted !== true ||
      typeof grant.grantedAt !== "number"
    ) {
      return false;
    }
    const age = Date.now() - grant.grantedAt;
    return age >= 0 && age < GRANT_TTL_MS;
  } catch {
    window.localStorage.removeItem(GUEST_DECK_ENTRY_GRANT_KEY);
    return false;
  }
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
