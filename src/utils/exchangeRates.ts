/** Exchange rates as the app keeps them: how many units of each currency one unit of `base` buys. */
export interface RateTable {
  base: string;
  rates: Record<string, number>;
  /** When the source last changed its rates (ms since epoch). */
  updatedAt: number;
  /** From this moment the table is too old to convert with (ms since epoch). */
  nextUpdateAt: number;
}

export const RATES_META_KEY = 'exchange_rates';

const HOUR = 60 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Reads an answer of open.er-api.com (`/v6/latest/<base>`); `null` when it is an error or has no usable rates.
 * The source asks for at most one request an hour, so a table always lasts that long.
 */
export function parseRatesResponse(body: unknown, now: number): RateTable | null {
  if (!isRecord(body) || body.result !== 'success') return null;
  const { base_code: base, rates: rawRates } = body;
  if (typeof base !== 'string' || !isRecord(rawRates)) return null;

  const rates: Record<string, number> = {};
  for (const [code, rate] of Object.entries(rawRates)) {
    if (/^[A-Z]{3}$/.test(code) && isRate(rate)) rates[code] = rate;
  }
  if (!isRate(rates[base])) return null;

  const seconds = (value: unknown): number | null => (isRate(value) ? value * 1000 : null);
  return {
    base,
    rates,
    updatedAt: seconds(body.time_last_update_unix) ?? now,
    nextUpdateAt: Math.max(seconds(body.time_next_update_unix) ?? 0, now + HOUR),
  };
}

/** A table read back from storage; `null` when it is not one. */
export function parseStoredRates(text: string | null): RateTable | null {
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (!isRecord(value) || typeof value.base !== 'string' || !isRecord(value.rates)) return null;
    if (!isRate(value.updatedAt) || !isRate(value.nextUpdateAt)) return null;
    if (!Object.values(value.rates).every(isRate)) return null;
    return {
      base: value.base,
      rates: value.rates as Record<string, number>,
      updatedAt: value.updatedAt,
      nextUpdateAt: value.nextUpdateAt,
    };
  } catch {
    return null;
  }
}

export const isFresh = (table: RateTable, now: number): boolean => now < table.nextUpdateAt;

/** What an amount in `from` is multiplied by to get `to`; `null` when the table lacks one of the two. */
export function conversionFactor(table: RateTable, from: string, to: string): number | null {
  if (from === to) return 1;
  const fromRate = table.rates[from];
  const toRate = table.rates[to];
  if (!isRate(fromRate) || !isRate(toRate)) return null;
  return toRate / fromRate;
}

/** An amount in another currency, rounded to the decimals that currency has. */
export function convertAmount(amount: number, factor: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(amount * factor * scale) / scale;
}
