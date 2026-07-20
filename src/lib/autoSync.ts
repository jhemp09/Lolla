import { useSyncExternalStore } from "react";
import { pushToRemote, pullFromRemote } from "./sync";
import { getSyncConfig, setLastSync } from "../state/useSyncSettings";
import { isOnlineMode } from "../state/useOnlineMode";
import { getGroupCode } from "../state/useGroup";

export type SyncStatus = "offline" | "idle" | "syncing" | "error" | "unconfigured";

const PUSH_DEBOUNCE_MS = 1500;

let status: SyncStatus = "offline";
let errorMessage = "";
let pushTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function setStatus(next: SyncStatus, message = "") {
  status = next;
  errorMessage = message;
  for (const l of listeners) l();
}

/**
 * Postgrest errors (RLS denials, constraint violations, etc.) put the actionable
 * detail in `hint`/`code`, not `message` — a bare "new row violates row-level
 * security policy" tells you nothing about *which* policy or *why*. Surface all of
 * it in the UI so a report of "sync failed" comes with enough to diagnose remotely,
 * instead of needing screen-share or console access on someone else's device.
 */
function describeError(e: unknown): string {
  if (e && typeof e === "object") {
    const err = e as { message?: string; hint?: string; code?: string };
    const parts = [err.message, err.hint].filter((p): p is string => !!p);
    if (parts.length) return err.code ? `${parts.join(" — ")} (${err.code})` : parts.join(" — ");
  }
  return e instanceof Error ? e.message : "Sync failed.";
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
    await pushToRemote(groupCode);
    await pullFromRemote(groupCode);
    setLastSync(new Date().toISOString());
    setStatus("idle");
  } catch (e) {
    console.error("Sync failed:", e);
    setStatus("error", describeError(e));
  }
}

/** Call once when the user flips online: syncs immediately. No periodic polling —
 * further syncs happen on local edits (debounced) or navigation (syncNow). */
export function startAutoSync() {
  runSync();
}

/** Call when the user flips offline (or on unmount): stops all network activity. */
export function stopAutoSync() {
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
