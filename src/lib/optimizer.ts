import type { Band, Day } from "../types";

export interface OptimizedDay {
  day: Day;
  bandIds: string[]; // in attendance order
  totalScore: number;
}

/** Sums each band's ratings across everyone in the group; unrated (0) contributes nothing. */
export function aggregateRatingWeights(
  ratings: { bandId: string; rating: number }[],
): Map<string, number> {
  const weights = new Map<string, number>();
  for (const r of ratings) {
    if (r.rating <= 0) continue;
    weights.set(r.bandId, (weights.get(r.bandId) ?? 0) + r.rating);
  }
  return weights;
}

/**
 * Picks, for each day, the sequence of rated bands that maximizes total group rating
 * while only chaining two picks back to back if there's enough time between them to
 * actually walk from one stage to the other. This is weighted interval scheduling
 * generalized with a stage-transition cost: model each rated band as a node, add a
 * directed edge i -> j (i earlier) when j is walk-feasible after i, then find the
 * max-weight path through that DAG via O(n^2) DP. Runs fully offline.
 */
export function optimizeGroupSchedule(
  bands: Band[],
  ratingWeights: Map<string, number>,
  walkMinutes: (stageA: string, stageB: string) => number,
): OptimizedDay[] {
  const days: Day[] = [1, 2, 3, 4];
  return days.map((day) => optimizeDay(day, bands, ratingWeights, walkMinutes));
}

function optimizeDay(
  day: Day,
  bands: Band[],
  ratingWeights: Map<string, number>,
  walkMinutes: (stageA: string, stageB: string) => number,
): OptimizedDay {
  const candidates = bands
    .filter((b) => b.day === day && (ratingWeights.get(b.id) ?? 0) > 0)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const n = candidates.length;
  if (n === 0) return { day, bandIds: [], totalScore: 0 };

  const weight = candidates.map((b) => ratingWeights.get(b.id) ?? 0);
  const best = new Array<number>(n).fill(0);
  const prev = new Array<number>(n).fill(-1);

  for (let j = 0; j < n; j++) {
    best[j] = weight[j];
    for (let i = 0; i < j; i++) {
      const gap = candidates[j].startMinutes - candidates[i].endMinutes;
      if (gap < 0) continue; // still overlaps i, never attendable back to back
      const needed = walkMinutes(candidates[i].stage, candidates[j].stage);
      if (gap >= needed && best[i] + weight[j] > best[j]) {
        best[j] = best[i] + weight[j];
        prev[j] = i;
      }
    }
  }

  let bestEnd = 0;
  for (let j = 1; j < n; j++) {
    if (best[j] > best[bestEnd]) bestEnd = j;
  }

  const chain: number[] = [];
  for (let cur = bestEnd; cur !== -1; cur = prev[cur]) {
    chain.push(cur);
  }
  chain.reverse();

  return {
    day,
    bandIds: chain.map((idx) => candidates[idx].id),
    totalScore: best[bestEnd],
  };
}
