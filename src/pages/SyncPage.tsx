import { useRef } from "react";
import { useSyncConfig } from "../state/useSyncSettings";
import { useOnlineMode } from "../state/useOnlineMode";
import { useUserName } from "../state/useUser";
import { useGroupCode } from "../state/useGroup";
import { signOut } from "../state/useAuth";
import { useSyncStatus, notifyLocalChange } from "../lib/autoSync";
import { reseedSampleData, importBands, importStageDistances } from "../db/db";
import { importRatings } from "../state/useRatings";
import { parseBandsCsv, parseStageDistancesCsv, parseRatingsCsv } from "../lib/csv";
import { DEFAULT_WALK_MINUTES } from "../lib/stageDistances";
import { GroupCard } from "../components/GroupCard";

const STATUS_TEXT: Record<string, string> = {
  offline: "Working offline. Nothing touches the network.",
  idle: "Up to date.",
  syncing: "Syncing…",
  error: "Sync error — will retry automatically.",
  unconfigured: "Sync isn't set up for this build yet.",
};

export function SyncPage() {
  const config = useSyncConfig();
  const [online, setOnline] = useOnlineMode();
  const [userName] = useUserName();
  const [groupCode] = useGroupCode();
  const { status, errorMessage } = useSyncStatus();
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

  return (
    <div className="main">
      <div className="sync-card">
        <div className="sync-row" style={{ marginTop: 0 }}>
          <div>
            <h2 style={{ fontSize: 16 }}>Account</h2>
            <p className="status-text" style={{ marginTop: 4 }}>{userName}</p>
          </div>
          <button
            className="secondary-btn"
            onClick={() => {
              if (confirm("Log out? Your data stays saved — you'll need your username and password to get back in.")) {
                signOut();
              }
            }}
          >
            Log out
          </button>
        </div>
      </div>

      <GroupCard />

      <div className="sync-card">
        <div className="sync-row" style={{ marginTop: 0 }}>
          <div>
            <h2 style={{ fontSize: 16 }}>{online ? "Online" : "Offline"}</h2>
            <p className="status-text" style={{ marginTop: 4 }}>
              {status === "error" && errorMessage ? errorMessage : STATUS_TEXT[status]}
            </p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={online}
              disabled={!config.configured}
              onChange={(e) => setOnline(e.target.checked)}
            />
            <span className="toggle-track">
              <span className="toggle-thumb" />
            </span>
          </label>
        </div>
        {!config.configured && (
          <p className="status-text err" style={{ marginTop: 10 }}>
            This build has no Supabase project configured, so sync is unavailable.
          </p>
        )}
        {config.lastSync && (
          <p className="status-text" style={{ marginTop: 10 }}>
            Last synced: {new Date(config.lastSync).toLocaleString()}
          </p>
        )}
        <p className="status-text" style={{ marginTop: 10 }}>
          Flip this on when you have signal — your ratings, schedule, and lineup sync
          automatically with your group in the background. Flip it off (or just lose
          signal) and everything keeps working from what's already on your phone.
        </p>
      </div>

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
          <button
            className="secondary-btn"
            onClick={async () => {
              if (!confirm("Reset bands to the built-in sample dataset? Your ratings/schedule stay.")) return;
              await reseedSampleData();
              notifyLocalChange();
            }}
          >
            Reset to sample lineup
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
    </div>
  );
}
