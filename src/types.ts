export type Day = 1 | 2 | 3 | 4;

export interface Band {
  id: string;
  name: string;
  stage: string;
  day: Day;
  /** Minutes since midnight, e.g. 14:30 -> 870 */
  startMinutes: number;
  endMinutes: number;
  genre: string;
  description: string;
}

export interface Rating {
  id?: number;
  groupCode: string;
  bandId: string;
  userName: string;
  rating: number; // 1-5, 0 means unrated/removed
  notes: string;
  updatedAt: string; // ISO timestamp, used for sync conflict resolution
}

export interface ScheduleEntry {
  id?: number;
  groupCode: string;
  bandId: string;
  userName: string;
  addedAt: string; // ISO timestamp
  removed: boolean; // tombstone so removals can sync
}

/** Walking time between two stages, in minutes. Symmetric (stageA/stageB order doesn't matter). */
export interface StageDistance {
  id?: number;
  stageA: string;
  stageB: string;
  minutes: number;
}

/** One pick in a computed group itinerary for a given day, in attendance order. */
export interface GroupScheduleEntry {
  id?: number;
  groupCode: string;
  day: Day;
  order: number;
  bandId: string;
  generatedAt: string; // ISO timestamp, same for every row from one generation run
}

export interface SyncMeta {
  key: string;
  value: string;
}

export const DAY_LABELS: Record<Day, string> = {
  1: "Thursday",
  2: "Friday",
  3: "Saturday",
  4: "Sunday",
};

export function formatMinutes(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}
