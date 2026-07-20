import { useRef } from "react";
import { useGroupCode } from "../state/useGroup";
import { notifyLocalChange } from "../lib/autoSync";
import { importBands, importStageDistances, migrateDescriptionNotes } from "../db/db";
import { importRatings } from "../state/useRatings";
import { parseBandsCsv, parseStageDistancesCsv, parseRatingsCsv } from "../lib/csv";
import { DEFAULT_WALK_MINUTES } from "../lib/stageDistances";

export function AdminPage() {
  const [groupCode] = useGroupCode();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const distancesInputRef = useRef<HTMLInputElement>(null);
  const ratingsInputRef = useRef<HTMLInputElement>(null);

  const doImport = async (file: File) => {
    try {
      const text = await file.text();
      const bands = parseBandsCsv(text);
      if (bands.length === 0) throw new Error("No rows found in that file.");
      await importBands(bands);
      notifyLocalChange();
    } catch {
      alert("Couldn't import that file — check it has name, stage, day, start, end columns.");
    }
  };

  const doImportDistances = async (file: File) => {
    try {
      const text = await file.text();
      const distances = parseStageDistancesCsv(text);
      if (distances.length === 0) throw new Error("No rows found in that file.");
      await importStageDistances(distances);
      notifyLocalChange();
    } catch {
      alert("Couldn't import that file — check it has stage_a, stage_b, minutes columns.");
    }
  };

  const doImportRatings = async (file: File) => {
    try {
      const text = await file.text();
      const rows = parseRatingsCsv(text);
      if (rows.length === 0) throw new Error("No rows found in that file.");
      const { imported, skipped } = await importRatings(groupCode, rows);
      const uniqueSkipped = [...new Set(skipped)];
      if (uniqueSkipped.length > 0) {
        alert(
          `Imported ${imported} rating(s). ${uniqueSkipped.length} band name(s) didn't match the current lineup and were skipped:\n\n${uniqueSkipped.join(", ")}`,
        );
      } else {
        alert(`Imported ${imported} rating(s).`);
      }
    } catch {
      alert("Couldn't import that file — check it has band, user, pre_rating columns.");
    }
  };

  const doMigrateDescriptionNotes = async () => {
    const migrated = await migrateDescriptionNotes(groupCode, ["Jess", "Tomek"]);
    notifyLocalChange();
    alert(
      migrated > 0
        ? `Moved notes for ${migrated} band(s) into Jess's and Tomek's pre-festival notes, and cleared their description.`
        : "Nothing to migrate — no bands currently have a description.",
    );
  };

  return (
    <div className="main">
      <div className="sync-card">
        <h2 style={{ fontSize: 16 }}>Import your real lineup</h2>
        <p className="status-text" style={{ marginTop: 6 }}>
          Export your spreadsheet as CSV with columns: name, stage, day (1-4), start,
          end (e.g. 14:30 or 2:30 PM), genre, description. This replaces the sample
          lineup; ratings/schedule already saved for matching band IDs are kept.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) doImport(file);
            e.target.value = "";
          }}
        />
        <div className="sync-row">
          <button className="primary-btn" onClick={() => fileInputRef.current?.click()}>
            Import CSV
          </button>
        </div>
      </div>

      <div className="sync-card">
        <h2 style={{ fontSize: 16 }}>Stage walking distances</h2>
        <p className="status-text" style={{ marginTop: 6 }}>
          Used by the group schedule optimizer to avoid back-to-back picks you can't
          actually walk between in time. Import a CSV with columns: stage_a, stage_b,
          minutes (one row per pair — order doesn't matter). Until you do, the
          optimizer assumes a {DEFAULT_WALK_MINUTES}-minute walk between any two
          different stages.
        </p>
        <input
          ref={distancesInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) doImportDistances(file);
            e.target.value = "";
          }}
        />
        <div className="sync-row">
          <button className="primary-btn" onClick={() => distancesInputRef.current?.click()}>
            Import CSV
          </button>
        </div>
      </div>

      <div className="sync-card">
        <h2 style={{ fontSize: 16 }}>Import pre-festival ratings</h2>
        <p className="status-text" style={{ marginTop: 6 }}>
          For bulk-loading ratings someone already collected elsewhere. Import a CSV
          with columns: band, user, pre_rating (1-5), pre_notes (optional). Bands are
          matched by name against the currently imported lineup — import your lineup
          first. Existing ratings for the same band/person are overwritten.
        </p>
        <input
          ref={ratingsInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) doImportRatings(file);
            e.target.value = "";
          }}
        />
        <div className="sync-row">
          <button className="primary-btn" onClick={() => ratingsInputRef.current?.click()}>
            Import CSV
          </button>
        </div>
      </div>

      <div className="sync-card">
        <h2 style={{ fontSize: 16 }}>One-time cleanup: move description notes</h2>
        <p className="status-text" style={{ marginTop: 6 }}>
          A spreadsheet import put Jess's and Tomek's personal notes into each band's
          shared description field instead of their own pre-festival notes. This moves
          that text onto the end of both of their pre-festival notes (below anything
          already there) and clears the description. Safe to run again — a second pass
          finds nothing left to move.
        </p>
        <div className="sync-row">
          <button className="primary-btn" onClick={doMigrateDescriptionNotes}>
            Migrate notes
          </button>
        </div>
      </div>
    </div>
  );
}
