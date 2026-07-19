import { useRef, useState } from "react";
import { useSyncSettings, saveSyncSettings, setLastSync } from "../state/useSyncSettings";
import { pushToRemote, pullFromRemote } from "../lib/sync";
import { reseedSampleData, importBands } from "../db/db";
import { parseBandsCsv } from "../lib/csv";

export function SyncPage() {
  const settings = useSyncSettings();
  const [url, setUrl] = useState(settings.url);
  const [anonKey, setAnonKey] = useState(settings.anonKey);
  const [status, setStatus] = useState<{ kind: "ok" | "err" | "busy"; text: string } | null>(
    null,
  );

  const doSave = () => {
    saveSyncSettings(url, anonKey);
    setStatus({ kind: "ok", text: "Saved." });
  };

  const doPush = async () => {
    setStatus({ kind: "busy", text: "Pushing…" });
    try {
      await pushToRemote(settings.url, settings.anonKey);
      setLastSync(new Date().toISOString());
      setStatus({ kind: "ok", text: "Pushed your changes to the shared database." });
    } catch (e) {
      setStatus({ kind: "err", text: e instanceof Error ? e.message : "Push failed." });
    }
  };

  const doPull = async () => {
    setStatus({ kind: "busy", text: "Pulling…" });
    try {
      await pullFromRemote(settings.url, settings.anonKey);
      setLastSync(new Date().toISOString());
      setStatus({ kind: "ok", text: "Pulled the latest shared data." });
    } catch (e) {
      setStatus({ kind: "err", text: e instanceof Error ? e.message : "Pull failed." });
    }
  };

  const doReset = async () => {
    if (!confirm("Reset bands to the built-in sample dataset? Your ratings/schedule stay.")) return;
    await reseedSampleData();
    setStatus({ kind: "ok", text: "Sample lineup reloaded." });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const doImport = async (file: File) => {
    try {
      const text = await file.text();
      const bands = parseBandsCsv(text);
      if (bands.length === 0) throw new Error("No rows found in that file.");
      await importBands(bands);
      setStatus({ kind: "ok", text: `Imported ${bands.length} bands. Push to share with your group.` });
    } catch (e) {
      setStatus({ kind: "err", text: e instanceof Error ? e.message : "Import failed." });
    }
  };

  return (
    <div className="main">
      <div className="sync-card">
        <h2 style={{ fontSize: 16 }}>How sync works</h2>
        <p className="status-text" style={{ marginTop: 6 }}>
          Everything runs from local storage on this device — nothing ever touches the
          network unless you tap Push or Pull below. Push uploads your ratings, schedule,
          and lineup to your shared Supabase project; Pull downloads the latest from your
          group. Do this once when you have signal, then go offline for the day.
        </p>
        {settings.lastSync && (
          <p className="status-text" style={{ marginTop: 8 }}>
            Last synced: {new Date(settings.lastSync).toLocaleString()}
          </p>
        )}
      </div>

      <div className="sync-card">
        <h2 style={{ fontSize: 16 }}>Supabase project</h2>
        <label className="field-label" htmlFor="sb-url">
          Project URL
        </label>
        <input
          id="sb-url"
          className="field-input"
          placeholder="https://xxxx.supabase.co"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <label className="field-label" htmlFor="sb-key">
          Anon public key
        </label>
        <input
          id="sb-key"
          className="field-input"
          placeholder="eyJhbGciOi..."
          value={anonKey}
          onChange={(e) => setAnonKey(e.target.value)}
        />
        <div className="sync-row">
          <button className="secondary-btn" onClick={doSave}>
            Save settings
          </button>
        </div>
      </div>

      <div className="sync-card">
        <div className="sync-row" style={{ marginTop: 0 }}>
          <button className="primary-btn" onClick={doPush} disabled={!settings.url}>
            ↑ Push my changes
          </button>
          <button className="secondary-btn" onClick={doPull} disabled={!settings.url}>
            ↓ Pull latest
          </button>
        </div>
        {status && (
          <p className={`status-text ${status.kind === "err" ? "err" : status.kind === "ok" ? "ok" : ""}`} style={{ marginTop: 10 }}>
            {status.text}
          </p>
        )}
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
          <button className="secondary-btn" onClick={doReset}>
            Reset to sample lineup
          </button>
        </div>
      </div>
    </div>
  );
}
