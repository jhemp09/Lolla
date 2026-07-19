import { useSyncExternalStore } from "react";

const LAST_SYNC_KEY = "lolla-last-sync";
const listeners = new Set<() => void>();

export interface SyncConfig {
  url: string;
  anonKey: string;
  lastSync: string;
  /** False if this build wasn't given Supabase credentials at build time. */
  configured: boolean;
}

// Baked in at build time (Vercel/Netlify env vars, or .env.local for dev).
// Intentionally not user-editable: end users just see an online/offline toggle.
const ENV_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const ENV_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

function readSettings(): SyncConfig {
  return {
    url: ENV_URL,
    anonKey: ENV_ANON_KEY,
    lastSync: localStorage.getItem(LAST_SYNC_KEY) ?? "",
    configured: !!ENV_URL && !!ENV_ANON_KEY,
  };
}

// Cached snapshot object: useSyncExternalStore requires getSnapshot to return
// a referentially stable value between emits, or React re-renders forever.
let cached: SyncConfig = readSettings();

function emitChange() {
  cached = readSettings();
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SyncConfig {
  return cached;
}

export function setLastSync(iso: string) {
  localStorage.setItem(LAST_SYNC_KEY, iso);
  emitChange();
}

export function useSyncConfig(): SyncConfig {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Non-hook read for use outside components (e.g. the auto-sync engine). */
export function getSyncConfig(): SyncConfig {
  return getSnapshot();
}
