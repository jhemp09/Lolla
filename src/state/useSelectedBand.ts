import { useCallback, useSyncExternalStore } from "react";

// Which band's detail view is open, if any — shared across tabs so tapping a
// band from the Bands list, Schedule list/grid, or the Group Pick panel all
// open the same detail view. Persisted like the active tab, so a refresh
// while viewing a band's detail lands back on that same detail view.
const STORAGE_KEY = "lolla-selected-band-id";
const listeners = new Set<() => void>();

function emitChange() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function openBandDetail(bandId: string) {
  localStorage.setItem(STORAGE_KEY, bandId);
  emitChange();
}

export function closeBandDetail() {
  localStorage.removeItem(STORAGE_KEY);
  emitChange();
}

export function useSelectedBandId(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Convenience hook for band tiles: returns a stable onClick-ready opener. */
export function useOpenBandDetail(bandId: string): () => void {
  return useCallback(() => openBandDetail(bandId), [bandId]);
}
