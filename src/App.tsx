import { useEffect, useState } from "react";
import "./App.css";
import { useUserName } from "./state/useUser";
import { ensureSeeded } from "./db/db";
import { UserPicker } from "./components/UserPicker";
import { BandsPage } from "./pages/BandsPage";
import { SchedulePage } from "./pages/SchedulePage";
import { SyncPage } from "./pages/SyncPage";

type Tab = "bands" | "schedule" | "sync";

function App() {
  const [userName] = useUserName();
  const [tab, setTab] = useState<Tab>("bands");

  useEffect(() => {
    ensureSeeded();
  }, []);

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
