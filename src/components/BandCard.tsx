import type { Band } from "../types";
import { formatMinutes } from "../types";
import { RatingStars } from "./RatingStars";
import { useRating, setRating } from "../state/useRatings";
import { useIsScheduled, addToSchedule, removeFromSchedule } from "../state/useSchedule";
import { useUserName } from "../state/useUser";
import { useGroupCode } from "../state/useGroup";

export function BandCard({ band }: { band: Band }) {
  const [userName] = useUserName();
  const [groupCode] = useGroupCode();
  const rating = useRating(groupCode, band.id, userName);
  const scheduled = useIsScheduled(groupCode, band.id, userName);

  const toggleSchedule = () => {
    if (scheduled) removeFromSchedule(groupCode, band.id, userName);
    else addToSchedule(groupCode, band.id, userName);
  };

  return (
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
      <div className="band-card-actions">
        <RatingStars rating={rating} onChange={(r) => setRating(groupCode, band.id, userName, r)} />
        <button
          className={`schedule-btn${scheduled ? " added" : ""}`}
          onClick={toggleSchedule}
        >
          {scheduled ? "✓ In schedule" : "+ Add to schedule"}
        </button>
      </div>
    </div>
  );
}
