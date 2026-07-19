import { useMemo, useState } from "react";
import type { Band } from "../types";
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

export function GroupSchedulePanel({ bands }: { bands: Band[] }) {
  const [groupCode] = useGroupCode();
  const [userName] = useUserName();
  const entries = useGroupSchedule(groupCode);
  const [generating, setGenerating] = useState(false);

  const bandsById = useMemo(() => new Map(bands.map((b) => [b.id, b])), [bands]);
  const byDay = useMemo(() => groupByDay(entries), [entries]);
  const generatedAt = entries[0]?.generatedAt;
  const totalPicks = entries.length;

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
    alert("Added! Check your schedule's List/Grid view.");
  };

  return (
    <div>
      <div className="sync-card">
        <p className="status-text">
          Builds one shared itinerary that fits as many of your group's ratings as
          possible, without scheduling back-to-back sets you can't actually walk
          between. Runs entirely on this device — no network needed.
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
        ([1, 2, 3, 4] as const).map((day) => {
          const dayEntries = byDay.get(day) ?? [];
          if (dayEntries.length === 0) return null;
          return (
            <div key={day} style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, margin: "10px 0" }}>{DAY_LABELS[day]}</h2>
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
    </div>
  );
}
