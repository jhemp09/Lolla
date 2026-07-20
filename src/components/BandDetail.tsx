import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, updateBand } from "../db/db";
import type { Band, Rating } from "../types";
import { formatMinutes } from "../types";
import { setPreRating, setPreNotes, setDuringRating, setDuringNotes } from "../state/useRatings";
import { useIsScheduled, addToSchedule, removeFromSchedule } from "../state/useSchedule";
import { useUserName } from "../state/useUser";
import { useGroupCode } from "../state/useGroup";
import { useIsAdmin } from "../state/useAuth";
import { useAllBands } from "../state/useBands";
import { notifyLocalChange } from "../lib/autoSync";
import { PRE_FESTIVAL_LABELS, DURING_FESTIVAL_LABELS } from "../lib/ratingLabels";

function minutesToTimeValue(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeValueToMinutes(value: string): number {
  const [h, m] = value.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

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

function BandEditForm({
  band,
  stageOptions,
  genreOptions,
  onDone,
}: {
  band: Band;
  stageOptions: string[];
  genreOptions: string[];
  onDone: () => void;
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
    </div>
  );
}

const EMPTY: Pick<Rating, "preRating" | "preNotes" | "duringRating" | "duringNotes"> = {
  preRating: 0,
  preNotes: "",
  duringRating: 0,
  duringNotes: "",
};

function RatingSection({
  title,
  description,
  labels,
  rating,
  notesDraft,
  onRatingChange,
  onNotesChange,
  onNotesBlur,
}: {
  title: string;
  description: string;
  labels: Record<1 | 2 | 3 | 4 | 5, string>;
  rating: number;
  notesDraft: string;
  onRatingChange: (r: number) => void;
  onNotesChange: (v: string) => void;
  onNotesBlur: () => void;
}) {
  return (
    <div className="sync-card">
      <h2 style={{ fontSize: 16 }}>{title}</h2>
      <p className="status-text" style={{ marginTop: 4 }}>{description}</p>
      <div style={{ margin: "10px 0" }}>
        {([5, 4, 3, 2, 1] as const).map((n) => (
          <button
            key={n}
            type="button"
            className={`rating-legend-row${n === rating ? " active" : ""}`}
            // Clicking the already-selected rating clears it, same as the old star toggle.
            onClick={() => onRatingChange(n === rating ? 0 : n)}
          >
            <span className="rating-legend-num">{n}</span>
            <span>{labels[n]}</span>
          </button>
        ))}
      </div>
      <label className="field-label" htmlFor={`notes-${title.replace(/\s+/g, "-").toLowerCase()}`}>
        Notes
      </label>
      <textarea
        id={`notes-${title.replace(/\s+/g, "-").toLowerCase()}`}
        className="field-textarea"
        value={notesDraft}
        onChange={(e) => onNotesChange(e.target.value)}
        onBlur={onNotesBlur}
        rows={3}
      />
    </div>
  );
}

export function BandDetail({ band, onBack }: { band: Band; onBack: () => void }) {
  const [userName] = useUserName();
  const [groupCode] = useGroupCode();
  const isAdmin = useIsAdmin();
  const allBands = useAllBands();
  const [editing, setEditing] = useState(false);
  const scheduled = useIsScheduled(groupCode, band.id, userName);

  // The detail view is shown/hidden with display:none rather than a real route change,
  // so the page keeps whatever scroll position the list/grid behind it was at — land on
  // the top of the detail view instead of wherever that happened to be.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [band.id]);

  const stageOptions = useMemo(
    () => Array.from(new Set(allBands.map((b) => b.stage))).sort(),
    [allBands],
  );
  const genreOptions = useMemo(
    () => Array.from(new Set(allBands.map((b) => b.genre))).sort(),
    [allBands],
  );

  // Resolves to `undefined` only while genuinely loading (never for "no row exists yet" —
  // the query itself substitutes EMPTY in that case) so drafts can be hydrated exactly once,
  // instead of on every re-render, which would clobber in-progress typing.
  const rawRating = useLiveQuery(
    async () => {
      const r = await db.ratings
        .where("[groupCode+bandId+userName]")
        .equals([groupCode, band.id, userName])
        .first();
      return r ?? EMPTY;
    },
    [groupCode, band.id, userName],
  );

  const [preNotesDraft, setPreNotesDraft] = useState("");
  const [duringNotesDraft, setDuringNotesDraft] = useState("");
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (rawRating !== undefined && hydratedFor.current !== band.id) {
      setPreNotesDraft(rawRating.preNotes);
      setDuringNotesDraft(rawRating.duringNotes);
      hydratedFor.current = band.id;
    }
  }, [band.id, rawRating]);

  const preRating = rawRating?.preRating ?? 0;
  const duringRating = rawRating?.duringRating ?? 0;

  const toggleSchedule = () => {
    if (scheduled) removeFromSchedule(groupCode, band.id, userName);
    else addToSchedule(groupCode, band.id, userName);
  };

  return (
    <div className="main">
      <button className="secondary-btn" onClick={onBack} style={{ marginBottom: 12 }}>
        ‹ Back
      </button>

      {editing ? (
        <BandEditForm
          band={band}
          stageOptions={stageOptions}
          genreOptions={genreOptions}
          onDone={() => setEditing(false)}
        />
      ) : (
        <div className="band-card">
          <div className="band-card-top">
            <div>
              <div className="band-name">{band.name}</div>
              <div className="band-meta">
                {formatMinutes(band.startMinutes)} – {formatMinutes(band.endMinutes)}
              </div>
            </div>
            <span className="badge">{band.stage}</span>
          </div>
          <div className="band-meta" style={{ marginTop: 6 }}>
            {band.genre}
          </div>
          {band.description && (
            <div className="band-meta" style={{ marginTop: 6 }}>
              {band.description}
            </div>
          )}
          <div className="band-card-actions">
            {isAdmin ? (
              <button className="secondary-btn" onClick={() => setEditing(true)}>
                Edit
              </button>
            ) : (
              <span />
            )}
            <button className={`schedule-btn${scheduled ? " added" : ""}`} onClick={toggleSchedule}>
              {scheduled ? "✓ In schedule" : "+ Add to my individual schedule"}
            </button>
          </div>
        </div>
      )}

      <RatingSection
        title="Pre-festival rating"
        description="How badly do you want to see this? This is what feeds the group schedule."
        labels={PRE_FESTIVAL_LABELS}
        rating={preRating}
        notesDraft={preNotesDraft}
        onRatingChange={(r) => setPreRating(groupCode, band.id, userName, r)}
        onNotesChange={setPreNotesDraft}
        onNotesBlur={() => setPreNotes(groupCode, band.id, userName, preNotesDraft)}
      />

      <RatingSection
        title="During the festival"
        description="How was the actual performance? This is just for the record — it doesn't affect the group schedule."
        labels={DURING_FESTIVAL_LABELS}
        rating={duringRating}
        notesDraft={duringNotesDraft}
        onRatingChange={(r) => setDuringRating(groupCode, band.id, userName, r)}
        onNotesChange={setDuringNotesDraft}
        onNotesBlur={() => setDuringNotes(groupCode, band.id, userName, duringNotesDraft)}
      />
    </div>
  );
}
