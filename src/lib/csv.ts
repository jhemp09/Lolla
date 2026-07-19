import type { Band, Day, StageDistance } from "../types";

/** Minimal CSV parser: handles quoted fields with commas, no multi-line cells. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

function parseTimeToMinutes(value: string): number {
  const trimmed = value.trim();
  // Accept "HH:MM" (24h) or "H:MM AM/PM"
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const isPm = ampmMatch[3].toLowerCase() === "pm";
    if (h === 12) h = 0;
    return (isPm ? h + 12 : h) * 60 + m;
  }
  const [h, m] = trimmed.split(":").map((n) => parseInt(n, 10));
  return h * 60 + (m || 0);
}

/**
 * Expected header (case-insensitive): name, stage, day, start, end, genre, description
 * day: 1-4. start/end: "HH:MM" 24h or "H:MM AM/PM".
 */
export function parseBandsCsv(text: string): Band[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);

  const nameIdx = col("name");
  const stageIdx = col("stage");
  const dayIdx = col("day");
  const startIdx = col("start");
  const endIdx = col("end");
  const genreIdx = col("genre");
  const descIdx = col("description");

  if (nameIdx === -1 || stageIdx === -1 || dayIdx === -1 || startIdx === -1 || endIdx === -1) {
    throw new Error("CSV must have at least: name, stage, day, start, end columns.");
  }

  return rows.slice(1).map((r, i) => {
    const name = r[nameIdx]?.trim() ?? "";
    const stage = r[stageIdx]?.trim() ?? "";
    const day = (parseInt(r[dayIdx], 10) || 1) as Day;
    const startMinutes = parseTimeToMinutes(r[startIdx] ?? "0:00");
    const endMinutes = parseTimeToMinutes(r[endIdx] ?? "0:00");
    const genre = genreIdx !== -1 ? (r[genreIdx]?.trim() ?? "") : "";
    const description = descIdx !== -1 ? (r[descIdx]?.trim() ?? "") : "";

    return {
      id: `${day}-${stage}-${startMinutes}-${i}`.replace(/\s+/g, "_"),
      name,
      stage,
      day,
      startMinutes,
      endMinutes,
      genre,
      description,
    };
  });
}

/**
 * Expected header (case-insensitive, underscores optional): stage_a/stagea, stage_b/stageb,
 * minutes. One row per stage pair — only needs each pair once, order doesn't matter.
 */
export function parseStageDistancesCsv(text: string): StageDistance[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/_/g, ""));
  const col = (name: string) => header.indexOf(name);

  const aIdx = col("stagea");
  const bIdx = col("stageb");
  const minIdx = col("minutes");

  if (aIdx === -1 || bIdx === -1 || minIdx === -1) {
    throw new Error("CSV must have columns: stage_a, stage_b, minutes.");
  }

  return rows.slice(1).map((r) => ({
    stageA: r[aIdx]?.trim() ?? "",
    stageB: r[bIdx]?.trim() ?? "",
    minutes: parseInt(r[minIdx], 10) || 0,
  }));
}
