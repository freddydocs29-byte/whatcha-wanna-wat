// src/app/lib/analytics-events.ts
// Canonical event name constants for Watcha analytics
// All new trackEvent() calls must reference these — never hardcode strings

// Tier 1 — Core funnel / North Star metrics
export const EVENT_SESSION_STARTED = "session_started";
export const EVENT_DECK_STARTED = "deck_started";
export const EVENT_DECK_SWIPE = "deck_swipe";
export const EVENT_MATCH_CREATED = "match_created";
export const EVENT_WATCHAS_CALL_TRIGGERED = "watchas_call_triggered";
export const EVENT_DECISION_LOCKED = "decision_locked";
export const EVENT_LOCKED_RESULT_VIEWED = "locked_result_viewed";
export const EVENT_RETURN_VISIT_DETECTED = "return_visit_detected";
export const EVENT_POST_DECISION_ACTION = "post_decision_action";

// Tier 2 — Friction signals
export const EVENT_ONBOARDING_STEP_VIEWED = "onboarding_step_viewed";
export const EVENT_ONBOARDING_STEP_COMPLETED = "onboarding_step_completed";
export const EVENT_ONBOARDING_ABANDONED = "onboarding_abandoned";
export const EVENT_SHARED_INVITE_CREATED = "shared_invite_created";
export const EVENT_SHARED_INVITE_JOINED = "shared_invite_joined";
export const EVENT_SHARED_SESSION_ABANDONED = "shared_session_abandoned";
export const EVENT_GUEST_LIMIT_REACHED = "guest_limit_reached";
export const EVENT_GUEST_SIGNUP_PROMPTED = "guest_signup_prompted";
export const EVENT_ERROR_SHOWN = "error_shown_to_user";

// Tier 3 — Engagement depth
export const EVENT_MEAL_SAVED = "meal_saved";
export const EVENT_BROWSE_VIEWED = "browse_viewed";
export const EVENT_MEAL_DETAIL_VIEWED = "meal_detail_viewed";
export const EVENT_PROFILE_VIEWED = "profile_viewed";
export const EVENT_FLAVOR_PROFILE_VIEWED = "flavor_profile_viewed";
export const EVENT_FLAVOR_CARD_SHARED = "flavor_card_shared";
export const EVENT_VIBE_SELECTED = "vibe_selected";
export const EVENT_TOP5_VIEWED = "top5_viewed";

// Existing events — documented for reference, call sites not yet migrated
export const EVENT_APP_OPENED = "app_opened";
export const EVENT_SHARED_SESSION_CREATED = "shared_session_created";
export const EVENT_SHARED_SESSION_JOINED = "shared_session_joined";
export const EVENT_SHARED_DECK_STARTED = "shared_deck_started";
export const EVENT_CARD_SEEN = "card_seen";
export const EVENT_CARD_SWIPED_YES = "card_swiped_yes";
export const EVENT_CARD_SWIPED_NO = "card_swiped_no";
export const EVENT_MATCH_FOUND = "match_found";
export const EVENT_MATCH_CONFIRMED = "match_confirmed";
export const EVENT_DECK_FINISHED = "deck_finished";
export const EVENT_DECK_REFRESHED = "deck_refreshed";
export const EVENT_COOK_CLICKED = "cook_clicked";
export const EVENT_ORDER_CLICKED = "order_clicked";
export const EVENT_CHANGE_MIND_CLICKED = "change_mind_clicked";
export const EVENT_DECIDE_WITH_SOMEONE_CLICKED = "decide_with_someone_clicked";

// Sprint 2 additions
export const EVENT_ONBOARDING_COMPLETED = "onboarding_completed";
export const EVENT_GUEST_CONVERTED = "guest_converted";
export const EVENT_MEAL_FAVORITED = "meal_favorited";
export const EVENT_WATCHAS_CALL_ACCEPTED = "watchas_call_accepted";
export const EVENT_WATCHAS_CALL_REJECTED = "watchas_call_rejected";

// Sprint 3 additions — growth and virality
export const EVENT_SHARE_SHEET_OPENED = "share_sheet_opened";
export const EVENT_QR_CODE_DISPLAYED = "qr_code_displayed";
export const EVENT_MATCH_CARD_SHARED = "match_card_shared";

// Sprint 4 additions — flavor and badge reveals
export const EVENT_FLAVOR_TYPE_REVEALED = "flavor_type_revealed";
export const EVENT_COUPLES_FLAVOR_REVEALED = "couples_flavor_revealed";
export const EVENT_BADGE_PAGE_VIEWED = "badge_page_viewed";

// Sprint 5 additions — friction signals
export const EVENT_SESSION_ABANDONED = "session_abandoned";
export const EVENT_SHARED_INVITE_EXPIRED = "shared_invite_expired";
