export interface Formatters {
  /** Locale tag the formatters use, e.g. `nl-NL`. */
  tag: string;
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Currency symbol in front, digits grouped for the language. `decimals` fixes the fraction digits (default 0). */
  money: (value: number, symbol: string, decimals?: number | Intl.NumberFormatOptions) => string;
  date: (date: Date, options: Intl.DateTimeFormatOptions) => string;
  /** Short month name for a 0-based month index. */
  shortMonth: (monthIndex: number) => string;
  /** "October 2026" for a `YYYY-MM` key. */
  monthYear: (monthKey: string, month?: 'long' | 'short') => string;
  /** "5 Oct 2026" for a `YYYY-MM-DD` key (the year can be left out). */
  day: (dateKey: string, withYear?: boolean) => string;
  /** "5 Oct 2026 – 9 Oct 2026"; a single day when both ends are equal. */
  range: (from: string, to: string) => string;
}

export const createFormatters = (tag: string): Formatters => {
  const number: Formatters['number'] = (value, options) => {
    try {
      return value.toLocaleString(tag, options);
    } catch {
      return value.toLocaleString(undefined, options);
    }
  };

  const date: Formatters['date'] = (value, options) => {
    try {
      return value.toLocaleDateString(tag, options);
    } catch {
      return value.toLocaleDateString(undefined, options);
    }
  };

  const day: Formatters['day'] = (dateKey, withYear = true) => {
    const [y, m, d] = dateKey.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return dateKey;
    return date(new Date(y, m - 1, d), {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' as const } : {}),
    });
  };

  return {
    tag,
    day,
    range: (from, to) => (from === to ? day(from) : `${day(from)} – ${day(to)}`),
    number,
    money: (value, symbol, decimals = 0) =>
      `${symbol}${number(
        value,
        typeof decimals === 'number'
          ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
          : decimals
      )}`,
    date,
    shortMonth: (monthIndex) => date(new Date(2024, monthIndex, 1), { month: 'short' }),
    monthYear: (monthKey, month = 'long') => {
      const [y, m] = monthKey.split('-').map(Number);
      if (!y || !m) return monthKey;
      return date(new Date(y, m - 1, 1), { month, year: 'numeric' });
    },
  };
};
