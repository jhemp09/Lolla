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

  it("fixes SB19's own exclusion, and correctly still excludes Paris once SB19 takes its slot (the real Paris Paloma case)", () => {
    // Real Day 1 lineup + real stage distances. SB19 (4) was narrowly excluded from the
    // slot right after Between Friends by the pre-pooled-budget model; that's fixed here.
    // But SB19 winning that slot changes who Paris Paloma (3.5) actually has to fit next
    // to: not just 5 Seconds of Summer (4.5, which it *would* clear comfortably) but SB19
    // itself, which it overlaps by 45 of both their 60-minute runtimes (75% each) — the
    // same shape of conflict as Finn/Skye below, just between Paris and SB19 instead. SB19
    // rated higher, so it keeps the slot it already claimed; Paris rightly stays out this
    // time, correctly generalizing the anchorQuality fix rather than contradicting it.
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
    expect(day.bandIds).toEqual(["Kingfishr", "BetweenFriends", "SB19", "FiveSOS"]);
  });

  it("rejects two only-decent picks trading time just because their rating gap is small (the real Finn/Skye case)", () => {
    // Real Day 2 lineup + real stage distances. Skye Newman (3, Allianz, 60 min) and Finn
    // Wolfhard (4, Airbnb, 45 min) overlap by 40 minutes plus a 10-minute walk (50 total) —
    // only a 1-point gap, the same as Paris/5SOS above, but neither act is anywhere near a
    // genuine 5. Without anchorQuality this fit (a 4's own budget doesn't care how far that
    // 4 itself is from a 5), which is exactly the over-correction anchorQuality exists to
    // catch: Finn's own sacrificeable budget is discounted by how far it is from a real 5,
    // on top of the existing gap-based discount.
    const walkMinutes = distanceTable([["Allianz", "Airbnb", 10]]);
    const bands = [band("SkyeNewman", "Allianz", 2, 940, 1000), band("FinnWolfhard", "Airbnb", 2, 960, 1005)];
    const day = scheduleFor(bands, { SkyeNewman: 3, FinnWolfhard: 4 }, walkMinutes, 2);
    expect(day.bandIds).toEqual(["FinnWolfhard"]);
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

  it("still lets a below-the-gate candidate fill a genuinely clean gap, regardless of its own duration", () => {
    const anchor = band("Big", "A", 1, 600, 660);
    const candidate = band("Filler", "B", 1, 670, 750); // 80-min set, 10-min gap matches the walk exactly
    const day = scheduleFor([anchor, candidate], { Big: 5, Filler: 1 }, () => 10);
    expect(day.bandIds).toEqual(["Big", "Filler"]);
  });

  it("excludes a below-the-gate candidate once it needs more than the flat cushion, even with no literal overlap", () => {
    const anchor = band("Big", "A", 1, 600, 660);
    const candidate = band("Filler", "B", 1, 670, 750); // 10-min gap, needs 41 min of walk -> 31 needed, over the flat 30 cushion
    const day = scheduleFor([anchor, candidate], { Big: 5, Filler: 1 }, () => 41);
    expect(day.bandIds).toEqual(["Big"]);
  });

  it("excludes a below-the-gate candidate from any literal overlap at all, however small and regardless of its own duration", () => {
    // This is the case that motivated CANDIDATE_QUALITY_GATE: without it, a below-the-gate
    // candidate's own long duration gave it a large enough self-trim budget to shave both
    // its edges down to a sliver and wedge into an already-good stretch of schedule. A
    // long (100-min) set rated 1 must now be rejected from even a 1-minute overlap, the
    // same as a short one would be.
    const anchor = band("Big", "A", 1, 600, 660);
    const candidate = band("Filler", "B", 1, 659, 759); // 100-min set, overlaps Big's last minute
    const day = scheduleFor([anchor, candidate], { Big: 5, Filler: 1 }, () => 0);
    expect(day.bandIds).toEqual(["Big"]);
  });

  it("still lets a genuinely decent candidate (rated exactly at the gate) use the pooled duration budget", () => {
    const anchor = band("Anchor", "A", 1, 600, 660); // 60 min, rated 5
    const candidate = band("Candidate", "B", 1, 650, 710); // 60 min, rated 4 (at the gate) -> flexible mode applies
    const day = scheduleFor([anchor, candidate], { Anchor: 5, Candidate: 4 }, () => 12); // 10-min overlap + 12-min walk = 22 needed
    expect(day.bandIds).toEqual(["Anchor", "Candidate"]);
  });

  it("resolves the real Day 1 stretch: Elizabeth Nichols no longer wedges between Between Friends and Paris Paloma", () => {
    // Real Day 1 lineup + real stage distances, extended from the SB19/Paris case above
    // with Elizabeth Nichols (1, BMI, 920-960) added — it overlaps Between Friends by 25
    // minutes and Paris Paloma by 15, and used to wedge in by shaving both its own edges
    // down using its own 40-minute duration as a self-trim budget, despite being rated a
    // flat 1. Now excluded outright: below the gate, no overlap is tolerated regardless of
    // size or the candidate's own duration.
    const walkMinutes = distanceTable([
      ["Tito's", "Bud Light", 2],
      ["Tito's", "T-Mobile", 15],
      ["Tito's", "Allianz", 15],
      ["Bud Light", "T-Mobile", 20],
      ["Bud Light", "Allianz", 17],
      ["T-Mobile", "Allianz", 2],
      ["Tito's", "BMI", 5],
      ["Bud Light", "BMI", 7],
    ]);
    const bands = [
      band("Kingfishr", "Tito's", 1, 825, 885),
      band("BetweenFriends", "Bud Light", 1, 885, 945),
      band("ElizabethNichols", "BMI", 1, 920, 960),
      band("SB19", "Allianz", 1, 930, 990),
      band("ParisPaloma", "Tito's", 1, 945, 1005),
      band("FiveSOS", "T-Mobile", 1, 990, 1050),
    ];
    const day = scheduleFor(
      bands,
      { Kingfishr: 4, BetweenFriends: 4, ElizabethNichols: 1, SB19: 4, ParisPaloma: 3.5, FiveSOS: 4.5 },
      walkMinutes,
    );
    expect(day.bandIds).toEqual(["Kingfishr", "BetweenFriends", "SB19", "FiveSOS"]);
  });

  it("resolves the real Day 2 morning stretch: no below-the-gate act wedges between better ones", () => {
    // Real Day 2 lineup + real stage distances. Three separate below-the-gate acts each
    // used to wedge into an already-good stretch by trimming their own (sometimes
    // sizeable) duration: The Army, The Navy (3) between Beno (5) and Day We Ran (4.5),
    // Ella Boh (3) cutting into Claire Rosinkranz (4.5), and Mother Mother (1) cutting
    // into Finn Wolfhard (4). All three are now excluded; the favorites they were cutting
    // into keep their full sets.
    const walkMinutes = distanceTable([
      ["Airbnb", "Allianz", 10],
      ["Airbnb", "BMI", 7],
      ["Airbnb", "Bud Light", 7],
      ["Airbnb", "Tito's", 5],
      ["Allianz", "BMI", 10],
      ["Allianz", "Bud Light", 17],
      ["Allianz", "Tito's", 15],
      ["BMI", "Bud Light", 7],
      ["BMI", "Tito's", 5],
      ["Bud Light", "Tito's", 2],
    ]);
    const bands = [
      band("Beno", "Airbnb", 2, 720, 750),
      band("ArmyNavy", "Allianz", 2, 730, 775),
      band("DayWeRan", "Airbnb", 2, 770, 810),
      band("ValenciaGrace", "BMI", 2, 780, 820),
      band("ClaireRosinkranz", "Allianz", 2, 820, 880),
      band("EllaBoh", "BMI", 2, 850, 890),
      band("BaluBrigada", "Bud Light", 2, 870, 930),
      band("MotherMother", "Tito's", 2, 930, 990),
      band("FinnWolfhard", "Airbnb", 2, 960, 1005),
    ];
    const weights = {
      Beno: 5,
      ArmyNavy: 3,
      DayWeRan: 4.5,
      ValenciaGrace: 5,
      ClaireRosinkranz: 4.5,
      EllaBoh: 3,
      BaluBrigada: 4,
      MotherMother: 1,
      FinnWolfhard: 4,
    };
    const day = scheduleFor(bands, weights, walkMinutes, 2);
    expect(day.bandIds).toEqual([
      "Beno",
      "DayWeRan",
      "ValenciaGrace",
      "ClaireRosinkranz",
      "BaluBrigada",
      "FinnWolfhard",
    ]);
  });

  it("chains an ordinary same-rating pair with a comfortably-fitting walk", () => {
    const bands = [band("A", "StageA", 1, 600, 660), band("B", "StageB", 1, 665, 720)];
    const day = scheduleFor(bands, { A: 3, B: 3 }, () => 10);
    expect(day.bandIds).toEqual(["A", "B"]);
  });
});
