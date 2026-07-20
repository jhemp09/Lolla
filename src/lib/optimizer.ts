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
 * Picks, for each day, the sequence of rated bands that maximizes total group rating —
 * arriving late, leaving early, or catching only part of a set is fine, so timing never
 * excludes a pick outright. The only thing walking distance affects is which of several
 * equally-rated schedules to prefer: given a tie in total rating, the one with less total
 * walking wins. Modeled as weighted interval scheduling generalized with a stage-transition
 * cost: each rated band is a node, with a directed edge i -> j (i earlier by start time)
 * whenever there's *some* plausible window to walk from i's stage to j's — using i's start
 * and j's end as the widest possible bound, not i's end and j's start, since you don't need
 * to catch either one in full. Two DP values propagate together per node: the max rating
 * reachable (primary), and the minimum total walking minutes to achieve that rating
 * (secondary, tie-break only) — so the result is the highest-rated schedule for the day,
 * and among schedules tied for highest-rated, the one that crosses the park least. O(n^2),
 * runs fully offline.
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
  const bestWalk = new Array<number>(n).fill(0);
  const prev = new Array<number>(n).fill(-1);

  for (let j = 0; j < n; j++) {
    best[j] = weight[j];
    bestWalk[j] = 0;
    for (let i = 0; i < j; i++) {
      // Widest plausible window: from the moment i starts to the moment j ends. You don't
      // need all of either — just enough combined time, somewhere in there, to make the walk.
      const available = candidates[j].endMinutes - candidates[i].startMinutes;
      const needed = walkMinutes(candidates[i].stage, candidates[j].stage);
      if (available < needed) continue; // even sacrificing all of both, the walk doesn't fit

      const candidateScore = best[i] + weight[j];
      const candidateWalk = bestWalk[i] + needed;
      const better =
        candidateScore > best[j] || (candidateScore === best[j] && candidateWalk < bestWalk[j]);
      if (better) {
        best[j] = candidateScore;
        bestWalk[j] = candidateWalk;
        prev[j] = i;
      }
    }
  }

  let bestEnd = 0;
  for (let j = 1; j < n; j++) {
    const better = best[j] > best[bestEnd] || (best[j] === best[bestEnd] && bestWalk[j] < bestWalk[bestEnd]);
    if (better) bestEnd = j;
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
