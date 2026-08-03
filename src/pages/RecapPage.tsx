import { useMemo } from "react";
import type { ReactNode } from "react";
import type { Band } from "../types";
import { useAllBands } from "../state/useBands";
import { useUserRatings } from "../state/useRatings";
import { useUserName } from "../state/useUser";
import { useGroupCode } from "../state/useGroup";
import { useOpenBandDetail } from "../state/useSelectedBand";
import { BandCardHeader } from "../components/BandCardHeader";

interface RecapRow {
  band: Band;
  preRating: number;
  duringRating: number;
  /** duringRating - preRating, with an unrated pre-fest band treated as a 0 — so a band
   * nobody pre-rated at all still counts as a "low or no ranking" for surprise purposes. */
  diff: number;
}

/** during-vs-pre gap as a colored badge: green/"+n" for a pleasant surprise, red/"n" for a
 * letdown, neutral/"0" when the performance matched expectations exactly. */
function DiffBadge({ diff }: { diff: number }) {
  if (diff > 0) return <span className="diff-badge surprise">+{diff}</span>;
  if (diff < 0) return <span className="diff-badge disappointment">{diff}</span>;
  return <span className="diff-badge low">0</span>;
}

function RecapCard({ row, badge }: { row: RecapRow; badge: ReactNode }) {
  const open = useOpenBandDetail(row.band.id);
  return (
    <div className="band-card clickable" onClick={open}>
      <BandCardHeader
        band={row.band}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {badge}
            <span className="rating-indicator">★ {row.duringRating}</span>
          </div>
        }
      />
      <div className="band-meta" style={{ marginTop: 6 }}>
        {row.band.stage} · Pre-fest rating: {row.preRating > 0 ? row.preRating : "unrated"}
      </div>
    </div>
  );
}

export function RecapPage() {
  const bands = useAllBands();
  const [userName] = useUserName();
  const [groupCode] = useGroupCode();
  const ratings = useUserRatings(groupCode, userName);

  const { ranked, surprises, disappointments } = useMemo(() => {
    const rated: RecapRow[] = [];
    for (const band of bands) {
      const r = ratings.get(band.id);
      if (!r || r.duringRating <= 0) continue;
      rated.push({
        band,
        preRating: r.preRating,
        duringRating: r.duringRating,
        diff: r.duringRating - r.preRating,
      });
    }
    const ranked = [...rated].sort((a, b) => b.duringRating - a.duringRating);

    const maxDiff = rated.reduce((max, r) => Math.max(max, r.diff), 0);
    const surprises = maxDiff > 0 ? rated.filter((r) => r.diff === maxDiff) : [];

    const minDiff = rated.reduce((min, r) => Math.min(min, r.diff), 0);
    const disappointments = minDiff < 0 ? rated.filter((r) => r.diff === minDiff) : [];

    return { ranked, surprises, disappointments };
  }, [bands, ratings]);

  if (ranked.length === 0) {
    return (
      <div className="main">
        <div className="empty-state">
          Rate some bands "during the festival" and your recap will show up here.
        </div>
      </div>
    );
  }

  return (
    <div className="main">
      {surprises.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Biggest Surprises</h2>
          {surprises.map((row) => (
            <RecapCard key={row.band.id} row={row} badge={<DiffBadge diff={row.diff} />} />
          ))}
        </>
      )}

      {disappointments.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, margin: "12px 0 8px" }}>Biggest Disappointments</h2>
          {disappointments.map((row) => (
            <RecapCard key={row.band.id} row={row} badge={<DiffBadge diff={row.diff} />} />
          ))}
        </>
      )}

      <h2 style={{ fontSize: 15, margin: "12px 0 8px" }}>Fest Recap</h2>
      {ranked.map((row) => (
        <RecapCard key={row.band.id} row={row} badge={<DiffBadge diff={row.diff} />} />
      ))}
    </div>
  );
}
