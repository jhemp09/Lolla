import { useCallback, useSyncExternalStore } from "react";

const listenersByKey = new Map<string, Set<() => void>>();

function getListeners(key: string): Set<() => void> {
  let set = listenersByKey.get(key);
  if (!set) {
    set = new Set();
    listenersByKey.set(key, set);
  }
  return set;
}

/** Generic localStorage-backed useState, shared across every component reading the same key. */
export function usePersistedState<T extends string>(key: string, defaultValue: T): [T, (value: T) => void] {
  const subscribe = useCallback(
    (listener: () => void) => {
      const listeners = getListeners(key);
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    [key],
  );

  const getSnapshot = useCallback(() => {
    return (localStorage.getItem(key) as T | null) ?? defaultValue;
  }, [key, defaultValue]);

  const value = useSyncExternalStore(subscribe, getSnapshot);

  const setValue = useCallback(
    (v: T) => {
      localStorage.setItem(key, v);
      for (const l of getListeners(key)) l();
    },
    [key],
  );

  return [value, setValue];
}
