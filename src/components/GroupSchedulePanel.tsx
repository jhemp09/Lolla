import { useMemo, useState } from "react";
import type { Band, Day } from "../types";
import { DAY_LABELS, formatMinutes } from "../types";
import { useGroupCode } from "../state/useGroup";
import { useUserName } from "../state/useUser";
import { useComputedGroupSchedule, adoptGroupSchedule } from "../state/useGroupSchedule";
import { openBandDetail } from "../state/useSelectedBand";
import { usePersistedState } from "../state/usePersistedState";
import { ItineraryGrid, type HighlightCategory } from "./ItineraryGrid";

export function GroupSchedulePanel({ bands }: { bands: Band[] }) {
  const [groupCode] = useGroupCode();
  const [userName] = useUserName();
  const days = useComputedGroupSchedule(groupCode, bands);
  const [view, setView] = usePersistedState<"list" | "grid">("lolla-group-schedule-view", "grid");
  const [day, setDay] = useState<Day>(1);

  const bandsById = useMemo(() => new Map(bands.map((b) => [b.id, b])), [bands]);
  const totalPicks = useMemo(() => days.reduce((sum, d) => sum + d.bandIds.length, 0), [days]);

  const stages = useMemo(() => Array.from(new Set(bands.map((b) => b.stage))), [bands]);

  const highlights = useMemo(() => {
    const map = new Map<string, HighlightCategory>();
    for (const d of days) {
      for (const bandId of d.bandIds) map.set(bandId, "group");
    }
    return map;
  }, [days]);

  const adopt = async () => {
    if (!confirm("Add every group schedule pick to your personal schedule? This won't remove anything you've already picked.")) {
      return;
    }
    await adoptGroupSchedule(groupCode, userName, days);
    alert("Added! Check the Individual Schedule tab.");
  };

  return (
    <div>
      <div className="sync-card">
        <p className="status-text">
          Updates automatically as ratings come in from you or your group — no need to
          regenerate. Maximizes total group rating without scheduling back-to-back sets
          you can't actually walk between. Not editable. Runs entirely on this device,
          no network needed.
        </p>
        <div className="sync-row">
          <p className="status-text" style={{ margin: 0 }}>
            {totalPicks > 0 ? `${totalPicks} picks` : "No picks yet — rate some bands as a group."}
          </p>
          {totalPicks > 0 && (
            <button className="secondary-btn" onClick={adopt}>
              Adopt into my schedule
            </button>
          )}
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 10 }}>
        <button
          className={`tab-btn${view === "list" ? " active" : ""}`}
          onClick={() => setView("list")}
        >
          List
        </button>
        <button
          className={`tab-btn${view === "grid" ? " active" : ""}`}
          onClick={() => setView("grid")}
        >
          Grid
        </button>
      </div>

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
                    <div className="band-card-top">
                      <div>
                        <div className="band-name">{band.name}</div>
                        <div className="band-meta">
                          {formatMinutes(band.startMinutes)} – {formatMinutes(band.endMinutes)}
                        </div>
                      </div>
                      <span className="badge">{band.stage}</span>
                    </div>
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
