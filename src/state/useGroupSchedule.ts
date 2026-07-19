import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Band } from "../types";
import { optimizeGroupSchedule, aggregateRatingWeights, type OptimizedDay } from "../lib/optimizer";
import { buildDistanceLookup } from "../lib/stageDistances";
import { addToSchedule } from "./useSchedule";

/**
 * The group schedule purely as a function of the group's current ratings and the stage
 * distance matrix — both already sync via Supabase, so every device recomputes the same
 * result locally rather than a separate "answer" needing its own sync. Reactive: updates
 * the instant a rating changes locally OR a teammate's rating arrives via a sync pull,
 * since both are just writes to db.ratings that this live query picks up automatically.
 */
export function useComputedGroupSchedule(groupCode: string, bands: Band[]): OptimizedDay[] {
  const ratings = useLiveQuery(
    () => db.ratings.where("groupCode").equals(groupCode).toArray(),
    [groupCode],
  );
  const distances = useLiveQuery(() => db.stageDistances.toArray());

  return useMemo(() => {
    const weights = aggregateRatingWeights(
      (ratings ?? []).map((r) => ({ bandId: r.bandId, rating: r.preRating })),
    );
    const walkMinutes = buildDistanceLookup(distances ?? []);
    return optimizeGroupSchedule(bands, weights, walkMinutes);
  }, [ratings, distances, bands]);
}

/** Copies the group schedule's picks into one person's own schedule. Additive only — never removes anything they already picked themselves. */
export async function adoptGroupSchedule(
  groupCode: string,
  userName: string,
  days: OptimizedDay[],
): Promise<void> {
  for (const day of days) {
    for (const bandId of day.bandIds) {
      await addToSchedule(groupCode, bandId, userName);
    }
  }
}
