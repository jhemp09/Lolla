import { createLocalStore } from "./localStore";

// Defaults to offline: syncing is opt-in, never assumed, per the "flaky
// festival wifi" design goal.
const store = createLocalStore<boolean>("lolla-online-mode", false, {
  parse: (raw) => raw === "true",
  serialize: (value) => String(value),
});

export const setOnlineMode = store.set;
export const useOnlineMode = store.useValue;

/** Non-hook read for use outside components (e.g. the auto-sync engine). */
export const isOnlineMode = store.get;
