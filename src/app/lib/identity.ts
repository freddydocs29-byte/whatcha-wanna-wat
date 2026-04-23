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
