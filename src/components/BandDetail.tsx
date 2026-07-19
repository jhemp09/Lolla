import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Band, Rating } from "../types";
import { formatMinutes } from "../types";
import { RatingStars } from "./RatingStars";
import { setPreRating, setPreNotes, setDuringRating, setDuringNotes } from "../state/useRatings";
import { useIsScheduled, addToSchedule, removeFromSchedule } from "../state/useSchedule";
import { useUserName } from "../state/useUser";
import { useGroupCode } from "../state/useGroup";
import { PRE_FESTIVAL_LABELS, DURING_FESTIVAL_LABELS } from "../lib/ratingLabels";

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
        <RatingStars rating={rating} onChange={onRatingChange} size={28} />
      </div>
      <div>
        {([5, 4, 3, 2, 1] as const).map((n) => (
          <div key={n} className={`rating-legend-row${n === rating ? " active" : ""}`}>
            <span className="rating-legend-num">{n}</span>
            <span>{labels[n]}</span>
          </div>
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
  const scheduled = useIsScheduled(groupCode, band.id, userName);

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
          <span />
          <button className={`schedule-btn${scheduled ? " added" : ""}`} onClick={toggleSchedule}>
            {scheduled ? "✓ In schedule" : "+ Add to schedule"}
          </button>
        </div>
      </div>

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
