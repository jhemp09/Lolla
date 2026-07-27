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
  day: 1 | 2 | 3 | 4 = 1,
) {
  const result = optimizeGroupSchedule(bands, new Map(Object.entries(weights)), walkMinutes);
  return result.find((d) => d.day === day)!;
}

/** Builds a walkMinutes function from [stageA, stageB, minutes] rows, order-agnostic —
 * mirrors buildDistanceLookup so real exported stage-distance data can be dropped in
 * directly. */
function distanceTable(rows: [string, string, number][]): (a: string, b: string) => number {
  const map = new Map(rows.map(([a, b, minutes]) => [[a, b].sort().join("|"), minutes]));
  return (a, b) => {
    if (a === b) return 0;
    const minutes = map.get([a, b].sort().join("|"));
    if (minutes === undefined) throw new Error(`no distance for ${a} <-> ${b}`);
    return minutes;
  };
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
    const walkMinutes = distanceTable([
      ["Prev", "Close", 2],
      ["Prev", "Far", 12],
      ["Close", "Far", 15],
    ]);
    const bands = [
      band("Prev", "Prev", 1, 480, 540),
      band("Close", "Close", 1, 540, 640), // 100-min set, 2-min walk from Prev
      band("Far", "Far", 1, 540, 620), // 80-min set, 12-min walk from Prev
    ];
    const day = scheduleFor(bands, { Prev: 5, Close: 5, Far: 5 }, walkMinutes);
    expect(day.bandIds).toEqual(["Prev", "Close"]);
  });

  it("resolves the real Ella Red / Suki Waterhouse conflict (both rated 5, same start time)", () => {
    // Real Day 2 lineup + real stage distances (from an actual group's export): six
    // rating-5 picks in a row, where Ella Red (BMI, 40 min) and Suki Waterhouse (Allianz,
    // 60 min) both start at the same minute. Ella wins and Suki is correctly excluded —
    // Suki would need 70 minutes of combined slack against Ella (40-min set, protects 20
    // of its own minutes at a 0 rating gap, plus Suki's own 30-min self-sacrifice budget
    // = 50 total), which the walk + full overlap can't fit within.
    const walkMinutes = distanceTable([
      ["Airbnb", "BMI", 7],
      ["Airbnb", "T-Mobile", 12],
      ["Airbnb", "Allianz", 10],
      ["Airbnb", "Bud Light", 7],
      ["BMI", "T-Mobile", 12],
      ["BMI", "Allianz", 10],
      ["BMI", "Bud Light", 7],
      ["T-Mobile", "Allianz", 2],
      ["T-Mobile", "Bud Light", 20],
      ["Allianz", "Bud Light", 17],
    ]);
    const bands = [
      band("Beno", "Airbnb", 2, 720, 750),
      band("ValenciaGrace", "BMI", 2, 780, 820),
      band("ZaraLarsson", "T-Mobile", 2, 1000, 1060),
      band("EllaRed", "BMI", 2, 1060, 1100),
      band("SukiWaterhouse", "Allianz", 2, 1060, 1120),
      band("YUNGBLUD", "Bud Light", 2, 1110, 1170),
    ];
    const weights = Object.fromEntries(bands.map((b) => [b.id, 5]));
    const day = scheduleFor(bands, weights, walkMinutes, 2);
    expect(day.bandIds).toEqual(["Beno", "ValenciaGrace", "ZaraLarsson", "EllaRed", "YUNGBLUD"]);
  });

  it("lets a lower-rated candidate trade time with a nearby-rated favorite (the real Paris Paloma case)", () => {
    // Real Day 1 lineup + real stage distances. Paris Paloma (3.5) sits between Between
    // Friends (4) and 5 Seconds of Summer (4.5) — it overlaps 5SOS by 15 minutes and needs
    // a 15-minute walk on top (30 total), which used to be rejected outright because only
    // 5SOS's own runtime was ever considered spendable. Now Paris's own 60-minute set can
    // also absorb part of that cost (its own tail), so the combined budget covers it. SB19
    // (4), which was narrowly excluded from the slot right before it by the same gap, is
    // fixed too.
    const walkMinutes = distanceTable([
      ["Tito's", "Bud Light", 2],
      ["Tito's", "T-Mobile", 15],
      ["Tito's", "Allianz", 15],
      ["Bud Light", "T-Mobile", 20],
      ["Bud Light", "Allianz", 17],
      ["T-Mobile", "Allianz", 2],
    ]);
    const bands = [
      band("Kingfishr", "Tito's", 1, 825, 885),
      band("BetweenFriends", "Bud Light", 1, 885, 945),
      band("SB19", "Allianz", 1, 930, 990),
      band("ParisPaloma", "Tito's", 1, 945, 1005),
      band("FiveSOS", "T-Mobile", 1, 990, 1050),
    ];
    const day = scheduleFor(
      bands,
      { Kingfishr: 4, BetweenFriends: 4, SB19: 4, ParisPaloma: 3.5, FiveSOS: 4.5 },
      walkMinutes,
    );
    expect(day.bandIds).toEqual(["Kingfishr", "BetweenFriends", "SB19", "ParisPaloma", "FiveSOS"]);
  });

  it("lets two equally-rated picks pool slack from both of their own durations", () => {
    // Anchor duration 100 min, candidate duration 100 min -> combined 100-min budget at
    // rating gap 0 (50 min from each side). Candidate starts after the anchor in both
    // cases so tier processing order (start-time fallback, both rated equally) is
    // unambiguous — only the walk time varies, to land exactly either side of the
    // 100-minute combined boundary.
    const anchor = band("Anchor", "A", 1, 600, 700);
    const candidate = band("Candidate", "B", 1, 601, 701); // 99-min natural overlap either way

    expect(scheduleFor([anchor, candidate], { Anchor: 5, Candidate: 5 }, () => 0).bandIds).toEqual([
      "Anchor",
      "Candidate",
    ]); // needs 99 min slack, within the 100-min budget

    expect(scheduleFor([anchor, candidate], { Anchor: 5, Candidate: 5 }, () => 2).bandIds).toEqual([
      "Anchor",
    ]); // needs 101 min slack, over the 100-min budget
  });

  it("lets a much lower-rated candidate trim only its own time against a much higher-rated anchor", () => {
    // Max rating gap (4, e.g. 1 vs 5) -> the anchor's own budget is 0, but the candidate's
    // full duration is still spendable from its own side — sacrificing a filler's own tail
    // costs the anchor nothing and is fine at any rating gap.
    const anchor = band("Big", "A", 1, 600, 660); // 60 min
    const candidate = band("Filler", "B", 1, 660, 720); // 60 min, needs exactly 50 min of slack
    const day = scheduleFor([anchor, candidate], { Big: 5, Filler: 1 }, () => 50);
    expect(day.bandIds).toEqual(["Big", "Filler"]);
  });

  it("still rejects a much lower-rated candidate once even its own full duration isn't enough", () => {
    const anchor = band("Big", "A", 1, 600, 660); // 60 min, 0-min own budget at max gap
    const candidate = band("Filler", "B", 1, 660, 720); // 60 min, full self-budget = 60
    const day = scheduleFor([anchor, candidate], { Big: 5, Filler: 1 }, () => 70); // needs 70
    expect(day.bandIds).toEqual(["Big"]);
  });

  it("chains an ordinary same-rating pair with a comfortably-fitting walk", () => {
    const bands = [band("A", "StageA", 1, 600, 660), band("B", "StageB", 1, 665, 720)];
    const day = scheduleFor(bands, { A: 3, B: 3 }, () => 10);
    expect(day.bandIds).toEqual(["A", "B"]);
  });
});
