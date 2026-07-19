import { useMemo, useState } from "react";
import type { Band, Day } from "../types";
import { DAY_LABELS, formatMinutes } from "../types";
import { useAllBands } from "../state/useBands";
import { useMySchedule, removeFromSchedule } from "../state/useSchedule";
import { useUserName } from "../state/useUser";
import { useGroupCode } from "../state/useGroup";
import { STAGE_LIST } from "../db/seed";
import { ItineraryGrid } from "../components/ItineraryGrid";
import { GroupSchedulePanel } from "../components/GroupSchedulePanel";
import { openBandDetail } from "../state/useSelectedBand";

function findConflicts(bands: Band[]): Set<string> {
  const conflicts = new Set<string>();
  for (let i = 0; i < bands.length; i++) {
    for (let j = i + 1; j < bands.length; j++) {
      const a = bands[i];
      const b = bands[j];
      if (a.day !== b.day) continue;
      const overlap = a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
      if (overlap) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }
  }
  return conflicts;
}

export function SchedulePage() {
  const [userName] = useUserName();
  const [groupCode] = useGroupCode();
  const allBands = useAllBands();
  const scheduleEntries = useMySchedule(groupCode, userName);
  const [view, setView] = useState<"list" | "grid" | "group">("grid");
  const [day, setDay] = useState<Day>(1);

  const bandsById = useMemo(() => new Map(allBands.map((b) => [b.id, b])), [allBands]);

  const myBands = useMemo(
    () =>
      scheduleEntries
        .map((e) => bandsById.get(e.bandId))
        .filter((b): b is Band => !!b)
        .sort((a, b) => a.day - b.day || a.startMinutes - b.startMinutes),
    [scheduleEntries, bandsById],
  );

  const myBandIds = useMemo(() => new Set(myBands.map((b) => b.id)), [myBands]);
  const conflicts = useMemo(() => findConflicts(myBands), [myBands]);

  const stages = useMemo(() => {
    const fromData = Array.from(new Set(allBands.map((b) => b.stage)));
    return fromData.length ? fromData : STAGE_LIST;
  }, [allBands]);

  return (
    <div className="main">
      <div className="tabs" style={{ marginBottom: 10 }}>
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
        <button
          className={`tab-btn${view === "group" ? " active" : ""}`}
          onClick={() => setView("group")}
        >
          Group Pick
        </button>
      </div>

      {view === "group" && <GroupSchedulePanel bands={allBands} />}

      {view === "grid" && (
        <>
          {conflicts.size > 0 && (
            <div className="conflict-banner">
              ⚠ You have overlapping sets in your schedule — check the times below.
            </div>
          )}
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
          <ItineraryGrid bands={allBands} day={day} stages={stages} myBandIds={myBandIds} />
        </>
      )}

      {view === "list" && (
        <>
          {conflicts.size > 0 && (
            <div className="conflict-banner">
              ⚠ You have overlapping sets in your schedule — check the times below.
            </div>
          )}
          {myBands.length === 0 ? (
            <div className="empty-state">
              Your schedule is empty. Add bands from the Bands tab.
            </div>
          ) : (
            myBands.map((b) => (
              <div key={b.id} className="band-card clickable" onClick={() => openBandDetail(b.id)}>
                <div className="band-card-top">
                  <div>
                    <div className="band-name">
                      {b.name} {conflicts.has(b.id) && <span style={{ color: "var(--danger)" }}>⚠</span>}
                    </div>
                    <div className="band-meta">
                      {DAY_LABELS[b.day]} · {formatMinutes(b.startMinutes)} – {formatMinutes(b.endMinutes)}
                    </div>
                  </div>
                  <span className="badge">{b.stage}</span>
                </div>
                <div className="band-card-actions">
                  <span />
                  <button
                    className="schedule-btn added"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromSchedule(groupCode, b.id, userName);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
