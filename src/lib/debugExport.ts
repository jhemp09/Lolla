import { db } from "../db/db";
import { aggregateRatingWeights, optimizeGroupSchedule } from "./optimizer";
import { buildDistanceLookup, DEFAULT_WALK_MINUTES } from "./stageDistances";

/**
 * Everything the group schedule optimizer reads, plus what it currently outputs, in one
 * plain-JSON snapshot — band names are included alongside every id so it's readable
 * without cross-referencing, for handing off when a scheduling result looks wrong instead
 * of reading times/ratings/distances off the screen by hand.
 */
export async function buildDebugExport(groupCode: string) {
  const [bands, stageDistances, ratings] = await Promise.all([
    db.bands.toArray(),
    db.stageDistances.toArray(),
    db.ratings.where("groupCode").equals(groupCode).toArray(),
  ]);
  const bandById = new Map(bands.map((b) => [b.id, b]));
  const weights = aggregateRatingWeights(ratings.map((r) => ({ bandId: r.bandId, rating: r.preRating })));
  const walkMinutes = buildDistanceLookup(stageDistances);
  const days = optimizeGroupSchedule(bands, weights, walkMinutes);

  return {
    exportedAt: new Date().toISOString(),
    groupCode,
    defaultWalkMinutes: DEFAULT_WALK_MINUTES,
    bands,
    stageDistances,
    ratings: ratings.map((r) => ({
      bandId: r.bandId,
      bandName: bandById.get(r.bandId)?.name ?? "(unknown band)",
      userName: r.userName,
      preRating: r.preRating,
      preNotes: r.preNotes,
    })),
    ratingWeights: [...weights.entries()].map(([bandId, averageRating]) => ({
      bandId,
      bandName: bandById.get(bandId)?.name ?? "(unknown band)",
      averageRating,
    })),
    computedSchedule: days.map((d) => ({
      day: d.day,
      totalScore: d.totalScore,
      picks: d.bandIds.map((id) => {
        const b = bandById.get(id);
        return {
          bandId: id,
          name: b?.name ?? "(unknown band)",
          stage: b?.stage ?? "",
          startMinutes: b?.startMinutes ?? 0,
          endMinutes: b?.endMinutes ?? 0,
          rating: weights.get(id) ?? 0,
        };
      }),
    })),
  };
}

/** Triggers a browser download of buildDebugExport's result as a formatted JSON file. */
export async function downloadDebugExport(groupCode: string): Promise<void> {
  const data = await buildDebugExport(groupCode);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lolla-debug-${groupCode}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
