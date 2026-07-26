import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { notifyLocalChange } from "../lib/autoSync";
import type { Rating } from "../types";
import type { RatingImportRow } from "../lib/csv";
import { addToSchedule } from "./useSchedule";
import { computeGroupSchedule } from "./useGroupSchedule";

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

/** Band IDs a given member rated 1 pre-festival — "actively want to avoid," surfaced as a warning icon on their schedule. */
export function useAvoidBandIds(groupCode: string, userName: string): Set<string> {
  const rows = useLiveQuery(
    () =>
      db.ratings
        .where("groupCode")
        .equals(groupCode)
        .filter((r) => r.userName === userName && r.preRating === 1)
        .toArray(),
    [groupCode, userName],
  );
  return useMemo(() => new Set((rows ?? []).map((r) => r.bandId)), [rows]);
}

/** This user's pre-festival rating for every band they've rated in this group — for the Bands
 * list's rating filter. A band with no row here is implicitly unrated (0), same as usePreRating. */
export function useUserPreRatings(groupCode: string, userName: string): Map<string, number> {
  const rows = useLiveQuery(
    () =>
      db.ratings
        .where("groupCode")
        .equals(groupCode)
        .filter((r) => r.userName === userName)
        .toArray(),
    [groupCode, userName],
  );
  return useMemo(() => new Map((rows ?? []).map((r) => [r.bandId, r.preRating])), [rows]);
}

/** Every group member's pre-festival rating for one band — what actually feeds the
 * group schedule's scoring, surfaced directly so a "why isn't this winning its slot"
 * question can be answered by looking, not guessing. Zero-rated/unrated members are
 * omitted, matching aggregateRatingWeights' own treatment of a 0 as "no opinion." */
export function useGroupRatingsForBand(
  groupCode: string,
  bandId: string,
): { userName: string; preRating: number }[] {
  const rows = useLiveQuery(
    () =>
      db.ratings
        .where("groupCode")
        .equals(groupCode)
        .filter((r) => r.bandId === bandId && r.preRating > 0)
        .toArray(),
    [groupCode, bandId],
  );
  return useMemo(
    () => (rows ?? []).map((r) => ({ userName: r.userName, preRating: r.preRating })).sort((a, b) => a.userName.localeCompare(b.userName)),
    [rows],
  );
}

async function patchRating(
  groupCode: string,
  bandId: string,
  userName: string,
  patch: Partial<Pick<Rating, "preRating" | "preNotes" | "duringRating" | "duringNotes">>,
) {
  if (!userName || !groupCode) return;
  const updatedAt = new Date().toISOString();
  // Wrapped in one transaction so the "does a row already exist" check and the add/update
  // it decides on can't be split apart by another write for the same key landing in between
  // — that race is exactly how two local rows for the same (groupCode, bandId, userName)
  // used to end up existing at once, which is harmless to read but fatal on push (Postgres's
  // upsert can't target the same row twice in one statement and rejects the whole batch).
  await db.transaction("rw", db.ratings, async () => {
    const existing = await db.ratings
      .where("[groupCode+bandId+userName]")
      .equals([groupCode, bandId, userName])
      .first();
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
  });
  notifyLocalChange();
}

export async function setPreRating(groupCode: string, bandId: string, userName: string, preRating: number) {
  await patchRating(groupCode, bandId, userName, { preRating });
  if (preRating === 5) await autoAddMustSee(groupCode, bandId, userName);
}

/**
 * Rating something "I cannot miss this band" is a strong enough signal to seed it straight
 * into your personal schedule automatically, rather than making you remember to also go tap
 * "Add to schedule." Skipped if you've already got an opinion on this band's schedule entry
 * one way or the other (added it yourself, or explicitly removed it — either way that's your
 * call now, not ours to override), or if the group schedule already includes it, since the
 * individual view already shows every group pick as a base layer — adding it again would
 * just be a redundant "deviation" pick for a band that's already covered.
 */
async function autoAddMustSee(groupCode: string, bandId: string, userName: string) {
  const existing = await db.schedule
    .where("[groupCode+bandId+userName]")
    .equals([groupCode, bandId, userName])
    .first();
  if (existing) return;

  const band = await db.bands.get(bandId);
  if (!band) return;

  const groupDays = await computeGroupSchedule(groupCode);
  const alreadyInGroupSchedule = groupDays.some(
    (d) => d.day === band.day && d.bandIds.includes(bandId),
  );
  if (alreadyInGroupSchedule) return;

  await addToSchedule(groupCode, bandId, userName);
}

/**
 * Backfills auto-add for every 5-rated band a user already has, in one pass — for ratings
 * that were set before the auto-add existed, or that arrived via a bulk CSV import (which
 * writes ratings straight to the table, bypassing setPreRating and the trigger on it
 * entirely). Cheap to call repeatedly: each band's own existing-entry check already makes
 * it a no-op the second time.
 */
export async function syncMustSeeSchedule(groupCode: string, userName: string): Promise<void> {
  if (!userName || !groupCode) return;
  const fiveStars = await db.ratings
    .where("groupCode")
    .equals(groupCode)
    .filter((r) => r.userName === userName && r.preRating === 5)
    .toArray();
  for (const r of fiveStars) {
    await autoAddMustSee(groupCode, r.bandId, userName);
  }
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
    await db.transaction("rw", db.ratings, async () => {
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
    });
    imported++;
    if (row.preRating === 5) await autoAddMustSee(groupCode, bandId, row.userName);
  }

  if (imported > 0) notifyLocalChange();
  return { imported, skipped };
}
