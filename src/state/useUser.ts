import { createLocalStore } from "./localStore";

const store = createLocalStore<string>("lolla-user-name", "", {
  serialize: (name: string) => name.trim(),
});

export const setUserName = store.set;
export const useUserName = store.useValue;

/** Non-hook read for use outside components. */
export const getUserName = store.get;
