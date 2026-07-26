import { useMemo, useState } from "react";
import type { Band, Day } from "../types";
import { DAY_LABELS } from "../types";
import { useGroupCode } from "../state/useGroup";
import { useComputedGroupSchedule } from "../state/useGroupSchedule";
import { openBandDetail } from "../state/useSelectedBand";
import { usePersistedState } from "../state/usePersistedState";
import { useIsAdmin } from "../state/useAuth";
import { ItineraryGrid, type HighlightCategory } from "./ItineraryGrid";
import { BandCardHeader } from "./BandCardHeader";
import { AddBandForm } from "./AddBandForm";
import { sortByStageOrder } from "../lib/stageOrder";

interface Props {
  bands: Band[];
  day: Day;
  setDay: (day: Day) => void;
}

export function GroupSchedulePanel({ bands, day, setDay }: Props) {
  const [groupCode] = useGroupCode();
  const isAdmin = useIsAdmin();
  const days = useComputedGroupSchedule(groupCode, bands);
  const [view, setView] = usePersistedState<"list" | "grid">("lolla-group-schedule-view", "grid");
  const [showAddForm, setShowAddForm] = useState(false);

  const bandsById = useMemo(() => new Map(bands.map((b) => [b.id, b])), [bands]);
  const totalPicks = useMemo(() => days.reduce((sum, d) => sum + d.bandIds.length, 0), [days]);

  const stages = useMemo(
    () => sortByStageOrder(Array.from(new Set(bands.map((b) => b.stage)))),
    [bands],
  );

  const highlights = useMemo(() => {
    const map = new Map<string, HighlightCategory>();
    for (const d of days) {
      for (const bandId of d.bandIds) map.set(bandId, "group");
    }
    return map;
  }, [days]);

  return (
    <div>
      <div className="sync-card">
        <p className="status-text">
          This schedule is generated based on the rankings of the group members, it is not
          editable, but you can make edits in your individual schedule.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="tabs">
          <button
            className={`tab-btn${view === "grid" ? " active" : ""}`}
            onClick={() => setView("grid")}
          >
            Grid
          </button>
          <button
            className={`tab-btn${view === "list" ? " active" : ""}`}
            onClick={() => setView("list")}
          >
            List
          </button>
        </div>
        {isAdmin && !showAddForm && (
          <button className="secondary-btn" onClick={() => setShowAddForm(true)}>
            + Add band
          </button>
        )}
      </div>

      {showAddForm && (
        <AddBandForm bands={bands} onDone={() => setShowAddForm(false)} />
      )}

      {view === "grid" ? (
        <>
          <div className="day-tabs" style={{ padding: "0 0 10px" }}>
            {([1, 2, 3, 4] as Day[]).map((d) => (
              <button
                key={d}
                className={`day-tab${d === day ? " active" : ""}`}
                onClick={() => setDay(d)}
              >
                {DAY_LABELS[d]}
              </button>
            ))}
          </div>
          <ItineraryGrid bands={bands} day={day} stages={stages} highlights={highlights} />
        </>
      ) : totalPicks === 0 ? (
        <div className="empty-state">No picks yet — rate some bands as a group.</div>
      ) : (
        days.map((d) => {
          if (d.bandIds.length === 0) return null;
          return (
            <div key={d.day} style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, margin: "10px 0" }}>{DAY_LABELS[d.day]}</h2>
              {d.bandIds.map((bandId) => {
                const band = bandsById.get(bandId);
                if (!band) return null;
                return (
                  <div
                    key={bandId}
                    className="band-card clickable"
                    onClick={() => openBandDetail(band.id)}
                  >
                    <BandCardHeader band={band} right={<span className="badge">{band.stage}</span>} />
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}
