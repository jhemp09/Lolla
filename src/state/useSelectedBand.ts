import { useCallback } from "react";
import { createLocalStore } from "./localStore";

// Which band's detail view is open, if any — shared across tabs so tapping a
// band from the Bands list, Schedule list/grid, or the Group Pick panel all
// open the same detail view. Persisted like the active tab, so a refresh
// while viewing a band's detail lands back on that same detail view.
const store = createLocalStore<string | null>("lolla-selected-band-id", null);

export function openBandDetail(bandId: string) {
  store.set(bandId);
}

export function closeBandDetail() {
  store.clear();
}

export function useSelectedBandId(): string | null {
  return store.useValue()[0];
}

/** Convenience hook for band tiles: returns a stable onClick-ready opener. */
export function useOpenBandDetail(bandId: string): () => void {
  return useCallback(() => openBandDetail(bandId), [bandId]);
}
