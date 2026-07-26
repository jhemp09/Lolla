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
 * Maximum minutes of a set you're allowed to miss at either end — arriving this late, or
 * leaving this early — for it to still count as genuinely attended when chained to a
 * neighbor. Deliberately a flat cap, not a fraction of the show's own length: a fraction
 * (e.g. "half") is forgiving in exactly the wrong direction — a 45-minute set only allows
 * skipping ~22 minutes, but a 2-hour headliner set would allow skipping a full hour, which
 * isn't "arriving a bit late," it's skipping most of the set. A flat cap scales the right
 * way regardless of how long the set runs.
 */
const MAX_SKIP_MINUTES = 15;

/**
 * Picks, for each day, the sequence of rated bands that maximizes total group rating —
 * where each band's raw group-rating total is squared before it's summed, so one band
 * the whole group loves outweighs a scattering of bands nobody loves quite as much, even
 * when the scattered ones add up to a higher raw total (see the squaring comment in
 * optimizeDay for the worked example). Exact start/end times aren't a hard requirement —
 * arriving a bit late or leaving a bit early is fine — but you can't be two places at
 * once, and a chain only makes sense if you actually see most of each show, not just clip
 * the edge of it while walking through. So two picks can chain if there's a walk window
 * that fits within MAX_SKIP_MINUTES of slack at each end — leaving i no earlier than
 * MAX_SKIP_MINUTES before it ends, arriving at j no later than MAX_SKIP_MINUTES after it
 * starts. The only thing walking distance affects beyond that is which of several
 * equally-scored schedules to prefer: given a tie, the one with less total walking wins.
 * Modeled as weighted interval scheduling generalized with a stage-transition cost: each
 * rated band is a node, with a directed edge i -> j (i earlier by start time) whenever
 * that window fits the walk. Two DP values propagate together per node: the max score
 * reachable (primary), and the minimum total walking minutes to achieve that score
 * (secondary, tie-break only) — so the result is the highest-scoring schedule for the
 * day, and among schedules tied for highest-scoring, the one that crosses the park
 * least. O(n^2), runs fully offline.
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

  // Squaring each band's raw group-rating total (rather than using it as-is) means one
  // band the whole group loves outweighs a scattering of bands nobody loves quite as
  // much, even when the scattered ones add up to more — e.g. a band both people rated 4
  // (total 8, squared 64) beats two other, unrelated bands totalling 6 and 5 (squared
  // 36 + 25 = 61) despite 6 + 5 > 8 on a raw sum. A plain sum has no preference between
  // "one thing everyone loves" and "a pile of things nobody loves quite as much" as long
  // as the totals match, which routinely traded away a mutual favorite for two
  // lower-consensus picks that simply happened to fit together and add up higher.
  const weight = candidates.map((b) => {
    const raw = ratingWeights.get(b.id) ?? 0;
    return raw * raw;
  });
  const best = new Array<number>(n).fill(0);
  const bestWalk = new Array<number>(n).fill(0);
  const prev = new Array<number>(n).fill(-1);

  for (let j = 0; j < n; j++) {
    best[j] = weight[j];
    bestWalk[j] = 0;
    for (let i = 0; i < j; i++) {
      // Earliest you can leave i without skipping more than the cap, and latest you can
      // arrive at j without missing more than the cap of its start.
      const canLeaveAt = candidates[i].endMinutes - MAX_SKIP_MINUTES;
      const mustArriveBy = candidates[j].startMinutes + MAX_SKIP_MINUTES;
      const available = mustArriveBy - canLeaveAt;
      const needed = walkMinutes(candidates[i].stage, candidates[j].stage);
      if (available < needed) continue; // can't walk it without skipping more than the cap of either

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
