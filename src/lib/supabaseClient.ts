import { createClient } from "@supabase/supabase-js";
import { getSyncConfig } from "../state/useSyncSettings";

type LollaClient = ReturnType<typeof createClient<any, "lolla">>;

let cached: LollaClient | null | undefined;

/**
 * One client instance for the whole app lifetime. Auth needs this: supabase-js
 * persists the session to localStorage and attaches it to every request made
 * through *this same instance* — a fresh createClient() per call (the old
 * pattern, back when there was no auth) would mean every request looks
 * anonymous again.
 */
export function getSupabaseClient(): LollaClient | null {
  if (cached !== undefined) return cached;
  const { url, anonKey, configured } = getSyncConfig();
  if (!configured) {
    cached = null;
    return cached;
  }
  cached = createClient<any, "lolla">(url, anonKey, { db: { schema: "lolla" } });
  return cached;
}
