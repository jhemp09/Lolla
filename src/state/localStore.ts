import { useCallback, useSyncExternalStore } from "react";

/**
 * Shared plumbing behind every localStorage-backed value in this app: a per-key
 * subscriber set wired to useSyncExternalStore, plus get/set usable both inside
 * React (via useValue) and outside it (effects, other modules, non-hook helpers).
 * `parse` converts the raw stored string into T — read-time validation/fallback
 * (e.g. an unrecognized enum value) belongs here. `serialize` does the reverse —
 * write-time normalization (trim, case) belongs here instead, so it applies
 * whether the value was set through the hook or through a direct setter call.
 * Both default to treating T as a plain string.
 */
export function createLocalStore<T>(
  key: string,
  defaultValue: T,
  config?: {
    parse?: (raw: string) => T;
    serialize?: (value: T) => string;
  },
) {
  const parse = config?.parse ?? ((raw: string) => raw as unknown as T);
  const serialize = config?.serialize ?? ((value: T) => value as unknown as string);
  const listeners = new Set<() => void>();

  function emitChange() {
    for (const l of listeners) l();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function get(): T {
    const raw = localStorage.getItem(key);
    return raw === null ? defaultValue : parse(raw);
  }

  function set(value: T) {
    localStorage.setItem(key, serialize(value));
    emitChange();
  }

  /** Removes the key entirely, distinct from set(), for values where "unset" isn't representable as T. */
  function clear() {
    localStorage.removeItem(key);
    emitChange();
  }

  function useValue(): [T, (value: T) => void] {
    const value = useSyncExternalStore(subscribe, get);
    const setValue = useCallback((v: T) => set(v), []);
    return [value, setValue];
  }

  return { get, set, clear, subscribe, useValue };
}
