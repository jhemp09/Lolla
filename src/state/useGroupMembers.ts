import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { useUserName } from "./useUser";

/** Every username who's rated or scheduled anything in this group, plus the current user (even if they haven't yet). */
export function useGroupMembers(groupCode: string): string[] {
  const [myUserName] = useUserName();

  const members = useLiveQuery(async () => {
    const [scheduleRows, ratingRows] = await Promise.all([
      db.schedule.where("groupCode").equals(groupCode).toArray(),
      db.ratings.where("groupCode").equals(groupCode).toArray(),
    ]);
    const names = new Set<string>();
    for (const r of scheduleRows) names.add(r.userName);
    for (const r of ratingRows) names.add(r.userName);
    return names;
  }, [groupCode]);

  return useMemo(() => {
    const set = new Set(members ?? []);
    if (myUserName) set.add(myUserName);
    // Current user always first, everyone else alphabetical after.
    return Array.from(set).sort((a, b) => {
      if (a === myUserName) return -1;
      if (b === myUserName) return 1;
      return a.localeCompare(b);
    });
  }, [members, myUserName]);
}
