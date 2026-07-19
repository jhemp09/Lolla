import { useMemo, useState } from "react";
import type { Band, Day } from "../types";
import { DAY_LABELS } from "../types";
import { useAllBands } from "../state/useBands";
import { STAGE_LIST } from "../db/seed";
import { BandCard } from "../components/BandCard";
import { FilterChipRow } from "../components/FilterChipRow";

const ALL_DAYS: Day[] = [1, 2, 3, 4];

function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function BandsPage() {
  const bands = useAllBands();
  const [days, setDays] = useState<Set<Day>>(new Set());
  const [stages, setStages] = useState<Set<string>>(new Set());
  const [genres, setGenres] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const stageOptions = useMemo(() => {
    const fromData = Array.from(new Set(bands.map((b) => b.stage))).sort();
    return fromData.length ? fromData : STAGE_LIST;
  }, [bands]);

  const genreOptions = useMemo(
    () => Array.from(new Set(bands.map((b) => b.genre))).sort(),
    [bands],
  );

  const filtered = useMemo(() => {
    return bands
      .filter((b) => days.size === 0 || days.has(b.day))
      .filter((b) => stages.size === 0 || stages.has(b.stage))
      .filter((b) => genres.size === 0 || genres.has(b.genre))
      .filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => a.day - b.day || a.startMinutes - b.startMinutes);
  }, [bands, days, stages, genres, query]);

  const grouped = useMemo(() => {
    const map = new Map<Day, Band[]>();
    for (const b of filtered) {
      const list = map.get(b.day) ?? [];
      list.push(b);
      map.set(b.day, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const hasActiveFilters = days.size > 0 || stages.size > 0 || genres.size > 0;

  return (
    <div className="main">
      <input
        className="search-input"
        placeholder="Search bands…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <FilterChipRow
        label="Day"
        options={ALL_DAYS}
        optionLabel={(d) => DAY_LABELS[d]}
        selected={days}
        onToggle={(d) => setDays((prev) => toggled(prev, d))}
      />
      <FilterChipRow
        label="Stage"
        options={stageOptions}
        selected={stages}
        onToggle={(s) => setStages((prev) => toggled(prev, s))}
      />
      <FilterChipRow
        label="Genre"
        options={genreOptions}
        selected={genres}
        onToggle={(g) => setGenres((prev) => toggled(prev, g))}
      />

      {hasActiveFilters && (
        <button
          className="secondary-btn"
          style={{ marginBottom: 10 }}
          onClick={() => {
            setDays(new Set());
            setStages(new Set());
            setGenres(new Set());
          }}
        >
          Clear filters
        </button>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">No bands match. Try different filters.</div>
      ) : (
        grouped.map(([day, dayBands]) => (
          <div key={day}>
            <h2 style={{ fontSize: 15, margin: "12px 0 8px" }}>{DAY_LABELS[day]}</h2>
            {dayBands.map((b) => (
              <BandCard key={b.id} band={b} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
