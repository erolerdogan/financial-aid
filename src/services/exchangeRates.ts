// The only file that asks the network for anything: today's exchange rates, used when a profile
// switches currency. The request is always the same (the full table against one fixed base), so it
// carries no user data and does not even say which currencies the user has.

import { getAppMeta, setAppMeta } from '@/db/database';
import {
  isFresh,
  parseRatesResponse,
  parseStoredRates,
  RATES_META_KEY,
  type RateTable,
} from '@/utils/exchangeRates';
import type { SQLiteDatabase } from 'expo-sqlite';

export interface RateProvider {
  /** Shown as the credit next to the rates, as the source asks. */
  name: string;
  url: string;
  /** Today's table, or `null` when the source cannot be reached or answers with something else. */
  fetchRates: () => Promise<RateTable | null>;
}

const REQUEST_TIMEOUT_MS = 10_000;

/** https://www.exchangerate-api.com/docs/free: no key, updated once a day, credit required. */
export const openErApiProvider: RateProvider = {
  name: 'Exchange Rate API',
  url: 'https://www.exchangerate-api.com',
  fetchRates: async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD', { signal: controller.signal });
      if (!response.ok) return null;
      return parseRatesResponse(await response.json(), Date.now());
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  },
};

export const RATE_PROVIDER: RateProvider = openErApiProvider;

/**
 * Rates to convert with now. The last table is kept until the source has a newer one, so the
 * network is asked at most once a day; a table past that moment is never used.
 */
export async function getRates(db: SQLiteDatabase, provider: RateProvider = RATE_PROVIDER): Promise<RateTable | null> {
  const stored = parseStoredRates(await getAppMeta(db, RATES_META_KEY));
  if (stored && isFresh(stored, Date.now())) return stored;

  const fetched = await provider.fetchRates();
  if (!fetched) return null;
  await setAppMeta(db, RATES_META_KEY, JSON.stringify(fetched)).catch((error) =>
    console.warn('Exchange rates save warning:', error)
  );
  return fetched;
}
