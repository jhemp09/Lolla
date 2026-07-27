import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { setStageDistance, deleteStageDistance } from "../db/db";
import { useAllBands } from "../state/useBands";
import { sortByStageOrder } from "../lib/stageOrder";
import { DEFAULT_WALK_MINUTES } from "../lib/stageDistances";
import { notifyLocalChange } from "../lib/autoSync";

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

function DistanceRow({
  stageA,
  stageB,
  minutes,
}: {
  stageA: string;
  stageB: string;
  minutes: number | undefined;
}) {
  const [draft, setDraft] = useState(minutes !== undefined ? String(minutes) : "");

  // Reflects edits arriving from elsewhere (a teammate's sync pull) as long as this
  // row isn't the thing being actively typed into.
  useEffect(() => {
    setDraft(minutes !== undefined ? String(minutes) : "");
  }, [minutes]);

  const commit = async () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      await deleteStageDistance(stageA, stageB);
    } else {
      const parsed = parseInt(trimmed, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setDraft(minutes !== undefined ? String(minutes) : "");
        return;
      }
      await setStageDistance(stageA, stageB, parsed);
    }
    notifyLocalChange();
  };

  return (
    <div className="sync-row">
      <span className="status-text">
        {stageA} ↔ {stageB}
      </span>
      <input
        className="field-input"
        style={{ width: 70, textAlign: "right" }}
        type="number"
        min={0}
        inputMode="numeric"
        placeholder={String(DEFAULT_WALK_MINUTES)}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
    </div>
  );
}

export function StageDistancesPage({ onBack }: { onBack: () => void }) {
  const allBands = useAllBands();
  const distances = useLiveQuery(() => db.stageDistances.toArray()) ?? [];

  const stages = sortByStageOrder(Array.from(new Set(allBands.map((b) => b.stage))));
  const lookup = new Map(distances.map((d) => [pairKey(d.stageA, d.stageB), d.minutes]));

  const pairs: [string, string][] = [];
  for (let i = 0; i < stages.length; i++) {
    for (let j = i + 1; j < stages.length; j++) {
      pairs.push([stages[i], stages[j]]);
    }
  }

  return (
    <div className="main">
      <button className="secondary-btn" onClick={onBack} style={{ marginBottom: 12 }}>
        ‹ Back
      </button>
      <div className="sync-card">
        <h2 style={{ fontSize: 16 }}>Stage walking distances</h2>
        <p className="status-text" style={{ marginTop: 6 }}>
          Used by the group schedule optimizer to break ties between otherwise
          equally-rated picks. Leave a pair blank to fall back to the default{" "}
          {DEFAULT_WALK_MINUTES}-minute assumption.
        </p>
        {pairs.length === 0 ? (
          <p className="status-text" style={{ marginTop: 6 }}>
            Import a lineup first — stages come from whatever's currently loaded.
          </p>
        ) : (
          pairs.map(([a, b]) => (
            <DistanceRow key={pairKey(a, b)} stageA={a} stageB={b} minutes={lookup.get(pairKey(a, b))} />
          ))
        )}
      </div>
    </div>
  );
}
