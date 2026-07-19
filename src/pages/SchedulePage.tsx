import { useAllBands } from "../state/useBands";
import { usePersistedState } from "../state/usePersistedState";
import { GroupSchedulePanel } from "../components/GroupSchedulePanel";
import { IndividualSchedulePanel } from "../components/IndividualSchedulePanel";

export function SchedulePage() {
  const allBands = useAllBands();
  const [tab, setTab] = usePersistedState<"group" | "individual">(
    "lolla-schedule-top-tab",
    "group",
  );

  return (
    <div className="main">
      <div className="tabs" style={{ marginBottom: 10 }}>
        <button
          className={`tab-btn${tab === "group" ? " active" : ""}`}
          onClick={() => setTab("group")}
        >
          Group Schedule
        </button>
        <button
          className={`tab-btn${tab === "individual" ? " active" : ""}`}
          onClick={() => setTab("individual")}
        >
          Individual Schedule
        </button>
      </div>

      {tab === "group" ? (
        <GroupSchedulePanel bands={allBands} />
      ) : (
        <IndividualSchedulePanel bands={allBands} />
      )}
    </div>
  );
}
