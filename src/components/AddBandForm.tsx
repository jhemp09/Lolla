import { useMemo, useState } from "react";
import type { Band, Day } from "../types";
import { DAY_LABELS } from "../types";
import { addBand } from "../db/db";
import { notifyLocalChange } from "../lib/autoSync";
import { timeValueToMinutes } from "../lib/timeInput";

interface NewBandDraft {
  name: string;
  day: Day;
  stage: string;
  genre: string;
  start: string;
  end: string;
}

const EMPTY_DRAFT: NewBandDraft = { name: "", day: 1, stage: "", genre: "", start: "", end: "" };

/** Admin-only form for adding a single band straight to the shared lineup — a quick fix for
 * "this one's missing" without re-running the full Admin tab CSV import. */
export function AddBandForm({ bands, onDone }: { bands: Band[]; onDone: () => void }) {
  const [draft, setDraft] = useState<NewBandDraft>(EMPTY_DRAFT);

  const stageOptions = useMemo(
    () => Array.from(new Set(bands.map((b) => b.stage))).sort(),
    [bands],
  );
  const genreOptions = useMemo(
    () => Array.from(new Set(bands.map((b) => b.genre))).sort(),
    [bands],
  );

  const save = async () => {
    const name = draft.name.trim();
    const stage = draft.stage.trim();
    const genre = draft.genre.trim();
    if (!name || !stage) {
      alert("Name and stage can't be empty.");
      return;
    }
    if (!draft.start || !draft.end) {
      alert("Start and end time are required.");
      return;
    }
    const startMinutes = timeValueToMinutes(draft.start);
    const endMinutes = timeValueToMinutes(draft.end);
    if (endMinutes <= startMinutes) {
      alert("End time must be after start time.");
      return;
    }
    await addBand({
      id: crypto.randomUUID(),
      name,
      stage,
      day: draft.day,
      startMinutes,
      endMinutes,
      genre,
      description: "",
    });
    notifyLocalChange();
    onDone();
  };

  return (
    <div className="band-card" style={{ marginBottom: 10 }}>
      <label className="field-label" htmlFor="new-band-name">Name</label>
      <input
        id="new-band-name"
        className="field-input"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        autoFocus
      />

      <div className="field-label" style={{ marginTop: 8 }}>Day</div>
      <div className="day-tabs" style={{ padding: "0 0 6px" }}>
        {([1, 2, 3, 4] as Day[]).map((d) => (
          <button
            key={d}
            type="button"
            className={`day-tab${d === draft.day ? " active" : ""}`}
            onClick={() => setDraft({ ...draft, day: d })}
          >
            {DAY_LABELS[d]}
          </button>
        ))}
      </div>

      <label className="field-label" htmlFor="new-band-stage">Stage</label>
      <input
        id="new-band-stage"
        className="field-input"
        list="new-band-stage-options"
        value={draft.stage}
        onChange={(e) => setDraft({ ...draft, stage: e.target.value })}
      />
      <datalist id="new-band-stage-options">
        {stageOptions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="sync-row" style={{ marginTop: 0 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label" htmlFor="new-band-start">Start</label>
          <input
            id="new-band-start"
            className="field-input"
            type="time"
            value={draft.start}
            onChange={(e) => setDraft({ ...draft, start: e.target.value })}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label" htmlFor="new-band-end">End</label>
          <input
            id="new-band-end"
            className="field-input"
            type="time"
            value={draft.end}
            onChange={(e) => setDraft({ ...draft, end: e.target.value })}
          />
        </div>
      </div>

      <label className="field-label" htmlFor="new-band-genre">Genre</label>
      <input
        id="new-band-genre"
        className="field-input"
        list="new-band-genre-options"
        value={draft.genre}
        onChange={(e) => setDraft({ ...draft, genre: e.target.value })}
      />
      <datalist id="new-band-genre-options">
        {genreOptions.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      <div className="sync-row">
        <button className="primary-btn" onClick={save}>
          Add band
        </button>
        <button className="secondary-btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
