import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { notifyLocalChange } from "../lib/autoSync";
import type { Rating } from "../types";
import type { RatingImportRow } from "../lib/csv";
import { addToSchedule } from "./useSchedule";
import { computeGroupSchedule } from "./useGroupSchedule";

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
    if (row.preRating === 5) await autoAddMustSee(groupCode, bandId, row.userName);
  }

  if (imported > 0) notifyLocalChange();
  return { imported, skipped };
}
