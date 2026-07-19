import { useMemo, useState } from "react";
import type { Day } from "../types";
import { DAY_LABELS } from "../types";
import { useAllBands } from "../state/useBands";
import { STAGE_LIST } from "../db/seed";
import { BandCard } from "../components/BandCard";

export function BandsPage() {
  const bands = useAllBands();
  const [day, setDay] = useState<Day>(1);
  const [stage, setStage] = useState<string>("all");
  const [query, setQuery] = useState("");

  const stages = useMemo(() => {
    const fromData = Array.from(new Set(bands.map((b) => b.stage)));
    return fromData.length ? fromData : STAGE_LIST;
  }, [bands]);

  const filtered = useMemo(() => {
    return bands
      .filter((b) => b.day === day)
      .filter((b) => stage === "all" || b.stage === stage)
      .filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()));
  }, [bands, day, stage, query]);

  return (
    <>
      <div className="day-tabs">
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
      <div className="main">
        <input
          className="search-input"
          placeholder="Search bands…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="stage-filter">
          <button
            className={`stage-chip${stage === "all" ? " active" : ""}`}
            onClick={() => setStage("all")}
          >
            All stages
          </button>
          {stages.map((s) => (
            <button
              key={s}
              className={`stage-chip${stage === s ? " active" : ""}`}
              onClick={() => setStage(s)}
            >
              {s}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">No bands match. Try a different filter.</div>
        ) : (
          filtered.map((b) => <BandCard key={b.id} band={b} />)
        )}
      </div>
    </>
  );
}
