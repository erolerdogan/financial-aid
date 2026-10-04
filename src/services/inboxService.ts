import {
  dismissDebtSuggestion,
  getAppMeta,
  getDebtKeywordMatches,
  getDebtSuggestions,
  getDebtSummaries,
  setAppMeta,
} from '@/db/database';
import { getLastBackupDate } from '@/services/backupService';
import { DebtSuggestion } from '@/utils/debtSuggestion';
import { UNCATEGORISED } from '@/utils/parser';
import type { SQLiteDatabase } from 'expo-sqlite';

const DAY_MS = 86400000;
const BACKUP_INTERVAL_DAYS = 30;
// A past month whose last transaction is before this day is treated as a partial statement (same rule as Home).
const FULL_MONTH_MIN_DAY = 25;
const MAX_PARTIAL_MONTHS = 2;

interface InboxItemBase {
  key: string;
  /** Stored when the item is dismissed; decides when it may come back. */
  dismissValue: number;
}

export type InboxItem =
  // One row however many there are; the Debts tab lists them one by one.
  | (InboxItemBase & { kind: 'DEBT_SUGGESTIONS'; suggestions: DebtSuggestion[] })
  | (InboxItemBase & { kind: 'UNCATEGORISED'; count: number })
  | (InboxItemBase & { kind: 'DEBT_MATCHES'; debtId: number; debtName: string; count: number })
  | (InboxItemBase & { kind: 'PARTIAL_MONTH'; month: string; minDate: string; maxDate: string })
  | (InboxItemBase & { kind: 'BACKUP'; daysSince: number | null });

/** Reminders show a dot on the bell; everything else needs a decision and is counted. */
export const isQuietInboxItem = (item: InboxItem): boolean => item.kind === 'BACKUP';

const dismissedKey = (profileId: number) => `inbox_dismissed:${profileId}`;

async function getDismissed(db: SQLiteDatabase, profileId: number): Promise<Record<string, number>> {
  try {
    const parsed: unknown = JSON.parse((await getAppMeta(db, dismissedKey(profileId))) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number') result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

const currentMonthKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/** Everything the user could act on for this profile, most useful first. */
export async function getInboxItems(
  db: SQLiteDatabase,
  profileId: number,
  options: { includeBackup: boolean }
): Promise<InboxItem[]> {
  const [dismissed, suggestions, uncategorised, debts, months, lastBackup] = await Promise.all([
    getDismissed(db, profileId),
    getDebtSuggestions(db, profileId),
    db.getFirstAsync<{ cnt: number; maxId: number | null }>(
      `SELECT COUNT(*) AS cnt, MAX(id) AS maxId FROM transactions WHERE profileId = ? AND category = ?;`,
      [profileId, UNCATEGORISED]
    ),
    getDebtSummaries(db, profileId),
    db.getAllAsync<{ month: string; minDate: string; maxDate: string }>(
      `SELECT monthName AS month, MIN(date) AS minDate, MAX(date) AS maxDate
       FROM transactions WHERE profileId = ? GROUP BY monthName ORDER BY monthName DESC LIMIT 4;`,
      [profileId]
    ),
    options.includeBackup ? getLastBackupDate(db) : Promise.resolve(null),
  ]);

  // Dismissed with a value at or past the threshold: nothing new since, keep it hidden.
  const hidden = (key: string, threshold: number) => (dismissed[key] ?? -Infinity) >= threshold;
  const items: InboxItem[] = [];

  if (suggestions.length > 0) {
    items.push({ kind: 'DEBT_SUGGESTIONS', key: 'debt-suggestions', dismissValue: 1, suggestions });
  }

  // Comes back when a later import adds uncategorised rows (higher ids).
  const uncategorisedMaxId = uncategorised?.maxId ?? 0;
  if ((uncategorised?.cnt ?? 0) > 0 && !hidden('uncategorised', uncategorisedMaxId)) {
    items.push({
      kind: 'UNCATEGORISED',
      key: 'uncategorised',
      dismissValue: uncategorisedMaxId,
      count: uncategorised?.cnt ?? 0,
    });
  }

  for (const debt of debts) {
    if (debt.isPaidOff || debt.keywords.length === 0) continue;
    const matches = await getDebtKeywordMatches(
      db,
      profileId,
      debt.keywords,
      debt.startDate,
      debt.paymentAmount,
      debt.id
    );
    const possible = matches.filter((m) => m.status === 'POSSIBLE');
    if (possible.length === 0) continue;
    const key = `debt-matches:${debt.id}`;
    const maxId = Math.max(...possible.map((m) => m.id));
    if (hidden(key, maxId)) continue;
    items.push({
      kind: 'DEBT_MATCHES',
      key,
      dismissValue: maxId,
      debtId: debt.id,
      debtName: debt.name,
      count: possible.length,
    });
  }

  const thisMonth = currentMonthKey();
  let partialMonths = 0;
  for (const row of months) {
    if (partialMonths >= MAX_PARTIAL_MONTHS) break;
    if (!row.maxDate || row.month >= thisMonth) continue;
    if (parseInt(row.maxDate.slice(8, 10), 10) >= FULL_MONTH_MIN_DAY) continue;
    const key = `partial:${row.month}`;
    if (hidden(key, 1)) continue;
    partialMonths++;
    items.push({
      kind: 'PARTIAL_MONTH',
      key,
      dismissValue: 1,
      month: row.month,
      minDate: row.minDate.slice(0, 10),
      maxDate: row.maxDate.slice(0, 10),
    });
  }

  if (options.includeBackup && months.length > 0) {
    const now = Date.now();
    const daysSince = lastBackup ? Math.floor((now - lastBackup.getTime()) / DAY_MS) : null;
    const due = daysSince === null || daysSince >= BACKUP_INTERVAL_DAYS;
    // A dismissal snoozes the reminder for one interval.
    if (due && !hidden('backup', now - BACKUP_INTERVAL_DAYS * DAY_MS)) {
      items.push({ kind: 'BACKUP', key: 'backup', dismissValue: now, daysSince });
    }
  }

  return items;
}

export async function dismissInboxItem(db: SQLiteDatabase, profileId: number, item: InboxItem): Promise<void> {
  if (item.kind === 'DEBT_SUGGESTIONS') {
    for (const suggestion of item.suggestions) {
      await dismissDebtSuggestion(db, profileId, suggestion.key);
    }
    return;
  }
  const dismissed = await getDismissed(db, profileId);
  dismissed[item.key] = item.dismissValue;
  await setAppMeta(db, dismissedKey(profileId), JSON.stringify(dismissed));
}
