import { createLocalStore } from "./localStore";

export type Tab = "bands" | "schedule" | "sync" | "admin";

const VALID_TABS: Tab[] = ["bands", "schedule", "sync", "admin"];

const store = createLocalStore<Tab>("lolla-active-tab", "bands", {
  parse: (raw) => ((VALID_TABS as string[]).includes(raw) ? (raw as Tab) : "bands"),
});

export const setTab = store.set;
export const useTab = store.useValue;
