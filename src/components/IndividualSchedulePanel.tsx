import { useEffect, useMemo, useState } from "react";
import type { Band, Day } from "../types";
import { DAY_LABELS, formatMinutes } from "../types";
import { useUserSchedule, removeFromSchedule } from "../state/useSchedule";
import { useComputedGroupSchedule } from "../state/useGroupSchedule";
import { syncMustSeeSchedule, useAvoidBandIds } from "../state/useRatings";
import { useUserName } from "../state/useUser";
import { useGroupCode } from "../state/useGroup";
import { useGroupMembers } from "../state/useGroupMembers";
import { usePersistedState } from "../state/usePersistedState";
import { openBandDetail } from "../state/useSelectedBand";
import { ItineraryGrid, type HighlightCategory } from "./ItineraryGrid";
import { AvoidIcon } from "./AvoidIcon";
import { sortByStageOrder } from "../lib/stageOrder";

export function IndividualSchedulePanel({ bands }: { bands: Band[] }) {
  const [myUserName] = useUserName();
  const [groupCode] = useGroupCode();
  const members = useGroupMembers(groupCode);
  const [selectedMember, setSelectedMember] = usePersistedState(
    "lolla-individual-member",
    myUserName,
  );
  const [view, setView] = usePersistedState<"list" | "grid">("lolla-individual-view", "grid");
  const [day, setDay] = useState<Day>(1);

  // The persisted member might belong to a group we've since left, or not exist yet — fall back to self.
  const effectiveMember = members.includes(selectedMember) ? selectedMember : myUserName;
  const isSelf = effectiveMember === myUserName;

  // Backfill: catches 5-star ratings that predate the auto-add feature, or arrived via a
  // bulk CSV import (which writes ratings directly and never went through setPreRating's
  // trigger). Only ever reconciles your own schedule, never another member's. Cheap no-op
  // on repeat visits once everything's already caught up.
  useEffect(() => {
    if (isSelf && groupCode && myUserName) syncMustSeeSchedule(groupCode, myUserName);
  }, [isSelf, groupCode, myUserName]);

  const scheduleEntries = useUserSchedule(groupCode, effectiveMember);
  const groupDays = useComputedGroupSchedule(groupCode, bands);
  // Whatever this member rated 1 ("actively want to avoid") — flagged wherever it shows up
  // in their schedule, since a group pick can still be a band they can't stand.
  const avoidBandIds = useAvoidBandIds(groupCode, effectiveMember);

  const bandsById = useMemo(() => new Map(bands.map((b) => [b.id, b])), [bands]);
  const groupBandIds = useMemo(
    () => new Set(groupDays.flatMap((d) => d.bandIds)),
    [groupDays],
  );
  // What this member has actually chosen to add themselves — as opposed to the group
  // schedule bands displayed alongside them, which are computed, not a real entry of theirs.
  const ownBandIds = useMemo(() => new Set(scheduleEntries.map((e) => e.bandId)), [scheduleEntries]);

  const stages = useMemo(
    () => sortByStageOrder(Array.from(new Set(bands.map((b) => b.stage)))),
    [bands],
  );

  // The individual view is always group schedule (base layer) + this member's own picks
  // layered on top — no separate "adopt" step needed to see the group's plan here.
  const displayedBands = useMemo(() => {
    const ids = new Set<string>([...groupBandIds, ...ownBandIds]);
    return Array.from(ids)
      .map((id) => bandsById.get(id))
      .filter((b): b is Band => !!b)
      .sort((a, b) => a.day - b.day || a.startMinutes - b.startMinutes);
  }, [groupBandIds, ownBandIds, bandsById]);

  const displayedByDay = useMemo(() => {
    const map = new Map<Day, Band[]>();
    for (const b of displayedBands) {
      const list = map.get(b.day) ?? [];
      list.push(b);
      map.set(b.day, list);
    }
    return Array.from(map.entries());
  }, [displayedBands]);

  const highlights = useMemo(() => {
    const map = new Map<string, HighlightCategory>();
    for (const b of displayedBands) {
      map.set(b.id, groupBandIds.has(b.id) ? "group" : "deviation");
    }
    return map;
  }, [displayedBands, groupBandIds]);

  return (
    <div>
      <div className="sync-card">
        <p className="status-text">
          The schedule below shows the group schedule and also shows anything you have marked
          as a "Can't Miss" act, and anything you have manually added to your schedule. You can
          also view the schedules of other members of your group.
        </p>
      </div>

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

      <p className="status-text" style={{ margin: "8px 0", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span className="diff-badge group">Group schedule</span>
        <span className="diff-badge deviation">Personal pick</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <AvoidIcon style={{ width: 12, height: 12, color: "var(--danger)" }} />
          Rated 1 — avoid
        </span>
      </p>

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
          <ItineraryGrid
            bands={bands}
            day={day}
            stages={stages}
            highlights={highlights}
            avoidBandIds={avoidBandIds}
          />
        </>
      ) : displayedBands.length === 0 ? (
        <div className="empty-state">
          {isSelf
            ? "Nothing yet — rate bands as a group, or add your own from the Bands tab."
            : `${effectiveMember} hasn't added anything yet.`}
        </div>
      ) : (
        displayedByDay.map(([d, dayBands]) => (
          <div key={d} style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, margin: "10px 0" }}>{DAY_LABELS[d]}</h2>
            {dayBands.map((b) => (
              <div
                key={b.id}
                className="band-card clickable"
                style={{ position: "relative" }}
                onClick={() => openBandDetail(b.id)}
              >
                {avoidBandIds.has(b.id) && <AvoidIcon className="band-card-avoid" />}
                <div className="band-card-top">
                  <div>
                    <div className="band-name">{b.name}</div>
                    <div className="band-meta">
                      {formatMinutes(b.startMinutes)} – {formatMinutes(b.endMinutes)}
                    </div>
                  </div>
                  <span className="badge">{b.stage}</span>
                </div>
                <div className="band-card-actions">
                  <span className={`diff-badge ${highlights.get(b.id)}`}>
                    {highlights.get(b.id) === "group" ? "Group schedule" : "Personal pick"}
                  </span>
                  {isSelf && ownBandIds.has(b.id) && (
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
            ))}
          </div>
        ))
      )}
    </div>
  );
}
