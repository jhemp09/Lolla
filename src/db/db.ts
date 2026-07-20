import Dexie, { type Table } from "dexie";
import type {
  Band,
  Rating,
  ScheduleEntry,
  SyncMeta,
  StageDistance,
  GroupScheduleEntry,
} from "../types";
import { getGroupCode, generateGroupCode, setGroupCode } from "../state/useGroup";

export class LollaDB extends Dexie {
  bands!: Table<Band, string>;
  ratings!: Table<Rating, number>;
  schedule!: Table<ScheduleEntry, number>;
  meta!: Table<SyncMeta, string>;
  stageDistances!: Table<StageDistance, number>;
  groupSchedule!: Table<GroupScheduleEntry, number>;

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

/** Replaces the stage-distance matrix with an imported one (from CSV import). */
export async function importStageDistances(distances: StageDistance[]): Promise<void> {
  await db.stageDistances.clear();
  await db.stageDistances.bulkPut(distances);
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
