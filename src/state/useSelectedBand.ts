import { useCallback, useSyncExternalStore } from "react";

// Ephemeral navigation state (which band's detail view is open, if any) — shared
// across tabs so tapping a band from the Bands list, Schedule list/grid, or the
// Group Pick panel all open the same detail view. Not persisted: closing/reopening
// the app should land back on the band list, not mid-detail.
let selectedBandId: string | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string | null {
  return selectedBandId;
}

export function openBandDetail(bandId: string) {
  selectedBandId = bandId;
  emitChange();
}

export function closeBandDetail() {
  selectedBandId = null;
  emitChange();
}

export function useSelectedBandId(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Convenience hook for band tiles: returns a stable onClick-ready opener. */
export function useOpenBandDetail(bandId: string): () => void {
  return useCallback(() => openBandDetail(bandId), [bandId]);
}
