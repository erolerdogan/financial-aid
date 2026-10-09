import { CURRENCY_SYMBOLS } from '@/contexts/ProfileContext';
import {
  getAlerts,
  getAlertSettings,
  getCategoryBenchmarkGroups,
  getHealthData,
  getHousehold,
  getMutedAlertKeys,
  getRangeOverrides,
  insertAlerts,
  type SQLiteDatabase,
  type StoredHealthAlert,
} from '@/db/database';
import { getActiveTag, tNow } from '@/i18n';
import { createFormatters } from '@/i18n/format';
import {
  computeHealth,
  healthHistory,
  indexMonths,
  previousMonthWithData,
  type HealthHistoryPoint,
  type HealthInput,
  type HealthResult,
} from '@/utils/budgetHealth';
import { todayKey } from '@/utils/debt';
import { alertText } from '@/utils/healthAlertText';
import { forecastNextMonth, type HealthForecast } from '@/utils/healthForecast';
import {
  buildHealthAlerts,
  enabledAlertTypes,
  MAX_ALERTS_PER_RUN,
  selectAlerts,
  type HealthAlert,
} from '@/utils/healthAlerts';
import { notifyHealthAlerts } from '@/utils/notifications';

// Thin loaders for the pure engines in `src/utils/budgetHealth.ts` and `src/utils/healthAlerts.ts`.

export async function loadHealthInput(db: SQLiteDatabase, profileId: number): Promise<HealthInput> {
  const [data, categoryGroups, household, overrides] = await Promise.all([
    getHealthData(db, profileId),
    getCategoryBenchmarkGroups(db, profileId),
    getHousehold(db, profileId),
    getRangeOverrides(db, profileId),
  ]);
  return { ...data, categoryGroups, household, overrides, today: todayKey() };
}

export interface HealthSnapshot {
  /** Months with transactions, newest first. */
  months: string[];
  /** Null when the profile has no transactions. */
  result: HealthResult | null;
  /** The month before it that has a score, for the "↑4" on the card. */
  previous: HealthHistoryPoint | null;
  history: HealthHistoryPoint[];
  /** Next month as a typical month; it does not depend on the month asked for. Null with too little data. */
  forecast: HealthForecast | null;
  input: HealthInput;
}

/** Health for one month; without a month (or with one that has no data) the latest month with data is used. */
export async function loadHealth(db: SQLiteDatabase, profileId: number, month?: string): Promise<HealthSnapshot> {
  const input = await loadHealthInput(db, profileId);
  const index = indexMonths(input);
  const months = Array.from(index.keys()).sort().reverse();
  const target = month && index.has(month) ? month : months[0];
  if (!target) return { months, result: null, previous: null, history: [], forecast: null, input };

  const result = computeHealth(input, target, index);
  const history = healthHistory(input, target, 12, index);

  let previous: HealthHistoryPoint | null = null;
  const previousMonth = previousMonthWithData(index, target);
  if (previousMonth) {
    const earlier = computeHealth(input, previousMonth, index);
    if (earlier.score !== null) previous = { month: previousMonth, score: earlier.score };
  }

  return { months, result, previous, history, forecast: forecastNextMonth(input, index), input };
}

/** Alerts of the latest month that the user has not answered yet. */
export async function loadNewAlerts(db: SQLiteDatabase, profileId: number): Promise<StoredHealthAlert[]> {
  const latest = await db.getFirstAsync<{ month: string | null }>(
    `SELECT MAX(monthName) AS month FROM transactions WHERE profileId = ?;`,
    [profileId]
  );
  if (!latest?.month) return [];
  const alerts = await getAlerts(db, profileId, latest.month);
  return alerts.filter((alert) => alert.status === 'new').slice(0, MAX_ALERTS_PER_RUN);
}

/**
 * Runs after every successful import: works out the alerts for the latest month, stores the new ones
 * and shows a notification for each (only when notifications are already allowed). Returns what was added.
 */
export async function runHealthAlerts(db: SQLiteDatabase, profileId: number): Promise<HealthAlert[]> {
  const input = await loadHealthInput(db, profileId);
  const months = Array.from(indexMonths(input).keys()).sort();
  const month = months[months.length - 1];
  if (!month) return [];

  const [settings, mutedKeys] = await Promise.all([
    getAlertSettings(db, profileId),
    getMutedAlertKeys(db, profileId),
  ]);
  const selected = selectAlerts(buildHealthAlerts(input, month), {
    enabled: enabledAlertTypes(settings),
    mutedKeys,
  });
  const added = await insertAlerts(db, profileId, selected);
  if (added.length === 0) return added;

  const profile = await db.getFirstAsync<{ currency: string }>(`SELECT currency FROM profiles WHERE id = ?;`, [
    profileId,
  ]);
  const symbol = CURRENCY_SYMBOLS[profile?.currency ?? 'EUR'] ?? '€';
  const format = createFormatters(getActiveTag());
  await notifyHealthAlerts(added.map((alert) => alertText(alert.message, tNow, format, symbol)));

  return added;
}
