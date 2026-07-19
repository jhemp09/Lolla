interface Props {
  rating: number;
  onChange: (rating: number) => void;
  size?: number;
}

export function RatingStars({ rating, onChange, size = 22 }: Props) {
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-btn${n <= rating ? " filled" : ""}`}
          style={{ fontSize: size }}
          aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            // Tapping the currently-set star clears the rating.
            onChange(n === rating ? 0 : n);
          }}
        >
          {n <= rating ? "★" : "☆"}
        </button>
      ))}
    </span>
  );
}
