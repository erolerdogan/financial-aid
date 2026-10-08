// Year and month levels of the Custom Range sheet: which years are listed, which cells are out of bounds,
// and which ones hold part of the selected range. Dates are `YYYY-MM-DD` keys, months `YYYY-MM`.

/** Years listed when a bound is missing: this many before the other end. */
export const FALLBACK_YEAR_SPAN = 10;

const pad = (value: number): string => String(value).padStart(2, '0');

export const monthKey = (year: number, monthIndex: number): string => `${year}-${pad(monthIndex + 1)}`;

/** Years to show, oldest first: from the `minDate` year to the `maxDate` year. */
export function yearOptions(minDate: string | null, maxDate: string | null, today: Date): number[] {
  const last = maxDate ? Number(maxDate.slice(0, 4)) : Math.max(today.getFullYear(), minDate ? Number(minDate.slice(0, 4)) : 0);
  const first = minDate ? Math.min(Number(minDate.slice(0, 4)), last) : last - FALLBACK_YEAR_SPAN;
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

export function isMonthDisabled(month: string, minDate: string | null, maxDate: string | null): boolean {
  return (!!minDate && month < minDate.slice(0, 7)) || (!!maxDate && month > maxDate.slice(0, 7));
}

export function isYearDisabled(year: number, minDate: string | null, maxDate: string | null): boolean {
  return (!!minDate && year < Number(minDate.slice(0, 4))) || (!!maxDate && year > Number(maxDate.slice(0, 4)));
}

/** The month key for `year` / `monthIndex`, moved to the nearest month inside the bounds. */
export function clampMonth(year: number, monthIndex: number, minDate: string | null, maxDate: string | null): string {
  const key = monthKey(year, monthIndex);
  if (minDate && key < minDate.slice(0, 7)) return minDate.slice(0, 7);
  if (maxDate && key > maxDate.slice(0, 7)) return maxDate.slice(0, 7);
  return key;
}

/** True when the selection (`end` null: a single day so far) has at least one day in the month. */
export function monthTouchesRange(month: string, start: string | null, end: string | null): boolean {
  if (!start) return false;
  return start.slice(0, 7) <= month && month <= (end ?? start).slice(0, 7);
}

export function yearTouchesRange(year: number, start: string | null, end: string | null): boolean {
  if (!start) return false;
  return Number(start.slice(0, 4)) <= year && year <= Number((end ?? start).slice(0, 4));
}
