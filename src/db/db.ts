import Dexie, { type Table } from "dexie";
import type {
  Band,
  Rating,
  ScheduleEntry,
  SyncMeta,
  StageDistance,
  GroupScheduleEntry,
} from "../types";
import { SAMPLE_BANDS } from "./seed";
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

/**
 * Seeds the local DB with sample bands on first run only; never overwrites imported/edited
 * data. Uses bulkPut (idempotent upsert) rather than bulkAdd because React StrictMode/effect
 * re-invocation can call this twice concurrently in dev.
 */
export async function ensureSeeded(): Promise<void> {
  const count = await db.bands.count();
  if (count === 0) {
    await db.bands.bulkPut(SAMPLE_BANDS);
  }
}

/** Wipes all bands and re-seeds with the built-in sample dataset. Used by "Reset sample data". */
export async function reseedSampleData(): Promise<void> {
  await db.bands.clear();
  await db.bands.bulkPut(SAMPLE_BANDS);
}

/** Replaces all bands with an imported dataset (from CSV/XLSX import). Ratings/schedule keyed by bandId are preserved. */
export async function importBands(bands: Band[]): Promise<void> {
  await db.bands.clear();
  await db.bands.bulkPut(bands);
}

/** Replaces the stage-distance matrix with an imported one (from CSV import). */
export async function importStageDistances(distances: StageDistance[]): Promise<void> {
  await db.stageDistances.clear();
  await db.stageDistances.bulkPut(distances);
}
