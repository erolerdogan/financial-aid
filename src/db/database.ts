import { CATEGORY_COLORS, setCustomCategoryColors } from '@/constants/colors';
import { classifyTransaction, normalizeMerchantName } from '@/utils/parser';
import { type SQLiteDatabase } from 'expo-sqlite';
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

export interface CategoryGoal {
  category: string;
  profileId: number;
  monthlyLimit: number;
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

export interface TransactionRecord {
  id: number;
  date: string;
  amount: number;
  category: string;
  monthName: string;
  description: string;
  rawDescription?: string;
  is_fixed?: number | null;
}

export interface MonthlyTrend {
  monthName: string;
  totalAmount: number;
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

export interface YearlyTrendPoint {
  monthName: string;
  income: number;
  expenses: number;
  net: number;
}

const DEFAULT_FIXED_KEYWORDS = [
  'HUUR', 'HYPOTHEEK', 'ZORGVERZEKERING', 'ENERGIE', 'ZIGGO',
  'KPN', 'NETFLIX', 'SPOTIFY', 'ICLOUD', 'WATER', 'STEDIN',
  'ENECO', 'ESSENT', 'VATTENFALL', 'HEALTHCITY', 'BASIC-FIT'
];

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
      is_fixed INTEGER
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
      status TEXT NOT NULL DEFAULT 'ACTIVE'
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
      ignored INTEGER NOT NULL DEFAULT 0
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
  `);

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

  const existingProfiles = await db.getAllAsync<{ id: number }>(`SELECT id FROM profiles;`);
  if (existingProfiles.length === 0) {
    await db.runAsync(
      `INSERT INTO profiles (name, avatarColor, isDefault, currency) VALUES ('Personal', '#007AFF', 1, 'EUR');`
    );
  }
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

export async function updateProfile(
  db: SQLiteDatabase,
  id: number,
  name: string,
  avatarColor: string
): Promise<void> {
  await db.runAsync(
    `UPDATE profiles SET name = ?, avatarColor = ? WHERE id = ?;`,
    [name.trim(), avatarColor, id]
  );
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
      is_fixed INTEGER
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
    await db.runAsync(`DELETE FROM profiles WHERE id = ?;`, [id]);
  });
}

/**
 * Dynamic Feedback Loop: Saves a category rule and updates ALL historical 
 * non-overridden transactions matching the clean merchant keyword.
 */
export async function updateMerchantCategoryAndApplyGlobally(
  db: SQLiteDatabase,
  merchantName: string,
  newCategory: string,
  profileId: number = 1
): Promise<void> {
  if (!db || !merchantName) return;
  const cleanKeyword = normalizeMerchantName(merchantName);
  if (!cleanKeyword) return;

  const searchPattern = `%${cleanKeyword}%`;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO category_rules (profileId, keyword, category) 
       VALUES (?, ?, ?)
       ON CONFLICT(keyword, profileId) DO UPDATE SET category = excluded.category;`,
      [profileId, cleanKeyword, newCategory]
    );

    await db.runAsync(
      `UPDATE transactions 
       SET category = ?, userOverridden = 1 
       WHERE profileId = ? 
         AND (UPPER(merchant) LIKE ? OR UPPER(rawDescription) LIKE ?);`,
      [newCategory, profileId, searchPattern, searchPattern]
    );
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

  
  const customRules = await db.getAllAsync<{ keyword: string; overrideState: string }>(
    `SELECT keyword, overrideState FROM fixed_cost_rules WHERE profileId = ?;`,
    [profileId]
  );

  const customRuleMap = new Map<string, string>();
  customRules.forEach((r) => customRuleMap.set(r.keyword.toUpperCase().trim(), r.overrideState));

  const detectedPatterns = await detectRecurringPatterns(db, 2, profileId);
  const detectedKeywords = detectedPatterns.map((p) => p.merchant.toUpperCase().trim());

  const allFixedKeywords = new Set([
    ...DEFAULT_FIXED_KEYWORDS.map((k) => k.toUpperCase().trim()),
    ...detectedKeywords,
  ]);

  let fixedTotal = 0;
  let flexibleTotal = 0;
  let fixedCount = 0;

