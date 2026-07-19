import { useEffect, useState } from "react";
import "./App.css";
import { useUserName } from "./state/useUser";
import { useGroupCode } from "./state/useGroup";
import { useOnlineMode } from "./state/useOnlineMode";
import { useSession } from "./state/useAuth";
import { ensureSeeded } from "./db/db";
import { startAutoSync, stopAutoSync } from "./lib/autoSync";
import { AuthScreen } from "./components/AuthScreen";
import { BandsPage } from "./pages/BandsPage";
import { SchedulePage } from "./pages/SchedulePage";
import { SyncPage } from "./pages/SyncPage";

type Tab = "bands" | "schedule" | "sync";

function App() {
  const { session, loading: sessionLoading } = useSession();
  const [userName, setUserName] = useUserName();
  const [, setGroupCode] = useGroupCode();
  const [tab, setTab] = useState<Tab>("bands");
  const [online] = useOnlineMode();
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    ensureSeeded().then(() => setSeeded(true));
  }, []);

  useEffect(() => {
    // Guard on `seeded` so a sync can never fire against an empty local DB
    // (e.g. toggling online in the instant before first-run seeding finishes)
    // and silently report "up to date" without actually pushing anything.
    if (online && seeded) {
      startAutoSync();
      return stopAutoSync;
    }
    stopAutoSync();
  }, [online, seeded]);

  // The account is the source of truth for identity/group; mirror it into the
  // local-only storage the rest of the app already reads, so nothing else has
  // to change and everything still works offline once this has run once.
  useEffect(() => {
    if (!session) return;
    const meta = session.user.user_metadata as { first_name?: string; group_code?: string };
    if (meta.first_name) setUserName(meta.first_name);
    if (meta.group_code) setGroupCode(meta.group_code);
  }, [session, setUserName, setGroupCode]);

  if (sessionLoading) {
    return null;
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header-row">
          <span className="app-title">🎪 Lolla Planner</span>
          <span className="user-chip">{userName}</span>
        </div>
      </header>

      {tab === "bands" && <BandsPage />}
      {tab === "schedule" && <SchedulePage />}
      {tab === "sync" && <SyncPage />}

      <nav className="bottom-nav">
        <button
          className={`bottom-nav-btn${tab === "bands" ? " active" : ""}`}
          onClick={() => setTab("bands")}
        >
          <span className="bottom-nav-icon">🎵</span>
          Bands
        </button>
        <button
          className={`bottom-nav-btn${tab === "schedule" ? " active" : ""}`}
          onClick={() => setTab("schedule")}
        >
          <span className="bottom-nav-icon">🗓️</span>
          Schedule
        </button>
        <button
          className={`bottom-nav-btn${tab === "sync" ? " active" : ""}`}
          onClick={() => setTab("sync")}
        >
          <span className="bottom-nav-icon">🔄</span>
          Sync
        </button>
      </nav>
    </>
  );
}

export default App;
