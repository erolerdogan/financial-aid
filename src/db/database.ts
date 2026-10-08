import {
  DEFAULT_CATEGORY_GROUPS,
  isBenchmarkGroupId,
  type BenchmarkGroupId,
  type BenchmarkRange,
  type Household,
} from '@/constants/benchmarks';
import { CATEGORY_COLORS, setCustomCategoryColors } from '@/constants/colors';
import type { Message } from '@/i18n';
import type { HealthDebt, HealthDebtPayment, HealthTransaction } from '@/utils/budgetHealth';
import { DebtMatchStrength, evaluateDebtKeyword, projectDebtPayoff } from '@/utils/debt';
import { buildDebtSuggestions, type DebtSuggestion } from '@/utils/debtSuggestion';
import {
  buildMerchantProfiles,
  fixedMatchText,
  type FixedCostRow,
  type FixedRule,
  matchRule,
  merchantKey,
  scoreFixed,
} from '@/utils/fixedCost';
import { DEFAULT_DEBT_PLAN, sanitizeDebtPlan, type DebtPlan } from '@/utils/debtSimulator';
import { type FreedomInput, type GoalType } from '@/utils/freedom';
import type { AlertStatus, AlertType, HealthAlert } from '@/utils/healthAlerts';
import {
  buildMerchantIndex,
  type CategorySuggestion,
  type KnownMerchant,
  suggestCategory,
} from '@/utils/categorySuggestion';
import {
  buildLearnedCategories,
  CLASSIFIER_VERSION,
  classifyTransaction,
  type ConfirmedRow,
  extractBankDetails,
  INCOME_CATEGORY,
  type LearnedCategories,
  merchantRuleKeyword,
  UNCATEGORISED,
} from '@/utils/parser';
import { backupDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
export { type SQLiteDatabase };

export interface Profile {
  id: number;
  name: string;
  avatarColor: string;
  isDefault: number;
  currency: string; // e.g., 'EUR', 'USD', 'GBP', 'JPY'
}

export type FixedOverrideState = 'AUTO' | 'FIXED' | 'FLEXIBLE';

export interface Transaction {
  id: number;
  profileId?: number;
  date: string;
  amount: number;
  rawDescription: string;
  merchant: string;
  category: string;
  monthName: string;
  userOverridden?: number;
  isZeroFlagged?: number;
  dateAmbiguous?: number;
  is_fixed?: number | null; // null = AUTO, 1 = FIXED, 0 = FLEXIBLE
  counterpartyIban?: string | null;
  txType?: string | null;
}

export interface CategoryTotal {
  category: string;
  totalAmount: number;
  count: number;
}

export interface CategoryRule {
  id: number;
  profileId: number;
  keyword: string;
  category: string;
}

export interface CategoryGoalWithProgress {
  category: string;
  monthlyLimit: number;
  spent: number;
  percentage: number;
}

export interface FixedCostSummary {
  fixedTotal: number;
  flexibleTotal: number;
  fixedPercentage: number;
  flexiblePercentage: number;
  fixedItemsCount: number;
}

export interface MonthlySummary {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
}

export interface DetectedRecurringItem {
  merchant: string;
  category: string;
  averageAmount: number;
  type: 'INCOME' | 'EXPENSE';
  occurrenceCount: number;
  monthsSeen: string[];
}

export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      avatarColor TEXT NOT NULL,
      isDefault INTEGER DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'EUR'
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profileId INTEGER NOT NULL DEFAULT 1,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      rawDescription TEXT NOT NULL,
      merchant TEXT NOT NULL,
      category TEXT NOT NULL,
      monthName TEXT NOT NULL,
      userOverridden INTEGER DEFAULT 0,
      isZeroFlagged INTEGER DEFAULT 0,
      dateAmbiguous INTEGER DEFAULT 0,
      is_fixed INTEGER,
      counterpartyIban TEXT,
      txType TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_dedup 
    ON transactions(date, amount, rawDescription, profileId);
    CREATE INDEX IF NOT EXISTS idx_transactions_profile_date
    ON transactions(profileId, date DESC);
    CREATE TABLE IF NOT EXISTS category_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profileId INTEGER NOT NULL DEFAULT 1,
      keyword TEXT NOT NULL,
      category TEXT NOT NULL,
      UNIQUE(keyword, profileId)
    );

    CREATE TABLE IF NOT EXISTS category_goals (
      category TEXT NOT NULL,
      profileId INTEGER NOT NULL DEFAULT 1,
      monthly_limit REAL NOT NULL,
      PRIMARY KEY (category, profileId)
    );

    CREATE TABLE IF NOT EXISTS fixed_cost_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profileId INTEGER NOT NULL DEFAULT 1,
      keyword TEXT NOT NULL,
      category TEXT NOT NULL,
      overrideState TEXT NOT NULL,
      UNIQUE(keyword, profileId)
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profileId INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      isBuiltIn INTEGER NOT NULL DEFAULT 0,
      UNIQUE(name, profileId)
    );
    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profileId INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'LOAN',
      originalAmount REAL NOT NULL,
      apr REAL NOT NULL DEFAULT 0,
      paymentAmount REAL NOT NULL DEFAULT 0,
      paymentDay INTEGER NOT NULL DEFAULT 1,
      startDate TEXT,
      color TEXT NOT NULL DEFAULT '#007AFF',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      termMonths INTEGER
    );

    CREATE TABLE IF NOT EXISTS debt_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debtId INTEGER NOT NULL,
      profileId INTEGER NOT NULL DEFAULT 1,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      principal REAL NOT NULL DEFAULT 0,
      interest REAL NOT NULL DEFAULT 0,
      transactionId INTEGER,
      source TEXT NOT NULL DEFAULT 'MANUAL',
      ignored INTEGER NOT NULL DEFAULT 0,
      keyword TEXT
    );

    CREATE TABLE IF NOT EXISTS debt_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debtId INTEGER NOT NULL,
      profileId INTEGER NOT NULL DEFAULT 1,
      keyword TEXT NOT NULL,
      UNIQUE(debtId, keyword)
    );

    CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debtId, date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_debt_payments_tx
      ON debt_payments(transactionId) WHERE transactionId IS NOT NULL;

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS freedom_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL UNIQUE,
      years INTEGER NOT NULL,
      lump_sum REAL NOT NULL,
      monthly REAL NOT NULL,
      annual_increase REAL NOT NULL,
      return_pct REAL NOT NULL,
      fee_pct REAL NOT NULL,
      inflation_pct REAL NOT NULL DEFAULT 0.025,
      goal_type TEXT NOT NULL DEFAULT 'BALANCE',
      goal_balance REAL NOT NULL DEFAULT 0,
      goal_income REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS debt_plan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL UNIQUE,
      extra_monthly REAL NOT NULL DEFAULT 0,
      strategy TEXT NOT NULL DEFAULT 'AVALANCHE',
      lump_sums TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS household_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL UNIQUE,
      adults INTEGER NOT NULL DEFAULT 2,
      children INTEGER NOT NULL DEFAULT 0,
      housing_type TEXT NOT NULL DEFAULT 'rent',
      net_income_override REAL,
      safety_savings REAL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS category_range_overrides (
      profile_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      min_pct REAL NOT NULL,
      max_pct REAL NOT NULL,
      PRIMARY KEY (profile_id, category)
    );

    CREATE TABLE IF NOT EXISTS health_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      type TEXT NOT NULL,
      key TEXT NOT NULL,
      message TEXT NOT NULL,
      severity INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL,
      UNIQUE(profile_id, month, type, key)
    );

    CREATE TABLE IF NOT EXISTS alert_settings (
      profile_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (profile_id, type)
    );
  `);

  try {
    await db.runAsync(`ALTER TABLE categories ADD COLUMN benchmark_group TEXT;`);
  } catch (e) {}

  try {
    await db.runAsync(`ALTER TABLE freedom_plans ADD COLUMN goal_type TEXT NOT NULL DEFAULT 'BALANCE';`);
  } catch (e) {}

  try {
    await db.runAsync(`ALTER TABLE freedom_plans ADD COLUMN goal_balance REAL NOT NULL DEFAULT 0;`);
  } catch (e) {}

  try {
    await db.runAsync(`ALTER TABLE freedom_plans ADD COLUMN goal_income REAL NOT NULL DEFAULT 0;`);
  } catch (e) {}

  try {
    await db.runAsync(`ALTER TABLE profiles ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR';`);
  } catch (e) {}

  try {
    await db.runAsync(`ALTER TABLE transactions ADD COLUMN profileId INTEGER NOT NULL DEFAULT 1;`);
  } catch (e) {}

  try {
    await db.runAsync(`ALTER TABLE transactions ADD COLUMN is_fixed INTEGER;`);
  } catch (e) {}

  try {
    await db.runAsync(`ALTER TABLE category_rules ADD COLUMN profileId INTEGER NOT NULL DEFAULT 1;`);
  } catch (e) {}

  try {
    await db.runAsync(`ALTER TABLE category_goals ADD COLUMN profileId INTEGER NOT NULL DEFAULT 1;`);
  } catch (e) {}

  try {
    await db.runAsync(`ALTER TABLE fixed_cost_rules ADD COLUMN profileId INTEGER NOT NULL DEFAULT 1;`);
  } catch (e) {}

  try {
    await db.runAsync(`ALTER TABLE fixed_cost_rules ADD COLUMN overrideState TEXT NOT NULL DEFAULT 'FIXED';`);
  } catch (e) {}

  try {
    await db.runAsync(`ALTER TABLE debt_payments ADD COLUMN keyword TEXT;`);
  } catch (e) {}

  try {
    await db.runAsync(`ALTER TABLE debts ADD COLUMN termMonths INTEGER;`);
  } catch (e) {}

  try {
    await db.runAsync(`ALTER TABLE transactions ADD COLUMN counterpartyIban TEXT;`);
  } catch (e) {}

  try {
    await db.runAsync(`ALTER TABLE transactions ADD COLUMN txType TEXT;`);
  } catch (e) {}

  const existingProfiles = await db.getAllAsync<{ id: number }>(`SELECT id FROM profiles;`);
  if (existingProfiles.length === 0) {
    await db.runAsync(
      `INSERT INTO profiles (name, avatarColor, isDefault, currency) VALUES ('Personal', '#007AFF', 1, 'EUR');`
    );
  }

  // Built-in classifier keywords changed: bring stored rows in line once.
  const version = await db.getFirstAsync<{ user_version: number }>(`PRAGMA user_version;`);
  if ((version?.user_version ?? 0) < CLASSIFIER_VERSION) {
    await backfillBankDetails(db);
    for (const profile of existingProfiles) {
      await reclassifyAllUnoverriddenTransactions(db, profile.id);
    }
    await db.execAsync(`PRAGMA user_version = ${CLASSIFIER_VERSION};`);
  }
}

export async function getAppMeta(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM app_meta WHERE key = ?;`, [key]);
  return row?.value ?? null;
}

export async function setAppMeta(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);`, [key, value]);
}

/**
 * Replaces every table on the live connection with the contents of `source` (SQLite online backup),
 * then migrates the result. `total_changes()` does not move for a backup, so the resolver cache is dropped by hand.
 */
export async function replaceDatabaseContents(db: SQLiteDatabase, source: SQLiteDatabase): Promise<void> {
  await backupDatabaseAsync({ sourceDatabase: source, destDatabase: db });
  fixedResolverCache.clear();
  await initDatabase(db);
}

// Rows imported before these columns existed: derive them from the stored bank text.
async function backfillBankDetails(db: SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ id: number; rawDescription: string }>(
    `SELECT id, rawDescription FROM transactions WHERE counterpartyIban IS NULL AND txType IS NULL;`
  );

  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const bank = extractBankDetails(row.rawDescription);
      if (!bank.counterpartyIban && !bank.txType) continue;
      await db.runAsync(`UPDATE transactions SET counterpartyIban = ?, txType = ? WHERE id = ?;`, [
        bank.counterpartyIban,
        bank.txType,
        row.id,
      ]);
    }
  });
}

export async function getProfiles(db: SQLiteDatabase): Promise<Profile[]> {
  if (!db) return [];
  return await db.getAllAsync<Profile>(`SELECT * FROM profiles ORDER BY id ASC;`);
}

export async function createProfile(db: SQLiteDatabase, name: string, avatarColor: string): Promise<Profile | null> {
  try {
    const result = await db.runAsync(
      `INSERT INTO profiles (name, avatarColor, isDefault, currency) VALUES (?, ?, 0, 'EUR');`,
      [name, avatarColor]
    );
    const newId = result.lastInsertRowId;
    return { id: newId, name, avatarColor, isDefault: 0, currency: 'EUR' };
  } catch (error) {
    console.error('Failed to create profile:', error);
    return null;
  }
}

