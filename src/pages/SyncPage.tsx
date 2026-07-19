import { useRef } from "react";
import { useSyncConfig } from "../state/useSyncSettings";
import { useOnlineMode } from "../state/useOnlineMode";
import { useSyncStatus, notifyLocalChange } from "../lib/autoSync";
import { reseedSampleData, importBands } from "../db/db";
import { parseBandsCsv } from "../lib/csv";

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
  const { status, errorMessage } = useSyncStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="main">
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
    </div>
  );
}
