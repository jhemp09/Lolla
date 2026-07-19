import { useSyncExternalStore } from "react";
import { pushToRemote, pullFromRemote } from "./sync";
import { getSyncConfig, setLastSync } from "../state/useSyncSettings";
import { isOnlineMode } from "../state/useOnlineMode";
import { getGroupCode } from "../state/useGroup";

export type SyncStatus = "offline" | "idle" | "syncing" | "error" | "unconfigured";

const PUSH_DEBOUNCE_MS = 1500;
const PULL_INTERVAL_MS = 45000;

let status: SyncStatus = "offline";
let errorMessage = "";
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pullTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function setStatus(next: SyncStatus, message = "") {
  status = next;
  errorMessage = message;
  for (const l of listeners) l();
}

async function runSync() {
  const config = getSyncConfig();
  const groupCode = getGroupCode();
  if (!isOnlineMode()) return;
  if (!config.configured || !groupCode) {
    setStatus("unconfigured");
    return;
  }
  setStatus("syncing");
  try {
    await pushToRemote(config.url, config.anonKey, groupCode);
    await pullFromRemote(config.url, config.anonKey, groupCode);
    setLastSync(new Date().toISOString());
    setStatus("idle");
  } catch (e) {
    setStatus("error", e instanceof Error ? e.message : "Sync failed.");
  }
}

/** Call once when the user flips online: syncs immediately, then keeps pulling periodically. */
export function startAutoSync() {
  if (pullTimer) return; // already running
  runSync();
  pullTimer = setInterval(runSync, PULL_INTERVAL_MS);
}

/** Call when the user flips offline (or on unmount): stops all network activity. */
export function stopAutoSync() {
  if (pullTimer) {
    clearInterval(pullTimer);
    pullTimer = null;
  }
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  setStatus("offline");
}

/** Call after any local ratings/schedule/band write. No-op while offline. */
export function notifyLocalChange() {
  if (!isOnlineMode()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(runSync, PUSH_DEBOUNCE_MS);
}

/** Call right after switching/joining a group so the new group's data fetches immediately. No-op while offline. */
export function syncNow() {
  if (!isOnlineMode()) return;
  if (pushTimer) clearTimeout(pushTimer);
  runSync();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getStatusSnapshot(): SyncStatus {
  return status;
}

export function useSyncStatus(): { status: SyncStatus; errorMessage: string } {
  const s = useSyncExternalStore(subscribe, getStatusSnapshot);
  return { status: s, errorMessage };
}
