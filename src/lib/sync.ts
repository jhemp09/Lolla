import { db } from "../db/db";
import type { Band, Rating, ScheduleEntry, StageDistance } from "../types";
import { getSupabaseClient } from "./supabaseClient";
import { getUserName } from "../state/useUser";

function client() {
  const sb = getSupabaseClient();
  if (!sb) {
    throw new Error("Set your Supabase URL and anon key first (Sync tab).");
  }
  return sb;
}

interface RemoteBand {
  id: string;
  name: string;
  stage: string;
  day: number;
  start_minutes: number;
  end_minutes: number;
  genre: string;
  description: string;
}

interface RemoteRating {
  group_code: string;
  band_id: string;
  user_name: string;
  pre_rating: number;
  pre_notes: string;
  during_rating: number;
  during_notes: string;
  updated_at: string;
}

interface RemoteSchedule {
  group_code: string;
  band_id: string;
  user_name: string;
  added_at: string;
  removed: boolean;
}

interface RemoteStageDistance {
  stage_a: string;
  stage_b: string;
  minutes: number;
}

/**
 * Pushes everything on this device up to the shared Supabase project. Ratings and
 * schedule are scoped to the current group; a device's local copy of both includes
 * every group member's rows (pulled down so the optimizer and "view someone else's
 * schedule" both work), but RLS only allows writing your own row (or, for an admin,
 * anyone's) — so the push filters to just those before sending, rather than batching
 * up rows it has no permission for. A single disallowed row fails the whole upsert
 * (Postgres rejects the batch, not just that row), which used to silently break sync
 * for anyone whose local table had picked up a teammate's ratings. Bands and stage
 * distances are global (shared across every group in this project) and admin-managed
 * — RLS only allows an admin account to write them, so a non-admin skips them
 * entirely rather than triggering a doomed write. When an admin does push them, it's
 * a full replace (delete anything remote that isn't in the current local set, not
 * just an upsert) so the shared table can't accumulate stale rows a local device no
 * longer has — e.g. sample-seeded bands that got pushed up before a local table was
 * properly replaced by a real import.
 *
 * Note: the group schedule itself is never pushed/pulled — it's computed locally on
 * every device from ratings + stage distances (see useComputedGroupSchedule), both of
 * which already sync here, so there's nothing extra to keep in sync for it.
 */
export async function pushToRemote(groupCode: string): Promise<void> {
  const sb = client();

  const [bands, distances, ratings, schedule, { data: sessionData }] = await Promise.all([
    db.bands.toArray(),
    db.stageDistances.toArray(),
    db.ratings.where("groupCode").equals(groupCode).toArray(),
    db.schedule.where("groupCode").equals(groupCode).toArray(),
    sb.auth.getSession(),
  ]);
  const isAdmin = sessionData.session?.user.app_metadata?.role === "admin";
  const myUserName = getUserName();
  const ownRow = (userName: string) => isAdmin || userName === myUserName;

  const remoteRatings: RemoteRating[] = ratings.filter((r) => ownRow(r.userName)).map((r) => ({
    group_code: r.groupCode,
    band_id: r.bandId,
    user_name: r.userName,
    pre_rating: r.preRating,
    pre_notes: r.preNotes,
    during_rating: r.duringRating,
    during_notes: r.duringNotes,
    updated_at: r.updatedAt,
  }));
  const remoteSchedule: RemoteSchedule[] = schedule.filter((s) => ownRow(s.userName)).map((s) => ({
    group_code: s.groupCode,
    band_id: s.bandId,
    user_name: s.userName,
    added_at: s.addedAt,
    removed: s.removed,
  }));

  // Own data first — never let an admin-only table's RLS rejection (or any other
  // failure below) stop a person's own ratings/schedule from reaching the server.
  if (remoteRatings.length) {
    const { error } = await sb
      .from("ratings")
      .upsert(remoteRatings, { onConflict: "group_code,band_id,user_name" });
    if (error) throw error;
  }
  if (remoteSchedule.length) {
    const { error } = await sb
      .from("schedule")
      .upsert(remoteSchedule, { onConflict: "group_code,band_id,user_name" });
    if (error) throw error;
  }

  if (!isAdmin) return;

  const remoteBands: RemoteBand[] = bands.map((b) => ({
    id: b.id,
    name: b.name,
    stage: b.stage,
    day: b.day,
    start_minutes: b.startMinutes,
    end_minutes: b.endMinutes,
    genre: b.genre,
    description: b.description,
  }));
  const remoteDistances: RemoteStageDistance[] = distances.map((d) => ({
    stage_a: d.stageA,
    stage_b: d.stageB,
    minutes: d.minutes,
  }));

  if (remoteBands.length) {
    // Full replace (delete-all-then-insert), not upsert — a routine upsert never
    // removes rows a local device no longer has, which is exactly how sample-seeded
    // bands ended up permanently stuck alongside a real imported lineup. Both tables
    // are small (a festival lineup, a handful of stage pairs) and only meaningfully
    // change when an admin imports new data, so the brief empty window this creates
    // is cheap and harmless.
    const { error: deleteError } = await sb.from("bands").delete().not("id", "is", null);
    if (deleteError) throw deleteError;
    const { error: insertError } = await sb.from("bands").insert(remoteBands);
    if (insertError) throw insertError;
  }
  if (remoteDistances.length) {
    const { error: deleteError } = await sb.from("stage_distances").delete().not("stage_a", "is", null);
    if (deleteError) throw deleteError;
    const { error: insertError } = await sb.from("stage_distances").insert(remoteDistances);
    if (insertError) throw insertError;
  }
}

