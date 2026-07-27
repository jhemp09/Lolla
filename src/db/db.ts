import Dexie, { type Table } from "dexie";
import type { Band, Rating, ScheduleEntry, SyncMeta, StageDistance } from "../types";
import { getGroupCode, generateGroupCode, setGroupCode } from "../state/useGroup";

export class LollaDB extends Dexie {
  bands!: Table<Band, string>;
  ratings!: Table<Rating, number>;
  schedule!: Table<ScheduleEntry, number>;
  meta!: Table<SyncMeta, string>;
  stageDistances!: Table<StageDistance, number>;

  constructor() {
    super("lolla-db");
    this.version(1).stores({
      bands: "id, stage, day, startMinutes",
      ratings: "++id, bandId, userName, [bandId+userName]",
      schedule: "++id, bandId, userName, [bandId+userName]",
      meta: "key",
    });
    this.version(2)
      .stores({
        bands: "id, stage, day, startMinutes",
        ratings: "++id, groupCode, bandId, userName, [groupCode+bandId+userName]",
        schedule: "++id, groupCode, bandId, userName, [groupCode+bandId+userName]",
        meta: "key",
        stageDistances: "++id, &[stageA+stageB]",
        groupSchedule: "++id, groupCode, day, [groupCode+day]",
      })
      .upgrade(async (tx) => {
        // Pre-group-code rows belong to whatever group this device is/becomes part of.
        let code = getGroupCode();
        if (!code) {
          code = generateGroupCode();
          setGroupCode(code);
        }
        await tx.table("ratings").toCollection().modify({ groupCode: code });
        await tx.table("schedule").toCollection().modify({ groupCode: code });
      });
    this.version(3)
      .stores({
        bands: "id, stage, day, startMinutes",
        ratings: "++id, groupCode, bandId, userName, [groupCode+bandId+userName]",
        schedule: "++id, groupCode, bandId, userName, [groupCode+bandId+userName]",
        meta: "key",
        stageDistances: "++id, &[stageA+stageB]",
        groupSchedule: "++id, groupCode, day, [groupCode+day]",
      })
      .upgrade(async (tx) => {
        // Single rating/notes -> pre-festival rating/notes (unchanged meaning: this is
        // still the value that feeds the optimizer), plus a fresh, unrated during-festival pair.
        await tx
          .table("ratings")
          .toCollection()
          .modify((r) => {
            r.preRating = r.rating;
            r.preNotes = r.notes;
            r.duringRating = 0;
            r.duringNotes = "";
            delete r.rating;
            delete r.notes;
          });
      });
    // The group schedule was never actually read from or written to this table — it's
    // computed live from ratings + stage distances instead (see useComputedGroupSchedule)
    // — so it sat empty since v2. Drop it rather than keep migrating a table nothing uses.
    this.version(4).stores({ groupSchedule: null });
  }
}

export const db = new LollaDB();

/** Replaces all bands with an imported dataset (from CSV/XLSX import). Ratings/schedule keyed by bandId are preserved. */
export async function importBands(bands: Band[]): Promise<void> {
  await db.bands.clear();
  await db.bands.bulkPut(bands);
}

/** Edits a single band's own fields (name/stage/times/genre) in place — id and description are untouched. */
export async function updateBand(
  id: string,
  patch: Partial<Pick<Band, "name" | "stage" | "day" | "startMinutes" | "endMinutes" | "genre">>,
): Promise<void> {
  await db.bands.update(id, patch);
}

/** Creates a single band directly (as opposed to importBands' full-lineup replace). */
export async function addBand(band: Band): Promise<void> {
  await db.bands.add(band);
}

/** Removes a single band. Any ratings/schedule rows referencing it become orphaned — every
 * lookup elsewhere already treats a missing band as "skip this," same as after a CSV
 * re-import drops a band, so nothing extra needs cleaning up here. */
export async function deleteBand(id: string): Promise<void> {
  await db.bands.delete(id);
}

/** The stored row for a stage pair, checked under both orderings since the pair is
 * symmetric but the table's unique index isn't — a pair may have been written down
 * either way. */
async function findStageDistance(stageA: string, stageB: string) {
  return (
    (await db.stageDistances.where("[stageA+stageB]").equals([stageA, stageB]).first()) ??
    (await db.stageDistances.where("[stageA+stageB]").equals([stageB, stageA]).first())
  );
}

/** Sets (or updates in place) the walk time for a single stage pair, from the Admin
 * tab's editor. Order-agnostic: updates whichever ordering is already stored rather
 * than risking a duplicate reversed row. */
export async function setStageDistance(stageA: string, stageB: string, minutes: number): Promise<void> {
  const existing = await findStageDistance(stageA, stageB);
  if (existing) {
    await db.stageDistances.update(existing.id!, { minutes });
  } else {
    await db.stageDistances.add({ stageA, stageB, minutes });
  }
}

/** Clears a stage pair's override, reverting it to DEFAULT_WALK_MINUTES. */
export async function deleteStageDistance(stageA: string, stageB: string): Promise<void> {
  const existing = await findStageDistance(stageA, stageB);
  if (existing) await db.stageDistances.delete(existing.id!);
}

/**
 * Re-tags locally saved ratings/schedule rows from one group code to another.
 * Used when a device's local group code was previously empty (data recorded
 * before the account had a real group code assigned) and just got a real one
 * — that data belongs to the group the device is joining/starting, not left
 * behind under the empty code where nothing can ever see it again.
 */
export async function reassignGroupCode(oldCode: string, newCode: string): Promise<void> {
  if (oldCode === newCode) return;
  await db.ratings.where("groupCode").equals(oldCode).modify({ groupCode: newCode });
  await db.schedule.where("groupCode").equals(oldCode).modify({ groupCode: newCode });
}
