import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "lolla-group-code";
const listeners = new Set<() => void>();

function emitChange() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

/** Short, human-shareable code — unambiguous alphabet (no 0/O/1/I) since people read these aloud. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateGroupCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function setGroupCode(code: string) {
  localStorage.setItem(STORAGE_KEY, code.trim().toUpperCase());
  emitChange();
}

export function useGroupCode(): [string, (code: string) => void] {
  const code = useSyncExternalStore(subscribe, getSnapshot);
  const set = useCallback((c: string) => setGroupCode(c), []);
  return [code, set];
}

/** Non-hook read for use outside components. */
export function getGroupCode(): string {
  return getSnapshot();
}
