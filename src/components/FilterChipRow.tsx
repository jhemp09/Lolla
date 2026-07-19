interface Props<T extends string | number> {
  label: string;
  options: T[];
  optionLabel?: (opt: T) => string;
  selected: Set<T>;
  onToggle: (opt: T) => void;
}

/** A labeled row of multi-select toggle chips. Empty `selected` set means "no filter" (show everything). */
export function FilterChipRow<T extends string | number>({
  label,
  options,
  optionLabel,
  selected,
  onToggle,
}: Props<T>) {
  if (options.length === 0) return null;

  return (
    <div style={{ marginBottom: 6 }}>
      <div className="field-label" style={{ margin: "0 0 4px" }}>
        {label}
      </div>
      <div className="stage-filter">
        {options.map((opt) => (
          <button
            key={opt}
            className={`stage-chip${selected.has(opt) ? " active" : ""}`}
            onClick={() => onToggle(opt)}
          >
            {optionLabel ? optionLabel(opt) : String(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}
