import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Band, Day, GroupScheduleEntry } from "../types";
import { optimizeGroupSchedule, aggregateRatingWeights } from "../lib/optimizer";
import { buildDistanceLookup } from "../lib/stageDistances";
import { addToSchedule } from "./useSchedule";
import { notifyLocalChange } from "../lib/autoSync";

export function useGroupSchedule(groupCode: string): GroupScheduleEntry[] {
  return (
    useLiveQuery(
      () =>
        db.groupSchedule
          .where("groupCode")
          .equals(groupCode)
          .sortBy("order"),
      [groupCode],
    ) ?? []
  );
}

/** Runs the optimizer over this group's current ratings and saves the result. Fully offline. */
export async function generateGroupSchedule(groupCode: string, bands: Band[]): Promise<void> {
  const [ratings, distances] = await Promise.all([
    db.ratings.where("groupCode").equals(groupCode).toArray(),
    db.stageDistances.toArray(),
  ]);

  const weights = aggregateRatingWeights(
    ratings.map((r) => ({ bandId: r.bandId, rating: r.preRating })),
  );
  const walkMinutes = buildDistanceLookup(distances);
  const optimized = optimizeGroupSchedule(bands, weights, walkMinutes);

  const generatedAt = new Date().toISOString();
  const entries: GroupScheduleEntry[] = optimized.flatMap((day) =>
    day.bandIds.map((bandId, order) => ({
      groupCode,
      day: day.day,
      order,
      bandId,
      generatedAt,
    })),
  );

  await db.groupSchedule.where("groupCode").equals(groupCode).delete();
  if (entries.length) await db.groupSchedule.bulkAdd(entries);
  notifyLocalChange();
}

/** Copies the group schedule's picks into one person's own schedule. Additive only — never removes anything they already picked themselves. */
export async function adoptGroupSchedule(
  groupCode: string,
  userName: string,
  entries: GroupScheduleEntry[],
): Promise<void> {
  for (const entry of entries) {
    await addToSchedule(groupCode, entry.bandId, userName);
  }
}

export function groupByDay(entries: GroupScheduleEntry[]): Map<Day, GroupScheduleEntry[]> {
  const byDay = new Map<Day, GroupScheduleEntry[]>();
  for (const e of entries) {
    const list = byDay.get(e.day) ?? [];
    list.push(e);
    byDay.set(e.day, list);
  }
  return byDay;
}
