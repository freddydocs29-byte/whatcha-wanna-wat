import { supabase } from "./supabase";

const USER_ID_KEY = "wwe_user_id";

/**
 * Returns a stable anonymous UUID for this device.
 * Generated once on first call and persisted in localStorage.
 */
export function getUserId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

/**
 * Returns the Supabase Auth user ID (uuid) for the currently signed-in user,
 * or null if the user is anonymous / not signed in.
 *
 * Uses getSession() which reads from localStorage — no network call.
 */
export async function getAuthUserId(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}
