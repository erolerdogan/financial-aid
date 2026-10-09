/**
 * Database performance check: runs the real queries of `src/db/database.ts` against an in-memory
 * SQLite database filled with made-up transactions and prints how long each screen's loaders take.
 *
 *   npm run perf            20,000 transactions
 *   npm run perf -- 50000   another size
 *
 * `scripts/perf-native-stub.js` is loaded first (see the npm script): `database.ts` and the services
 * import native Expo modules, and nothing here calls into them.
 *
 * Node's built-in SQLite stands in for expo-sqlite, so the numbers are for a desktop CPU and leave
 * out the native bridge. Read them as a comparison between queries and between runs, and watch the
 * "calls" column: every call is one round trip to the native side on a phone.
 */

import { performance } from 'node:perf_hooks';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as database from '../src/db/database';
import { loadHealth } from '../src/services/healthService';
import { processBatchImport } from '../src/services/importService';
import { getInboxItems } from '../src/services/inboxService';
import { classifyTransaction, parseCSVContent } from '../src/utils/parser';

type Params = SQLInputValue[];

/** The part of expo-sqlite's `SQLiteDatabase` that the app uses, on top of `node:sqlite`. */
class PerfDatabase {
  calls = 0;
  private readonly db = new DatabaseSync(':memory:');

  private args(params: unknown[]): Params {
    return (params.length === 1 && Array.isArray(params[0]) ? params[0] : params) as Params;
  }

