import { useCallback } from "react";
import { createLocalStore } from "./localStore";

// Which band's detail view is open, if any — shared across tabs so tapping a
// band from the Bands list, Schedule list/grid, or the Group Pick panel all
// open the same detail view. Persisted like the active tab, so a refresh
// while viewing a band's detail lands back on that same detail view.
const store = createLocalStore<string | null>("lolla-selected-band-id", null);

/**
 * The app has no real routing — every screen is just local state — so the phone's
 * hardware/gesture back button has no browser history to act on and exits the whole
 * app instead of backing out of whatever's open. Opening the detail view pushes a
 * history entry for it, and every way of closing it (the in-app "‹ Back" button,
 * switching bottom-nav tabs, deleting the open band) goes through history.back()
 * rather than clearing the state directly, so a single popstate listener is the one
 * place that actually closes it — keeping the browser's history stack and "is detail
 * view open" in sync however the close happens, so the back button reliably backs out
 * to whatever list/grid was open underneath instead of leaving the app.
 */
window.addEventListener("popstate", () => {
  if (!history.state?.lollaBandDetail && store.get() !== null) {
    store.clear();
  }
});
// A refresh can land straight back on an open detail view (persisted above) with no
// history entry pushed for it yet — push one now so the very first back-press already
// closes the detail view rather than exiting.
if (store.get() !== null) {
  history.pushState({ lollaBandDetail: true }, "");
}

export function openBandDetail(bandId: string) {
  store.set(bandId);
  history.pushState({ lollaBandDetail: true }, "");
}

export function closeBandDetail() {
  if (store.get() === null) return;
  if (history.state?.lollaBandDetail) {
    history.back();
  } else {
    // No matching history entry to walk back through (shouldn't normally happen) —
    // still close the view rather than leaving it stuck open.
    store.clear();
  }
}

export function useSelectedBandId(): string | null {
  return store.useValue()[0];
}

/** Convenience hook for band tiles: returns a stable onClick-ready opener. */
export function useOpenBandDetail(bandId: string): () => void {
  return useCallback(() => openBandDetail(bandId), [bandId]);
}
