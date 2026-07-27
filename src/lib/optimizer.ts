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
 * A rating of 1 is *not* special-cased here — see optimizeGroupSchedule for why a band
 * anyone hated can still end up in the schedule, but can never cost the group something
 * they'd have preferred more.
 */
export function aggregateRatingWeights(
  ratings: { bandId: string; rating: number }[],
): Map<string, number> {
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const r of ratings) {
    if (r.rating <= 0) continue;
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
 * Picks, for each day, which rated bands to attend by considering them highest-rated
 * first and slotting each one into the day if it fits around whatever higher-rated bands
 * are already committed — never the other way around. A band only ever competes against
 * bands rated the same or higher; once something is committed, nothing lower-rated can
 * bump it or be preferred over it. A low-rated band (even one someone rated a flat-out
 * 1) can still end up in the schedule if it's the only thing that fits a genuine gap,
 * but it can never cost the group a band they'd have rated more highly — by the time a
 * lower-rated band is even considered, every higher-rated one has already had first
 * claim on the day. (An earlier version instead maximized total group score across the
 * whole day, which could trade away a single well-loved band for a combination of
 * lower-rated ones that happened to add up to more — mathematically "optimal," but not
 * what anyone actually wants from a group schedule.)
 *
 * Exact start/end times aren't a hard requirement — arriving a bit late or leaving a bit
 * early is fine — but you can't be two places at once, and a slot only makes sense to
 * fill if you'd actually see most of the show, not just clip the edge of it while
 * walking through. So a candidate is only feasible next to whichever bands are already
 * scheduled immediately before and after it if there's a walk window within
 * MAX_SKIP_MINUTES of slack at each end.
 *
 * Ties in rating are broken by preferring whichever candidate is the shorter walk from
 * the band already scheduled right before it (not after — see the worked example below)
 * — falling back to start time for a candidate with nothing scheduled before it yet.
 * Runs fully offline.
 */
export function optimizeGroupSchedule(
  bands: Band[],
  ratingWeights: Map<string, number>,
  walkMinutes: (stageA: string, stageB: string) => number,
): OptimizedDay[] {
  const days: Day[] = [1, 2, 3, 4];
  return days.map((day) => scheduleDay(day, bands, ratingWeights, walkMinutes));
}

/** The already-committed band immediately before `candidate`'s start time, if any. */
function findPredecessor(committed: Band[], candidate: Band): Band | undefined {
  let predecessor: Band | undefined;
  for (const b of committed) {
    if (b.startMinutes < candidate.startMinutes) predecessor = b;
    else break;
  }
  return predecessor;
}

/** Where `candidate` would land in `committed` (kept sorted by startMinutes), and its
 * chronological neighbors there — without actually inserting it. */
function findInsertion(committed: Band[], candidate: Band) {
  let insertAt = 0;
  while (insertAt < committed.length && committed[insertAt].startMinutes < candidate.startMinutes) {
    insertAt++;
  }
  return {
    insertAt,
    predecessor: insertAt > 0 ? committed[insertAt - 1] : undefined,
    successor: insertAt < committed.length ? committed[insertAt] : undefined,
  };
}

function fitsWalk(from: Band, to: Band, walkMinutes: (a: string, b: string) => number): boolean {
  const canLeaveAt = from.endMinutes - MAX_SKIP_MINUTES;
  const mustArriveBy = to.startMinutes + MAX_SKIP_MINUTES;
  const needed = walkMinutes(from.stage, to.stage);
  return mustArriveBy - canLeaveAt >= needed;
}

function scheduleDay(
  day: Day,
  bands: Band[],
  ratingWeights: Map<string, number>,
  walkMinutes: (stageA: string, stageB: string) => number,
): OptimizedDay {
  const candidates = bands.filter((b) => b.day === day && (ratingWeights.get(b.id) ?? 0) > 0);

  // Highest-rated first; within a tie, whichever is the shorter walk from whatever's
  // already committed right before it wins that tie (not the band scheduled after it —
  // weighing the outgoing hop first would let a short walk to whatever comes *after* a
  // tied pick override an obviously-closer option, which reads as arbitrary when you're
  // just comparing what's next to what came before it). Nothing is committed yet when
  // the very first, highest tier is sorted, so every candidate in it falls back to start
  // time — exactly the same fallback a candidate with nothing scheduled before it uses
  // at any tier.
  const committed: Band[] = [];
  const scoreOf = (b: Band) => ratingWeights.get(b.id) ?? 0;

  const remaining = [...candidates];
  while (remaining.length > 0) {
    let topScore = -Infinity;
    for (const c of remaining) topScore = Math.max(topScore, scoreOf(c));
    const tier = remaining.filter((c) => scoreOf(c) === topScore);
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (scoreOf(remaining[i]) === topScore) remaining.splice(i, 1);
    }

    tier.sort((a, b) => {
      const predA = findPredecessor(committed, a);
      const predB = findPredecessor(committed, b);
      const distA = predA ? walkMinutes(predA.stage, a.stage) : 0;
      const distB = predB ? walkMinutes(predB.stage, b.stage) : 0;
      return distA !== distB ? distA - distB : a.startMinutes - b.startMinutes;
    });

    for (const candidate of tier) {
      const { insertAt, predecessor, successor } = findInsertion(committed, candidate);
      if (predecessor && candidate.startMinutes < predecessor.endMinutes) continue; // overlaps
      if (successor && candidate.endMinutes > successor.startMinutes) continue; // overlaps
      if (predecessor && !fitsWalk(predecessor, candidate, walkMinutes)) continue;
      if (successor && !fitsWalk(candidate, successor, walkMinutes)) continue;
      committed.splice(insertAt, 0, candidate);
    }
  }

  return {
    day,
    bandIds: committed.map((b) => b.id),
    totalScore: committed.reduce((sum, b) => sum + scoreOf(b), 0),
  };
}