  async execAsync(sql: string): Promise<void> {
    this.calls++;
    this.db.exec(sql);
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<{ changes: number; lastInsertRowId: number }> {
    this.calls++;
    const result = this.db.prepare(sql).run(...this.args(params));
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    this.calls++;
    return this.db.prepare(sql).all(...this.args(params)) as T[];
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    this.calls++;
    return (this.db.prepare(sql).get(...this.args(params)) as T | undefined) ?? null;
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await task();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  plan(sql: string, params: Params): string {
    const rows = this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[];
    return rows.map((row) => row.detail).join(' | ');
  }
}

// --- Made-up data ------------------------------------------------------------------------------

/** Small seeded generator, so every run measures the same rows. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

interface Shop {
  name: string;
  text: string;
  min: number;
  max: number;
  /** Day of the month for a bill that comes back every month. */
  day?: number;
  iban?: string;
}

const MONTHLY: Shop[] = [
  { name: 'Northgate Housing', text: 'NORTHGATE HOUSING RENT', min: 1150, max: 1150, day: 1, iban: 'NL11TEST0000000001' },
  { name: 'Brightline Energy', text: 'BRIGHTLINE ENERGY TERMIJN', min: 140, max: 165, day: 5, iban: 'NL11TEST0000000002' },
  { name: 'Clearwave Mobile', text: 'CLEARWAVE MOBILE ABONNEMENT', min: 32, max: 32, day: 12, iban: 'NL11TEST0000000003' },
  { name: 'Harbor Insurance', text: 'HARBOR INSURANCE PREMIE', min: 128, max: 128, day: 20, iban: 'NL11TEST0000000004' },
  { name: 'Lakeside Lending', text: 'LAKESIDE LENDING LOAN REPAYMENT', min: 310, max: 310, day: 3, iban: 'NL11TEST0000000005' },
  { name: 'Streambox', text: 'STREAMBOX SUBSCRIPTION', min: 13.99, max: 13.99, day: 17 },
  { name: 'Fitpoint Gym', text: 'FITPOINT GYM MEMBERSHIP', min: 29.5, max: 29.5, day: 25 },
];

const EVERYDAY: { category: string; words: string[]; min: number; max: number }[] = [
  { category: 'Groceries', words: ['SUPERMARKET', 'GROCERY', 'MARKET'], min: 4, max: 95 },
  { category: 'Dining Out', words: ['RESTAURANT', 'CAFE', 'PIZZERIA', 'BAKERY'], min: 3, max: 70 },
  { category: 'Transportation', words: ['FUEL STATION', 'PARKING', 'TRANSIT'], min: 2, max: 85 },
  { category: 'Shopping & Retail', words: ['STORE', 'OUTLET', 'WEBSHOP'], min: 5, max: 240 },
  { category: 'Health & Care', words: ['PHARMACY', 'DENTIST', 'DRUGSTORE'], min: 4, max: 130 },
  { category: 'Uncategorised', words: ['ZQX', 'VRM', 'KLT'], min: 2, max: 60 },
];

const TOWNS = ['AMSTERDAM', 'UTRECHT', 'LEIDEN', 'ZWOLLE', 'DELFT', 'BREDA', 'ARNHEM', 'HAARLEM'];
const PREFIXES = ['ALBA', 'BRIO', 'CORA', 'DELTA', 'ELMO', 'FARO', 'GALA', 'HANSA', 'IRIS', 'JUNO', 'KILO', 'LUMA'];

interface SeedRow {
  date: string;
  amount: number;
  rawDescription: string;
  merchant: string;
  category: string;
  monthName: string;
  counterpartyIban: string | null;
  txType: string | null;
}

/** `count` rows spread over the months ending at 2026-09, newest month last. */
function buildRows(count: number, classify: (merchant: string, text: string, amount: number) => string): SeedRow[] {
  const random = seededRandom(20261009);
  const months = Math.max(12, Math.round(count / 333));
  const perMonth = Math.ceil(count / months);
  const rows: SeedRow[] = [];
  const pad = (value: number) => String(value).padStart(2, '0');

  for (let m = 0; m < months && rows.length < count; m++) {
    const date = new Date(2026, 8 - (months - 1 - m), 1);
    const monthName = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    const push = (day: number, amount: number, merchant: string, text: string, iban: string | null, txType: string | null) => {
      if (rows.length >= count) return;
      rows.push({
        date: `${monthName}-${pad(day)}`,
        amount,
        rawDescription: text,
        merchant,
        category: classify(merchant, text, amount),
        monthName,
        counterpartyIban: iban,
        txType,
      });
    };

    push(24, 3400, 'Acme Works', 'SALARY ACME WORKS', 'NL11TEST0000000099', null);
    for (const bill of MONTHLY) {
      const amount = bill.min + (bill.max - bill.min) * random();
      push(bill.day ?? 1, -Math.round(amount * 100) / 100, bill.name, bill.text, bill.iban ?? null, bill.iban ? 'DIRECT_DEBIT' : null);
    }

    for (let i = MONTHLY.length + 1; i < perMonth; i++) {
      const kind = EVERYDAY[Math.floor(random() * EVERYDAY.length)];
      const word = kind.words[Math.floor(random() * kind.words.length)];
      const merchant = `${PREFIXES[Math.floor(random() * PREFIXES.length)]} ${word}`;
      const town = TOWNS[Math.floor(random() * TOWNS.length)];
      const amount = Math.round((kind.min + (kind.max - kind.min) * random()) * 100) / 100;
      // The pass number keeps two purchases at one shop on one day apart, like a bank's reference does.
      push(1 + Math.floor(random() * 28), -amount, merchant, `${merchant} ${town} PAS${pad(m)}${i}`, null, 'CARD');
    }
  }
  return rows;
}

// --- Timing ------------------------------------------------------------------------------------

interface Measurement {
  group: string;
  name: string;
  ms: number;
  calls: number;
  rows: number | null;
}

const results: Measurement[] = [];

async function measure<T>(db: PerfDatabase, group: string, name: string, task: () => Promise<T>, repeat = 5): Promise<T> {
  const times: number[] = [];
  let calls = 0;
  let last!: T;
  for (let i = 0; i < repeat; i++) {
    const before = db.calls;
    const start = performance.now();
    last = await task();
    times.push(performance.now() - start);
    calls = db.calls - before;
  }
  times.sort((a, b) => a - b);
  results.push({
    group,
    name,
    ms: times[Math.floor(times.length / 2)],
    calls,
    rows: Array.isArray(last) ? last.length : null,
  });
  return last;
}

function printResults(): void {
  let group = '';
  for (const result of results) {
    if (result.group !== group) {
      group = result.group;
      console.log(`\n${group}`);
    }
    const rows = result.rows === null ? '' : `${result.rows} rows`;
    console.log(
      `  ${result.name.padEnd(58)} ${result.ms.toFixed(1).padStart(8)} ms ${String(result.calls).padStart(6)} calls  ${rows}`
    );
  }
}

async function main(): Promise<void> {
  const count = Number(process.argv[2]) || 20000;
  const profileId = 1;

  const perf = new PerfDatabase();
  const db = perf as unknown as SQLiteDatabase;
  await database.initDatabase(db);

  const rows = buildRows(count, (merchant, rawDescription, amount) =>
    classifyTransaction({ merchant, rawDescription }, [], { iban: null, amount })
  );
  const latestMonth = rows[rows.length - 1].monthName;
  const latestYear = latestMonth.slice(0, 4);
  const earlierYears = [...new Set(rows.map((row) => row.monthName.slice(0, 4)))].filter((year) => year !== latestYear);
  const yearRange = database.makeRangeKey(`${latestYear}-01-01`, `${latestYear}-12-31`);
  const quarter = database.makeRangeKey(`${latestYear}-04-01`, `${latestYear}-06-30`);

  // Import: the CSV text of all rows through the parser, the dedup check and the insert.
  const csv = ['Date,Description,Amount', ...rows.map((row) => `${row.date},"${row.rawDescription}",${row.amount}`)].join('\n');
  const parsed = await measure(perf, 'Import', `parse a CSV of ${count} rows`, async () => parseCSVContent(csv, []), 3);
  const items = parsed.transactions.map((tx) => ({ ...tx, monthName: tx.date.slice(0, 7) }));
  await measure(perf, 'Import', `first import of ${items.length} rows`, () => processBatchImport(db, items, profileId), 1);
  await measure(perf, 'Import', 'same file again (all duplicates)', () => processBatchImport(db, items, profileId), 3);

  await database.createDebt(db, profileId, {
    name: 'Lakeside loan',
    type: 'LOAN',
    originalAmount: 30000,
    apr: 5,
    paymentAmount: 310,
    paymentDay: 3,
    startDate: rows[0].date,
    color: '#007AFF',
    keywords: ['LAKESIDE LENDING'],
  });
  await database.setCategoryGoal(db, 'Groceries', 600, profileId);
  const stored = (await perf.getFirstAsync<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM transactions;`))?.cnt ?? 0;
  console.log(`${stored} transactions stored, ${latestMonth} is the latest month.`);

  await measure(perf, 'Start', 'initDatabase (nothing to migrate)', () => database.initDatabase(db));
  await measure(perf, 'Start', 'reclassify every row (classifier version bump)', () =>
    database.reclassifyAllUnoverriddenTransactions(db, profileId), 3);
  await measure(perf, 'Start', 'syncCategoryColors', () => database.syncCategoryColors(db, profileId));
  await measure(perf, 'Start', 'inbox items', () => getInboxItems(db, profileId, { isDemo: false }));

  const home = (period: string) => async () => {
    await Promise.all([database.getAvailableMonths(db, profileId), database.getTransactionDateBounds(db, profileId)]);
    await Promise.all([
      database.getMonthlySummary(db, period, profileId),
      database.getMonthlyCategoryTotals(db, period, profileId),
      database.getCategoryGoals(db, profileId),
      database.getRecentTransactions(db, period, profileId),
    ]);
  };
  await measure(perf, 'Home', 'load, one month', home(latestMonth));
  await measure(perf, 'Home', 'load, three-month range', home(quarter));
  await measure(perf, 'Home', 'load, whole year range', home(yearRange));
  await measure(perf, 'Home', 'fixed vs. flexible summary, month', () =>
    database.getFixedVsFlexibleSummary(db, latestMonth, profileId));
  await measure(perf, 'Home', 'category drill-down, month', () =>
    database.getTransactionsByMonthAndCategory(db, latestMonth, 'Groceries', profileId));
  await measure(perf, 'Home', 'expense list, whole year', () =>
    database.getTransactionsByMonthAndCategory(db, yearRange, 'All', profileId));

  await measure(perf, 'Transactions', 'filter options', () =>
    Promise.all([
      database.getAvailableMonths(db, profileId),
      database.getTransactionDateBounds(db, profileId),
      database.getTransactionCategories(db, profileId),
      database.getUncategorisedCount(db, profileId),
    ]));
  await measure(perf, 'Transactions', 'first page, all time', () => database.getAllTransactionsByDate(db, profileId, '', 100, 0));
  await measure(perf, 'Transactions', 'page 100 (offset 9900)', () => database.getAllTransactionsByDate(db, profileId, '', 100, 9900));
  await measure(perf, 'Transactions', 'last page', () => database.getAllTransactionsByDate(db, profileId, '', 100, stored - 100));
  await measure(perf, 'Transactions', 'search "pharm"', () => database.getAllTransactionsByDate(db, profileId, 'pharm', 100, 0));
  await measure(perf, 'Transactions', 'search with no match', () => database.getAllTransactionsByDate(db, profileId, 'qqqqqq', 100, 0));
  await measure(perf, 'Transactions', 'one category, all time', () =>
    database.getAllTransactionsByDate(db, profileId, '', 100, 0, undefined, undefined, 'Groceries'));
  const sample = (await database.getAllTransactionsByDate(db, profileId, '', 1, 0))[0];
  await measure(perf, 'Transactions', 'open a transaction (fixed explanation)', () =>
    database.getTransactionFixedExplanation(db, sample, profileId));
  await measure(perf, 'Transactions', 'set a merchant to fixed, then reload the page', async () => {
    await database.setMerchantFixedOverride(db, sample.merchant, sample.category, 'FIXED', profileId);
    await database.getAllTransactionsByDate(db, profileId, '', 100, 0);
    await database.setMerchantFixedOverride(db, sample.merchant, sample.category, 'AUTO', profileId);
  }, 3);
  await measure(perf, 'Transactions', 'fixed vs. flexible after a write (rebuilds resolver)', async () => {
    await database.setAppMeta(db, 'perf_probe', String(Math.random()));
    return database.getFixedVsFlexibleSummary(db, latestMonth, profileId);
  });

  await measure(perf, 'Trends', 'year, all categories', async () => {
    await Promise.all([
      database.getAvailableYears(db, profileId),
      database.getExpenseCategoryNames(db, profileId, yearRange),
    ]);
    await Promise.all([
      database.getAnnualTrendWithBudget(db, latestYear, 'All', profileId),
      database.getYearCoverageStatus(db, latestYear, profileId),
      database.getTransactionDateBounds(db, profileId),
      database.getYearlyExpenseTotals(db, earlierYears, 'All', profileId),
    ]);
  });
  await measure(perf, 'Trends', 'range by month', () =>
    database.getRangeTrendWithBudget(db, `${latestYear}-01-01`, `${latestYear}-06-30`, 'All', profileId));
  await measure(perf, 'Trends', 'range by day', () =>
    database.getDailyTrend(db, `${latestYear}-06-01`, `${latestYear}-06-30`, 'All', profileId));

  await measure(perf, 'Plan', 'Budget Health', () => loadHealth(db, profileId));
  await measure(perf, 'Plan', 'Debts segment', async () => {
    await database.syncDebtPayments(db, profileId);
    await database.getDebtSummaries(db, profileId);
    return database.getDebtSuggestions(db, profileId);
  });

  await measure(perf, 'Other screens', 'Budgets', () => database.getCategoryGoalsWithProgress(db, latestMonth, profileId));
  await measure(perf, 'Other screens', 'Categories', () => database.getCategoriesWithStats(db, profileId));
  await measure(perf, 'Other screens', 'Review uncategorised', () => database.getUncategorisedGroups(db, profileId));
  await measure(perf, 'Other screens', 'Quick add list', () => database.getUncategorisedTransactions(db, profileId));

  printResults();

  console.log('\nQuery plans');
  const plans: [string, string, Params][] = [
    ['month summary', `SELECT TOTAL(amount) FROM transactions WHERE monthName = ? AND profileId = ?;`, [latestMonth, profileId]],
    ['range summary', `SELECT TOTAL(amount) FROM transactions WHERE date >= ? AND date < ? AND profileId = ?;`, [`${latestYear}-04-01`, `${latestYear}-07-01`, profileId]],
    ['list page', `SELECT * FROM transactions WHERE profileId = ? ORDER BY date DESC, id DESC LIMIT 100 OFFSET 0;`, [profileId]],
    ['uncategorised count', `SELECT COUNT(*) FROM transactions WHERE profileId = ? AND category = ?;`, [profileId, 'Uncategorised']],
  ];
  for (const [name, sql, params] of plans) console.log(`  ${name.padEnd(22)} ${perf.plan(sql, params)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
