import { createClient } from "@supabase/supabase-js";
import { db } from "../db/db";
import type { Band, Rating, ScheduleEntry } from "../types";

function client(url: string, anonKey: string) {
  if (!url || !anonKey) {
    throw new Error("Set your Supabase URL and anon key first (Sync tab).");
  }
  // Tables live in the "lolla" schema, not "public", so this project can be
  // shared with unrelated apps without table-name collisions.
  return createClient(url, anonKey, { db: { schema: "lolla" } });
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
  band_id: string;
  user_name: string;
  rating: number;
  notes: string;
  updated_at: string;
}

interface RemoteSchedule {
  band_id: string;
  user_name: string;
  added_at: string;
  removed: boolean;
}

/** Pushes everything on this device up to the shared Supabase project. Upserts only, never deletes remote rows. */
export async function pushToRemote(url: string, anonKey: string): Promise<void> {
  const sb = client(url, anonKey);

  const [bands, ratings, schedule] = await Promise.all([
    db.bands.toArray(),
    db.ratings.toArray(),
    db.schedule.toArray(),
  ]);

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
  const remoteRatings: RemoteRating[] = ratings.map((r) => ({
    band_id: r.bandId,
    user_name: r.userName,
    rating: r.rating,
    notes: r.notes,
    updated_at: r.updatedAt,
  }));
  const remoteSchedule: RemoteSchedule[] = schedule.map((s) => ({
    band_id: s.bandId,
    user_name: s.userName,
    added_at: s.addedAt,
    removed: s.removed,
  }));

  if (remoteBands.length) {
    const { error } = await sb.from("bands").upsert(remoteBands, { onConflict: "id" });
    if (error) throw error;
  }
  if (remoteRatings.length) {
    const { error } = await sb
      .from("ratings")
      .upsert(remoteRatings, { onConflict: "band_id,user_name" });
    if (error) throw error;
  }
  if (remoteSchedule.length) {
    const { error } = await sb
      .from("schedule")
      .upsert(remoteSchedule, { onConflict: "band_id,user_name" });
    if (error) throw error;
  }
}

/** Pulls the shared project down and merges into local storage (last-write-wins by timestamp). */
export async function pullFromRemote(url: string, anonKey: string): Promise<void> {
  const sb = client(url, anonKey);

  const [bandsRes, ratingsRes, scheduleRes] = await Promise.all([
    sb.from("bands").select("*"),
    sb.from("ratings").select("*"),
    sb.from("schedule").select("*"),
  ]);
  if (bandsRes.error) throw bandsRes.error;
  if (ratingsRes.error) throw ratingsRes.error;
  if (scheduleRes.error) throw scheduleRes.error;

  const remoteBands = (bandsRes.data ?? []) as RemoteBand[];
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
    await db.bands.bulkPut(bands);
  }

  await db.transaction("rw", db.ratings, async () => {
    for (const r of remoteRatings) {
      const existing = await db.ratings
        .where("[bandId+userName]")
        .equals([r.band_id, r.user_name])
        .first();
      if (!existing || new Date(r.updated_at) > new Date(existing.updatedAt)) {
        const local: Rating = {
          bandId: r.band_id,
          userName: r.user_name,
          rating: r.rating,
          notes: r.notes,
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
        .where("[bandId+userName]")
        .equals([s.band_id, s.user_name])
        .first();
      if (!existing || new Date(s.added_at) > new Date(existing.addedAt)) {
        const local: ScheduleEntry = {
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
