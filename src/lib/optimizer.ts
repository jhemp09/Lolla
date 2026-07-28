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
 * How much of an act's own set length must be preserved when it's on one side of a
 * chained conflict — as a fraction of that set's own length, not a flat number of
 * minutes, and as a function of the *rating gap* between the two acts (higher minus
 * lower). Used for both sides of a pair, just applied in opposite directions:
 *
 * - The higher-rated ("anchor") side is protected by this fraction directly — at a
 *   0-point gap (two picks the group is equally excited about) half its runtime is
 *   tradeable; at the maximum 4-point gap (a 1 next to a 5) it's fully protected, not
 *   one minute given up.
 * - The lower-rated ("candidate") side gets the *complement*, i.e. it's willing to give
 *   up this same fraction of *itself*: also half at a 0-point gap, and effectively fully
 *   expendable at a 4-point gap.
 *
 * Splitting the budget this way (see allowedSlackMinutes) matters because those are
 * different questions: trimming a filler's own tail to make a walk work costs the anchor
 * nothing and is fine at any rating gap, but that's not the same as being willing to trim
 * the *anchor's* time for a much worse candidate — treating "does the walk fit" as one
 * combined number against only the anchor's clock (an earlier version of this) couldn't
 * tell those apart, and ended up rejecting fixable cases where the low-rated side could
 * have absorbed the whole cost itself.
 *
 * Tiers are processed highest-rated-first (see scheduleDay), so the anchor a candidate is
 * checked against is always rated at least as high as the candidate itself — this
 * difference is never negative in practice, but it's clamped defensively anyway.
 */
function protectFraction(ratingGap: number): number {
  return 0.5 + 0.125 * Math.min(4, Math.max(0, ratingGap));
}

/**
 * How much of a genuine 5 a given rating actually is, squared so anything short of a real
 * 5 tapers off fast: a 4 only gets 64% credit, a 3 gets 36%. protectFraction's generosity
 * (up to half an anchor's own runtime traded away at a 0-point gap) was calibrated entirely
 * around examples anchored to a 5 — "two competing 5s," "a 4 blocking a 5" — so a 1-point
 * gap between a merely-decent 4 and a 3 shouldn't earn the same trade room as the same
 * 1-point gap between a 5 and a 4 just because the *gap* looks identical; the anchor itself
 * has to actually be worth stretching for. Only ever applied to the anchor's own
 * sacrificeable minutes (see allowedSlackMinutes) — a candidate trimming its own tail to
 * make a walk work costs nobody else anything and doesn't need this gate, regardless of how
 * unexciting that candidate is.
 */
function anchorQuality(rating: number): number {
  return (rating / 5) ** 2;
}

/**
 * Total minutes of slack (see slackNeeded) a chained pair can spend before it's not worth
 * it, pooled from both sides: up to (1 - protectFraction) of the anchor's own runtime,
 * discounted by how close the anchor itself is to a genuine 5 (see anchorQuality), plus up
 * to protectFraction of the candidate's own runtime, undiscounted — the lower-rated side is
 * always willing to give up more of itself than it asks of the anchor. A clean fit
 * (slackNeeded <= 0) is always fine regardless of this budget either way.
 */
function allowedSlackMinutes(
  anchor: Band,
  anchorRating: number,
  candidate: Band,
  candidateRating: number,
): number {
  const protect = protectFraction(anchorRating - candidateRating);
  const anchorDuration = anchor.endMinutes - anchor.startMinutes;
  const candidateDuration = candidate.endMinutes - candidate.startMinutes;
  return anchorDuration * (1 - protect) * anchorQuality(anchorRating) + candidateDuration * protect;
}

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
 * Exact start/end times aren't a hard requirement — arriving a bit late, leaving a bit
 * early, or even genuinely overlapping a neighbor is fine, up to a point: a candidate is
 * feasible next to whichever bands are already scheduled immediately before and after it
 * as long as the combined walking-time-plus-overlap cost stays within a budget pooled from
 * *both* sides' own runtimes — some of it the neighbor's to give, some of it the
 * candidate's own (see allowedSlackMinutes). A band you're lukewarm on mostly trims its
 * own edges to fit a small gap; a band you both love just as much can trade real time with
 * a favorite in either direction — but only a genuine favorite: how much the higher-rated
 * side is willing to give up of *itself* also depends on how close to a full 5 it actually
 * is, not just how small the gap to its neighbor happens to be, so two merely-decent picks
 * a point apart don't get the same trade room as a 5 and a 4.
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

/**
 * Minutes of slack it'd take to chain `from` (ending at `fromEnd`, on `fromStage`) into
 * `to` (starting at `toStart`, on `toStage`) — the walk time minus whatever natural gap
 * already exists between them. Zero or negative means the gap already covers the walk, no
 * sacrifice needed; positive — and growing the more the two actually overlap in time —
 * means that much combined "arrive late to `to` / leave `from` early / both" is required.
 */
function slackNeeded(
  fromEnd: number,
  fromStage: string,
  toStart: number,
  toStage: string,
  walkMinutes: (a: string, b: string) => number,
): number {
  return walkMinutes(fromStage, toStage) - (toStart - fromEnd);
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
  // the very first, highest tier is ranked, so every candidate in it falls back to start
  // time — exactly the same fallback a candidate with nothing scheduled before it uses
  // at any tier.
  //
  // Re-ranked one pick at a time rather than sorted once up front: when several
  // same-rated bands are all candidates for the same tier (routine whenever more than
  // one thing shares the top rating), an earlier pick in *this* tier can itself become
  // the predecessor the rest are being measured against — a one-shot sort can't see
  // that, since nothing in the tier has been committed yet at sort time, so every
  // same-tier candidate would wrongly look predecessor-less and fall back to start time
  // regardless of which is actually the shorter walk.
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

    while (tier.length > 0) {
      tier.sort((a, b) => {
        const predA = findPredecessor(committed, a);
        const predB = findPredecessor(committed, b);
        const distA = predA ? walkMinutes(predA.stage, a.stage) : 0;
        const distB = predB ? walkMinutes(predB.stage, b.stage) : 0;
        return distA !== distB ? distA - distB : a.startMinutes - b.startMinutes;
      });
      const candidate = tier.shift()!;
      const { insertAt, predecessor, successor } = findInsertion(committed, candidate);
      const candidateScore = scoreOf(candidate);
      if (
        predecessor &&
        slackNeeded(predecessor.endMinutes, predecessor.stage, candidate.startMinutes, candidate.stage, walkMinutes) >
          allowedSlackMinutes(predecessor, scoreOf(predecessor), candidate, candidateScore)
      )
        continue;
      if (
        successor &&
        slackNeeded(candidate.endMinutes, candidate.stage, successor.startMinutes, successor.stage, walkMinutes) >
          allowedSlackMinutes(successor, scoreOf(successor), candidate, candidateScore)
      )
        continue;
      committed.splice(insertAt, 0, candidate);
    }
  }

  return {
    day,
    bandIds: committed.map((b) => b.id),
    totalScore: committed.reduce((sum, b) => sum + scoreOf(b), 0),
  };
}
