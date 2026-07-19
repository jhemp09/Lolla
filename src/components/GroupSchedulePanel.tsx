import { useMemo, useState } from "react";
import type { Band, Day } from "../types";
import { DAY_LABELS, formatMinutes } from "../types";
import { useGroupCode } from "../state/useGroup";
import { useUserName } from "../state/useUser";
import {
  useGroupSchedule,
  generateGroupSchedule,
  adoptGroupSchedule,
  groupByDay,
} from "../state/useGroupSchedule";
import { openBandDetail } from "../state/useSelectedBand";
import { usePersistedState } from "../state/usePersistedState";
import { ItineraryGrid, type HighlightCategory } from "./ItineraryGrid";
import { STAGE_LIST } from "../db/seed";

export function GroupSchedulePanel({ bands }: { bands: Band[] }) {
  const [groupCode] = useGroupCode();
  const [userName] = useUserName();
  const entries = useGroupSchedule(groupCode);
  const [generating, setGenerating] = useState(false);
  const [view, setView] = usePersistedState<"list" | "grid">("lolla-group-schedule-view", "list");
  const [day, setDay] = useState<Day>(1);

  const bandsById = useMemo(() => new Map(bands.map((b) => [b.id, b])), [bands]);
  const byDay = useMemo(() => groupByDay(entries), [entries]);
  const generatedAt = entries[0]?.generatedAt;
  const totalPicks = entries.length;

  const stages = useMemo(() => {
    const fromData = Array.from(new Set(bands.map((b) => b.stage)));
    return fromData.length ? fromData : STAGE_LIST;
  }, [bands]);

  const highlights = useMemo(() => {
    const map = new Map<string, HighlightCategory>();
    for (const e of entries) map.set(e.bandId, "group");
    return map;
  }, [entries]);

  const regenerate = async () => {
    setGenerating(true);
    try {
      await generateGroupSchedule(groupCode, bands);
    } finally {
      setGenerating(false);
    }
  };

  const adopt = async () => {
    if (!confirm("Add every group schedule pick to your personal schedule? This won't remove anything you've already picked.")) {
      return;
    }
    await adoptGroupSchedule(groupCode, userName, entries);
    alert("Added! Check the Individual Schedule tab.");
  };

  return (
    <div>
      <div className="sync-card">
        <p className="status-text">
          Builds one shared itinerary that fits as many of your group's ratings as
          possible, without scheduling back-to-back sets you can't actually walk
          between. Not editable — regenerate to update it as ratings change. Runs
          entirely on this device — no network needed.
        </p>
        {generatedAt && (
          <p className="status-text" style={{ marginTop: 8 }}>
            Generated {new Date(generatedAt).toLocaleString()} · {totalPicks} picks
          </p>
        )}
        <div className="sync-row">
          <button className="primary-btn" onClick={regenerate} disabled={generating}>
            {generating ? "Generating…" : totalPicks ? "Regenerate" : "Generate group schedule"}
          </button>
          {totalPicks > 0 && (
            <button className="secondary-btn" onClick={adopt}>
              Adopt into my schedule
            </button>
          )}
        </div>
      </div>

      {totalPicks === 0 ? (
        <div className="empty-state">
          No group schedule yet. Rate some bands as a group, then generate one above.
        </div>
      ) : (
        <>
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
          ) : (
            ([1, 2, 3, 4] as const).map((d) => {
              const dayEntries = byDay.get(d) ?? [];
              if (dayEntries.length === 0) return null;
              return (
                <div key={d} style={{ marginBottom: 16 }}>
                  <h2 style={{ fontSize: 15, margin: "10px 0" }}>{DAY_LABELS[d]}</h2>
                  {dayEntries.map((entry) => {
                    const band = bandsById.get(entry.bandId);
                    if (!band) return null;
                    return (
                      <div
                        key={entry.id}
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
        </>
      )}
    </div>
  );
}
