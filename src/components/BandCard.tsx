import type { Band } from "../types";
import { formatMinutes } from "../types";
import { usePreRating } from "../state/useRatings";
import { useUserName } from "../state/useUser";
import { useGroupCode } from "../state/useGroup";
import { useOpenBandDetail } from "../state/useSelectedBand";

export function BandCard({ band }: { band: Band }) {
  const [userName] = useUserName();
  const [groupCode] = useGroupCode();
  const preRating = usePreRating(groupCode, band.id, userName);
  const open = useOpenBandDetail(band.id);

  return (
    <div className="band-card clickable" onClick={open}>
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