export async function updateProfileCurrency(
  db: SQLiteDatabase,
  id: number,
  currency: string
): Promise<void> {
  await db.runAsync(`UPDATE profiles SET currency = ? WHERE id = ?;`, [currency, id]);
}

export async function deleteProfile(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  if (!db) return;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      avatarColor TEXT NOT NULL,
      isDefault INTEGER DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'EUR'
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profileId INTEGER NOT NULL DEFAULT 1,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      rawDescription TEXT NOT NULL,
      merchant TEXT NOT NULL,
      category TEXT NOT NULL,
      monthName TEXT NOT NULL,
      userOverridden INTEGER DEFAULT 0,
      isZeroFlagged INTEGER DEFAULT 0,
      dateAmbiguous INTEGER DEFAULT 0,
      is_fixed INTEGER,
      counterpartyIban TEXT,
      txType TEXT
    );

    CREATE TABLE IF NOT EXISTS category_goals (
      category TEXT NOT NULL,
      profileId INTEGER NOT NULL DEFAULT 1,
      monthly_limit REAL NOT NULL,
      PRIMARY KEY (category, profileId)
    );

    CREATE TABLE IF NOT EXISTS category_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profileId INTEGER NOT NULL DEFAULT 1,
      keyword TEXT NOT NULL,
      category TEXT NOT NULL,
      UNIQUE(keyword, profileId)
    );

    CREATE TABLE IF NOT EXISTS fixed_cost_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profileId INTEGER NOT NULL DEFAULT 1,
      keyword TEXT NOT NULL,
      category TEXT NOT NULL,
      overrideState TEXT NOT NULL DEFAULT 'FIXED',
      UNIQUE(keyword, profileId)
    );
  `);

  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM transactions WHERE profileId = ?;`, [id]);
    await db.runAsync(`DELETE FROM category_goals WHERE profileId = ?;`, [id]);
    await db.runAsync(`DELETE FROM category_rules WHERE profileId = ?;`, [id]);
    await db.runAsync(`DELETE FROM fixed_cost_rules WHERE profileId = ?;`, [id]);
    await db.runAsync(`DELETE FROM debt_plan WHERE profile_id = ?;`, [id]);
    await clearHealthTables(db, id);
    await db.runAsync(`DELETE FROM profiles WHERE id = ?;`, [id]);
  });
}
const RANGE_KEY_PATTERN = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

export function makeRangeKey(from: string, to: string): string {
  return `${from}..${to}`;
}

export function parseRangeKey(period: string): { from: string; to: string } | null {
  const match = period.match(RANGE_KEY_PATTERN);
  return match ? { from: match[1], to: match[2] } : null;
}

function periodClause(period: string): { sql: string; params: string[] } {
  const range = parseRangeKey(period);
  if (range) {
    return { sql: `substr(date, 1, 10) BETWEEN ? AND ?`, params: [range.from, range.to] };
  }
  return { sql: `monthName = ?`, params: [period] };
}

export type FixedSource = 'MANUAL' | 'RULE' | 'DEBT' | 'AUTO';

export interface FixedResolution {
  isFixed: boolean;
  source: FixedSource;
  reason: Message[];
}

export interface FixedExplanation {
  state: FixedOverrideState;
  autoIsFixed: boolean;
  reason: Message[];
}

type FixedResolvable = Pick<Transaction, 'amount' | 'merchant' | 'rawDescription' | 'category'> & {
  id?: number;
  txType?: string | null;
  is_fixed?: number | null;
};

interface FixedResolver {
  rules: FixedRule[];
  /** Detection result ignoring manual overrides and rules. */
  auto: (tx: FixedResolvable) => { isFixed: boolean; reason: Message[]; debtLinked?: boolean };
  resolve: (tx: FixedResolvable) => FixedResolution;
}

const fixedResolverCache = new Map<number, { changes: number; resolver: Promise<FixedResolver> }>();

async function loadFixedResolver(db: SQLiteDatabase, profileId: number): Promise<FixedResolver> {
  const rules = await db.getAllAsync<FixedRule>(
    `SELECT keyword, overrideState FROM fixed_cost_rules WHERE profileId = ?;`,
    [profileId]
  );

  const rows = await db.getAllAsync<FixedCostRow>(
    `SELECT date, amount, merchant, rawDescription, category, txType FROM transactions WHERE profileId = ?;`,
    [profileId]
  );
  const profiles = buildMerchantProfiles(rows);

  const debtLinked = new Set<number>();
  try {
    const linked = await db.getAllAsync<{ transactionId: number }>(
      `SELECT transactionId FROM debt_payments
       WHERE profileId = ? AND transactionId IS NOT NULL AND ignored = 0;`,
      [profileId]
    );
    linked.forEach((row) => debtLinked.add(row.transactionId));
  } catch {}

  const auto: FixedResolver['auto'] = (tx) => {
    if (tx.id !== undefined && tx.amount < 0 && debtLinked.has(tx.id)) {
      return { isFixed: true, reason: [{ key: 'fixed.reason.debt' }], debtLinked: true };
    }
    const text = `${tx.merchant ?? ''} ${tx.rawDescription ?? ''}`;
    return scoreFixed(profiles.get(merchantKey(tx)), tx.category, text, tx.amount > 0, tx.txType === 'DIRECT_DEBIT');
  };

  const resolve = (tx: FixedResolvable): FixedResolution => {
    if (tx.is_fixed === 1 || tx.is_fixed === 0) {
      return { isFixed: tx.is_fixed === 1, source: 'MANUAL', reason: [{ key: 'fixed.reason.manual' }] };
    }
    const rule = matchRule(fixedMatchText(tx), rules);
    if (rule) {
      return {
        isFixed: rule.overrideState === 'FIXED',
        source: 'RULE',
        reason: [{ key: 'fixed.reason.rule', params: { keyword: rule.keyword } }],
      };
    }
    const detected = auto(tx);
    return {
      isFixed: detected.isFixed,
      reason: detected.reason,
      source: detected.debtLinked ? 'DEBT' : 'AUTO',
    };
  };

  return { rules, auto, resolve };
}

/**
 * One resolver per profile, reused until anything is written on this connection.
 * `total_changes()` moves on every INSERT / UPDATE / DELETE, so no write path has to invalidate by hand.
 */
async function getFixedResolver(db: SQLiteDatabase, profileId: number): Promise<FixedResolver> {
  const row = await db.getFirstAsync<{ changes: number }>(`SELECT total_changes() AS changes;`);
  const changes = row?.changes ?? -1;

  const cached = fixedResolverCache.get(profileId);
  if (cached && cached.changes === changes && changes !== -1) return cached.resolver;

  const resolver = loadFixedResolver(db, profileId);
  fixedResolverCache.set(profileId, { changes, resolver });
  resolver.catch(() => fixedResolverCache.delete(profileId));
  return resolver;
}

/** Fills `is_fixed` with the resolved value so list badges match the summary cards. */
function withResolvedFixed(transactions: Transaction[], resolver: FixedResolver): Transaction[] {
  return transactions.map((tx) => ({ ...tx, is_fixed: resolver.resolve(tx).isFixed ? 1 : 0 }));
}

function summarizeFixed(transactions: Transaction[], resolver: FixedResolver): FixedCostSummary {
  let fixedTotal = 0;
  let flexibleTotal = 0;
  let fixedCount = 0;

  for (const tx of transactions) {
    const absAmount = Math.abs(tx.amount);
    if (resolver.resolve(tx).isFixed) {
      fixedTotal += absAmount;
      fixedCount++;
    } else {
      flexibleTotal += absAmount;
    }
  }

  const grandTotal = fixedTotal + flexibleTotal;

  return {
    fixedTotal,
    flexibleTotal,
    fixedPercentage: grandTotal > 0 ? (fixedTotal / grandTotal) * 100 : 0,
    flexiblePercentage: grandTotal > 0 ? (flexibleTotal / grandTotal) * 100 : 0,
    fixedItemsCount: fixedCount,
  };
}

export async function getFixedVsFlexibleSummary(
  db: SQLiteDatabase,
  monthName: string,
  profileId: number
): Promise<FixedCostSummary> {
  const period = periodClause(monthName);
  const transactions = await db.getAllAsync<Transaction>(
    `SELECT * FROM transactions WHERE ${period.sql} AND profileId = ? AND amount < 0;`,
    [...period.params, profileId]
  );

  return summarizeFixed(transactions, await getFixedResolver(db, profileId));
}

export async function getCategoryFixedVsFlexibleSummary(
  db: SQLiteDatabase,
  monthName: string,
  category: string,
  profileId: number = 1
): Promise<FixedCostSummary> {
  const period = periodClause(monthName);
  const isAll = category === 'All' || category === 'ALL';
  const categoryFilter = isAll ? '' : 'AND category = ?';

  const queryParams: (string | number)[] = [profileId, ...period.params];
  if (!isAll) queryParams.push(category);

  const transactions = await db.getAllAsync<Transaction>(
    `SELECT * FROM transactions
     WHERE profileId = ? AND ${period.sql} ${categoryFilter} AND amount < 0;`,
    queryParams
  );

  return summarizeFixed(transactions, await getFixedResolver(db, profileId));
}

export async function getFixedOrFlexibleTransactions(
  db: SQLiteDatabase,
  monthName: string,
  isFixedTarget: boolean,
  profileId: number
): Promise<Transaction[]> {
  const period = periodClause(monthName);
  const allExpenses = await db.getAllAsync<Transaction>(
    `SELECT * FROM transactions
     WHERE ${period.sql}
       AND amount < 0
       AND profileId = ?
     ORDER BY ABS(amount) DESC;`,
    [...period.params, profileId]
  );

  const resolved = withResolvedFixed(allExpenses, await getFixedResolver(db, profileId));
  return resolved.filter((tx) => (tx.is_fixed === 1) === isFixedTarget);
}

export async function getCategoryGoalsWithProgress(
  db: SQLiteDatabase,
  monthStr: string,
  profileId: number = 1
): Promise<CategoryGoalWithProgress[]> {
  await ensureCategoriesSeeded(db, profileId);

  const query = `
    SELECT 
      c.category,
      COALESCE(g.monthly_limit, 0) as monthlyLimit,
      COALESCE(SUM(ABS(t.amount)), 0) as spent
    FROM (
      SELECT c.name AS category FROM categories c
      WHERE c.profileId = ? AND ${EXPENSE_CATEGORY_SQL}
    ) c
    LEFT JOIN category_goals g ON c.category = g.category AND g.profileId = ?
    LEFT JOIN transactions t ON c.category = t.category 
      AND t.monthName = ? 
      AND t.profileId = ?
      AND t.amount < 0
    GROUP BY c.category
    ORDER BY spent DESC, c.category ASC;
  `;
  const rows = await db.getAllAsync<{ category: string; monthlyLimit: number; spent: number }>(
    query,
    [profileId, profileId, monthStr, profileId]
  );

  return rows.map((r) => {
    const limit = r.monthlyLimit || 0;
    const spent = r.spent || 0;
    const percentage = limit > 0 ? (spent / limit) * 100 : 0;
    return {
      category: r.category,
      monthlyLimit: limit,
      spent: spent,
      percentage: Math.round(percentage),
    };
  });
}

/** Categories that have a budget, oldest first: the free limit keeps the oldest ones editable. */
export async function getBudgetOrder(db: SQLiteDatabase, profileId: number): Promise<string[]> {
  const rows = await db.getAllAsync<{ category: string }>(
    `SELECT category FROM category_goals WHERE profileId = ? AND monthly_limit > 0 ORDER BY rowid ASC;`,
    [profileId]
  );
  return rows.map((row) => row.category);
}

export async function setCategoryGoal(
  db: SQLiteDatabase,
  category: string,
  monthlyLimit: number,
  profileId: number = 1
): Promise<void> {
  await db.runAsync(
    `INSERT INTO category_goals (category, profileId, monthly_limit)
     VALUES (?, ?, ?)
     ON CONFLICT(category, profileId) DO UPDATE SET monthly_limit = excluded.monthly_limit;`,
    [category, profileId, monthlyLimit]
  );
}

export async function insertTransactions(
  db: SQLiteDatabase,
  transactions: Omit<Transaction, 'id'>[],
  profileId: number = 1
): Promise<{ insertedCount: number; skippedCount: number }> {
  let insertedCount = 0;
  let skippedCount = 0;

  await db.withTransactionAsync(async () => {
    for (const tx of transactions) {
      const result = await db.runAsync(
        `INSERT OR IGNORE INTO transactions
           (profileId, date, amount, rawDescription, merchant, category, monthName, isZeroFlagged, dateAmbiguous, is_fixed,
            counterpartyIban, txType)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?);`,
        [
          tx.profileId ?? profileId,
          tx.date,
          Number(tx.amount),
          tx.rawDescription,
          tx.merchant,
          tx.category,
          tx.monthName,
          tx.isZeroFlagged ?? 0,
          tx.dateAmbiguous ?? 0,
          tx.counterpartyIban ?? null,
          tx.txType ?? null,
        ]
      );

      if (result.changes > 0) {
        insertedCount++;
      } else {
        skippedCount++;
      }
    }
  });

  return { insertedCount, skippedCount };
}

