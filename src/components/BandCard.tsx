import type { Band } from "../types";
import { formatMinutes } from "../types";
import { usePreRating } from "../state/useRatings";
import { useUserName } from "../state/useUser";
import { useGroupCode } from "../state/useGroup";

export function BandCard({ band, onSelect }: { band: Band; onSelect: (band: Band) => void }) {
  const [userName] = useUserName();
  const [groupCode] = useGroupCode();
  const preRating = usePreRating(groupCode, band.id, userName);

  return (
    <div className="band-card clickable" onClick={() => onSelect(band)}>
      <div className="band-card-top">
        <div>
          <div className="band-name">{band.name}</div>
          <div className="band-meta">
            {formatMinutes(band.startMinutes)} – {formatMinutes(band.endMinutes)}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {preRating > 0 && <span className="rating-indicator">★ {preRating}</span>}
          <span className="badge">{band.stage}</span>
        </div>
      </div>
      <div className="band-meta" style={{ marginTop: 6 }}>
        {band.genre}
      </div>
    </div>
  );
}
