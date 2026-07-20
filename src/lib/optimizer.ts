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
 * You have to actually be worth going for a set to count — this is the minimum fraction
 * of a band's own duration you must stay for (arriving) or have already caught (leaving)
 * for it to still count as "attended" when chained to a neighbor. Below this, you're not
 * meaningfully seeing the show, you're just passing through.
 */
const MIN_ATTENDANCE_FRACTION = 0.5;

/**
 * Picks, for each day, the sequence of rated bands that maximizes total group rating.
 * Exact start/end times aren't a hard requirement — arriving a bit late or leaving a bit
 * early is fine — but you can't be two places at once, and a chain only makes sense if
 * you actually see a meaningful chunk of each show, not just clip the edge of it while
 * walking through. So two picks can chain if there's a walk window that still leaves at
 * least half of each one's own duration watched (see MIN_ATTENDANCE_FRACTION) — half of i
 * from its start before you'd need to leave, half of j before its end for you to have
 * arrived by. The only thing walking distance affects beyond that is which of several
 * equally-rated schedules to prefer: given a tie in total rating, the one with less total
 * walking wins. Modeled as weighted interval scheduling generalized with a stage-transition
 * cost: each rated band is a node, with a directed edge i -> j (i earlier by start time)
 * whenever that half-attendance window fits the walk. Two DP values propagate together per
 * node: the max rating reachable (primary), and the minimum total walking minutes to
 * achieve that rating (secondary, tie-break only) — so the result is the highest-rated
 * schedule for the day, and among schedules tied for highest-rated, the one that crosses
 * the park least. O(n^2), runs fully offline.
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
      // Earliest you can leave i while still having watched at least half of it, and
      // latest you can arrive at j while still catching at least half of it.
      const minWatchI = (candidates[i].endMinutes - candidates[i].startMinutes) * MIN_ATTENDANCE_FRACTION;
      const minWatchJ = (candidates[j].endMinutes - candidates[j].startMinutes) * MIN_ATTENDANCE_FRACTION;
      const canLeaveAt = candidates[i].startMinutes + minWatchI;
      const mustArriveBy = candidates[j].endMinutes - minWatchJ;
      const available = mustArriveBy - canLeaveAt;
      const needed = walkMinutes(candidates[i].stage, candidates[j].stage);
      if (available < needed) continue; // can't walk it without shortchanging one of the two below half

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
