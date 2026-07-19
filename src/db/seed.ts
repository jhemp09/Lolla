import type { Band, Day } from "../types";

/**
 * Placeholder sample lineup: 7 stages x 4 days so the app has realistic
 * data to work with out of the box. Replace via the CSV import screen
 * with your real Lollapalooza lineup when you have it.
 */

const STAGES = [
  "Main Stage",
  "North Stage",
  "South Stage",
  "Grove Stage",
  "Underground Stage",
  "Sound Stage",
  "Discovery Stage",
] as const;

const GENRES = [
  "Indie Rock",
  "Hip-Hop",
  "Electronic",
  "Pop",
  "Alternative",
  "R&B",
  "Punk",
  "Folk",
  "House",
  "Metal",
];

const NAME_PART_A = [
  "Neon",
  "Velvet",
  "Echo",
  "Crimson",
  "Golden",
  "Midnight",
  "Electric",
  "Paper",
  "Wild",
  "Silver",
  "Glass",
  "Static",
  "Amber",
  "Lunar",
  "Copper",
];

const NAME_PART_B = [
  "Foxes",
  "Valley",
  "Riot",
  "Parade",
  "Collective",
  "Underground",
  "Motel",
  "Signal",
  "Bloom",
  "District",
  "Machine",
  "Orbit",
  "Static",
  "Tigers",
  "Society",
];

// Small deterministic PRNG so the sample dataset is stable across reloads/builds.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateBands(): Band[] {
  const rand = mulberry32(20260719);
  const bands: Band[] = [];
  const usedNames = new Set<string>();

  for (let day = 1 as Day; day <= 4; day = (day + 1) as Day) {
    for (const stage of STAGES) {
      // Each stage runs 11:00 AM (660 min) to ~10:00 PM (1320 min), 6-8 sets.
      let cursor = 660 + Math.floor(rand() * 30);
      const setsCount = 6 + Math.floor(rand() * 3);

      for (let i = 0; i < setsCount; i++) {
        const duration = [45, 45, 60, 60, 60, 75][Math.floor(rand() * 6)];
        const startMinutes = cursor;
        const endMinutes = Math.min(startMinutes + duration, 1350);

        let name = "";
        do {
          const a = NAME_PART_A[Math.floor(rand() * NAME_PART_A.length)];
          const b = NAME_PART_B[Math.floor(rand() * NAME_PART_B.length)];
          name = `${a} ${b}`;
        } while (usedNames.has(name));
        usedNames.add(name);

        const genre = GENRES[Math.floor(rand() * GENRES.length)];

        bands.push({
          id: `${day}-${stage}-${startMinutes}`.replace(/\s+/g, "_"),
          name,
          stage,
          day,
          startMinutes,
          endMinutes,
          genre,
          description: `${genre} act playing the ${stage} on day ${day}. Sample placeholder data — replace with your real lineup via import.`,
        });

        cursor = endMinutes + 15 + Math.floor(rand() * 20);
        if (cursor > 1320) break;
      }
    }
  }

  return bands;
}

export const SAMPLE_BANDS: Band[] = generateBands();
export const STAGE_LIST: string[] = [...STAGES];
