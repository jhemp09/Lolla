import { useEffect } from "react";
import "./App.css";
import { useUserName } from "./state/useUser";
import { useGroupCode } from "./state/useGroup";
import { useOnlineMode } from "./state/useOnlineMode";
import { useSession, useIsAdmin } from "./state/useAuth";
import { useSelectedBandId, closeBandDetail } from "./state/useSelectedBand";
import { useBand } from "./state/useBands";
import { useTab } from "./state/useTab";
import { startAutoSync, stopAutoSync, syncNow } from "./lib/autoSync";
import { AuthScreen } from "./components/AuthScreen";
import { BandsIcon, ScheduleIcon, SyncIcon, AdminIcon } from "./components/NavIcons";
import { BandDetail } from "./components/BandDetail";
import { BandsPage } from "./pages/BandsPage";
import { SchedulePage } from "./pages/SchedulePage";
import { SyncPage } from "./pages/SyncPage";
import { AdminPage } from "./pages/AdminPage";

function App() {
  const { session, loading: sessionLoading } = useSession();
  const isAdmin = useIsAdmin();
  const [userName, setUserName] = useUserName();
  const [, setGroupCode] = useGroupCode();
  const [tab, setTab] = useTab();
  const [online] = useOnlineMode();
  const selectedBandId = useSelectedBandId();
  const selectedBand = useBand(selectedBandId ?? undefined);

  // No periodic background polling — instead, sync whenever the user navigates
  // between tabs, so data is fresh the moment they land on a page. Also closes
  // any open band detail — otherwise it stayed on top since it's a separate
  // piece of state from the active tab, and only "‹ Back" ever cleared it.
  function goToTab(next: typeof tab) {
    closeBandDetail();
    setTab(next);
    syncNow();
  }

  useEffect(() => {
    if (online) {
      startAutoSync();
      return stopAutoSync;
    }
    stopAutoSync();
  }, [online]);

  // The account is the source of truth for identity/group; mirror it into the
  // local-only storage the rest of the app already reads, so nothing else has
  // to change and everything still works offline once this has run once.
  useEffect(() => {
    if (!session) return;
    const meta = session.user.user_metadata as { first_name?: string; group_code?: string };
    if (meta.first_name) setUserName(meta.first_name);
    if (meta.group_code) setGroupCode(meta.group_code);
  }, [session, setUserName, setGroupCode]);

  // Guards against a stale "admin" tab persisting across a log-out/log-in as a
  // non-admin account (or admin being revoked) — bounce back to a tab everyone has.
  useEffect(() => {
    if (tab === "admin" && !isAdmin) setTab("bands");
  }, [tab, isAdmin, setTab]);

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
          <span className="app-title">
            <img src="/lolla-icon.png" alt="" className="lolla-logo" />
            Lolla Planner
          </span>
          <span className="user-chip">{userName}</span>
        </div>
      </header>

      {/* Kept mounted (just hidden) behind the detail view so switching back
          doesn't lose local state like Schedule's List/Grid choice or Bands'
          filters — only unmounts when the bottom nav actually changes tabs. */}
      <div style={{ display: selectedBand ? "none" : "contents" }}>
        {tab === "bands" && <BandsPage />}
        {tab === "schedule" && <SchedulePage />}
        {tab === "sync" && <SyncPage />}
        {tab === "admin" && isAdmin && <AdminPage />}
      </div>
      {selectedBand && <BandDetail band={selectedBand} onBack={closeBandDetail} />}

      <nav className="bottom-nav">
        <button
          className={`bottom-nav-btn${tab === "bands" ? " active" : ""}`}
          onClick={() => goToTab("bands")}
        >
          <span className="bottom-nav-icon"><BandsIcon /></span>
          Bands
        </button>
        <button
          className={`bottom-nav-btn${tab === "schedule" ? " active" : ""}`}
          onClick={() => goToTab("schedule")}
        >
          <span className="bottom-nav-icon"><ScheduleIcon /></span>
          Schedule
        </button>
        <button
          className={`bottom-nav-btn${tab === "sync" ? " active" : ""}`}
          onClick={() => goToTab("sync")}
        >
          <span className="bottom-nav-icon"><SyncIcon /></span>
          Sync
        </button>
        {isAdmin && (
          <button
            className={`bottom-nav-btn${tab === "admin" ? " active" : ""}`}
            onClick={() => goToTab("admin")}
          >
            <span className="bottom-nav-icon"><AdminIcon /></span>
            Admin
          </button>
        )}
      </nav>
    </>
  );
}

export default App;
