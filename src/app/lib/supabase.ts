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
  /** Ordered deck entries: string IDs for static meals, Meal objects for AI-generated meals. */
  deck_meal_ids: (string | Record<string, unknown>)[] | null;
  vibe: string | null;
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

export type Profile = {
  user_id: string;
  display_name: string | null;
  dietary_restrictions: string[];
  hard_no_foods: string[];
  favorite_cuisines: string[];
  learned_weights: {
    likedTags: Record<string, number>;
    dislikedTags: Record<string, number>;
    likedCategories: Record<string, number>;
    interactionCount: number;
  } | null;
  recently_seen_meal_ids: string[];
  created_at: string;
  updated_at: string;
};