/** Pulls the shared project down and merges into local storage (last-write-wins by timestamp). */
export async function pullFromRemote(groupCode: string): Promise<void> {
  const sb = client();

  const [bandsRes, distancesRes, ratingsRes, scheduleRes] = await Promise.all([
    sb.from("bands").select("*"),
    sb.from("stage_distances").select("*"),
    sb.from("ratings").select("*").eq("group_code", groupCode),
    sb.from("schedule").select("*").eq("group_code", groupCode),
  ]);
  if (bandsRes.error) throw bandsRes.error;
  if (distancesRes.error) throw distancesRes.error;
  if (ratingsRes.error) throw ratingsRes.error;
  if (scheduleRes.error) throw scheduleRes.error;

  const remoteBands = (bandsRes.data ?? []) as RemoteBand[];
  const remoteDistances = (distancesRes.data ?? []) as RemoteStageDistance[];
  const remoteRatings = (ratingsRes.data ?? []) as RemoteRating[];
  const remoteSchedule = (scheduleRes.data ?? []) as RemoteSchedule[];

  if (remoteBands.length) {
    const bands: Band[] = remoteBands.map((b) => ({
      id: b.id,
      name: b.name,
      stage: b.stage,
      day: b.day as Band["day"],
      startMinutes: b.start_minutes,
      endMinutes: b.end_minutes,
      genre: b.genre,
      description: b.description,
    }));
    // Bands are a global, admin-managed replace-the-whole-table dataset (like
    // stage distances below), not additive rows — clear first or a device's
    // original sample-seeded bands (different IDs, never overwritten by an
    // upsert) sit alongside the real ones forever. Clear+bulkPut run inside one
    // transaction so useLiveQuery observers never see the momentarily-empty table.
    await db.transaction("rw", db.bands, async () => {
      await db.bands.clear();
      await db.bands.bulkPut(bands);
    });
  }

  if (remoteDistances.length) {
    const distances: StageDistance[] = remoteDistances.map((d) => ({
      stageA: d.stage_a,
      stageB: d.stage_b,
      minutes: d.minutes,
    }));
    await db.transaction("rw", db.stageDistances, async () => {
      await db.stageDistances.clear();
      await db.stageDistances.bulkPut(distances);
    });
  }

  await db.transaction("rw", db.ratings, async () => {
    for (const r of remoteRatings) {
      const existing = await db.ratings
        .where("[groupCode+bandId+userName]")
        .equals([r.group_code, r.band_id, r.user_name])
        .first();
      if (!existing || new Date(r.updated_at) > new Date(existing.updatedAt)) {
        const local: Rating = {
          groupCode: r.group_code,
          bandId: r.band_id,
          userName: r.user_name,
          preRating: r.pre_rating,
          preNotes: r.pre_notes,
          duringRating: r.during_rating,
          duringNotes: r.during_notes,
          updatedAt: r.updated_at,
        };
        if (existing) await db.ratings.update(existing.id!, local);
        else await db.ratings.add(local);
      }
    }
  });

  await db.transaction("rw", db.schedule, async () => {
    for (const s of remoteSchedule) {
      const existing = await db.schedule
        .where("[groupCode+bandId+userName]")
        .equals([s.group_code, s.band_id, s.user_name])
        .first();
      if (!existing || new Date(s.added_at) > new Date(existing.addedAt)) {
        const local: ScheduleEntry = {
          groupCode: s.group_code,
          bandId: s.band_id,
          userName: s.user_name,
          addedAt: s.added_at,
          removed: s.removed,
        };
        if (existing) await db.schedule.update(existing.id!, local);
        else await db.schedule.add(local);
      }
    }
  });
}
