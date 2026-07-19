import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";

export function useRating(bandId: string, userName: string): number {
  const rating = useLiveQuery(
    () => db.ratings.where("[bandId+userName]").equals([bandId, userName]).first(),
    [bandId, userName],
  );
  return rating?.rating ?? 0;
}

export async function setRating(bandId: string, userName: string, rating: number, notes = "") {
  if (!userName) return;
  const existing = await db.ratings
    .where("[bandId+userName]")
    .equals([bandId, userName])
    .first();

  const updatedAt = new Date().toISOString();
  if (existing) {
    await db.ratings.update(existing.id!, { rating, notes, updatedAt });
  } else {
    await db.ratings.add({ bandId, userName, rating, notes, updatedAt });
  }
}

/** All ratings for a band, across every group member (for "shared group" visibility). */
export function useBandRatings(bandId: string) {
  return useLiveQuery(() => db.ratings.where("bandId").equals(bandId).toArray(), [bandId]) ?? [];
}