export async function updateTransactionCategory(
  db: SQLiteDatabase,
  id: number,
  category: string
): Promise<void> {
  await db.runAsync(
    `UPDATE transactions SET category = ?, userOverridden = 1 WHERE id = ?;`,
    [category, id]
  );
}

export async function getAvailableMonths(
  db: SQLiteDatabase,
  profileId: number = 1
): Promise<string[]> {
  const rows = await db.getAllAsync<{ monthName: string }>(
    `SELECT DISTINCT monthName FROM transactions WHERE profileId = ? ORDER BY monthName DESC;`,
    [profileId]
  );
  return rows.map((r) => r.monthName);
}
export async function getMonthlySummary(
  db: SQLiteDatabase,
  monthName: string,
  profileId: number = 1
): Promise<MonthlySummary> {
  const period = periodClause(monthName);
  const result = await db.getFirstAsync<{ totalIncome: number; totalExpenses: number }>(
    `SELECT 
       TOTAL(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS totalIncome,
       TOTAL(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS totalExpenses
     FROM transactions
     WHERE ${period.sql} AND profileId = ?;`,
    [...period.params, profileId]
  );

  const totalIncome = result?.totalIncome ?? 0;
  const totalExpenses = result?.totalExpenses ?? 0;

  return {
    totalIncome,
    totalExpenses,
    netSavings: totalIncome - totalExpenses,
  };
}

export async function getMonthlyCategoryTotals(
  db: SQLiteDatabase,
  monthName: string,
  profileId: number = 1
): Promise<CategoryTotal[]> {
  if (!db) return [];

  try {
    const period = periodClause(monthName);
    const query = `
      SELECT category, TOTAL(ABS(amount)) as totalAmount, COUNT(*) as count
      FROM transactions
      WHERE ${period.sql} AND profileId = ? AND amount < 0
      GROUP BY category
      ORDER BY totalAmount DESC;
    `;
    return await db.getAllAsync<CategoryTotal>(query, [...period.params, profileId]);
  } catch (error) {
    console.error('Error in getMonthlyCategoryTotals:', error);
    return [];
  }
}

export async function getFilteredTransactions(
  db: SQLiteDatabase,
  monthName: string,
  typeFilter: 'EXPENSE' | 'INCOME' | 'ALL' = 'ALL',
  profileId: number = 1
): Promise<Transaction[]> {
  const period = periodClause(monthName);
  let query = `SELECT * FROM transactions WHERE ${period.sql} AND profileId = ?`;
  const params: (string | number)[] = [...period.params, profileId];

  if (typeFilter === 'EXPENSE') {
    query += ` AND amount < 0`;
  } else if (typeFilter === 'INCOME') {
    query += ` AND amount > 0`;
  }

  query += ` ORDER BY date DESC, id DESC;`;
  const transactions = await db.getAllAsync<Transaction>(query, params);

  return withResolvedFixed(transactions, await getFixedResolver(db, profileId));
}

export async function getTransactionsByMonthAndCategory(
  db: SQLiteDatabase,
  monthName: string,
  category: string,
  profileId: number
): Promise<Transaction[]> {
  const period = periodClause(monthName);
  const isAll = category === 'All';
  const categoryFilter = isAll ? '' : 'AND category = ?';

  const query = `
    SELECT * FROM transactions
    WHERE profileId = ? AND ${period.sql} ${categoryFilter} AND amount < 0
    ORDER BY ABS(amount) DESC;
  `;

  const queryParams: (string | number)[] = [profileId, ...period.params];
  if (!isAll) queryParams.push(category);

  const rows = await db.getAllAsync<Transaction>(query, queryParams);

  return withResolvedFixed(rows, await getFixedResolver(db, profileId));
}

/** The newest rows of a period, for the Recent activity card on Home. */
export async function getRecentTransactions(
  db: SQLiteDatabase,
  monthName: string,
  profileId: number,
  limit: number = 5
): Promise<Transaction[]> {
  const period = periodClause(monthName);
  return await db.getAllAsync<Transaction>(
    `SELECT * FROM transactions WHERE profileId = ? AND ${period.sql} ORDER BY date DESC, id DESC LIMIT ?;`,
    [profileId, ...period.params, limit]
  );
}

export async function getAllTransactionsByDate(
  db: SQLiteDatabase,
  profileId: number = 1,
  searchQuery: string = '',
  limit: number = 100,
  offset: number = 0,
  dateFrom?: string,
  dateTo?: string,
  category?: string
): Promise<Transaction[]> {
  const params: (string | number)[] = [profileId];
  let sql = `SELECT * FROM transactions WHERE profileId = ?`;

  if (dateFrom && dateTo) {
    sql += ` AND date >= ? AND date < ?`;
    params.push(dateFrom, dateTo);
  }

  if (category && category !== 'All') {
    sql += ` AND category = ?`;
    params.push(category);
  }

  const term = searchQuery.trim();
  if (term.length > 0) {
    sql += ` AND (rawDescription LIKE ? OR merchant LIKE ? OR category LIKE ?)`;
    const pattern = `%${term}%`;
    params.push(pattern, pattern, pattern);
  }

  sql += ` ORDER BY date DESC, id DESC LIMIT ? OFFSET ?;`;
  params.push(limit, offset);

  return await db.getAllAsync<Transaction>(sql, params);
}

export async function getTransactionCategories(
  db: SQLiteDatabase,
  profileId: number = 1,
  dateFrom?: string,
  dateTo?: string
): Promise<string[]> {
  const params: (string | number)[] = [profileId];
  let sql = `SELECT category FROM transactions WHERE profileId = ?`;

  if (dateFrom && dateTo) {
    sql += ` AND date >= ? AND date < ?`;
    params.push(dateFrom, dateTo);
  }

  sql += ` GROUP BY category ORDER BY SUM(ABS(amount)) DESC;`;

  const rows = await db.getAllAsync<{ category: string }>(sql, params);
  return rows.map((r) => r.category).filter(Boolean);
}

export async function getTransactionDateBounds(
  db: SQLiteDatabase,
  profileId: number = 1
): Promise<{ minDate: string; maxDate: string } | null> {
  const row = await db.getFirstAsync<{ minDate: string | null; maxDate: string | null }>(
    `SELECT MIN(date) AS minDate, MAX(date) AS maxDate FROM transactions WHERE profileId = ?;`,
    [profileId]
  );
  if (!row?.minDate || !row?.maxDate) return null;
  return { minDate: row.minDate.slice(0, 10), maxDate: row.maxDate.slice(0, 10) };
}

export async function getCustomRules(
  db: SQLiteDatabase,
  profileId: number = 1
): Promise<CategoryRule[]> {
  return await db.getAllAsync<CategoryRule>(
    `SELECT * FROM category_rules WHERE profileId = ? ORDER BY keyword ASC;`,
    [profileId]
  );
}

export async function addCustomRule(
  db: SQLiteDatabase,
  keyword: string,
  category: string,
  profileId: number = 1
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO category_rules (profileId, keyword, category) VALUES (?, ?, ?);`,
    [profileId, keyword.toUpperCase(), category]
  );
}

export async function deleteCustomRule(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(`DELETE FROM category_rules WHERE id = ?;`, [id]);
}

export async function clearAllData(
  db: SQLiteDatabase,
  profileId?: number
): Promise<void> {
  if (!db) return;

  if (profileId !== undefined) {
    await db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM transactions WHERE profileId = ?;`, [profileId]);
      await db.runAsync(`DELETE FROM category_goals WHERE profileId = ?;`, [profileId]);
      await db.runAsync(`DELETE FROM category_rules WHERE profileId = ?;`, [profileId]);
      await db.runAsync(`DELETE FROM fixed_cost_rules WHERE profileId = ?;`, [profileId]);
      await db.runAsync(`DELETE FROM categories WHERE profileId = ?;`, [profileId]);
      await db.runAsync(`DELETE FROM debt_payments WHERE profileId = ?;`, [profileId]);
      await db.runAsync(`DELETE FROM debt_rules WHERE profileId = ?;`, [profileId]);
      await db.runAsync(`DELETE FROM debts WHERE profileId = ?;`, [profileId]);
      await db.runAsync(`DELETE FROM freedom_plans WHERE profile_id = ?;`, [profileId]);
      await db.runAsync(`DELETE FROM debt_plan WHERE profile_id = ?;`, [profileId]);
      await clearHealthTables(db, profileId);
    });
  } else {
    await db.execAsync(`
      DROP TABLE IF EXISTS transactions;
      DROP TABLE IF EXISTS category_goals;
      DROP TABLE IF EXISTS category_rules;
      DROP TABLE IF EXISTS fixed_cost_rules;
      DROP TABLE IF EXISTS categories;
      DROP TABLE IF EXISTS debt_payments;
      DROP TABLE IF EXISTS debt_rules;
      DROP TABLE IF EXISTS debts;
      DROP TABLE IF EXISTS freedom_plans;
      DROP TABLE IF EXISTS debt_plan;
      DROP TABLE IF EXISTS household_profile;
      DROP TABLE IF EXISTS category_range_overrides;
      DROP TABLE IF EXISTS health_alerts;
      DROP TABLE IF EXISTS alert_settings;
      DROP TABLE IF EXISTS profiles;
    `);
    await initDatabase(db);
  }
}

export async function detectRecurringPatterns(
  db: SQLiteDatabase,
  minMonthsThreshold: number = 2,
  profileId: number = 1
): Promise<DetectedRecurringItem[]> {
  if (!db) return [];

  try {
    const rows = await db.getAllAsync<{
      merchantKey: string;
      category: string;
      monthName: string;
      avgAmount: number;
    }>(
      `
      SELECT 
        UPPER(TRIM(COALESCE(NULLIF(merchant, 'Unknown'), rawDescription))) AS merchantKey,
        category,
        monthName,
        AVG(amount) AS avgAmount
      FROM transactions
      WHERE profileId = ?
      GROUP BY merchantKey, monthName
      ORDER BY merchantKey, monthName DESC;
    `,
      [profileId]
    );

    const merchantMap: Record<
      string,
      {
        category: string;
        amounts: number[];
        monthsSeen: string[];
      }
    > = {};

    for (const row of rows) {
      if (!row.merchantKey || row.merchantKey.trim().length === 0) continue;

      if (!merchantMap[row.merchantKey]) {
        merchantMap[row.merchantKey] = {
          category: row.category,
          amounts: [],
          monthsSeen: [],
        };
      }

      merchantMap[row.merchantKey].amounts.push(row.avgAmount);
      merchantMap[row.merchantKey].monthsSeen.push(row.monthName);
    }

    const detectedList: DetectedRecurringItem[] = [];

    for (const [merchant, data] of Object.entries(merchantMap)) {
      if (data.monthsSeen.length >= minMonthsThreshold) {
        const sum = data.amounts.reduce((a, b) => a + b, 0);
        const averageAmount = sum / data.amounts.length;

        detectedList.push({
          merchant,
          category: data.category,
          averageAmount,
          type: averageAmount > 0 ? 'INCOME' : 'EXPENSE',
          occurrenceCount: data.monthsSeen.length,
          monthsSeen: data.monthsSeen,
        });
      }
    }

    return detectedList.sort((a, b) => Math.abs(b.averageAmount) - Math.abs(a.averageAmount));
  } catch (error) {
    console.error('Failed to detect recurring patterns:', error);
    return [];
  }
}

export async function getTransactionFixedExplanation(
  db: SQLiteDatabase,
  transaction: Transaction,
  profileId: number = 1
): Promise<FixedExplanation> {
  if (!db || !transaction) return { state: 'AUTO', autoIsFixed: false, reason: [] };

  const resolver = await getFixedResolver(db, profileId);
  const detected = resolver.auto(transaction);

  // List queries overwrite `is_fixed` with the resolved value for their badges,
  // so the stored value is the only reliable sign of a manual override.
  const stored = await db.getFirstAsync<{ is_fixed: number | null }>(
    `SELECT is_fixed FROM transactions WHERE id = ?;`,
    [transaction.id]
  );
  const storedIsFixed = stored ? stored.is_fixed : transaction.is_fixed;

  let state: FixedOverrideState = 'AUTO';
  if (storedIsFixed === 1) state = 'FIXED';
  else if (storedIsFixed === 0) state = 'FLEXIBLE';
  else {
    const rule = matchRule(fixedMatchText(transaction), resolver.rules);
    if (rule) state = rule.overrideState === 'FIXED' ? 'FIXED' : 'FLEXIBLE';
  }

  return { state, autoIsFixed: detected.isFixed, reason: detected.reason };
}

