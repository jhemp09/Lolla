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
  const addedAt = new Date().toISOString();
  // Wrapped in one transaction so the "does a row already exist" check and the add/update
  // it decides on can't be split apart by another write for the same key landing in between
  // — see the identical comment on patchRating in useRatings.ts for why that race matters.
  await db.transaction("rw", db.schedule, async () => {
    const existing = await db.schedule
      .where("[groupCode+bandId+userName]")
      .equals([groupCode, bandId, userName])
      .first();
    if (existing) {
      await db.schedule.update(existing.id!, { removed: false, addedAt });
    } else {
      await db.schedule.add({ groupCode, bandId, userName, addedAt, removed: false });
    }
  });
  notifyLocalChange();
}

export async function removeFromSchedule(groupCode: string, bandId: string, userName: string) {
  if (!userName || !groupCode) return;
  let removedSomething = false;
  await db.transaction("rw", db.schedule, async () => {
    const existing = await db.schedule
      .where("[groupCode+bandId+userName]")
      .equals([groupCode, bandId, userName])
      .first();
    if (existing) {
      await db.schedule.update(existing.id!, { removed: true, addedAt: new Date().toISOString() });
      removedSomething = true;
    }
  });
  if (removedSomething) notifyLocalChange();
}
