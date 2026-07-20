/**
 * Left-to-right column order for the schedule grid, matching the physical layout of
 * the festival grounds rather than alphabetical or import order. Any stage not in
 * this list (e.g. a rename, or a future year's new stage) sorts after these, A-Z.
 */
const STAGE_ORDER = ["Bud Light", "Tito's", "Airbnb", "BMI", "Perry's", "Allianz", "T-Mobile"];

export function sortByStageOrder(stages: string[]): string[] {
  return [...stages].sort((a, b) => {
    const ia = STAGE_ORDER.indexOf(a);
    const ib = STAGE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}
