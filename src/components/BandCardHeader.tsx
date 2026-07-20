import type { ReactNode } from "react";
import type { Band } from "../types";
import { formatMinutes } from "../types";

/** Name + start-end time, with an optional right-aligned slot (rating indicator, stage badge,
 * etc.) — the piece every band card/list-row shares, regardless of what else surrounds it. */
export function BandCardHeader({ band, right }: { band: Band; right?: ReactNode }) {
  return (
    <div className="band-card-top">
      <div>
        <div className="band-name">{band.name}</div>
        <div className="band-meta">
          {formatMinutes(band.startMinutes)} – {formatMinutes(band.endMinutes)}
        </div>
      </div>
      {right}
    </div>
  );
}
