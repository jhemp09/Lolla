import { useCallback, useSyncExternalStore } from "react";

export type Tab = "bands" | "schedule" | "sync";

const STORAGE_KEY = "lolla-active-tab";
const VALID_TABS: Tab[] = ["bands", "schedule", "sync"];
const listeners = new Set<() => void>();

function emitChange() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Tab {
  const stored = localStorage.getItem(STORAGE_KEY);
  return (VALID_TABS as string[]).includes(stored ?? "") ? (stored as Tab) : "bands";
}

export function setTab(tab: Tab) {
  localStorage.setItem(STORAGE_KEY, tab);
  emitChange();
}

export function useTab(): [Tab, (tab: Tab) => void] {
  const tab = useSyncExternalStore(subscribe, getSnapshot);
  const set = useCallback((t: Tab) => setTab(t), []);
  return [tab, set];
}
