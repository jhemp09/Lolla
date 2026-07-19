import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { notifyLocalChange } from "../lib/autoSync";

export function useIsScheduled(groupCode: string, bandId: string, userName: string): boolean {
  const entry = useLiveQuery(
    () =>
      db.schedule
        .where("[groupCode+bandId+userName]")
        .equals([groupCode, bandId, userName])
        .filter((e) => !e.removed)
        .first(),
    [groupCode, bandId, userName],
  );
  return !!entry;
}

/** A given user's schedule entries in a group — "given" so it works for viewing any group member, not just yourself. */
export function useUserSchedule(groupCode: string, userName: string) {
  return (
    useLiveQuery(
      () =>
        db.schedule
          .where("userName")
          .equals(userName)
          .filter((e) => !e.removed && e.groupCode === groupCode)
          .toArray(),
      [groupCode, userName],
    ) ?? []
  );
}

export async function addToSchedule(groupCode: string, bandId: string, userName: string) {
  if (!userName || !groupCode) return;
  const existing = await db.schedule
    .where("[groupCode+bandId+userName]")
    .equals([groupCode, bandId, userName])
    .first();

  const addedAt = new Date().toISOString();
  if (existing) {
    await db.schedule.update(existing.id!, { removed: false, addedAt });
  } else {
    await db.schedule.add({ groupCode, bandId, userName, addedAt, removed: false });
  }
  notifyLocalChange();
}

export async function removeFromSchedule(groupCode: string, bandId: string, userName: string) {
  if (!userName || !groupCode) return;
  const existing = await db.schedule
    .where("[groupCode+bandId+userName]")
    .equals([groupCode, bandId, userName])
    .first();
  if (existing) {
    await db.schedule.update(existing.id!, { removed: true, addedAt: new Date().toISOString() });
    notifyLocalChange();
  }
}
