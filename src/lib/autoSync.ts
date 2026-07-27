import { useSyncExternalStore } from "react";
import { pushToRemote, pullFromRemote } from "./sync";
import { startRealtimeSync, stopRealtimeSync } from "./realtime";
import { getSyncConfig, setLastSync } from "../state/useSyncSettings";
import { isOnlineMode } from "../state/useOnlineMode";
import { getGroupCode } from "../state/useGroup";

export type SyncStatus = "offline" | "idle" | "syncing" | "error" | "unconfigured";

let status: SyncStatus = "offline";
let errorMessage = "";
let syncPromise: Promise<void> | null = null;
let rerunPending = false;
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

/**
 * Rapid edits, tab navigation, and the foreground listener can all fire close
 * together, and each used to kick off its own independent runSync() — including its own
 * full delete-then-reinsert of the whole bands table for an admin. Two of those racing
 * meant one's insert could land while the other's delete was still in flight, tripping
 * bands_pkey. If a sync is already running, a new trigger no longer starts a second,
 * overlapping one — but it also can't just be ignored: the in-flight run already read
 * the local database *before* this trigger fired, so if this trigger represents a write
 * that landed after that read (e.g. a rating saved a moment after an unrelated sync from
 * another trigger had already started), simply piggybacking on the in-flight promise
 * would silently drop it — that write would never get pushed until something else
 * happened to trigger yet another sync later. Instead, mark that a fresh run is needed
 * and kick off exactly one more the moment the current one finishes, so every write is
 * guaranteed to eventually ride a sync whose read happened after it, without ever
 * running two pushes concurrently.
 */
function runSync(): Promise<void> {
  if (syncPromise) {
    rerunPending = true;
    return syncPromise;
  }
  syncPromise = runSyncNow().finally(() => {
    syncPromise = null;
    if (rerunPending) {
      rerunPending = false;
      runSync();
    }
  });
  return syncPromise;
}

async function runSyncNow() {
  const config = getSyncConfig();
  const groupCode = getGroupCode();
  if (!isOnlineMode()) return;
  if (!config.configured || !groupCode) {
    setStatus("unconfigured");
    return;
  }
  // Idempotent and cheap if already subscribed to this group — keeps the realtime
  // subscription pointed at whatever group is currently active without needing every
  // group-switch call site to remember to also restart it.
  startRealtimeSync(groupCode);
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

function handleVisibilityChange() {
  if (document.visibilityState === "visible") runSync();
}

/**
 * Call once when the user flips online: syncs immediately (which also opens the
 * realtime subscription — see runSyncNow), then again on local edits, navigation
 * (syncNow), or whenever the app comes back to the foreground. That last one matters on
 * a phone: the realtime websocket doesn't survive the OS suspending a backgrounded tab,
 * so reconnecting (and catching up on anything missed via a fresh pull) the moment the
 * app is reopened closes that gap.
 */
export function startAutoSync() {
  runSync();
  document.addEventListener("visibilitychange", handleVisibilityChange);
}

/** Call when the user flips offline (or on unmount): stops all network activity. */
export function stopAutoSync() {
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  stopRealtimeSync();
  setStatus("offline");
}

/**
 * Call after any local ratings/schedule/band write. No-op while offline. Pushes right
 * away rather than debouncing — runSync's own in-flight guard already coalesces bursts
 * of rapid edits into one trailing sync (see its comment), so a fixed wait-and-batch
 * delay wasn't buying anything except a window where a write could sit unpushed.
 */
export function notifyLocalChange() {
  if (!isOnlineMode()) return;
  runSync();
}

/** Call right after switching/joining a group so the new group's data fetches immediately. No-op while offline. */
export function syncNow() {
  if (!isOnlineMode()) return;
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
