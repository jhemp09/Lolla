import { createLocalStore } from "./localStore";

const store = createLocalStore<boolean>("lolla-stage-distances-open", false, {
  parse: (raw) => raw === "true",
});

/**
 * Same history-integration trick as useSelectedBand: opening this page pushes a
 * history entry so the phone's back button closes it instead of exiting the app,
 * and every close path (in-app "‹ Back", switching bottom-nav tabs) goes through
 * history.back() so a single popstate listener stays the one place that closes it.
 */
window.addEventListener("popstate", () => {
  if (!history.state?.lollaStageDistances && store.get()) {
    store.set(false);
  }
});
if (store.get()) {
  history.pushState({ lollaStageDistances: true }, "");
}

export function openStageDistances() {
  store.set(true);
  history.pushState({ lollaStageDistances: true }, "");
}

export function closeStageDistances() {
  if (!store.get()) return;
  if (history.state?.lollaStageDistances) {
    history.back();
  } else {
    store.set(false);
  }
}

export function useShowStageDistances(): boolean {
  return store.useValue()[0];
}
