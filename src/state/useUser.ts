import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "lolla-user-name";
const listeners = new Set<() => void>();

function emitChange() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

export function setUserName(name: string) {
  localStorage.setItem(STORAGE_KEY, name.trim());
  emitChange();
}

export function useUserName(): [string, (name: string) => void] {
  const name = useSyncExternalStore(subscribe, getSnapshot);
  const set = useCallback((n: string) => setUserName(n), []);
  return [name, set];
}

/** Non-hook read for use outside components. */
export function getUserName(): string {
  return getSnapshot();
}
