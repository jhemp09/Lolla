import type { StageDistance } from "../types";

/**
 * Placeholder walk time (minutes) used for any stage pair with no real distance data
 * yet. Deliberately conservative-ish so the optimizer doesn't over-pack schedules
 * before real grounds distances are imported. Replace via CSV import on the Sync tab.
 */
export const DEFAULT_WALK_MINUTES = 12;

/** Builds a fast (stageA|stageB) -> minutes lookup, symmetric regardless of input order. */
export function buildDistanceLookup(distances: StageDistance[]): (a: string, b: string) => number {
  const map = new Map<string, number>();
  for (const d of distances) {
    const key = [d.stageA, d.stageB].sort().join("|");
    map.set(key, d.minutes);
  }
  return (a: string, b: string) => {
    if (a === b) return 0;
    const key = [a, b].sort().join("|");
    return map.get(key) ?? DEFAULT_WALK_MINUTES;
  };
}
