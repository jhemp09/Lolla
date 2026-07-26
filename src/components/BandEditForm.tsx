import { useState } from "react";
import { updateBand, deleteBand } from "../db/db";
import type { Band } from "../types";
import { notifyLocalChange } from "../lib/autoSync";
import { minutesToTimeValue, timeValueToMinutes } from "../lib/timeInput";

interface BandEditDraft {
  name: string;
  stage: string;
  genre: string;
  start: string;
  end: string;
}

function draftFromBand(band: Band): BandEditDraft {
  return {
    name: band.name,
    stage: band.stage,
    genre: band.genre,
    start: minutesToTimeValue(band.startMinutes),
    end: minutesToTimeValue(band.endMinutes),
  };
}

/** Admin-only edit form for a single band's name/stage/timing/genre, with a delete option. */
export function BandEditForm({
  band,
  stageOptions,
  genreOptions,
  onDone,
  onDelete,
}: {
  band: Band;
  stageOptions: string[];
  genreOptions: string[];
  onDone: () => void;
  /** Called after the band is deleted — distinct from onDone since there's no longer a band to go back to viewing. */
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<BandEditDraft>(() => draftFromBand(band));

  const save = async () => {
    const name = draft.name.trim();
    const stage = draft.stage.trim();
    const genre = draft.genre.trim();
    if (!name || !stage) {
      alert("Name and stage can't be empty.");
      return;
    }
    const startMinutes = timeValueToMinutes(draft.start);
    const endMinutes = timeValueToMinutes(draft.end);
    if (endMinutes <= startMinutes) {
      alert("End time must be after start time.");
      return;
    }
    await updateBand(band.id, { name, stage, genre, startMinutes, endMinutes });
    notifyLocalChange();
    onDone();
  };

  const remove = async () => {
    if (!confirm(`Delete "${band.name}"? This can't be undone.`)) return;
    await deleteBand(band.id);
    notifyLocalChange();
    onDelete();
  };

  return (
    <div className="band-card">
      <label className="field-label" htmlFor="edit-name">Name</label>
      <input
        id="edit-name"
        className="field-input"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
      />

      <label className="field-label" htmlFor="edit-stage">Stage</label>
      <input
        id="edit-stage"
        className="field-input"
        list="edit-stage-options"
        value={draft.stage}
        onChange={(e) => setDraft({ ...draft, stage: e.target.value })}
      />
      <datalist id="edit-stage-options">
        {stageOptions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="sync-row" style={{ marginTop: 0 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label" htmlFor="edit-start">Start</label>
          <input
            id="edit-start"
            className="field-input"
            type="time"
            value={draft.start}
            onChange={(e) => setDraft({ ...draft, start: e.target.value })}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label" htmlFor="edit-end">End</label>
          <input
            id="edit-end"
            className="field-input"
            type="time"
            value={draft.end}
            onChange={(e) => setDraft({ ...draft, end: e.target.value })}
          />
        </div>
      </div>

      <label className="field-label" htmlFor="edit-genre">Genre</label>
      <input
        id="edit-genre"
        className="field-input"
        list="edit-genre-options"
        value={draft.genre}
        onChange={(e) => setDraft({ ...draft, genre: e.target.value })}
      />
      <datalist id="edit-genre-options">
        {genreOptions.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      <div className="sync-row">
        <button className="primary-btn" onClick={save}>
          Save
        </button>
        <button className="secondary-btn" onClick={onDone}>
          Cancel
        </button>
      </div>
      <div className="sync-row">
        <button className="danger-btn" onClick={remove}>
          Delete band
        </button>
      </div>
    </div>
  );
}
