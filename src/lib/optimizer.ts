import type { Band, Day } from "../types";

export interface OptimizedDay {
  day: Day;
  bandIds: string[]; // in attendance order
  totalScore: number;
}

/**
 * A group-schedule pick whose average rating is at or below this is "there because
 * nothing better fit that slot," not because the group actually wanted to see it — the
 * UI uses this to show those picks differently rather than implying they're a real
 * favorite. 2.5 lands right below "I could go either way," the midpoint of the scale.
 */
export const LOW_CONSENSUS_THRESHOLD = 2.5;

/**
 * Averages each band's ratings across whoever in the group actually rated it; unrated
 * (0) doesn't count for or against it, and people who never rated it at all aren't
 * counted as a silent 0 either — a band two people rated carefully (say 2s and 3s) isn't
 * average-diluted just because a third person hasn't gotten to it yet. A plain sum would
 * let one person's later, partial pass at rating things — a handful of enthusiastic
 * scores on top of two people's careful, complete ratings — outweigh what the group as a
 * whole actually thinks, purely by adding another number on top rather than blending in
 * with what's already there. Averaging means a new rating on an already-rated band
 * blends with the existing ones instead of stacking on top of them.
 *
 * A rating of 1 ("I hate this, I will not be in the vicinity of this sound") is treated
 * as a hard veto, not a weak positive — if anyone in the group rated a band 1, it's
 * excluded from the group schedule entirely (same weight as never having been rated),
 * rather than being averaged in as a small-but-real number the optimizer could still
 * pick when nothing else fits a slot. This matches how a 1-rating already works
 * everywhere else in the app (the "avoid" warning icon) — the group schedule shouldn't
 * be the one place it's silently ignored.
 */
