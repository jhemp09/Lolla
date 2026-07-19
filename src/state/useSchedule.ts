import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";

export function useIsScheduled(bandId: string, userName: string): boolean {
  const entry = useLiveQuery(
    () =>
      db.schedule
        .where("[bandId+userName]")
        .equals([bandId, userName])
        .filter((e) => !e.removed)
        .first(),
    [bandId, userName],
  );
  return !!entry;
}

export function useMySchedule(userName: string) {
  return (
    useLiveQuery(
      () =>
        db.schedule
          .where("userName")
          .equals(userName)
          .filter((e) => !e.removed)
          .toArray(),
      [userName],
    ) ?? []
  );
}

export async function addToSchedule(bandId: string, userName: string) {
  if (!userName) return;
  const existing = await db.schedule
    .where("[bandId+userName]")
    .equals([bandId, userName])
    .first();

  const addedAt = new Date().toISOString();
  if (existing) {
    await db.schedule.update(existing.id!, { removed: false, addedAt });
  } else {
    await db.schedule.add({ bandId, userName, addedAt, removed: false });
  }
}

export async function removeFromSchedule(bandId: string, userName: string) {
  if (!userName) return;
  const existing = await db.schedule
    .where("[bandId+userName]")
    .equals([bandId, userName])
    .first();
  if (existing) {
    await db.schedule.update(existing.id!, { removed: true, addedAt: new Date().toISOString() });
  }
}
