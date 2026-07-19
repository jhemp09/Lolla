import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabaseClient";

/**
 * Supabase Auth requires an email; usernames aren't one. This is the standard
 * workaround — map the username to a synthetic address on a domain nobody
 * sends mail to, and never surface it in the UI.
 */
function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@lolla.internal`;
}

function mapAuthError(message: string): string {
  if (/already registered|already exists/i.test(message)) {
    return "That username is already taken — try another, or log in if it's yours.";
  }
  if (/invalid login credentials/i.test(message)) {
    return "Wrong username or password.";
  }
  if (/password.*(least|short|character)/i.test(message)) {
    return "Password must be at least 6 characters.";
  }
  return message;
}

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabaseClient();
    if (!sb) {
      setLoading(false);
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export async function signUp(
  username: string,
  password: string,
  firstName: string,
  groupCode: string,
): Promise<{ error: string | null }> {
  const sb = getSupabaseClient();
  if (!sb) return { error: "This app isn't set up for accounts yet — check back once sync is configured." };

  const { error } = await sb.auth.signUp({
    email: usernameToEmail(username),
    password,
    options: {
      data: {
        username: username.trim(),
        first_name: firstName.trim(),
        group_code: groupCode.trim().toUpperCase(),
      },
    },
  });
  return { error: error ? mapAuthError(error.message) : null };
}

export async function signIn(username: string, password: string): Promise<{ error: string | null }> {
  const sb = getSupabaseClient();
  if (!sb) return { error: "This app isn't set up for accounts yet — check back once sync is configured." };

  const { error } = await sb.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  return { error: error ? mapAuthError(error.message) : null };
}

export async function signOut(): Promise<void> {
  const sb = getSupabaseClient();
  if (sb) await sb.auth.signOut();
}

/**
 * Admin status lives in app_metadata, not user_metadata — app_metadata can only be set
 * server-side (Supabase SQL editor / service role), never by the signed-in user themselves,
 * so it's safe to trust for gating UI. See README "Making yourself the admin."
 */
export function useIsAdmin(): boolean {
  const { session } = useSession();
  return session?.user.app_metadata?.role === "admin";
}

/** Best-effort: keeps the account's saved group in sync so logging in on another device rejoins it. No-op if offline/unconfigured. */
export async function updateAccountGroupCode(groupCode: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb.auth.updateUser({ data: { group_code: groupCode } });
  } catch {
    // Fine to fail silently here — local group switch already happened, this is just a nice-to-have.
  }
}
