import { useEffect, useState } from "react";
import "./App.css";
import { useUserName } from "./state/useUser";
import { useOnlineMode } from "./state/useOnlineMode";
import { ensureSeeded } from "./db/db";
import { startAutoSync, stopAutoSync } from "./lib/autoSync";
import { UserPicker } from "./components/UserPicker";
import { BandsPage } from "./pages/BandsPage";
import { SchedulePage } from "./pages/SchedulePage";
import { SyncPage } from "./pages/SyncPage";

type Tab = "bands" | "schedule" | "sync";

function App() {
  const [userName] = useUserName();
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

  if (!userName) {
    return <UserPicker />;
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
