import { useState } from "react";
import { useMemo } from "react";
import type { ReactNode } from "react";
import type { Band, Day } from "../types";
import { DAY_LABELS } from "../types";
import { useAllBands } from "../state/useBands";
import { useUserRatings } from "../state/useRatings";
import { useUserName } from "../state/useUser";
import { useGroupCode } from "../state/useGroup";
import { useSession } from "../state/useAuth";
import { useOpenBandDetail } from "../state/useSelectedBand";
import { BandCardHeader } from "../components/BandCardHeader";
import { generateAiRecap } from "../lib/aiRecap";
import type { RecapAct } from "../lib/aiRecap";

interface RecapRow {
  band: Band;
  preRating: number;
  preNotes: string;
  duringRating: number;
  duringNotes: string;
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

interface RecapStats {
  totalSeen: number;
  rankCounts: Record<1 | 2 | 3 | 4 | 5, number>;
  topGenre: { name: string; count: number } | null;
  busiestDay: { day: Day; count: number } | null;
}

function StatsCard({ stats }: { stats: RecapStats }) {
  const maxRankCount = Math.max(...Object.values(stats.rankCounts));
  return (
    <div className="recap-stats-card">
      <div className="recap-stat-grid">
        <div className="recap-stat-tile">
          <div className="recap-stat-value">{stats.totalSeen}</div>
          <div className="recap-stat-label">Acts seen</div>
        </div>
        <div className="recap-stat-tile">
          <div className="recap-stat-value">{stats.topGenre?.name ?? "—"}</div>
          <div className="recap-stat-label">
            Top genre{stats.topGenre ? ` (${stats.topGenre.count})` : ""}
          </div>
        </div>
        <div className="recap-stat-tile">
          <div className="recap-stat-value">
            {stats.busiestDay ? DAY_LABELS[stats.busiestDay.day] : "—"}
          </div>
          <div className="recap-stat-label">
            Busiest day{stats.busiestDay ? ` (${stats.busiestDay.count})` : ""}
          </div>
        </div>
      </div>

      {([5, 4, 3, 2, 1] as const).map((rank) => (
        <div className="recap-rating-row" key={rank}>
          <span className="recap-rating-label">★{rank}</span>
          <div className="recap-rating-bar-track">
            <div
              className="recap-rating-bar-fill"
              style={{ width: maxRankCount > 0 ? `${(stats.rankCounts[rank] / maxRankCount) * 100}%` : "0%" }}
            />
          </div>
          <span className="recap-rating-count">{stats.rankCounts[rank]}</span>
        </div>
      ))}
    </div>
  );
}

type AiRecapState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; text: string }
  | { status: "error"; message: string };

/** Sends this user's rated acts (numbers + notes, both pre- and during-fest) to the /api/recap
 * serverless function and shows back whatever funny summary the LLM writes. Generation is a
 * deliberate button press, not automatic — it's a paid API call the user should choose to make. */
function AiRecapSection({ userName, acts }: { userName: string; acts: RecapAct[] }) {
  const { session } = useSession();
  const [state, setState] = useState<AiRecapState>({ status: "idle" });

  async function handleGenerate() {
    if (!session) return;
    setState({ status: "loading" });
    try {
      const text = await generateAiRecap(session.access_token, userName, acts);
      setState({ status: "done", text });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Couldn't generate a recap — try again." });
    }
  }

  return (
    <div className="ai-recap-card">
      <div className="sync-row" style={{ marginTop: 0 }}>
        <h2 style={{ fontSize: 16 }}>Your Festival, As Told By AI</h2>
        <button className="secondary-btn" onClick={handleGenerate} disabled={state.status === "loading"}>
          {state.status === "loading" ? "…" : state.status === "done" || state.status === "error" ? "Regenerate" : "Generate"}
        </button>
      </div>
      {state.status === "idle" && (
        <p className="status-text" style={{ marginTop: 10 }}>
          A short, funny AI-written recap of your festival, based on your ratings and notes.
        </p>
      )}
      {state.status === "error" && (
        <p className="status-text err" style={{ marginTop: 10 }}>{state.message}</p>
      )}
      {state.status === "done" && <p className="ai-recap-text">{state.text}</p>}
    </div>
  );
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

  const { ranked, surprises, disappointments, stats } = useMemo(() => {
    const rated: RecapRow[] = [];
    for (const band of bands) {
      const r = ratings.get(band.id);
      if (!r || r.duringRating <= 0) continue;
      rated.push({
        band,
        preRating: r.preRating,
        preNotes: r.preNotes,
        duringRating: r.duringRating,
        duringNotes: r.duringNotes,
        diff: r.duringRating - r.preRating,
      });
    }
    const ranked = [...rated].sort((a, b) => b.duringRating - a.duringRating);

    const maxDiff = rated.reduce((max, r) => Math.max(max, r.diff), 0);
    const surprises = maxDiff > 0 ? rated.filter((r) => r.diff === maxDiff) : [];

    const minDiff = rated.reduce((min, r) => Math.min(min, r.diff), 0);
    const disappointments = minDiff < 0 ? rated.filter((r) => r.diff === minDiff) : [];

    const rankCounts: RecapStats["rankCounts"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const genreCounts = new Map<string, number>();
    const dayCounts = new Map<Day, number>();
    for (const row of rated) {
      rankCounts[row.duringRating as 1 | 2 | 3 | 4 | 5]++;
      genreCounts.set(row.band.genre, (genreCounts.get(row.band.genre) ?? 0) + 1);
      dayCounts.set(row.band.day, (dayCounts.get(row.band.day) ?? 0) + 1);
    }
    let topGenre: RecapStats["topGenre"] = null;
    for (const [name, count] of genreCounts) {
      if (!topGenre || count > topGenre.count) topGenre = { name, count };
    }
    let busiestDay: RecapStats["busiestDay"] = null;
    for (const [day, count] of dayCounts) {
      if (!busiestDay || count > busiestDay.count) busiestDay = { day, count };
    }

    const stats: RecapStats = { totalSeen: rated.length, rankCounts, topGenre, busiestDay };

    return { ranked, surprises, disappointments, stats };
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

  const acts: RecapAct[] = ranked.map((row) => ({
    name: row.band.name,
    genre: row.band.genre,
    stage: row.band.stage,
    day: DAY_LABELS[row.band.day],
    preRating: row.preRating,
    preNotes: row.preNotes,
    duringRating: row.duringRating,
    duringNotes: row.duringNotes,
  }));

  return (
    <div className="main">
      <StatsCard stats={stats} />

      <AiRecapSection userName={userName} acts={acts} />

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
