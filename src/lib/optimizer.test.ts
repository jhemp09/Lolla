import { describe, expect, it } from "vitest";
import type { Band } from "../types";
import { optimizeGroupSchedule } from "./optimizer";

function band(id: string, stage: string, day: 1 | 2 | 3 | 4, start: number, end: number): Band {
  return { id, name: id, stage, day, startMinutes: start, endMinutes: end, genre: "", description: "" };
}

function scheduleFor(
  bands: Band[],
  weights: Record<string, number>,
  walkMinutes: (a: string, b: string) => number = () => 12,
) {
  const result = optimizeGroupSchedule(bands, new Map(Object.entries(weights)), walkMinutes);
  return result.find((d) => d.day === 1)!;
}

describe("optimizeGroupSchedule", () => {
  it("never lets a lower-rated band bump an already-committed higher-rated one", () => {
    // Same slot, mutually exclusive; the 5 must win regardless of processing order.
    const bands = [band("Good", "A", 1, 600, 700), band("Filler", "B", 1, 620, 720)];
    const day = scheduleFor(bands, { Good: 5, Filler: 1 }, () => 60);
    expect(day.bandIds).toEqual(["Good"]);
  });

  it("still lets a low-rated band fill a genuine gap nothing better could use", () => {
    const bands = [
      band("Big", "A", 1, 600, 660),
      band("Filler", "B", 1, 670, 700), // 10-min gap, matches the walk exactly
      band("Next", "A", 1, 710, 770),
    ];
    const day = scheduleFor(bands, { Big: 5, Filler: 1, Next: 5 }, () => 10);
    expect(day.bandIds).toEqual(["Big", "Filler", "Next"]);
  });

  it("resolves a same-start-time, same-rating conflict by walk distance from the shared predecessor", () => {
    // The exact shape of the Ella/Suki case: two 5-rated picks starting together, one a
    // much shorter walk from the previous (also 5-rated) act than the other. Regression
    // test for the tie-break bug where the sort ran once per tier before anything in that
    // tier had committed, so it couldn't see who the real predecessor would be.
    const dist: Record<string, number> = { "Prev|Close": 2, "Prev|Far": 12, "Close|Far": 8 };
    const walkMinutes = (a: string, b: string) => (a === b ? 0 : (dist[[a, b].sort().join("|")] ?? 5));
    const bands = [
      band("Prev", "Prev", 1, 480, 540),
      band("Close", "Close", 1, 540, 640), // 100-min set, 2-min walk from Prev
      band("Far", "Far", 1, 540, 620), // 80-min set, 12-min walk from Prev
    ];
    const day = scheduleFor(bands, { Prev: 5, Close: 5, Far: 5 }, walkMinutes);
    expect(day.bandIds).toEqual(["Prev", "Close"]);
  });

  it("lets two equally-rated picks trade up to half of the anchor's own duration, not more", () => {
    const walkMinutes = () => 0;
    // Anchor duration 100 min -> 50-min budget at rating gap 0.
    const anchor = band("Anchor", "A", 1, 600, 700);

    const fitsWithin = band("Fits", "B", 1, 651, 751); // needs 49 min slack
    expect(scheduleFor([anchor, fitsWithin], { Anchor: 5, Fits: 5 }, walkMinutes).bandIds).toEqual([
      "Anchor",
      "Fits",
    ]);

    const exceedsBy1 = band("TooMuch", "B", 1, 649, 749); // needs 51 min slack
    expect(scheduleFor([anchor, exceedsBy1], { Anchor: 5, TooMuch: 5 }, walkMinutes).bandIds).toEqual([
      "Anchor",
    ]);
  });

  it("gives a much lower-rated candidate zero tolerance against a much higher-rated anchor", () => {
    // Max rating gap (4, e.g. 1 vs 5) -> 100% protection: not even one minute of slack.
    const walkMinutes = () => 11;
    const bands = [band("Big", "A", 1, 600, 660), band("Filler", "B", 1, 670, 700)]; // 10-min gap, needs 11
    const day = scheduleFor(bands, { Big: 5, Filler: 1 }, walkMinutes);
    expect(day.bandIds).toEqual(["Big"]);
  });

  it("chains an ordinary same-rating pair with a comfortably-fitting walk", () => {
    const bands = [band("A", "StageA", 1, 600, 660), band("B", "StageB", 1, 665, 720)];
    const day = scheduleFor(bands, { A: 3, B: 3 }, () => 10);
    expect(day.bandIds).toEqual(["A", "B"]);
  });
});