export async function setMerchantFixedOverride(
  db: SQLiteDatabase,
  merchantOrDesc: string,
  category: string,
  overrideState: FixedOverrideState,
  profileId: number = 1
): Promise<void> {
  if (!db || !merchantOrDesc) return;

  const uppercaseKeyword = merchantOrDesc.toUpperCase().trim();
  const searchPattern = `%${uppercaseKeyword}%`;

  if (overrideState === 'AUTO') {
    await db.runAsync(
      `DELETE FROM fixed_cost_rules WHERE UPPER(keyword) = ? AND profileId = ?;`,
      [uppercaseKeyword, profileId]
    );

    await db.runAsync(
      `UPDATE transactions 
       SET is_fixed = NULL 
       WHERE (UPPER(merchant) LIKE ? OR UPPER(rawDescription) LIKE ?) AND profileId = ?;`,
      [searchPattern, searchPattern, profileId]
    );
  } else {
    const isFixedVal = overrideState === 'FIXED' ? 1 : 0;

    await db.runAsync(
      `INSERT INTO fixed_cost_rules (keyword, category, overrideState, profileId) 
       VALUES (?, ?, ?, ?)
       ON CONFLICT(keyword, profileId) DO UPDATE SET 
         overrideState = excluded.overrideState,
         category = excluded.category;`,
      [uppercaseKeyword, category, overrideState, profileId]
    );

    await db.runAsync(
      `UPDATE transactions 
       SET is_fixed = ? 
       WHERE (UPPER(merchant) LIKE ? OR UPPER(rawDescription) LIKE ?) AND profileId = ?;`,
      [isFixedVal, searchPattern, searchPattern, profileId]
    );
  }
}

export interface RecurringCandidate {
  merchant: string;
  category: string;
  occurrenceCount: number;
  averageAmount: number;
}

export async function getRecurringCandidates(
  db: SQLiteDatabase,
  profileId: number
): Promise<RecurringCandidate[]> {
  const candidates = await db.getAllAsync<RecurringCandidate>(
    `SELECT 
       merchant,
       category,
       COUNT(DISTINCT monthName) as occurrenceCount,
       AVG(ABS(amount)) as averageAmount
     FROM transactions
     WHERE profileId = ?
       AND merchant != 'Unknown'
       AND UPPER(merchant) NOT IN (
         SELECT DISTINCT UPPER(keyword) FROM fixed_cost_rules WHERE profileId = ?
       )
     GROUP BY merchant
     HAVING occurrenceCount >= 2
     ORDER BY occurrenceCount DESC, averageAmount DESC
     LIMIT 5;`,
    [profileId, profileId]
  );
  return candidates || [];
}

export interface AnnualTrendPointWithBudget {
  monthName: string;
  totalAmount: number;
  budgetLimit: number;
}

export async function getCategoryGoal(
  db: SQLiteDatabase,
  category: string,
  profileId: number = 1
): Promise<number> {
  const result = await db.getFirstAsync<{ monthly_limit: number }>(
    `SELECT monthly_limit FROM category_goals WHERE category = ? AND profileId = ?;`,
    [category, profileId]
  );
  return result?.monthly_limit ?? 0;
}

/** Monthly limits per category; categories without a limit are left out. */
export async function getCategoryGoals(
  db: SQLiteDatabase,
  profileId: number
): Promise<Record<string, number>> {
  const rows = await db.getAllAsync<{ category: string; monthly_limit: number }>(
    `SELECT category, monthly_limit FROM category_goals WHERE profileId = ? AND monthly_limit > 0;`,
    [profileId]
  );
  const goals: Record<string, number> = {};
  rows.forEach((r) => {
    goals[r.category] = r.monthly_limit;
  });
  return goals;
}

export async function getAnnualTrendWithBudget(
  db: SQLiteDatabase,
  year: string = '2026',
  category: string = 'All',
  profileId: number = 1
): Promise<AnnualTrendPointWithBudget[]> {
  let query = `
    SELECT monthName, TOTAL(ABS(amount)) as totalAmount
    FROM transactions
    WHERE monthName LIKE ? AND profileId = ? AND amount < 0
  `;
  const params: (string | number)[] = [`${year}-%`, profileId];

  if (category && category !== 'All') {
    query += ` AND category = ?`;
    params.push(category);
  }

  query += ` GROUP BY monthName ORDER BY monthName ASC;`;
  const rows = await db.getAllAsync<{ monthName: string; totalAmount: number }>(query, params);

  const spendingMap: Record<string, number> = {};
  rows.forEach((r) => {
    spendingMap[r.monthName] = r.totalAmount;
  });

  const budgetLimit = await getCategoryGoal(db, category, profileId);

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return `${year}-${m}`;
  });

  return months.map((m) => ({
    monthName: m,
    totalAmount: spendingMap[m] || 0,
    budgetLimit: budgetLimit,
  }));
}

/** Monthly expense totals (index = month - 1, rounded) for each of the given years, in one query. */
export async function getYearlyExpenseTotals(
  db: SQLiteDatabase,
  years: string[],
  category: string = 'All',
  profileId: number = 1
): Promise<Record<string, number[]>> {
  const totals: Record<string, number[]> = {};
  if (years.length === 0) return totals;
  years.forEach((year) => {
    totals[year] = Array.from({ length: 12 }, () => 0);
  });

  let query = `
    SELECT monthName, TOTAL(ABS(amount)) as totalAmount
    FROM transactions
    WHERE profileId = ? AND amount < 0 AND SUBSTR(monthName, 1, 4) IN (${years.map(() => '?').join(', ')})
  `;
  const params: (string | number)[] = [profileId, ...years];

  if (category && category !== 'All') {
    query += ` AND category = ?`;
    params.push(category);
  }

  query += ` GROUP BY monthName;`;
  const rows = await db.getAllAsync<{ monthName: string; totalAmount: number }>(query, params);

  rows.forEach((r) => {
    const monthIndex = Number(r.monthName.slice(5, 7)) - 1;
    const yearTotals = totals[r.monthName.slice(0, 4)];
    if (yearTotals && monthIndex >= 0 && monthIndex < 12) {
      yearTotals[monthIndex] = Math.round(r.totalAmount);
    }
  });

  return totals;
}

export async function getRangeTrendWithBudget(
  db: SQLiteDatabase,
  from: string,
  to: string,
  category: string = 'All',
  profileId: number = 1
): Promise<AnnualTrendPointWithBudget[]> {
  let query = `
    SELECT SUBSTR(date, 1, 7) AS monthName, TOTAL(ABS(amount)) AS totalAmount
    FROM transactions
    WHERE profileId = ? AND amount < 0 AND SUBSTR(date, 1, 10) BETWEEN ? AND ?
  `;
  const params: (string | number)[] = [profileId, from, to];

  if (category && category !== 'All') {
    query += ` AND category = ?`;
    params.push(category);
  }

  query += ` GROUP BY SUBSTR(date, 1, 7) ORDER BY monthName ASC;`;
  const rows = await db.getAllAsync<{ monthName: string; totalAmount: number }>(query, params);

  const spendingMap: Record<string, number> = {};
  rows.forEach((r) => {
    spendingMap[r.monthName] = r.totalAmount;
  });

  const monthlyGoal = await getCategoryGoal(db, category, profileId);

  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);

  const result: AnnualTrendPointWithBudget[] = [];
  let year = fromYear;
  let month = fromMonth;

  while (year < toYear || (year === toYear && month <= toMonth)) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDay = year === fromYear && month === fromMonth ? Number(from.slice(8, 10)) : 1;
    const endDay = year === toYear && month === toMonth ? Number(to.slice(8, 10)) : daysInMonth;
    const coveredDays = Math.max(0, endDay - startDay + 1);

    result.push({
      monthName: key,
      totalAmount: spendingMap[key] || 0,
      budgetLimit: (monthlyGoal * coveredDays) / daysInMonth,
    });

    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return result;
}

export async function getDailyTrend(
  db: SQLiteDatabase,
  from: string,
  to: string,
  category: string = 'All',
  profileId: number = 1
): Promise<AnnualTrendPointWithBudget[]> {
  let query = `
    SELECT SUBSTR(date, 1, 10) AS dayKey, TOTAL(ABS(amount)) AS totalAmount
    FROM transactions
    WHERE profileId = ? AND amount < 0 AND SUBSTR(date, 1, 10) BETWEEN ? AND ?
  `;
  const params: (string | number)[] = [profileId, from, to];

  if (category && category !== 'All') {
    query += ` AND category = ?`;
    params.push(category);
  }

  query += ` GROUP BY SUBSTR(date, 1, 10) ORDER BY dayKey ASC;`;
  const rows = await db.getAllAsync<{ dayKey: string; totalAmount: number }>(query, params);

  const spendingMap: Record<string, number> = {};
  rows.forEach((r) => {
    spendingMap[r.dayKey] = r.totalAmount;
  });

  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);

  const cursor = new Date(fromYear, fromMonth - 1, fromDay);
  const end = new Date(toYear, toMonth - 1, toDay);

  const result: AnnualTrendPointWithBudget[] = [];
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
      cursor.getDate()
    ).padStart(2, '0')}`;
    result.push({
      monthName: key, // holds the day key (YYYY-MM-DD) in daily mode
      totalAmount: spendingMap[key] || 0,
      budgetLimit: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}
export async function getIncomeFixedVsFlexibleSummary(
  db: SQLiteDatabase,
  monthName: string,
  profileId: number
): Promise<FixedCostSummary> {
  const period = periodClause(monthName);
  const transactions = await db.getAllAsync<Transaction>(
    `SELECT * FROM transactions WHERE ${period.sql} AND profileId = ? AND amount > 0;`,
    [...period.params, profileId]
  );

  return summarizeFixed(transactions, await getFixedResolver(db, profileId));
}

export async function getAvailableYears(db: SQLiteDatabase, profileId: number = 1): Promise<string[]> {
  try {
    const results = await db.getAllAsync<{ year: string }>(
      `SELECT DISTINCT SUBSTR(date, 1, 4) as year 
       FROM transactions 
       WHERE profileId = ? AND date IS NOT NULL 
       ORDER BY year DESC;`,
      [profileId]
    );
    
    if (!results || results.length === 0) {
      const currentYear = String(new Date().getFullYear());
      return [currentYear];
    }

    return results.map(r => r.year);
  } catch (error) {
    console.error('Failed to get available years:', error);
    return [String(new Date().getFullYear())];
  }
}

export async function getYearCoverageStatus(
  db: SQLiteDatabase,
  year: string,
  profileId: number = 1
): Promise<{ status: 'IN_PROGRESS' | 'PARTIAL' | 'COMPLETE' | 'EMPTY'; minDate?: string; maxDate?: string }> {
  try {
    const res = await db.getFirstAsync<{ minDate: string; maxDate: string }>(
      `SELECT MIN(date) as minDate, MAX(date) as maxDate 
       FROM transactions 
       WHERE SUBSTR(date, 1, 4) = ? AND profileId = ?;`,
      [year, profileId]
    );

    const currentYear = String(new Date().getFullYear());
    const isCurrentYear = year === currentYear;

    if (!res || !res.minDate) {
      return { status: 'EMPTY' };
    }

    const maxMonth = parseInt(res.maxDate.slice(5, 7), 10);
    const maxDay = parseInt(res.maxDate.slice(-2), 10);

    if (isCurrentYear) {
      return { status: 'IN_PROGRESS', minDate: res.minDate, maxDate: res.maxDate };
    } else if (maxMonth < 12 || maxDay < 25) {
      return { status: 'PARTIAL', minDate: res.minDate, maxDate: res.maxDate };
    } else {
      return { status: 'COMPLETE', minDate: res.minDate, maxDate: res.maxDate };
    }
  } catch (error) {
    console.error('Failed to get year coverage status:', error);
    return { status: 'EMPTY' };
  }
}

/** Categories the user confirmed per IBAN and merchant; see `buildLearnedCategories`. */
export async function getLearnedCategories(
  db: SQLiteDatabase,
  profileId: number = 1
): Promise<LearnedCategories> {
  const rows = await db.getAllAsync<ConfirmedRow>(
    `SELECT merchant, category, amount, counterpartyIban
     FROM transactions WHERE profileId = ? AND userOverridden = 1 AND category != ?;`,
    [profileId, UNCATEGORISED]
  );
  return buildLearnedCategories(rows);
}

export async function reclassifyAllUnoverriddenTransactions(
  db: SQLiteDatabase,
  profileId: number = 1
): Promise<number> {
  if (!db) return 0;

  // 1. Fetch user rules & non-overridden transactions
  const rules = await db.getAllAsync<CategoryRule>(
    `SELECT * FROM category_rules WHERE profileId = ?;`,
    [profileId]
  );
  const learned = await getLearnedCategories(db, profileId);

  const transactions = await db.getAllAsync<{
    id: number;
    rawDescription: string;
    merchant: string;
    category: string;
    amount: number;
    counterpartyIban: string | null;
  }>(
    `SELECT id, rawDescription, merchant, category, amount, counterpartyIban
     FROM transactions WHERE profileId = ? AND userOverridden = 0;`,
    [profileId]
  );

  let updatedCount = 0;

  await db.withTransactionAsync(async () => {
    for (const tx of transactions) {
      // Run the new classification logic against the clean text
      const newCategory = classifyTransaction(
        { merchant: tx.merchant, rawDescription: tx.rawDescription },
        rules,
        { iban: tx.counterpartyIban, amount: tx.amount, learned }
      );

      // No rule or keyword hit: keep categories the classifier never produces (custom ones).
      const isFallback = newCategory === UNCATEGORISED || newCategory === INCOME_CATEGORY;
      if (isFallback && !BUILT_IN_CATEGORY_NAMES.includes(tx.category)) {
        continue;
      }

      const res = await db.runAsync(
        `UPDATE transactions SET category = ? WHERE id = ? AND category != ?;`,
        [newCategory, tx.id, newCategory]
      );
      if (res.changes > 0) updatedCount++;
    }
  });

  return updatedCount;
}

export interface UncategorisedGroup {
  key: string;
  title: string;
  /** Set when every transaction in the group shares one counterparty IBAN. */
  iban: string | null;
  keyword: string;
  transactionIds: number[];
  count: number;
  total: number;
  lastDate: string;
  sample: string;
  /** Best guess for the category, when there is one. */
  suggestion: CategorySuggestion | null;
}

export async function getUncategorisedCount(db: SQLiteDatabase, profileId: number): Promise<number> {
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM transactions WHERE profileId = ? AND category = ?;`,
    [profileId, UNCATEGORISED]
  );
  return row?.cnt ?? 0;
}

