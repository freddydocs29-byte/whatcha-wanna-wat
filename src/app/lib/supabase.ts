import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Session = {
  id: string;
  host_user_id: string;
  guest_user_id: string | null;
  status: "waiting" | "active" | "matched";
  locked_meal_id: string | null;
  deck_meal_ids: string[] | null;
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