  for (const tx of transactions) {
    const absAmount = Math.abs(tx.amount);
    let isFixed = false;

    if (tx.is_fixed === 1) {
      isFixed = true;
    } else if (tx.is_fixed === 0) {
      isFixed = false;
    } else {
      const keyword = (tx.merchant && tx.merchant !== 'Unknown' ? tx.merchant : tx.rawDescription)
        .toUpperCase()
        .trim();

      const matchedRule = Array.from(customRuleMap.entries()).find(([kw]) => keyword.includes(kw));
      if (matchedRule) {
        isFixed = matchedRule[1] === 'FIXED';
      } else {
        isFixed = Array.from(allFixedKeywords).some((kw) => keyword.includes(kw));
      }
    }

    if (isFixed) {
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

export async function getCategoryFixedVsFlexibleSummary(
  db: SQLiteDatabase,
  monthName: string,
  category: string,
  profileId: number = 1
): Promise<FixedCostSummary> {
  const isAll = category === 'All' || category === 'ALL';
  const categoryFilter = isAll ? '' : 'AND category = ?';

  const query = `
    SELECT * FROM transactions 
    WHERE profileId = ? AND monthName = ? ${categoryFilter} AND amount < 0;
  `;

  const queryParams = isAll ? [profileId, monthName] : [profileId, monthName, category];
  const transactions = await db.getAllAsync<Transaction>(query, queryParams);

  const customRules = await db.getAllAsync<{ keyword: string; overrideState: string }>(
    `SELECT keyword, overrideState FROM fixed_cost_rules WHERE profileId = ?;`,
    [profileId]
  );

  const customRuleMap = new Map<string, string>();
  customRules.forEach((r) => customRuleMap.set(r.keyword.toUpperCase().trim(), r.overrideState));

  const detectedPatterns = await detectRecurringPatterns(db, 2, profileId);
  const detectedKeywords = detectedPatterns.map((p) => p.merchant.toUpperCase().trim());

  const allFixedKeywords = new Set([
    ...DEFAULT_FIXED_KEYWORDS.map((k) => k.toUpperCase().trim()),
    ...detectedKeywords,
  ]);

  let fixedTotal = 0;
  let flexibleTotal = 0;
  let fixedCount = 0;

  for (const tx of transactions) {
    const absAmount = Math.abs(tx.amount);
    let isFixed = false;

    if (tx.is_fixed === 1) {
      isFixed = true;
    } else if (tx.is_fixed === 0) {
      isFixed = false;
    } else {
      const keyword = (tx.merchant && tx.merchant !== 'Unknown' ? tx.merchant : tx.rawDescription)
        .toUpperCase()
        .trim();

      const matchedRule = Array.from(customRuleMap.entries()).find(([kw]) => keyword.includes(kw));
      if (matchedRule) {
        isFixed = matchedRule[1] === 'FIXED';
      } else {
        isFixed = Array.from(allFixedKeywords).some((kw) => keyword.includes(kw));
      }
    }

    if (isFixed) {
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

  const customRules = await db.getAllAsync<{ keyword: string; overrideState: string }>(
    `SELECT keyword, overrideState FROM fixed_cost_rules WHERE profileId = ?;`,
    [profileId]
  );

  const customRuleMap = new Map<string, string>();
  customRules.forEach((r) => customRuleMap.set(r.keyword.toUpperCase().trim(), r.overrideState));

  const detectedPatterns = await detectRecurringPatterns(db, 2, profileId);
  const detectedKeywords = detectedPatterns.map((p) => p.merchant.toUpperCase().trim());

  const allFixedKeywords = new Set([
    ...DEFAULT_FIXED_KEYWORDS.map((k) => k.toUpperCase().trim()),
    ...detectedKeywords,
  ]);

  const filteredItems: Transaction[] = [];

  for (const tx of allExpenses) {
    let isFixed = false;

    if (tx.is_fixed === 1) {
      isFixed = true;
    } else if (tx.is_fixed === 0) {
      isFixed = false;
    } else {
      const keyword = (tx.merchant && tx.merchant !== 'Unknown' ? tx.merchant : tx.rawDescription)
        .toUpperCase()
        .trim();

      const matchedRule = Array.from(customRuleMap.entries()).find(([kw]) => keyword.includes(kw));
      if (matchedRule) {
        isFixed = matchedRule[1] === 'FIXED';
      } else {
        isFixed = Array.from(allFixedKeywords).some((kw) => keyword.includes(kw));
      }
    }

    tx.is_fixed = isFixed ? 1 : 0;

    if (isFixedTarget === isFixed) {
      filteredItems.push(tx);
    }
  }

  return filteredItems;
}

export async function getCategoryGoalsWithProgress(
  db: SQLiteDatabase,
  monthStr: string,
  profileId: number = 1
): Promise<CategoryGoalWithProgress[]> {
  const query = `
    SELECT 
      c.category,
      COALESCE(g.monthly_limit, 0) as monthlyLimit,
      COALESCE(SUM(ABS(t.amount)), 0) as spent
    FROM (
      SELECT DISTINCT category FROM transactions WHERE amount < 0 AND profileId = ?
      UNION
      SELECT category FROM category_goals WHERE profileId = ?
    ) c
    LEFT JOIN category_goals g ON c.category = g.category AND g.profileId = ?
    LEFT JOIN transactions t ON c.category = t.category 
      AND t.monthName = ? 
      AND t.profileId = ?
      AND t.amount < 0
    GROUP BY c.category
    ORDER BY spent DESC;
  `;
  const rows = await db.getAllAsync<{ category: string; monthlyLimit: number; spent: number }>(
    query,
    [profileId, profileId, profileId, monthStr, profileId]
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
           (profileId, date, amount, rawDescription, merchant, category, monthName, isZeroFlagged, dateAmbiguous, is_fixed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);`,
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

export async function clearAllTransactions(
  db: SQLiteDatabase,
  profileId: number = 1
): Promise<void> {
  if (!db) return;
  await db.runAsync(`DELETE FROM transactions WHERE profileId = ?;`, [profileId]);
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



export async function getFullYearSpendingTrend(
  db: SQLiteDatabase,
  year: string = '2026',
  category?: string,
  profileId: number = 1
): Promise<MonthlyTrend[]> {
  try {
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

    return await db.getAllAsync<MonthlyTrend>(query, params);
  } catch (error) {
    console.error('Error fetching yearly trend:', error);
    return [];
  }
}


export async function getTransactionsByMonth(
  db: SQLiteDatabase,
  monthName: string,
  searchQuery: string = '',
  categoryFilter: string = 'ALL',
  profileId: number = 1
): Promise<Transaction[]> {
  let query = `SELECT * FROM transactions WHERE monthName = ? AND profileId = ?`;
  const params: (string | number)[] = [monthName, profileId];

  if (categoryFilter !== 'ALL') {
    query += ` AND category = ?`;
    params.push(categoryFilter);
  }

  if (searchQuery.trim().length > 0) {
    query += ` AND (rawDescription LIKE ? OR merchant LIKE ?)`;
    const searchPattern = `%${searchQuery.trim()}%`;
    params.push(searchPattern, searchPattern);
  }

  query += ` ORDER BY date DESC, id DESC;`;

  return await db.getAllAsync<Transaction>(query, params);
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

  return transactions;
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
    WHERE profileId = ? AND ${period.sql} ${categoryFilter}
    ORDER BY ABS(amount) DESC;
  `;

  const queryParams: (string | number)[] = [profileId, ...period.params];
  if (!isAll) queryParams.push(category);

  const rows = await db.getAllAsync<Transaction>(query, queryParams);

  const needsResolution = rows.some(
    (tx) => tx.amount < 0 && tx.is_fixed !== 1 && tx.is_fixed !== 0
  );
  if (!needsResolution) return rows;

  const customRules = await db.getAllAsync<{ keyword: string; overrideState: string }>(
    `SELECT keyword, overrideState FROM fixed_cost_rules WHERE profileId = ?;`,
    [profileId]
  );

  const customRuleMap = new Map<string, string>();
  customRules.forEach((r) => customRuleMap.set(r.keyword.toUpperCase().trim(), r.overrideState));

  const detectedPatterns = await detectRecurringPatterns(db, 2, profileId);
  const detectedKeywords = detectedPatterns.map((p) => p.merchant.toUpperCase().trim());

  const allFixedKeywords = new Set([
    ...DEFAULT_FIXED_KEYWORDS.map((k) => k.toUpperCase().trim()),
    ...detectedKeywords,
  ]);

  return rows.map((tx) => {
    if (tx.amount >= 0 || tx.is_fixed === 1 || tx.is_fixed === 0) return tx;

    const keyword = (tx.merchant && tx.merchant !== 'Unknown' ? tx.merchant : tx.rawDescription)
      .toUpperCase()
      .trim();

    const matchedRule = Array.from(customRuleMap.entries()).find(([kw]) => keyword.includes(kw));
    const isFixed = matchedRule
      ? matchedRule[1] === 'FIXED'
      : Array.from(allFixedKeywords).some((kw) => keyword.includes(kw));

    return { ...tx, is_fixed: isFixed ? 1 : 0 };
  });
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
export async function searchTransactions(
  db: SQLiteDatabase,
  searchQuery: string = '',
  category: string = 'All',
  profileId: number = 1
): Promise<TransactionRecord[]> {
  if (!db) return [];

  try {
    let sql = `
      SELECT id, date, amount, category, monthName, rawDescription AS description, rawDescription, is_fixed
      FROM transactions
      WHERE profileId = ?
    `;
    const params: (string | number)[] = [profileId];

    if (searchQuery.trim().length > 0) {
      sql += ` AND (rawDescription LIKE ? OR merchant LIKE ? OR category LIKE ?)`;
      const term = `%${searchQuery.trim()}%`;
      params.push(term, term, term);
    }

    if (category && category !== 'All') {
      sql += ` AND category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY date DESC LIMIT 200;`;

    return await db.getAllAsync<TransactionRecord>(sql, params);
  } catch (error) {
    console.error('Error searching transactions:', error);
    return [];
  }
}

export async function getCategoryTransactionsForMonth(
  db: SQLiteDatabase,
  monthName: string,
  category: string,
  profileId: number = 1
): Promise<TransactionRecord[]> {
  if (!db) return [];

  try {
    const query = `
      SELECT id, date, amount, category, monthName, rawDescription AS description, is_fixed
      FROM transactions
      WHERE monthName = ? AND category = ? AND profileId = ?
      ORDER BY date DESC;
    `;
    return await db.getAllAsync<TransactionRecord>(query, [monthName, category, profileId]);
  } catch (error) {
    console.error('Error fetching category transactions:', error);
    return [];
  }
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

export async function getFullYearTrendData(
  db: SQLiteDatabase,
  year: string = '2026',
  profileId: number = 1
): Promise<YearlyTrendPoint[]> {
  const rows = await db.getAllAsync<{ monthName: string; income: number; expenses: number }>(
    `SELECT 
       monthName,
       TOTAL(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
       TOTAL(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS expenses
     FROM transactions
     WHERE monthName LIKE ? AND profileId = ?
     GROUP BY monthName
     ORDER BY monthName ASC;`,
    [`${year}-%`, profileId]
  );

  return rows.map((r) => ({
    monthName: r.monthName,
    income: r.income,
    expenses: r.expenses,
    net: r.income - r.expenses,
  }));
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

export async function isTransactionFixed(
  db: SQLiteDatabase,
  merchantOrDesc: string,
  profileId: number = 1
): Promise<boolean> {
  if (!db || !merchantOrDesc) return false;
  const targetUpper = merchantOrDesc.toUpperCase().trim();

  const customRules = await db.getAllAsync<{ keyword: string; overrideState: string }>(
    `SELECT keyword, overrideState FROM fixed_cost_rules WHERE profileId = ?;`,
    [profileId]
  );

  const matchedRule = customRules.find((r) => targetUpper.includes(r.keyword.toUpperCase()));
  if (matchedRule) {
    return matchedRule.overrideState === 'FIXED';
  }

  const detectedPatterns = await detectRecurringPatterns(db, 2, profileId);
  const detectedKeywords = detectedPatterns.map((p) => p.merchant.toUpperCase());

  const allFixedKeywords = new Set([
    ...DEFAULT_FIXED_KEYWORDS,
    ...detectedKeywords,
  ]);

  return Array.from(allFixedKeywords).some((kw) => targetUpper.includes(kw));
}

export async function getTransactionFixedState(
  db: SQLiteDatabase,
  transaction: Transaction,
  profileId: number = 1
): Promise<FixedOverrideState> {
  if (!db || !transaction) return 'AUTO';

  if (transaction.is_fixed === 1) return 'FIXED';
  if (transaction.is_fixed === 0) return 'FLEXIBLE';

  const keyword =
    transaction.merchant && transaction.merchant !== 'Unknown'
      ? transaction.merchant
      : transaction.rawDescription;

  if (keyword) {
    const uppercaseKeyword = keyword.toUpperCase().trim();
    const rule = await db.getFirstAsync<{ overrideState: FixedOverrideState }>(
      `SELECT overrideState FROM fixed_cost_rules WHERE UPPER(keyword) = ? AND profileId = ?;`,
      [uppercaseKeyword, profileId]
    );

    if (rule?.overrideState) {
      return rule.overrideState;
    }
  }

  return 'AUTO';
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

export async function addFixedCostRule(
  db: SQLiteDatabase,
  keyword: string,
  category: string,
  profileId: number = 1
): Promise<void> {
  await setMerchantFixedOverride(db, keyword, category, 'FIXED', profileId);
}

export async function toggleFixedCostRule(
  db: SQLiteDatabase,
  keyword: string,
  category: string,
  profileId: number = 1
): Promise<boolean> {
  const currentState = await isTransactionFixed(db, keyword, profileId);
  const newState: FixedOverrideState = currentState ? 'FLEXIBLE' : 'FIXED';
  await setMerchantFixedOverride(db, keyword, category, newState, profileId);
  return newState === 'FIXED';
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

  const customRules = await db.getAllAsync<{ keyword: string; overrideState: string }>(
    `SELECT keyword, overrideState FROM fixed_cost_rules WHERE profileId = ?;`,
    [profileId]
  );
  const customRuleMap = new Map<string, string>();
  customRules.forEach((r) => customRuleMap.set(r.keyword.toUpperCase().trim(), r.overrideState));

  const detectedPatterns = await detectRecurringPatterns(db, 2, profileId);
  const detectedKeywords = detectedPatterns.map((p) => p.merchant.toUpperCase().trim());
  const allFixedKeywords = new Set([
    ...DEFAULT_FIXED_KEYWORDS.map((k) => k.toUpperCase().trim()),
    ...detectedKeywords,
  ]);

  let fixedTotal = 0;
  let flexibleTotal = 0;
  let fixedCount = 0;

  for (const tx of transactions) {
    const absAmount = Math.abs(tx.amount);
    let isFixed = false;

    if (tx.is_fixed === 1) {
      isFixed = true;
    } else if (tx.is_fixed === 0) {
      isFixed = false;
    } else {
      const keyword = (tx.merchant && tx.merchant !== 'Unknown' ? tx.merchant : tx.rawDescription)
        .toUpperCase()
        .trim();

      const matchedRule = Array.from(customRuleMap.entries()).find(([kw]) => keyword.includes(kw));
      if (matchedRule) {
        isFixed = matchedRule[1] === 'FIXED';
      } else {
        isFixed = Array.from(allFixedKeywords).some((kw) => keyword.includes(kw));
      }
    }

    if (isFixed) {
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

export async function clearDemoWorkspace(db: SQLiteDatabase, demoProfileId: number = 1): Promise<void> {
  if (!db) return;

  await db.execAsync(`
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
      is_fixed INTEGER
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
    await db.runAsync('DELETE FROM transactions WHERE profileId = ?;', [demoProfileId]);
    await db.runAsync('DELETE FROM category_goals WHERE profileId = ?;', [demoProfileId]);
    await db.runAsync('DELETE FROM category_rules WHERE profileId = ?;', [demoProfileId]);
    await db.runAsync('DELETE FROM fixed_cost_rules WHERE profileId = ?;', [demoProfileId]);
  });
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
): Promise<{ status: 'IN_PROGRESS' | 'PARTIAL' | 'COMPLETE' | 'EMPTY'; minDate?: string; maxDate?: string; label: string }> {
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
      return { status: 'EMPTY', label: 'Statement Pending' };
    }

    const maxMonth = parseInt(res.maxDate.slice(5, 7), 10);
    const maxDay = parseInt(res.maxDate.slice(-2), 10);

    if (isCurrentYear) {
      const startMonthStr = formatMonthName(res.minDate);
      const endMonthStr = formatMonthName(res.maxDate);
      return {
        status: 'IN_PROGRESS',
        minDate: res.minDate,
        maxDate: res.maxDate,
        label: `In Progress (${startMonthStr} – ${endMonthStr})`,
      };
    } else if (maxMonth < 12 || maxDay < 25) {
      const startMonthStr = formatMonthName(res.minDate);
      const endMonthStr = formatMonthName(res.maxDate);
      return {
        status: 'PARTIAL',
        minDate: res.minDate,
        maxDate: res.maxDate,
        label: `Partial Year (${startMonthStr} – ${endMonthStr})`,
      };
    } else {
      return {
        status: 'COMPLETE',
        minDate: res.minDate,
        maxDate: res.maxDate,
        label: `Full Year (${year})`,
      };
    }
  } catch (error) {
    console.error('Failed to get year coverage status:', error);
    return { status: 'EMPTY', label: 'Statement Pending' };
  }
}

const formatMonthName = (dateStr: string): string => {
  if (!dateStr || dateStr.length < 7) return dateStr;
  const [, month] = dateStr.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(month, 10) - 1;
  return monthNames[monthIdx] || month;
};

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
  
  const transactions = await db.getAllAsync<{ id: number; rawDescription: string; merchant: string }>(
    `SELECT id, rawDescription, merchant FROM transactions WHERE profileId = ? AND userOverridden = 0;`,
    [profileId]
  );

  let updatedCount = 0;

  await db.withTransactionAsync(async () => {
    for (const tx of transactions) {
      // Run the new classification logic against the clean text
      const newCategory = classifyTransaction(tx.rawDescription || tx.merchant, rules);

      const res = await db.runAsync(
        `UPDATE transactions SET category = ? WHERE id = ? AND category != ?;`,
        [newCategory, tx.id, newCategory]
      );
      if (res.changes > 0) updatedCount++;
    }
  });

  return updatedCount;
}

// Inside db/database.ts

export async function safeExecuteQuery<T>(
  db: SQLiteDatabase,
  queryFn: () => Promise<T>
): Promise<T | null> {
  if (!db) return null;
  try {
    return await queryFn();
  } catch (error: any) {
    if (
      error?.message?.includes('Access closed resource') ||
      error?.message?.includes('AccessClosedResourceException')
    ) {
      console.warn('SQLite handle closed during async operation. Execution skipped.');
      return null;
    }
    throw error;
  }
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

export function projectDebtPayoff(
  balance: number,
  apr: number,
  payment: number
): { months: number | null; totalInterest: number | null } {
  if (balance <= 0.005) return { months: 0, totalInterest: 0 };
  if (payment <= 0) return { months: null, totalInterest: null };

  const monthlyRate = apr / 1200;
  if (monthlyRate === 0) {
    return { months: Math.ceil(balance / payment), totalInterest: 0 };
  }
  if (payment <= balance * monthlyRate) return { months: null, totalInterest: null };

  const months = Math.ceil(-Math.log(1 - (balance * monthlyRate) / payment) / Math.log(1 + monthlyRate));
  return { months, totalInterest: Math.max(0, payment * months - balance) };
}

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
    `INSERT INTO debts (profileId, name, type, originalAmount, apr, paymentAmount, paymentDay, startDate, color, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE');`,
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
     SET name = ?, type = ?, originalAmount = ?, apr = ?, paymentAmount = ?, paymentDay = ?, startDate = ?, color = ?
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
      debtId,
    ]
  );
  await setDebtKeywords(db, debtId, existing.profileId, input.keywords);
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
    `SELECT * FROM debt_payments WHERE debtId = ? AND ignored = 0 ORDER BY date DESC, id DESC;`,
    [debtId]
  );
}

export async function syncDebtPayments(db: SQLiteDatabase, profileId: number): Promise<number> {
  const rules = await db.getAllAsync<{ debtId: number; keyword: string; startDate: string | null }>(
    `SELECT r.debtId AS debtId, r.keyword AS keyword, d.startDate AS startDate
     FROM debt_rules r
     JOIN debts d ON d.id = r.debtId
     WHERE r.profileId = ? AND d.status != 'ARCHIVED';`,
    [profileId]
  );
  if (rules.length === 0) return 0;

  const touched = new Set<number>();
  let inserted = 0;

  for (const rule of rules) {
    const keyword = rule.keyword.trim().toUpperCase();
    if (!keyword) continue;
    const pattern = `%${keyword}%`;

    const matches = await db.getAllAsync<{ id: number; date: string; amount: number }>(
      `SELECT t.id AS id, t.date AS date, t.amount AS amount
       FROM transactions t
       WHERE t.profileId = ?
         AND t.amount < 0
         AND (UPPER(t.merchant) LIKE ? OR UPPER(t.rawDescription) LIKE ?)
         AND (? IS NULL OR SUBSTR(t.date, 1, 10) >= ?)
         AND NOT EXISTS (SELECT 1 FROM debt_payments p WHERE p.transactionId = t.id);`,
      [profileId, pattern, pattern, rule.startDate, rule.startDate]
    );

    for (const tx of matches) {
      await db.runAsync(
        `INSERT OR IGNORE INTO debt_payments (debtId, profileId, date, amount, transactionId, source)
         VALUES (?, ?, ?, ?, ?, 'AUTO');`,
        [rule.debtId, profileId, tx.date.slice(0, 10), Math.abs(tx.amount), tx.id]
      );
      touched.add(rule.debtId);
      inserted++;
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
}