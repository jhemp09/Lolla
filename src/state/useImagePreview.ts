import { useSyncExternalStore } from "react";

export interface ImagePreview {
  blob: Blob;
  url: string;
  filename: string;
}

// Not a createLocalStore like the other overlay stores — a Blob can't be serialized to
// localStorage, and there'd be nothing worth reopening to after a reload anyway.
let current: ImagePreview | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function clear() {
  if (current) URL.revokeObjectURL(current.url);
  current = null;
  emitChange();
}

/**
 * Same history-integration trick as useSelectedBand: opening the preview pushes a
 * history entry so the phone's back button closes it instead of exiting the app, and
 * every close path goes through history.back() so this one popstate listener is the
 * only place that actually clears the state.
 */
window.addEventListener("popstate", () => {
  if (!history.state?.lollaImagePreview && current) clear();
});

export function openImagePreview(blob: Blob, filename: string) {
  if (current) URL.revokeObjectURL(current.url);
  current = { blob, url: URL.createObjectURL(blob), filename };
  history.pushState({ lollaImagePreview: true }, "");
  emitChange();
}

export function closeImagePreview() {
  if (!current) return;
  if (history.state?.lollaImagePreview) {
    history.back();
  } else {
    clear();
  }
}

export function useImagePreview(): ImagePreview | null {
  return useSyncExternalStore(subscribe, () => current);
}
