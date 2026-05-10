import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
    !supabaseAnonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]
    .filter(Boolean)
    .join(", ");
  throw new Error(
    `[supabase] Missing env var(s): ${missing}. ` +
      `In Vercel → Settings → Environment Variables, make sure both vars are enabled ` +
      `for Production, Preview, AND Development, then trigger a new deployment.`,
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Session = {
  id: string;
  host_user_id: string;
  guest_user_id: string | null;
  status: "waiting" | "active" | "matched";
  locked_meal_id: string | null;
  deck_meal_ids: string[] | null;
  vibe: string | null;
  cooking_intent: "cooking" | "ordering" | "either" | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

export type Swipe = {
  id: string;
  session_id: string;
  user_id: string;
  meal_id: string;
  decision: "yes" | "no";
  created_at: string;
};

export type UserSession = {
  id: string;
  user_id: string;
  opened_at: string;
  closed_at: string | null;
  meal_period: "breakfast" | "lunch" | "dinner" | "latenight";
  day_type: "weekday" | "friday" | "weekend" | "sunday";
  resolved: boolean;
  swipe_count: number;
  time_to_decision_seconds: number | null;
  returned_within_10min: boolean | null;
  is_group_session: boolean;
  group_session_id: string | null;
};

export type Decision = {
  id: string;
  session_id: string;
  user_id: string;
  meal_id: string;
  meal_name: string;
  meal_period: "breakfast" | "lunch" | "dinner" | "latenight";
  day_type: "weekday" | "friday" | "weekend" | "sunday";
  outcome: "accepted" | "rejected" | "abandoned";
  rejection_reason: string | null;
  position_in_deck: number;
  decided_at: string;
  is_ai_generated: boolean;
};

/**
 * A soft-avoid entry — a temporary score penalty applied to a meal category
 * or ingredient group. Added when the user confirms the cross-session nudge.
 * Expires after 60 days and self-clears if the user accepts a matching meal.
 */
export type SoftAvoid = {
  category: string;
  ingredient: string;
  addedAt: string;
  expiresAt: string;
  /** Cross-session pass count at the time the nudge fired — used for score weighting. */
  strength: number;
};

/** Consolidated behavioral learning store — one row per user. */
export type UserBehavioralSignals = {
  user_id: string;
  liked_tags: Record<string, number>;
  disliked_tags: Record<string, number>;
  liked_categories: Record<string, number>;
  /** Last 30 accepted meals with timestamps, for time-based recency penalties. */
  recently_chosen: Array<{ meal_id: string; chosen_at: string }>;
  last_updated: string;
};

export type Profile = {
  user_id: string;
  /** UUID from supabase.auth — null for anonymous users, set when they create an account. */
  auth_user_id: string | null;
  /** Display name — set during sign-up or edited on profile page. Used for avatar initials. */
  display_name: string | null;
  /** Public URL of avatar stored in the `avatars` Storage bucket. */
  avatar_url: string | null;
  dietary_restrictions: string[];
  hard_no_foods: string[];
  favorite_cuisines: string[];
  /** Novelty bias from onboarding Step 3 (0.2 = familiar, 0.5 = mix, 0.8 = adventurous). */
  novelty_bias: number | null;
  learned_weights: {
    likedTags: Record<string, number>;
    dislikedTags: Record<string, number>;
    likedCategories: Record<string, number>;
    interactionCount: number;
  } | null;
  recently_seen_meal_ids: string[];
  soft_avoids: SoftAvoid[];
  meal_history: Array<{ meal: Record<string, unknown>; chosenAt: string }> | null;
  saved_meals: Array<{ meal: Record<string, unknown>; isFavorite: boolean; savedAt: string }> | null;
  last_decided_meal: {
    id: string;
    name: string;
    image?: string;
    description?: string;
    cuisine?: string;
    category?: string;
    decidedAt: string;
    mode: "solo" | "shared";
    sessionId?: string;
    partner?: string;
  } | null;
  created_at: string;
  updated_at: string;
};
