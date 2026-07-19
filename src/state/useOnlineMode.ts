import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "lolla-online-mode";
const listeners = new Set<() => void>();

function emitChange() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Defaults to offline: syncing is opt-in, never assumed, per the "flaky
// festival wifi" design goal.
function getSnapshot(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function setOnlineMode(online: boolean) {
  localStorage.setItem(STORAGE_KEY, String(online));
  emitChange();
}

/** Non-hook read for use outside components (e.g. the auto-sync engine). */
export function isOnlineMode(): boolean {
  return getSnapshot();
}

export function useOnlineMode(): [boolean, (online: boolean) => void] {
  const online = useSyncExternalStore(subscribe, getSnapshot);
  const set = useCallback((v: boolean) => setOnlineMode(v), []);
  return [online, set];
}
