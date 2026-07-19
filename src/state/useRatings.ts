import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { notifyLocalChange } from "../lib/autoSync";
import type { Rating } from "../types";
import type { RatingImportRow } from "../lib/csv";

export interface BandRating {
  preRating: number;
  preNotes: string;
  duringRating: number;
  duringNotes: string;
}

const EMPTY_RATING: BandRating = { preRating: 0, preNotes: "", duringRating: 0, duringNotes: "" };

export function useBandRating(groupCode: string, bandId: string, userName: string): BandRating {
  const rating = useLiveQuery(
    () =>
      db.ratings
        .where("[groupCode+bandId+userName]")
        .equals([groupCode, bandId, userName])
        .first(),
    [groupCode, bandId, userName],
  );
  if (!rating) return EMPTY_RATING;
  return {
    preRating: rating.preRating,
    preNotes: rating.preNotes,
    duringRating: rating.duringRating,
    duringNotes: rating.duringNotes,
  };
}

/** Cheap read for list-tile indicators that only need the pre-festival number, not notes. */
export function usePreRating(groupCode: string, bandId: string, userName: string): number {
  const rating = useLiveQuery(
    () =>
      db.ratings
        .where("[groupCode+bandId+userName]")
        .equals([groupCode, bandId, userName])
        .first(),
    [groupCode, bandId, userName],
  );
  return rating?.preRating ?? 0;
}

async function patchRating(
  groupCode: string,
  bandId: string,
  userName: string,
  patch: Partial<Pick<Rating, "preRating" | "preNotes" | "duringRating" | "duringNotes">>,
) {
  if (!userName || !groupCode) return;
  const existing = await db.ratings
    .where("[groupCode+bandId+userName]")
    .equals([groupCode, bandId, userName])
    .first();

  const updatedAt = new Date().toISOString();
  if (existing) {
    await db.ratings.update(existing.id!, { ...patch, updatedAt });
  } else {
    await db.ratings.add({
      groupCode,
      bandId,
      userName,
      preRating: 0,
      preNotes: "",
      duringRating: 0,
      duringNotes: "",
      ...patch,
      updatedAt,
    });
  }
  notifyLocalChange();
}

export function setPreRating(groupCode: string, bandId: string, userName: string, preRating: number) {
  return patchRating(groupCode, bandId, userName, { preRating });
}

export function setPreNotes(groupCode: string, bandId: string, userName: string, preNotes: string) {
  return patchRating(groupCode, bandId, userName, { preNotes });
}

export function setDuringRating(groupCode: string, bandId: string, userName: string, duringRating: number) {
  return patchRating(groupCode, bandId, userName, { duringRating });
}

export function setDuringNotes(groupCode: string, bandId: string, userName: string, duringNotes: string) {
  return patchRating(groupCode, bandId, userName, { duringNotes });
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

/**
 * Bulk-imports pre-festival ratings matched to the current lineup by band name
 * (case-insensitive) rather than band ID, since a bulk historical import has no
 * local IDs to reference. Rows whose band name doesn't match anything currently
 * imported are skipped and reported back so the caller can surface them.
 */
export async function importRatings(
  groupCode: string,
  rows: RatingImportRow[],
): Promise<{ imported: number; skipped: string[] }> {
  const bands = await db.bands.toArray();
  const byName = new Map(bands.map((b) => [b.name.trim().toLowerCase(), b.id]));

  let imported = 0;
  const skipped: string[] = [];
  const updatedAt = new Date().toISOString();

  for (const row of rows) {
    const bandId = byName.get(row.bandName.trim().toLowerCase());
    if (!bandId) {
      skipped.push(row.bandName);
      continue;
    }
    const existing = await db.ratings
      .where("[groupCode+bandId+userName]")
      .equals([groupCode, bandId, row.userName])
      .first();
    if (existing) {
      await db.ratings.update(existing.id!, {
        preRating: row.preRating,
        preNotes: row.preNotes,
        updatedAt,
      });
    } else {
      await db.ratings.add({
        groupCode,
        bandId,
        userName: row.userName,
        preRating: row.preRating,
        preNotes: row.preNotes,
        duringRating: 0,
        duringNotes: "",
        updatedAt,
      });
    }
    imported++;
  }

  if (imported > 0) notifyLocalChange();
  return { imported, skipped };
}
