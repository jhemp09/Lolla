import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabaseClient";
import { getUserName } from "../state/useUser";
import { db } from "../db/db";
import { applyRemoteRatingRow, applyRemoteScheduleRow, type RemoteRating, type RemoteSchedule } from "./sync";

let channel: RealtimeChannel | null = null;
let subscribedGroupCode: string | null = null;

function handleRatingChange(payload: RealtimePostgresChangesPayload<RemoteRating>) {
  if (payload.eventType === "DELETE") return; // ratings are never actually deleted, just re-rated
  const row = payload.new as RemoteRating;
  db.transaction("rw", db.ratings, () => applyRemoteRatingRow(row, getUserName())).catch((e) =>
    console.error("Realtime rating merge failed:", e),
  );
}

function handleScheduleChange(payload: RealtimePostgresChangesPayload<RemoteSchedule>) {
  if (payload.eventType === "DELETE") return; // removal is a `removed: true` update, not a real delete
  const row = payload.new as RemoteSchedule;
  db.transaction("rw", db.schedule, () => applyRemoteScheduleRow(row, getUserName())).catch((e) =>
    console.error("Realtime schedule merge failed:", e),
  );
}

/**
 * Subscribes to live Postgres changes for this group's ratings and schedule, so a
 * teammate's edit reaches this device the instant it lands on the server instead of
 * waiting for one of this device's own triggers (an edit, a tab switch, coming back to
 * the foreground) to happen to fire a pull — every sync bug tonight came down to some
 * version of that trigger not firing at the right moment. The trigger-based push/pull in
 * runSync stays in place as a fallback (covers the brief gap before this connects, and
 * self-heals if the websocket drops), but this is what makes an update feel instant
 * rather than "eventually, whenever something else happens to check."
 *
 * Safe to call repeatedly — a no-op if already subscribed to this exact group, and
 * cleanly re-subscribes if the group has changed (switching groups while online).
 */
export function startRealtimeSync(groupCode: string): void {
  if (subscribedGroupCode === groupCode && channel) return;
  stopRealtimeSync();

  const sb = getSupabaseClient();
  if (!sb) return;

  channel = sb
    .channel(`lolla-group-${groupCode}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "lolla", table: "ratings", filter: `group_code=eq.${groupCode}` },
      handleRatingChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "lolla", table: "schedule", filter: `group_code=eq.${groupCode}` },
      handleScheduleChange,
    )
    .subscribe();
  subscribedGroupCode = groupCode;
}

/** Call when flipping offline (or on unmount) to close the websocket connection. */
export function stopRealtimeSync(): void {
  if (!channel) return;
  const sb = getSupabaseClient();
  sb?.removeChannel(channel);
  channel = null;
  subscribedGroupCode = null;
}
