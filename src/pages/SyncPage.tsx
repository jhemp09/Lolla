import { useSyncConfig } from "../state/useSyncSettings";
import { useOnlineMode } from "../state/useOnlineMode";
import { useUserName } from "../state/useUser";
import { signOut } from "../state/useAuth";
import { useSyncStatus } from "../lib/autoSync";
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
  const { status, errorMessage } = useSyncStatus();

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
    </div>
  );
}