export function aggregateRatingWeights(
  ratings: { bandId: string; rating: number }[],
): Map<string, number> {
  const avoided = new Set<string>();
  for (const r of ratings) {
    if (r.rating === 1) avoided.add(r.bandId);
  }
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const r of ratings) {
    if (r.rating <= 0 || avoided.has(r.bandId)) continue;
    sums.set(r.bandId, (sums.get(r.bandId) ?? 0) + r.rating);
    counts.set(r.bandId, (counts.get(r.bandId) ?? 0) + 1);
  }
  const weights = new Map<string, number>();
  for (const [bandId, sum] of sums) {
    weights.set(bandId, sum / (counts.get(bandId) ?? 1));
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
 * How hard each band's average group rating is pushed toward rewarding consensus before
 * chain scores are summed — see the comment in optimizeDay for what this trades off and
 * why 4 specifically. Tune up for an even stronger "prefer one mutual favorite" bias, or
 * down toward 1 to go back to a plain sum with no such preference.
 */
const RATING_EXPONENT = 4;

/**
 * Picks, for each day, the sequence of rated bands that maximizes total group rating —
 * where each band's average group rating is raised to RATING_EXPONENT before it's
 * summed, so one band the whole group loves outweighs a scattering of bands nobody loves
 * quite as much, even when the scattered ones would add up to more on a raw sum (see the
 * worked example in optimizeDay). Exact start/end times aren't a hard requirement —
 * arriving a bit late or leaving a bit early is fine — but you can't be two places at
 * once, and a chain only makes sense if you actually see most of each show, not just clip
 * the edge of it while walking through. So two picks can chain if there's a walk window
 * that fits within MAX_SKIP_MINUTES of slack at each end — leaving i no earlier than
 * MAX_SKIP_MINUTES before it ends, arriving at j no later than MAX_SKIP_MINUTES after it
 * starts. The only thing walking distance affects beyond that is which of several
 * equally-scored options to prefer at a given point in the chain: given a tie, the pick
 * whose path *up to* it was already the shorter walk wins, and only if that's tied too
 * does the length of this specific final hop settle it. Deliberately not the other way
 * around — weighing this hop's length first would let a short walk to whatever comes
 * *after* a tied pick override an obviously-closer option several stops back, which
 * reads as arbitrary when you're just comparing what's next to what came before it.
 * Modeled as weighted interval scheduling generalized with a stage-transition cost: each
 * rated band is a node, with a directed edge i -> j (i earlier by start time) whenever
 * that window fits the walk. Three DP values propagate together per node: the max score
 * reachable (primary), the winning predecessor's own walk-so-far (secondary tie-break),
 * and the cumulative walk including this node (tertiary tie-break, and what a later node
 * inherits as its own predecessor's walk-so-far) — so the result is the highest-scoring
 * schedule for the day, and at any point where two ways of extending it tie, the one
 * that was already the shorter walk up to now wins. O(n^2), runs fully offline.
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

  // Raising each band's average group rating to a power (rather than using it as-is)
  // means one band the whole group loves outweighs a scattering of bands nobody loves
  // quite as much, even when the raw averages alone would add up to more. Plainly
  // summing has no preference between "one thing everyone loves" and "a pile of things
  // nobody loves quite as much" as long as the totals match, which routinely traded away
  // a mutual favorite for two lower-consensus picks that happened to fit together —
  // squaring alone turned out not to push hard enough: a 4.5-average band (squared
  // 20.25) still lost to two overlapping 4.0 and 3.0-average bands (squared 16 + 9 =
  // 25). RATING_EXPONENT = 4 fixes that specific case with real margin (410 vs 337)
  // while still letting a genuinely much bigger combo win outright (two 5.0s beat one
  // 2.5 easily) and still letting two comparably-good picks (say 4.0 and 4.0) edge out
  // one only slightly higher single pick (4.5) — it's a push toward consensus, not an
  // absolute rule that fewer picks always wins.
  const weight = candidates.map((b) => {
    const raw = ratingWeights.get(b.id) ?? 0;
    return raw ** RATING_EXPONENT;
  });
  const best = new Array<number>(n).fill(0);
  // Cumulative walking minutes for the best chain ending at this node — propagates
  // forward exactly like before, and is what a later node inherits as its predecessor's
  // "walk so far" (see bestPredWalk below), and what the final day-end comparison uses.
  const bestWalk = new Array<number>(n).fill(0);
  // The winning predecessor's OWN bestWalk, kept separate from bestWalk[j] itself so a
  // tie-break can ask "was the path *before* this hop already the better one" ahead of
  // "is this specific final hop short" instead of collapsing both into one number. Without
  // this split, two score-tied options converging on the same later node get compared
  // purely by their last hop into that node — so an obviously-closer option two stops
  // back can still lose because the *other* option happens to set up a short final hop,
  // which reads as arbitrary when you're just looking at what's next to what.
  const bestPredWalk = new Array<number>(n).fill(0);
  const prev = new Array<number>(n).fill(-1);

  for (let j = 0; j < n; j++) {
    best[j] = weight[j];
    bestWalk[j] = 0;
    bestPredWalk[j] = 0;
    for (let i = 0; i < j; i++) {
      // Earliest you can leave i without skipping more than the cap, and latest you can
      // arrive at j without missing more than the cap of its start.
      const canLeaveAt = candidates[i].endMinutes - MAX_SKIP_MINUTES;
      const mustArriveBy = candidates[j].startMinutes + MAX_SKIP_MINUTES;
      const available = mustArriveBy - canLeaveAt;
      const needed = walkMinutes(candidates[i].stage, candidates[j].stage);
      if (available < needed) continue; // can't walk it without skipping more than the cap of either

      const candidateScore = best[i] + weight[j];
      const predWalk = bestWalk[i];
      const currentHop = bestWalk[j] - bestPredWalk[j];
      const better =
        candidateScore > best[j] ||
        (candidateScore === best[j] &&
          (predWalk < bestPredWalk[j] || (predWalk === bestPredWalk[j] && needed < currentHop)));
      if (better) {
        best[j] = candidateScore;
        bestPredWalk[j] = predWalk;
        bestWalk[j] = predWalk + needed;
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
