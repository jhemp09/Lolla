import type { Day } from "../types";
import { useAllBands } from "../state/useBands";
import { usePersistedState } from "../state/usePersistedState";
import { createLocalStore } from "../state/localStore";
import { GroupSchedulePanel } from "../components/GroupSchedulePanel";
import { IndividualSchedulePanel } from "../components/IndividualSchedulePanel";

const VALID_DAYS: Day[] = [1, 2, 3, 4];

// Shared between the Group and Individual panels (not reset when switching between them,
// or the next visit) — the user picks a day once and it stays put until they change it.
const dayStore = createLocalStore<Day>("lolla-schedule-day", 1, {
  parse: (raw) => (VALID_DAYS.includes(Number(raw) as Day) ? (Number(raw) as Day) : 1),
  serialize: (value) => String(value),
});

export function SchedulePage() {
  const allBands = useAllBands();
  const [tab, setTab] = usePersistedState<"group" | "individual">(
    "lolla-schedule-top-tab",
    "group",
  );
  const [day, setDay] = dayStore.useValue();

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
        <GroupSchedulePanel bands={allBands} day={day} setDay={setDay} />
      ) : (
        <IndividualSchedulePanel bands={allBands} day={day} setDay={setDay} />
      )}
    </div>
  );
}
