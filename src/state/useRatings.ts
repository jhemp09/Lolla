import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { notifyLocalChange } from "../lib/autoSync";

export function useRating(groupCode: string, bandId: string, userName: string): number {
  const rating = useLiveQuery(
    () =>
      db.ratings
        .where("[groupCode+bandId+userName]")
        .equals([groupCode, bandId, userName])
        .first(),
    [groupCode, bandId, userName],
  );
  return rating?.rating ?? 0;
}

export async function setRating(
  groupCode: string,
  bandId: string,
  userName: string,
  rating: number,
  notes = "",
) {
  if (!userName || !groupCode) return;
  const existing = await db.ratings
    .where("[groupCode+bandId+userName]")
    .equals([groupCode, bandId, userName])
    .first();

  const updatedAt = new Date().toISOString();
  if (existing) {
    await db.ratings.update(existing.id!, { rating, notes, updatedAt });
  } else {
    await db.ratings.add({ groupCode, bandId, userName, rating, notes, updatedAt });
  }
  notifyLocalChange();
}

/** All of the current group's ratings for a band (every member who's rated it). */
export function useBandRatings(groupCode: string, bandId: string) {
  return (
    useLiveQuery(
      () =>
        db.ratings
          .where("bandId")
          .equals(bandId)
          .filter((r) => r.groupCode === groupCode)
          .toArray(),
      [groupCode, bandId],
    ) ?? []
  );
}

/** Every rating recorded for the current group (used by the schedule optimizer). */
export async function getGroupRatings(groupCode: string) {
  return db.ratings.where("groupCode").equals(groupCode).toArray();
}
