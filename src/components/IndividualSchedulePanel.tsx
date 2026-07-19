import { useMemo, useState } from "react";
import type { Band, Day } from "../types";
import { DAY_LABELS, formatMinutes } from "../types";
import { useUserSchedule, removeFromSchedule } from "../state/useSchedule";
import { useComputedGroupSchedule } from "../state/useGroupSchedule";
import { useUserName } from "../state/useUser";
import { useGroupCode } from "../state/useGroup";
import { useGroupMembers } from "../state/useGroupMembers";
import { usePersistedState } from "../state/usePersistedState";
import { openBandDetail } from "../state/useSelectedBand";
import { ItineraryGrid, type HighlightCategory } from "./ItineraryGrid";
import { STAGE_LIST } from "../db/seed";

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

export function IndividualSchedulePanel({ bands }: { bands: Band[] }) {
  const [myUserName] = useUserName();
  const [groupCode] = useGroupCode();
  const members = useGroupMembers(groupCode);
  const [selectedMember, setSelectedMember] = usePersistedState(
    "lolla-individual-member",
    myUserName,
  );
  const [view, setView] = usePersistedState<"list" | "grid">("lolla-individual-view", "list");
  const [day, setDay] = useState<Day>(1);

  // The persisted member might belong to a group we've since left, or not exist yet — fall back to self.
  const effectiveMember = members.includes(selectedMember) ? selectedMember : myUserName;
  const isSelf = effectiveMember === myUserName;

  const scheduleEntries = useUserSchedule(groupCode, effectiveMember);
  const groupDays = useComputedGroupSchedule(groupCode, bands);

  const bandsById = useMemo(() => new Map(bands.map((b) => [b.id, b])), [bands]);
  const groupBandIds = useMemo(
    () => new Set(groupDays.flatMap((d) => d.bandIds)),
    [groupDays],
  );

  const stages = useMemo(() => {
    const fromData = Array.from(new Set(bands.map((b) => b.stage)));
    return fromData.length ? fromData : STAGE_LIST;
  }, [bands]);

  const displayedBands = useMemo(
    () =>
      scheduleEntries
        .map((e) => bandsById.get(e.bandId))
        .filter((b): b is Band => !!b)
        .sort((a, b) => a.day - b.day || a.startMinutes - b.startMinutes),
    [scheduleEntries, bandsById],
  );

  const conflicts = useMemo(() => findConflicts(displayedBands), [displayedBands]);

  const highlights = useMemo(() => {
    const map = new Map<string, HighlightCategory>();
    for (const b of displayedBands) {
      map.set(b.id, groupBandIds.has(b.id) ? "group" : "deviation");
    }
    return map;
  }, [displayedBands, groupBandIds]);

  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <div className="field-label" style={{ margin: "0 0 4px" }}>
          Viewing
        </div>
        <div className="stage-filter">
          {members.map((m) => (
            <button
              key={m}
              className={`stage-chip${m === effectiveMember ? " active" : ""}`}
              onClick={() => setSelectedMember(m)}
            >
              {m === myUserName ? "Me" : m}
            </button>
          ))}
        </div>
      </div>

      <p className="status-text" style={{ margin: "8px 0" }}>
        <span className="diff-badge group">Group schedule</span>{" "}
        <span className="diff-badge deviation">Personal pick</span>
      </p>

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

      {conflicts.size > 0 && (
        <div className="conflict-banner">
          ⚠ {isSelf ? "You have" : `${effectiveMember} has`} overlapping sets — check the times below.
        </div>
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
      ) : displayedBands.length === 0 ? (
        <div className="empty-state">
          {isSelf
            ? "Your schedule is empty. Add bands from the Bands tab."
            : `${effectiveMember} hasn't added anything yet.`}
        </div>
      ) : (
        displayedBands.map((b) => (
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
              <span className={`diff-badge ${highlights.get(b.id)}`}>
                {highlights.get(b.id) === "group" ? "Group schedule" : "Personal pick"}
              </span>
              {isSelf && (
                <button
                  className="schedule-btn added"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromSchedule(groupCode, b.id, myUserName);
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
