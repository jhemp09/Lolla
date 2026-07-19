import Dexie, { type Table } from "dexie";
import type { Band, Rating, ScheduleEntry, SyncMeta } from "../types";
import { SAMPLE_BANDS } from "./seed";

export class LollaDB extends Dexie {
  bands!: Table<Band, string>;
  ratings!: Table<Rating, number>;
  schedule!: Table<ScheduleEntry, number>;
  meta!: Table<SyncMeta, string>;

  constructor() {
    super("lolla-db");
    this.version(1).stores({
      bands: "id, stage, day, startMinutes",
      ratings: "++id, bandId, userName, [bandId+userName]",
      schedule: "++id, bandId, userName, [bandId+userName]",
      meta: "key",
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