/** Uncategorised transactions grouped per merchant (IBAN when known, else name), largest total first. */
export async function getUncategorisedGroups(
  db: SQLiteDatabase,
  profileId: number
): Promise<UncategorisedGroup[]> {
  const rows = await db.getAllAsync<Transaction>(
    `SELECT * FROM transactions WHERE profileId = ? AND category = ? ORDER BY date DESC;`,
    [profileId, UNCATEGORISED]
  );

  const groups = new Map<string, UncategorisedGroup>();
  const groupRows = new Map<string, Transaction[]>();
  for (const tx of rows) {
    const name = tx.merchant && tx.merchant !== 'Unknown' ? tx.merchant : tx.rawDescription;
    const keyword = merchantRuleKeyword(name);
    const key = tx.counterpartyIban ?? keyword;
    if (!key) continue;

    const group = groups.get(key);
    if (group) {
      groupRows.get(key)?.push(tx);
      group.transactionIds.push(tx.id);
      group.count++;
      group.total += Math.abs(tx.amount);
    } else {
      groups.set(key, {
        key,
        title: name,
        iban: tx.counterpartyIban ?? null,
        keyword,
        transactionIds: [tx.id],
        count: 1,
        total: Math.abs(tx.amount),
        lastDate: tx.date,
        sample: tx.rawDescription,
        suggestion: null,
      });
      groupRows.set(key, [tx]);
    }
  }

  if (groups.size > 0) {
    const [learned, known] = await Promise.all([
      getLearnedCategories(db, profileId),
      db.getAllAsync<KnownMerchant>(
        `SELECT merchant, category, COUNT(*) AS count FROM transactions
         WHERE profileId = ? AND amount < 0 AND category NOT IN (?, ?)
         GROUP BY merchant, category;`,
        [profileId, UNCATEGORISED, INCOME_CATEGORY]
      ),
    ]);
    const context = { learned, index: buildMerchantIndex(known) };
    for (const [key, group] of groups) {
      group.suggestion = suggestCategory(
        { title: group.title, iban: group.iban, sample: group.sample, rows: groupRows.get(key) ?? [] },
        context
      );
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.total - a.total);
}

/** Assigns a category to a reviewed merchant and saves a rule so future imports follow it. */
export async function categoriseMerchantGroup(
  db: SQLiteDatabase,
  group: UncategorisedGroup,
  category: string,
  profileId: number
): Promise<void> {
  const ruleKeyword = group.iban ?? group.keyword;

  await db.withTransactionAsync(async () => {
    if (ruleKeyword) {
      await db.runAsync(
        `INSERT INTO category_rules (profileId, keyword, category)
         VALUES (?, ?, ?)
         ON CONFLICT(keyword, profileId) DO UPDATE SET category = excluded.category;`,
        [profileId, ruleKeyword, category]
      );
    }

    for (const id of group.transactionIds) {
      await db.runAsync(
        `UPDATE transactions SET category = ?, userOverridden = 1 WHERE id = ? AND profileId = ?;`,
        [category, id, profileId]
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Category management
// ---------------------------------------------------------------------------

export const BUILT_IN_CATEGORY_NAMES = [
  'Housing',
  'Childcare',
  'Credit Card Payments',
  'Groceries',
  'Dining Out',
  'Health & Care',
  'Financial Transfers',
  'Utilities & Telecom',
  'Loan & Insurance',
  'Transportation',
  'Taxes & Municipal Fees',
  'Shopping & Retail',
  UNCATEGORISED,
];

export interface CategoryRow {
  id: number;
  profileId: number;
  name: string;
  color: string;
  isBuiltIn: number;
}

export interface CategoryInfo extends CategoryRow {
  transactionCount: number;
  totalSpent: number;
  monthlyLimit: number;
}

export async function ensureCategoriesSeeded(
  db: SQLiteDatabase,
  profileId: number = 1
): Promise<void> {
  for (const name of BUILT_IN_CATEGORY_NAMES) {
    await db.runAsync(
      `INSERT OR IGNORE INTO categories (profileId, name, color, isBuiltIn) VALUES (?, ?, ?, 1);`,
      [profileId, name, CATEGORY_COLORS[name] ?? '#8E8E93']
    );
  }

  // Built-in categories start with their benchmark group; a group the user picked is never replaced.
  for (const [name, group] of Object.entries(DEFAULT_CATEGORY_GROUPS)) {
    await db.runAsync(
      `UPDATE categories SET benchmark_group = ?
       WHERE profileId = ? AND name = ? AND isBuiltIn = 1 AND benchmark_group IS NULL;`,
      [group, profileId, name]
    );
  }

  await db.runAsync(
    `INSERT OR IGNORE INTO categories (profileId, name, color, isBuiltIn)
     SELECT DISTINCT ?, category, '#8E8E93', 0
     FROM transactions
     WHERE profileId = ? AND category IS NOT NULL AND TRIM(category) != '';`,
    [profileId, profileId]
  );
}

export async function syncCategoryColors(
  db: SQLiteDatabase,
  profileId: number = 1
): Promise<void> {
  if (!db) return;
  try {
    await ensureCategoriesSeeded(db, profileId);
    const rows = await db.getAllAsync<{ name: string; color: string }>(
      `SELECT name, color FROM categories WHERE profileId = ?;`,
      [profileId]
    );
    const map: Record<string, string> = {};
    rows.forEach((r) => {
      map[r.name] = r.color;
    });
    setCustomCategoryColors(map);
  } catch (error) {
    console.warn('Failed to sync category colors:', error);
  }
}

export async function getCategoriesWithStats(
  db: SQLiteDatabase,
  profileId: number = 1
): Promise<CategoryInfo[]> {
  await ensureCategoriesSeeded(db, profileId);

  return await db.getAllAsync<CategoryInfo>(
    `SELECT
       c.id AS id,
       c.profileId AS profileId,
       c.name AS name,
       c.color AS color,
       c.isBuiltIn AS isBuiltIn,
       COALESCE(t.cnt, 0) AS transactionCount,
       COALESCE(t.spent, 0) AS totalSpent,
       COALESCE(g.monthly_limit, 0) AS monthlyLimit
     FROM categories c
     LEFT JOIN (
       SELECT category,
              COUNT(*) AS cnt,
              SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS spent
       FROM transactions
       WHERE profileId = ?
       GROUP BY category
     ) t ON t.category = c.name
     LEFT JOIN category_goals g ON g.category = c.name AND g.profileId = ?
     WHERE c.profileId = ?
     ORDER BY transactionCount DESC, c.name ASC;`,
    [profileId, profileId, profileId]
  );
}

// A category counts as an expense category when it is built-in, has no income
// transactions, or has at least one expense transaction. Expects alias `c`.
const EXPENSE_CATEGORY_SQL = `(
  c.isBuiltIn = 1
  OR NOT EXISTS (
    SELECT 1 FROM transactions x
    WHERE x.profileId = c.profileId AND x.category = c.name AND x.amount >= 0
  )
  OR EXISTS (
    SELECT 1 FROM transactions x
    WHERE x.profileId = c.profileId AND x.category = c.name AND x.amount < 0
  )
)`;

export async function getExpenseCategoryNames(
  db: SQLiteDatabase,
  profileId: number = 1,
  period?: string
): Promise<string[]> {
  await ensureCategoriesSeeded(db, profileId);

  const clause = period ? periodClause(period) : null;
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT c.name AS name
     FROM categories c
     LEFT JOIN (
       SELECT category, TOTAL(ABS(amount)) AS spent
       FROM transactions
       WHERE profileId = ? AND amount < 0${clause ? ` AND ${clause.sql}` : ''}
       GROUP BY category
     ) s ON s.category = c.name
     WHERE c.profileId = ? AND ${EXPENSE_CATEGORY_SQL}
     ORDER BY COALESCE(s.spent, 0) DESC, c.name ASC;`,
    [profileId, ...(clause ? clause.params : []), profileId]
  );
  return rows.map((r) => r.name);
}

export async function findCategoryByName(
  db: SQLiteDatabase,
  profileId: number,
  name: string,
  excludeId?: number
): Promise<CategoryRow | null> {
  const row = await db.getFirstAsync<CategoryRow>(
    `SELECT * FROM categories
     WHERE profileId = ? AND LOWER(name) = LOWER(?) AND id != ?
     LIMIT 1;`,
    [profileId, name.trim(), excludeId ?? -1]
  );
  return row ?? null;
}

export async function getCategoryKeywords(
  db: SQLiteDatabase,
  profileId: number,
  category: string
): Promise<CategoryRule[]> {
  return await db.getAllAsync<CategoryRule>(
    `SELECT * FROM category_rules WHERE profileId = ? AND category = ? ORDER BY keyword ASC;`,
    [profileId, category]
  );
}

export async function createCategory(
  db: SQLiteDatabase,
  profileId: number,
  name: string,
  color: string,
  keywords: string[] = []
): Promise<void> {
  const trimmed = name.trim();
  await db.runAsync(
    `INSERT INTO categories (profileId, name, color, isBuiltIn) VALUES (?, ?, ?, 0);`,
    [profileId, trimmed, color]
  );
  for (const keyword of keywords) {
    const cleaned = keyword.trim();
    if (cleaned) await addCustomRule(db, cleaned, trimmed, profileId);
  }
}

export async function updateCategoryColor(
  db: SQLiteDatabase,
  profileId: number,
  id: number,
  color: string
): Promise<void> {
  await db.runAsync(`UPDATE categories SET color = ? WHERE id = ? AND profileId = ?;`, [
    color,
    id,
    profileId,
  ]);
}

export async function renameCategory(
  db: SQLiteDatabase,
  profileId: number,
  id: number,
  newName: string
): Promise<void> {
  const trimmed = newName.trim();
  const row = await db.getFirstAsync<CategoryRow>(
    `SELECT * FROM categories WHERE id = ? AND profileId = ?;`,
    [id, profileId]
  );
  if (!row) throw new Error('Category not found.');
  if (row.isBuiltIn === 1) throw new Error('Built-in categories cannot be renamed.');
  if (row.name === trimmed) return;

  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE categories SET name = ? WHERE id = ?;`, [trimmed, id]);
    await db.runAsync(
      `UPDATE transactions SET category = ? WHERE category = ? AND profileId = ?;`,
      [trimmed, row.name, profileId]
    );
    await db.runAsync(
      `UPDATE category_rules SET category = ? WHERE category = ? AND profileId = ?;`,
      [trimmed, row.name, profileId]
    );
    await db.runAsync(
      `UPDATE fixed_cost_rules SET category = ? WHERE category = ? AND profileId = ?;`,
      [trimmed, row.name, profileId]
    );
    await db.runAsync(`DELETE FROM category_goals WHERE category = ? AND profileId = ?;`, [
      trimmed,
      profileId,
    ]);
    await db.runAsync(
      `UPDATE category_goals SET category = ? WHERE category = ? AND profileId = ?;`,
      [trimmed, row.name, profileId]
    );
    await db.runAsync(`DELETE FROM category_range_overrides WHERE category = ? AND profile_id = ?;`, [
      trimmed,
      profileId,
    ]);
    await db.runAsync(
      `UPDATE category_range_overrides SET category = ? WHERE category = ? AND profile_id = ?;`,
      [trimmed, row.name, profileId]
    );
  });
}

export async function deleteCategory(
  db: SQLiteDatabase,
  profileId: number,
  id: number,
  reassignTo: string
): Promise<void> {
  const row = await db.getFirstAsync<CategoryRow>(
    `SELECT * FROM categories WHERE id = ? AND profileId = ?;`,
    [id, profileId]
  );
  if (!row) throw new Error('Category not found.');
  if (row.isBuiltIn === 1) throw new Error('Built-in categories cannot be deleted.');
  if (row.name === reassignTo) throw new Error('Choose a different category to move items to.');

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE transactions SET category = ? WHERE category = ? AND profileId = ?;`,
      [reassignTo, row.name, profileId]
    );
    await db.runAsync(
      `UPDATE category_rules SET category = ? WHERE category = ? AND profileId = ?;`,
      [reassignTo, row.name, profileId]
    );
    await db.runAsync(
      `UPDATE fixed_cost_rules SET category = ? WHERE category = ? AND profileId = ?;`,
      [reassignTo, row.name, profileId]
    );
    await db.runAsync(`DELETE FROM category_goals WHERE category = ? AND profileId = ?;`, [
      row.name,
      profileId,
    ]);
    await db.runAsync(`DELETE FROM category_range_overrides WHERE category = ? AND profile_id = ?;`, [
      row.name,
      profileId,
    ]);
    await db.runAsync(`DELETE FROM categories WHERE id = ?;`, [id]);
  });
}

// ---------------------------------------------------------------------------
// Debt management
// ---------------------------------------------------------------------------

export type DebtType = 'LOAN' | 'MORTGAGE' | 'STUDENT' | 'PERSONAL' | 'OTHER';

export interface DebtInput {
  name: string;
  type: DebtType;
  originalAmount: number;
  apr: number;
  paymentAmount: number;
  paymentDay: number;
  startDate: string | null;
  termMonths?: number | null;
  color: string;
  keywords: string[];
}

export interface Debt {
  id: number;
  profileId: number;
  name: string;
  type: DebtType;
  originalAmount: number;
  apr: number;
  paymentAmount: number;
  paymentDay: number;
  startDate: string | null;
  termMonths: number | null;
  color: string;
  status: string;
}

export interface DebtPayment {
  id: number;
  debtId: number;
  profileId: number;
  date: string;
  amount: number;
  principal: number;
  interest: number;
  transactionId: number | null;
  source: 'AUTO' | 'MANUAL';
  ignored: number;
  keyword: string | null;
  merchant?: string | null;
  rawDescription?: string | null;
}

export type DebtMatchStatus = 'NEW' | 'POSSIBLE' | 'LINKED' | 'OTHER_DEBT' | 'IGNORED' | 'BEFORE_START';

// An exact keyword match whose amount is this far from the monthly payment is only suggested.
const DEBT_AMOUNT_TOLERANCE = 0.5;

export interface DebtKeywordMatch {
  id: number;
  date: string;
  amount: number;
  merchant: string;
  rawDescription: string;
  keyword: string;
  strength: DebtMatchStrength;
  status: DebtMatchStatus;
}

export interface DebtSummary extends Debt {
  paidPrincipal: number;
  paidInterest: number;
  balance: number;
  percentPaid: number;
  paymentCount: number;
  monthsRemaining: number | null;
  payoffMonth: string | null; // YYYY-MM
  projectedInterest: number | null;
  keywords: string[];
  isPaidOff: boolean;
}

const debtDaysBetween = (a: string, b: string): number => {
  const [ay, am, ad] = a.slice(0, 10).split('-').map(Number);
  const [by, bm, bd] = b.slice(0, 10).split('-').map(Number);
  const diff = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.max(0, Math.round(diff / 86400000));
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

export async function recomputeDebtPayments(db: SQLiteDatabase, debtId: number): Promise<void> {
  const debt = await db.getFirstAsync<Debt>(`SELECT * FROM debts WHERE id = ?;`, [debtId]);
  if (!debt) return;

  const payments = await db.getAllAsync<DebtPayment>(
    `SELECT * FROM debt_payments WHERE debtId = ? AND ignored = 0 ORDER BY date ASC, id ASC;`,
    [debtId]
  );

  let balance = debt.originalAmount;
  let lastDate: string | null = debt.startDate ?? (payments[0]?.date ?? null);

  for (const payment of payments) {
    const days = lastDate ? debtDaysBetween(lastDate, payment.date) : 0;
    const accrued = debt.apr > 0 ? balance * (debt.apr / 100) * (days / 365) : 0;
    const interest = Math.min(payment.amount, roundMoney(accrued));
    const principal = Math.min(balance, Math.max(0, roundMoney(payment.amount - interest)));
    balance = Math.max(0, roundMoney(balance - principal));
    lastDate = payment.date;

    if (Math.abs(payment.principal - principal) > 0.004 || Math.abs(payment.interest - interest) > 0.004) {
      await db.runAsync(`UPDATE debt_payments SET principal = ?, interest = ? WHERE id = ?;`, [
        principal,
        interest,
        payment.id,
      ]);
    }
  }

  await db.runAsync(`UPDATE debts SET status = ? WHERE id = ?;`, [
    balance <= 0.005 ? 'PAID_OFF' : 'ACTIVE',
    debtId,
  ]);
}

async function setDebtKeywords(
  db: SQLiteDatabase,
  debtId: number,
  profileId: number,
  keywords: string[]
): Promise<void> {
  await db.runAsync(`DELETE FROM debt_rules WHERE debtId = ?;`, [debtId]);
  const unique = Array.from(new Set(keywords.map((k) => k.trim().toUpperCase()).filter(Boolean)));
  for (const keyword of unique) {
    await db.runAsync(`INSERT OR IGNORE INTO debt_rules (debtId, profileId, keyword) VALUES (?, ?, ?);`, [
      debtId,
      profileId,
      keyword,
    ]);
  }
}

export async function createDebt(
  db: SQLiteDatabase,
  profileId: number,
  input: DebtInput
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO debts (profileId, name, type, originalAmount, apr, paymentAmount, paymentDay, startDate, color, status, termMonths)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?);`,
    [
      profileId,
      input.name.trim(),
      input.type,
      input.originalAmount,
      input.apr,
      input.paymentAmount,
      input.paymentDay,
      input.startDate,
      input.color,
      input.termMonths ?? null,
    ]
  );
  const debtId = result.lastInsertRowId;
  await setDebtKeywords(db, debtId, profileId, input.keywords);
  return debtId;
}

export async function updateDebt(
  db: SQLiteDatabase,
  debtId: number,
  input: DebtInput
): Promise<void> {
  const existing = await db.getFirstAsync<Debt>(`SELECT * FROM debts WHERE id = ?;`, [debtId]);
  if (!existing) return;

  await db.runAsync(
    `UPDATE debts
     SET name = ?, type = ?, originalAmount = ?, apr = ?, paymentAmount = ?, paymentDay = ?, startDate = ?, color = ?, termMonths = ?
     WHERE id = ?;`,
    [
      input.name.trim(),
      input.type,
      input.originalAmount,
      input.apr,
      input.paymentAmount,
      input.paymentDay,
      input.startDate,
      input.color,
      input.termMonths ?? null,
      debtId,
    ]
  );
  await setDebtKeywords(db, debtId, existing.profileId, input.keywords);

  // Drop auto-linked payments that no remaining keyword matches.
  const autoRows = await db.getAllAsync<{ id: number; merchant: string; rawDescription: string }>(
    `SELECT p.id AS id, t.merchant AS merchant, t.rawDescription AS rawDescription
     FROM debt_payments p
     JOIN transactions t ON t.id = p.transactionId
     WHERE p.debtId = ? AND p.source = 'AUTO';`,
    [debtId]
  );
  for (const row of autoRows) {
    if (!evaluateDebtKeyword(row.merchant, row.rawDescription, input.keywords)) {
      await db.runAsync(`DELETE FROM debt_payments WHERE id = ?;`, [row.id]);
    }
  }

  await recomputeDebtPayments(db, debtId);
}

export async function deleteDebt(db: SQLiteDatabase, debtId: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM debt_payments WHERE debtId = ?;`, [debtId]);
    await db.runAsync(`DELETE FROM debt_rules WHERE debtId = ?;`, [debtId]);
    await db.runAsync(`DELETE FROM debts WHERE id = ?;`, [debtId]);
  });
}

export async function addManualDebtPayment(
  db: SQLiteDatabase,
  profileId: number,
  debtId: number,
  amount: number,
  date: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO debt_payments (debtId, profileId, date, amount, source) VALUES (?, ?, ?, ?, 'MANUAL');`,
    [debtId, profileId, date, amount]
  );
  await recomputeDebtPayments(db, debtId);
}

export async function removeDebtPayment(db: SQLiteDatabase, paymentId: number): Promise<void> {
  const payment = await db.getFirstAsync<DebtPayment>(
    `SELECT * FROM debt_payments WHERE id = ?;`,
    [paymentId]
  );
  if (!payment) return;

  if (payment.source === 'AUTO') {
    // Keep the row (ignored) so the same transaction is not auto-linked again.
    await db.runAsync(`UPDATE debt_payments SET ignored = 1 WHERE id = ?;`, [paymentId]);
  } else {
    await db.runAsync(`DELETE FROM debt_payments WHERE id = ?;`, [paymentId]);
  }
  await recomputeDebtPayments(db, payment.debtId);
}

export async function getDebtPayments(db: SQLiteDatabase, debtId: number): Promise<DebtPayment[]> {
  return await db.getAllAsync<DebtPayment>(
    `SELECT p.*, t.merchant AS merchant, t.rawDescription AS rawDescription
     FROM debt_payments p
     LEFT JOIN transactions t ON t.id = p.transactionId
     WHERE p.debtId = ? AND p.ignored = 0
     ORDER BY p.date DESC, p.id DESC;`,
    [debtId]
  );
}

export async function getDebtKeywordMatches(
  db: SQLiteDatabase,
  profileId: number,
  keywords: string[],
  startDate: string | null,
  paymentAmount: number,
  debtId: number | null
): Promise<DebtKeywordMatch[]> {
  if (keywords.length === 0) return [];

  const rows = await db.getAllAsync<{
    id: number;
    date: string;
    amount: number;
    merchant: string;
    rawDescription: string;
    linkedDebtId: number | null;
    ignored: number | null;
  }>(
    `SELECT t.id AS id, t.date AS date, t.amount AS amount, t.merchant AS merchant,
            t.rawDescription AS rawDescription, p.debtId AS linkedDebtId, p.ignored AS ignored
     FROM transactions t
     LEFT JOIN debt_payments p ON p.transactionId = t.id
     WHERE t.profileId = ? AND t.amount < 0
     ORDER BY t.date DESC, t.id DESC;`,
    [profileId]
  );

  const matches: DebtKeywordMatch[] = [];
  for (const row of rows) {
    const result = evaluateDebtKeyword(row.merchant, row.rawDescription, keywords);
    if (!result) continue;

    const date = row.date.slice(0, 10);
    const amount = Math.abs(row.amount);
    const isLinkedHere = row.linkedDebtId !== null && row.linkedDebtId === debtId && !row.ignored;
    const beforeStart = !!startDate && date < startDate;

    let status: DebtMatchStatus;
    if (isLinkedHere) {
      status = 'LINKED';
    } else if (result.strength === 'POSSIBLE') {
      // Near-misses are only worth suggesting while the transaction is still free.
      if (row.linkedDebtId !== null || beforeStart) continue;
      status = 'POSSIBLE';
    } else if (row.linkedDebtId !== null) {
      status = row.ignored ? 'IGNORED' : 'OTHER_DEBT';
    } else if (beforeStart) {
      status = 'BEFORE_START';
    } else if (paymentAmount > 0 && Math.abs(amount - paymentAmount) / paymentAmount > DEBT_AMOUNT_TOLERANCE) {
      status = 'POSSIBLE';
    } else {
      status = 'NEW';
    }

    matches.push({
      id: row.id,
      date,
      amount,
      merchant: row.merchant,
      rawDescription: row.rawDescription,
      keyword: result.keyword,
      strength: result.strength,
      status,
    });
  }
  return matches;
}

// Unlinks one statement transaction from a debt; it stays ignored so it is not auto-linked again.
export async function unlinkDebtTransaction(
  db: SQLiteDatabase,
  debtId: number,
  transactionId: number
): Promise<void> {
  const payment = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM debt_payments WHERE debtId = ? AND transactionId = ? AND ignored = 0;`,
    [debtId, transactionId]
  );
  if (payment) await removeDebtPayment(db, payment.id);
}

// Links one suggested transaction to a debt without widening the keyword.
export async function linkDebtTransaction(
  db: SQLiteDatabase,
  profileId: number,
  debtId: number,
  transactionId: number,
  keyword: string | null
): Promise<boolean> {
  const tx = await db.getFirstAsync<{ date: string; amount: number }>(
    `SELECT date, amount FROM transactions WHERE id = ? AND profileId = ?;`,
    [transactionId, profileId]
  );
  if (!tx) return false;

  const result = await db.runAsync(
    `INSERT OR IGNORE INTO debt_payments (debtId, profileId, date, amount, transactionId, source, keyword)
     VALUES (?, ?, ?, ?, ?, 'AUTO', ?);`,
    [debtId, profileId, tx.date.slice(0, 10), Math.abs(tx.amount), transactionId, keyword]
  );
  if (result.changes === 0) return false;

  await recomputeDebtPayments(db, debtId);
  return true;
}

export async function syncDebtPayments(db: SQLiteDatabase, profileId: number): Promise<number> {
  const touched = new Set<number>();

  // Auto payments whose statement transaction was deleted.
  const orphans = await db.getAllAsync<{ debtId: number }>(
    `SELECT DISTINCT debtId FROM debt_payments
     WHERE profileId = ? AND transactionId IS NOT NULL
       AND transactionId NOT IN (SELECT id FROM transactions);`,
    [profileId]
  );
  if (orphans.length > 0) {
    await db.runAsync(
      `DELETE FROM debt_payments
       WHERE profileId = ? AND transactionId IS NOT NULL
         AND transactionId NOT IN (SELECT id FROM transactions);`,
      [profileId]
    );
    orphans.forEach((o) => touched.add(o.debtId));
  }

  const rules = await db.getAllAsync<{
    debtId: number;
    keyword: string;
    startDate: string | null;
    paymentAmount: number;
  }>(
    `SELECT r.debtId AS debtId, r.keyword AS keyword, d.startDate AS startDate, d.paymentAmount AS paymentAmount
     FROM debt_rules r
     JOIN debts d ON d.id = r.debtId
     WHERE r.profileId = ? AND d.status != 'ARCHIVED'
     ORDER BY r.debtId ASC;`,
    [profileId]
  );

  const byDebt = new Map<number, { keywords: string[]; startDate: string | null; paymentAmount: number }>();
  for (const rule of rules) {
    const entry = byDebt.get(rule.debtId) ?? {
      keywords: [],
      startDate: rule.startDate,
      paymentAmount: rule.paymentAmount,
    };
    entry.keywords.push(rule.keyword);
    byDebt.set(rule.debtId, entry);
  }

  let inserted = 0;
  for (const [debtId, { keywords, startDate, paymentAmount }] of byDebt) {
    const matches = await getDebtKeywordMatches(db, profileId, keywords, startDate, paymentAmount, debtId);
    for (const match of matches) {
      if (match.status !== 'NEW') continue;
      const result = await db.runAsync(
        `INSERT OR IGNORE INTO debt_payments (debtId, profileId, date, amount, transactionId, source, keyword)
         VALUES (?, ?, ?, ?, ?, 'AUTO', ?);`,
        [debtId, profileId, match.date, match.amount, match.id, match.keyword]
      );
      if (result.changes > 0) {
        touched.add(debtId);
        inserted++;
      }
    }
  }

  for (const debtId of touched) await recomputeDebtPayments(db, debtId);
  return inserted;
}

export async function getDebtSummaries(
  db: SQLiteDatabase,
  profileId: number
): Promise<DebtSummary[]> {
  const debts = await db.getAllAsync<Debt>(
    `SELECT * FROM debts WHERE profileId = ? AND status != 'ARCHIVED' ORDER BY id ASC;`,
    [profileId]
  );
  if (debts.length === 0) return [];

  const totals = await db.getAllAsync<{
    debtId: number;
    principal: number;
    interest: number;
    cnt: number;
  }>(
    `SELECT debtId, TOTAL(principal) AS principal, TOTAL(interest) AS interest, COUNT(*) AS cnt
     FROM debt_payments WHERE profileId = ? AND ignored = 0 GROUP BY debtId;`,
    [profileId]
  );
  const totalsMap = new Map(totals.map((t) => [t.debtId, t]));

  const rules = await db.getAllAsync<{ debtId: number; keyword: string }>(
    `SELECT debtId, keyword FROM debt_rules WHERE profileId = ? ORDER BY keyword ASC;`,
    [profileId]
  );
  const rulesMap = new Map<number, string[]>();
  rules.forEach((r) => rulesMap.set(r.debtId, [...(rulesMap.get(r.debtId) ?? []), r.keyword]));

  const summaries = debts.map((debt): DebtSummary => {
    const t = totalsMap.get(debt.id);
    const paidPrincipal = Math.min(t?.principal ?? 0, debt.originalAmount);
    const paidInterest = t?.interest ?? 0;
    const balance = Math.max(0, roundMoney(debt.originalAmount - paidPrincipal));
    const percentPaid =
      debt.originalAmount > 0 ? Math.min(100, (paidPrincipal / debt.originalAmount) * 100) : 0;
    const isPaidOff = balance <= 0.005;

    const projection = projectDebtPayoff(balance, debt.apr, debt.paymentAmount);
    let payoffMonth: string | null = null;
    if (projection.months !== null) {
      const d = new Date();
      d.setMonth(d.getMonth() + projection.months);
      payoffMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    return {
      ...debt,
      paidPrincipal,
      paidInterest,
      balance,
      percentPaid,
      paymentCount: t?.cnt ?? 0,
      monthsRemaining: projection.months,
      payoffMonth,
      projectedInterest: projection.totalInterest,
      keywords: rulesMap.get(debt.id) ?? [],
      isPaidOff,
    };
  });

  return summaries.sort((a, b) => Number(a.isPaidOff) - Number(b.isPaidOff) || a.id - b.id);
}

export async function convertDebtAmounts(
  db: SQLiteDatabase,
  profileId: number,
  factor: number
): Promise<void> {
  await db.runAsync(
    `UPDATE debts
     SET originalAmount = ROUND(originalAmount * ?, 2), paymentAmount = ROUND(paymentAmount * ?, 2)
     WHERE profileId = ?;`,
    [factor, factor, profileId]
  );
  await db.runAsync(
    `UPDATE debt_payments
     SET amount = ROUND(amount * ?, 2), principal = ROUND(principal * ?, 2), interest = ROUND(interest * ?, 2)
     WHERE profileId = ?;`,
    [factor, factor, factor, profileId]
  );

  // The payoff plan is typed next to the debts, so its amounts follow them.
  const plan = await getSavedDebtPlan(db, profileId);
  if (plan) {
    await saveDebtPlan(db, profileId, {
      ...plan,
      extraMonthly: roundMoney(plan.extraMonthly * factor),
      lumpSums: plan.lumpSums.map((lump) => ({ ...lump, amount: roundMoney(lump.amount * factor) })),
    });
  }
}

/** The payoff plan stored for this profile, or null when none has been saved yet. */
export async function getSavedDebtPlan(db: SQLiteDatabase, profileId: number): Promise<DebtPlan | null> {
  if (!db) return null;

  const row = await db.getFirstAsync<{ extra_monthly: number; strategy: string; lump_sums: string }>(
    `SELECT extra_monthly, strategy, lump_sums FROM debt_plan WHERE profile_id = ?;`,
    [profileId]
  );
  return row ? sanitizeDebtPlan(row.extra_monthly, row.strategy, row.lump_sums) : null;
}

export async function getDebtPlan(db: SQLiteDatabase, profileId: number): Promise<DebtPlan> {
  return (await getSavedDebtPlan(db, profileId)) ?? { ...DEFAULT_DEBT_PLAN, lumpSums: [] };
}

export async function saveDebtPlan(db: SQLiteDatabase, profileId: number, plan: DebtPlan): Promise<void> {
  if (!db) return;

  await db.runAsync(
    `INSERT INTO debt_plan (profile_id, extra_monthly, strategy, lump_sums, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(profile_id) DO UPDATE SET
       extra_monthly = excluded.extra_monthly,
       strategy = excluded.strategy,
       lump_sums = excluded.lump_sums,
       updated_at = excluded.updated_at;`,
    [profileId, plan.extraMonthly, plan.strategy, JSON.stringify(plan.lumpSums), new Date().toISOString()]
  );
}

const dismissedDebtSuggestionsKey = (profileId: number): string => `debt_suggestions_dismissed:${profileId}`;

async function getDismissedDebtSuggestions(db: SQLiteDatabase, profileId: number): Promise<string[]> {
  try {
    const parsed: unknown = JSON.parse((await getAppMeta(db, dismissedDebtSuggestionsKey(profileId))) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

/** Recurring lender payments in the statements that are not tracked as a debt yet. */
export async function getDebtSuggestions(db: SQLiteDatabase, profileId: number): Promise<DebtSuggestion[]> {
  const rows = await db.getAllAsync<FixedCostRow>(
    `SELECT t.date AS date, t.amount AS amount, t.merchant AS merchant,
            t.rawDescription AS rawDescription, t.category AS category
     FROM transactions t
     LEFT JOIN debt_payments p ON p.transactionId = t.id
     WHERE t.profileId = ? AND t.amount < 0 AND p.id IS NULL;`,
    [profileId]
  );
  if (rows.length === 0) return [];

  const [rules, unmatchedDebts, latest, dismissed] = await Promise.all([
    db.getAllAsync<{ keyword: string }>(`SELECT keyword FROM debt_rules WHERE profileId = ?;`, [profileId]),
    // A debt added by hand has no keyword; its name is the only thing that ties it to the statements.
    db.getAllAsync<{ name: string }>(
      `SELECT d.name AS name FROM debts d
       WHERE d.profileId = ? AND d.status != 'ARCHIVED'
         AND NOT EXISTS (SELECT 1 FROM debt_rules r WHERE r.debtId = d.id);`,
      [profileId]
    ),
    db.getFirstAsync<{ date: string | null }>(
      `SELECT MAX(date) AS date FROM transactions WHERE profileId = ?;`,
      [profileId]
    ),
    getDismissedDebtSuggestions(db, profileId),
  ]);

  return buildDebtSuggestions(
    rows,
    [...rules.map((r) => r.keyword), ...unmatchedDebts.map((d) => d.name)],
    dismissed,
    latest?.date ?? null
  );
}

export async function dismissDebtSuggestion(db: SQLiteDatabase, profileId: number, key: string): Promise<void> {
  const dismissed = await getDismissedDebtSuggestions(db, profileId);
  if (dismissed.includes(key)) return;
  await setAppMeta(db, dismissedDebtSuggestionsKey(profileId), JSON.stringify([...dismissed, key]));
}

// ---------------------------------------------------------------------------
// Freedom plan
// ---------------------------------------------------------------------------

export interface FreedomPlan extends FreedomInput {
  inflationPct: number;
  goalType: GoalType;
  /** Target balance; 0 means no goal set. */
  goalBalance: number;
  /** Target passive income per month; 0 means no goal set. */
  goalIncome: number;
}

export const DEFAULT_FREEDOM_PLAN: FreedomPlan = {
  years: 35,
  lumpSum: 10000,
  monthly: 250,
  annualIncreasePct: 0.05,
  returnPct: 0.09,
  feePct: 0,
  inflationPct: 0.025,
  goalType: 'BALANCE',
  goalBalance: 0,
  goalIncome: 0,
};

/** The plan stored for this profile, or null when none has been saved yet. */
export async function getSavedFreedomPlan(db: SQLiteDatabase, profileId: number): Promise<FreedomPlan | null> {
  if (!db) return null;

  const row = await db.getFirstAsync<{
    years: number;
    lump_sum: number;
    monthly: number;
    annual_increase: number;
    return_pct: number;
    fee_pct: number;
    inflation_pct: number;
    goal_type: string;
    goal_balance: number;
    goal_income: number;
  }>(
    `SELECT years, lump_sum, monthly, annual_increase, return_pct, fee_pct, inflation_pct,
            goal_type, goal_balance, goal_income
     FROM freedom_plans WHERE profile_id = ?;`,
    [profileId]
  );
  if (!row) return null;

  return {
    years: row.years,
    lumpSum: row.lump_sum,
    monthly: row.monthly,
    annualIncreasePct: row.annual_increase,
    returnPct: row.return_pct,
    feePct: row.fee_pct,
    inflationPct: row.inflation_pct,
    goalType: row.goal_type === 'INCOME' ? 'INCOME' : 'BALANCE',
    goalBalance: row.goal_balance,
    goalIncome: row.goal_income,
  };
}

export async function getFreedomPlan(db: SQLiteDatabase, profileId: number): Promise<FreedomPlan> {
  return (await getSavedFreedomPlan(db, profileId)) ?? { ...DEFAULT_FREEDOM_PLAN };
}

export async function saveFreedomPlan(db: SQLiteDatabase, profileId: number, plan: FreedomPlan): Promise<void> {
  if (!db) return;

  await db.runAsync(
    `INSERT INTO freedom_plans
       (profile_id, years, lump_sum, monthly, annual_increase, return_pct, fee_pct, inflation_pct,
        goal_type, goal_balance, goal_income, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(profile_id) DO UPDATE SET
       years = excluded.years,
       lump_sum = excluded.lump_sum,
       monthly = excluded.monthly,
       annual_increase = excluded.annual_increase,
       return_pct = excluded.return_pct,
       fee_pct = excluded.fee_pct,
       inflation_pct = excluded.inflation_pct,
       goal_type = excluded.goal_type,
       goal_balance = excluded.goal_balance,
       goal_income = excluded.goal_income,
       updated_at = excluded.updated_at;`,
    [
      profileId,
      plan.years,
      plan.lumpSum,
      plan.monthly,
      plan.annualIncreasePct,
      plan.returnPct,
      plan.feePct,
      plan.inflationPct,
      plan.goalType,
      plan.goalBalance,
      plan.goalIncome,
      new Date().toISOString(),
    ]
  );
}

// ---------------------------------------------------------------------------
// Budget Health
// ---------------------------------------------------------------------------

/** Household, range overrides, alerts and alert settings of one profile. Runs inside the caller's transaction. */
async function clearHealthTables(db: SQLiteDatabase, profileId: number): Promise<void> {
  await db.runAsync(`DELETE FROM household_profile WHERE profile_id = ?;`, [profileId]);
  await db.runAsync(`DELETE FROM category_range_overrides WHERE profile_id = ?;`, [profileId]);
  await db.runAsync(`DELETE FROM health_alerts WHERE profile_id = ?;`, [profileId]);
  await db.runAsync(`DELETE FROM alert_settings WHERE profile_id = ?;`, [profileId]);
}

/** The household saved for this profile, or null when the questions have not been answered yet. */
export async function getHousehold(db: SQLiteDatabase, profileId: number): Promise<Household | null> {
  if (!db) return null;

  const row = await db.getFirstAsync<{
    adults: number;
    children: number;
    housing_type: string;
    net_income_override: number | null;
    safety_savings: number | null;
  }>(
    `SELECT adults, children, housing_type, net_income_override, safety_savings
     FROM household_profile WHERE profile_id = ?;`,
    [profileId]
  );
  if (!row) return null;

  return {
    adults: row.adults,
    children: row.children,
    housingType: row.housing_type === 'own' ? 'own' : 'rent',
    netIncomeOverride: row.net_income_override,
    safetySavings: row.safety_savings,
  };
}

export async function saveHousehold(db: SQLiteDatabase, profileId: number, household: Household): Promise<void> {
  if (!db) return;

  await db.runAsync(
    `INSERT INTO household_profile
       (profile_id, adults, children, housing_type, net_income_override, safety_savings, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(profile_id) DO UPDATE SET
       adults = excluded.adults,
       children = excluded.children,
       housing_type = excluded.housing_type,
       net_income_override = excluded.net_income_override,
       safety_savings = excluded.safety_savings,
       updated_at = excluded.updated_at;`,
    [
      profileId,
      household.adults,
      household.children,
      household.housingType,
      household.netIncomeOverride,
      household.safetySavings,
      new Date().toISOString(),
    ]
  );
}

/** Currency switch: the two amounts typed by the user follow the transactions. */
export async function convertHouseholdAmounts(db: SQLiteDatabase, profileId: number, factor: number): Promise<void> {
  await db.runAsync(
    `UPDATE household_profile
     SET net_income_override = ROUND(net_income_override * ?, 2), safety_savings = ROUND(safety_savings * ?, 2)
     WHERE profile_id = ?;`,
    [factor, factor, profileId]
  );
}

/** Category name → benchmark group; a category without a row here has not been given a group yet. */
export async function getCategoryBenchmarkGroups(
  db: SQLiteDatabase,
  profileId: number
): Promise<Record<string, BenchmarkGroupId>> {
  await ensureCategoriesSeeded(db, profileId);

  const rows = await db.getAllAsync<{ name: string; benchmark_group: string | null }>(
    `SELECT name, benchmark_group FROM categories WHERE profileId = ?;`,
    [profileId]
  );
  const groups: Record<string, BenchmarkGroupId> = {};
  for (const row of rows) {
    if (isBenchmarkGroupId(row.benchmark_group)) groups[row.name] = row.benchmark_group;
  }
  return groups;
}

export async function setCategoryBenchmarkGroup(
  db: SQLiteDatabase,
  profileId: number,
  category: string,
  group: BenchmarkGroupId
): Promise<void> {
  await db.runAsync(`UPDATE categories SET benchmark_group = ? WHERE profileId = ? AND name = ?;`, [
    group,
    profileId,
    category,
  ]);
}

export async function getRangeOverrides(
  db: SQLiteDatabase,
  profileId: number
): Promise<Record<string, BenchmarkRange>> {
  const rows = await db.getAllAsync<{ category: string; min_pct: number; max_pct: number }>(
    `SELECT category, min_pct, max_pct FROM category_range_overrides WHERE profile_id = ?;`,
    [profileId]
  );
  const overrides: Record<string, BenchmarkRange> = {};
  for (const row of rows) overrides[row.category] = { min: row.min_pct, max: row.max_pct };
  return overrides;
}

export async function setRangeOverride(
  db: SQLiteDatabase,
  profileId: number,
  category: string,
  range: BenchmarkRange
): Promise<void> {
  await db.runAsync(
    `INSERT INTO category_range_overrides (profile_id, category, min_pct, max_pct)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(profile_id, category) DO UPDATE SET min_pct = excluded.min_pct, max_pct = excluded.max_pct;`,
    [profileId, category, range.min, range.max]
  );
}

export async function clearRangeOverride(db: SQLiteDatabase, profileId: number, category: string): Promise<void> {
  await db.runAsync(`DELETE FROM category_range_overrides WHERE profile_id = ? AND category = ?;`, [
    profileId,
    category,
  ]);
}

export async function clearAllRangeOverrides(db: SQLiteDatabase, profileId: number): Promise<void> {
  await db.runAsync(`DELETE FROM category_range_overrides WHERE profile_id = ?;`, [profileId]);
}

export interface StoredHealthAlert extends HealthAlert {
  id: number;
  status: AlertStatus;
  createdAt: string;
}

/** Stores new alerts; one that already exists for the month (same type and key) is left as it is. Returns the new ones. */
export async function insertAlerts(
  db: SQLiteDatabase,
  profileId: number,
  alerts: HealthAlert[]
): Promise<HealthAlert[]> {
  const inserted: HealthAlert[] = [];
  const createdAt = new Date().toISOString();

  for (const alert of alerts) {
    const result = await db.runAsync(
      `INSERT OR IGNORE INTO health_alerts (profile_id, month, type, key, message, severity, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'new', ?);`,
      [profileId, alert.month, alert.type, alert.key, JSON.stringify(alert.message), alert.severity, createdAt]
    );
    if (result.changes > 0) inserted.push(alert);
  }
  return inserted;
}

export async function getAlerts(db: SQLiteDatabase, profileId: number, month: string): Promise<StoredHealthAlert[]> {
  const rows = await db.getAllAsync<{
    id: number;
    month: string;
    type: AlertType;
    key: string;
    message: string;
    severity: number;
    status: AlertStatus;
    created_at: string;
  }>(
    `SELECT id, month, type, key, message, severity, status, created_at
     FROM health_alerts WHERE profile_id = ? AND month = ?
     ORDER BY severity DESC, id ASC;`,
    [profileId, month]
  );

  const alerts: StoredHealthAlert[] = [];
  for (const row of rows) {
    try {
      const message = JSON.parse(row.message) as HealthAlert['message'];
      if (!message || typeof message.key !== 'string') continue;
      alerts.push({
        id: row.id,
        month: row.month,
        type: row.type,
        key: row.key,
        message,
        severity: row.severity,
        status: row.status,
        createdAt: row.created_at,
      });
    } catch {}
  }
  return alerts;
}

export async function setAlertStatus(
  db: SQLiteDatabase,
  profileId: number,
  alertId: number,
  status: AlertStatus
): Promise<void> {
  await db.runAsync(`UPDATE health_alerts SET status = ? WHERE id = ? AND profile_id = ?;`, [
    status,
    alertId,
    profileId,
  ]);
}

/** "Don't alert me about this": every alert of this type for this merchant or category is muted, now and later. */
export async function muteAlertKey(db: SQLiteDatabase, profileId: number, type: AlertType, key: string): Promise<void> {
  await db.runAsync(`UPDATE health_alerts SET status = 'muted' WHERE profile_id = ? AND type = ? AND key = ?;`, [
    profileId,
    type,
    key,
  ]);
}

/** `type|key` of everything the user muted. */
export async function getMutedAlertKeys(db: SQLiteDatabase, profileId: number): Promise<string[]> {
  const rows = await db.getAllAsync<{ type: string; key: string }>(
    `SELECT DISTINCT type, key FROM health_alerts WHERE profile_id = ? AND status = 'muted';`,
    [profileId]
  );
  return rows.map((row) => `${row.type}|${row.key}`);
}

/** Saved switches only; a type without a row follows `DEFAULT_ENABLED_ALERTS`. */
export async function getAlertSettings(
  db: SQLiteDatabase,
  profileId: number
): Promise<Partial<Record<AlertType, boolean>>> {
  const rows = await db.getAllAsync<{ type: AlertType; enabled: number }>(
    `SELECT type, enabled FROM alert_settings WHERE profile_id = ?;`,
    [profileId]
  );
  const settings: Partial<Record<AlertType, boolean>> = {};
  for (const row of rows) settings[row.type] = row.enabled === 1;
  return settings;
}

export async function setAlertSetting(
  db: SQLiteDatabase,
  profileId: number,
  type: AlertType,
  enabled: boolean
): Promise<void> {
  await db.runAsync(
    `INSERT INTO alert_settings (profile_id, type, enabled) VALUES (?, ?, ?)
     ON CONFLICT(profile_id, type) DO UPDATE SET enabled = excluded.enabled;`,
    [profileId, type, enabled ? 1 : 0]
  );
}

export interface HealthData {
  transactions: HealthTransaction[];
  debts: HealthDebt[];
  debtPayments: HealthDebtPayment[];
}

/** Everything the health and alert engines read, with fixed / flexible already resolved. */
export async function getHealthData(db: SQLiteDatabase, profileId: number): Promise<HealthData> {
  const [rows, debts, debtPayments, resolver] = await Promise.all([
    db.getAllAsync<Transaction>(`SELECT * FROM transactions WHERE profileId = ? ORDER BY date ASC, id ASC;`, [
      profileId,
    ]),
    db.getAllAsync<Debt>(`SELECT * FROM debts WHERE profileId = ? AND status != 'ARCHIVED' ORDER BY id ASC;`, [
      profileId,
    ]),
    db.getAllAsync<HealthDebtPayment>(
      `SELECT debtId, substr(date, 1, 10) AS date, amount FROM debt_payments WHERE profileId = ? AND ignored = 0;`,
      [profileId]
    ),
    getFixedResolver(db, profileId),
  ]);

  return {
    transactions: rows.map((tx) => ({
      id: tx.id,
      date: tx.date.slice(0, 10),
      amount: tx.amount,
      category: tx.category,
      merchant: tx.merchant,
      rawDescription: tx.rawDescription,
      isFixed: resolver.resolve(tx).isFixed,
    })),
    debts: debts.map((debt) => ({
      id: debt.id,
      name: debt.name,
      isMortgage: debt.type === 'MORTGAGE',
      paymentAmount: debt.paymentAmount,
      paymentDay: debt.paymentDay,
      startDate: debt.startDate ? debt.startDate.slice(0, 10) : null,
      active: debt.status === 'ACTIVE',
    })),
    debtPayments,
  };
}
