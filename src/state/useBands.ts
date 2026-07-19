import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Band } from "../types";

export function useAllBands(): Band[] {
  return useLiveQuery(() => db.bands.orderBy("startMinutes").toArray()) ?? [];
}

export function useBand(bandId: string | undefined): Band | undefined {
  return useLiveQuery(() => (bandId ? db.bands.get(bandId) : undefined), [bandId]);
}
