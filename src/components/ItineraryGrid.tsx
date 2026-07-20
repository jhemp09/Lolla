import { useMemo } from "react";
import type { Band, Day } from "../types";
import { formatMinutes } from "../types";
import { openBandDetail } from "../state/useSelectedBand";
import { AvoidIcon } from "./AvoidIcon";

export type HighlightCategory = "group" | "deviation";

interface Props {
  bands: Band[];
  day: Day;
  stages: string[];
  /** bandId -> "group" (matches the group schedule) or "deviation" (this schedule's own pick, not in the group's). */
  highlights?: Map<string, HighlightCategory>;
  /** Band IDs this member rated 1 — flagged with a small "avoid" icon regardless of highlight category. */
  avoidBandIds?: Set<string>;
}

const SLOT_MINUTES = 15;
const SLOT_HEIGHT = 13; // px per 15-minute row — tuned to fit a phone screen without losing readability

export function ItineraryGrid({ bands, day, stages, highlights, avoidBandIds }: Props) {
  const dayBands = useMemo(() => bands.filter((b) => b.day === day), [bands, day]);

  const { gridStart, totalSlots } = useMemo(() => {
    if (dayBands.length === 0) return { gridStart: 600, totalSlots: 48 };
    const rawStart = Math.min(...dayBands.map((b) => b.startMinutes));
    const rawEnd = Math.max(...dayBands.map((b) => b.endMinutes));
    const start = Math.floor(rawStart / SLOT_MINUTES) * SLOT_MINUTES;
    const end = Math.ceil(rawEnd / SLOT_MINUTES) * SLOT_MINUTES;
    return { gridStart: start, totalSlots: Math.max(1, (end - start) / SLOT_MINUTES) };
  }, [dayBands]);

  const hourLabels = useMemo(() => {
    const labels: { row: number; text: string }[] = [];
    for (let slot = 0; slot < totalSlots; slot++) {
      const minutes = gridStart + slot * SLOT_MINUTES;
      if (minutes % 60 === 0) {
        labels.push({ row: slot + 2, text: formatMinutes(minutes) });
      }
    }
    return labels;
  }, [gridStart, totalSlots]);

  return (
    <div className="grid-wrap">
      <div
        className="itinerary-grid"
        style={{
          gridTemplateColumns: `28px repeat(${stages.length}, minmax(52px, 1fr))`,
          gridTemplateRows: `auto repeat(${totalSlots}, ${SLOT_HEIGHT}px)`,
        }}
      >
        <div className="grid-header-cell" style={{ borderLeft: "none", gridColumn: 1, gridRow: 1 }}>
          Time
        </div>
        {stages.map((s, i) => (
          <div key={s} className="grid-header-cell" style={{ gridColumn: i + 2, gridRow: 1 }}>
            {s}
          </div>
        ))}

        {/* Background grid lines for every stage column across all rows */}
        {stages.map((s, i) =>
          Array.from({ length: totalSlots }, (_, slot) => (
            <div
              key={`${s}-bg-${slot}`}
              className="grid-slot"
              style={{ gridColumn: i + 2, gridRow: slot + 2 }}
            />
          )),
        )}

        {hourLabels.map((label) => (
          <div
            key={label.row}
            className="grid-time-cell"
            style={{ gridColumn: 1, gridRow: `${label.row} / span 4` }}
          >
            {label.text}
          </div>
        ))}

        {dayBands
          .filter((b) => stages.includes(b.stage))
          .map((band) => {
            const startSlot = Math.round((band.startMinutes - gridStart) / SLOT_MINUTES);
            const span = Math.max(1, Math.round((band.endMinutes - band.startMinutes) / SLOT_MINUTES));
            const col = stages.indexOf(band.stage) + 2;
            return (
              <div
                key={band.id}
                style={{
                  gridColumn: col,
                  gridRow: `${startSlot + 2} / span ${span}`,
                  padding: 1,
                }}
              >
                <div
                  className={`grid-band${highlights?.has(band.id) ? ` ${highlights.get(band.id)}` : ""}`}
                  onClick={() => openBandDetail(band.id)}
                >
                  {band.name}
                  {avoidBandIds?.has(band.id) && (
                    <AvoidIcon className="grid-band-avoid" />
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
