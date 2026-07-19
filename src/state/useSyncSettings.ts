import { useSyncExternalStore } from "react";

const URL_KEY = "lolla-supabase-url";
const ANON_KEY = "lolla-supabase-anon-key";
const LAST_SYNC_KEY = "lolla-last-sync";
const listeners = new Set<() => void>();

export interface SyncSettings {
  url: string;
  anonKey: string;
  lastSync: string;
}

function readSettings(): SyncSettings {
  return {
    url: localStorage.getItem(URL_KEY) ?? import.meta.env.VITE_SUPABASE_URL ?? "",
    anonKey: localStorage.getItem(ANON_KEY) ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
    lastSync: localStorage.getItem(LAST_SYNC_KEY) ?? "",
  };
}

// Cached snapshot object: useSyncExternalStore requires getSnapshot to return
// a referentially stable value between emits, or React re-renders forever.
let cached: SyncSettings = readSettings();

function emitChange() {
  cached = readSettings();
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SyncSettings {
  return cached;
}

export function saveSyncSettings(url: string, anonKey: string) {
  localStorage.setItem(URL_KEY, url.trim());
  localStorage.setItem(ANON_KEY, anonKey.trim());
  emitChange();
}

export function setLastSync(iso: string) {
  localStorage.setItem(LAST_SYNC_KEY, iso);
  emitChange();
}

export function useSyncSettings(): SyncSettings {
  return useSyncExternalStore(subscribe, getSnapshot);
}
