// Year comparison on the Trends chart: which years are drawn next to the selected one, and in which colour.

/** The chart draws the selected year plus at most this many other years (`data2`..`data5`). */
export const MAX_COMPARE_YEARS = 4;

const newestFirst = (a: string, b: string): number => b.localeCompare(a);

/**
 * Years drawn next to `selectedYear`, newest first.
 * `picked === null` means the user has not chosen yet: the previous year, when it has data.
 */
export function resolveCompareYears(
  selectedYear: string,
  yearsWithData: string[],
  picked: string[] | null
): string[] {
  if (picked === null) {
    const previous = String(Number(selectedYear) - 1);
    return yearsWithData.includes(previous) ? [previous] : [];
  }
  return Array.from(new Set(picked))
    .filter((year) => year !== selectedYear && yearsWithData.includes(year))
    .sort(newestFirst)
    .slice(0, MAX_COMPARE_YEARS);
}

/** Adds or removes a year; adding beyond the cap changes nothing. */
export function toggleCompareYear(current: string[], year: string): string[] {
  if (current.includes(year)) return current.filter((y) => y !== year);
  if (current.length >= MAX_COMPARE_YEARS) return current;
  return [...current, year].sort(newestFirst);
}

/** `count` colours from the palette in order, skipping `avoid` (the colour of the selected year's line). */
export function pickSeriesColors(count: number, palette: string[], avoid: string): string[] {
  const usable = palette.filter((color) => color.toLowerCase() !== avoid.toLowerCase());
  if (usable.length === 0) return [];
  return Array.from({ length: Math.max(0, count) }, (_, i) => usable[i % usable.length]);
}

/** The same month in another year: its amount and how much the selected year differs from it. */
export function compareMonth(
  currentValue: number,
  values: number[] | undefined,
  monthIndex: number
): { previous: number; diff: number } {
  const previous = values?.[monthIndex] ?? 0;
  return { previous, diff: currentValue - previous };
}
