import { CategoryRule, insertTransactions, syncDebtPayments, Transaction } from '@/db/database';
import type { BankId } from '@/utils/bankFormats';
import {
  type LearnedCategories,
  type ParsedStatement,
  parseCSVContent,
  parseExcelContent,
  type PreviousKey,
} from '@/utils/parser';
import {
  decodeStatementText,
  describeUnsupportedStatement,
  isSpreadsheetFile,
  STATEMENT_HEAD_BYTES,
  UnsupportedFileError,
} from '@/utils/statementFormat';
import * as FileSystem from 'expo-file-system/legacy';
import { SQLiteDatabase } from 'expo-sqlite';

export interface ImportTransactionPayload {
  date: string;
  amount: number;
  rawDescription: string;
  /** The single cell older versions stored as rawDescription; only used to detect duplicates. */
  legacyRawDescription?: string;
  /** How earlier versions stored this row, when the bank's format changes its amount or text. */
  previousKeys?: PreviousKey[];
  merchant: string;
  category: string;
  monthName?: string;
  isZeroFlagged?: number;
  dateAmbiguous?: number;
  counterpartyIban?: string | null;
  txType?: string | null;
}

export interface ImportResultSummary {
  totalProcessed: number;
  insertedCount: number;
  skippedCount: number;
  isFirstImport: boolean;
  dateFrom: string | null;
  dateTo: string | null;
  incomeTotal: number;
  expenseTotal: number;
  ambiguousDateCount: number;
  linkedDebtPayments: number;
  /** The bank whose export layout was recognised, if any. */
  bank: BankId | null;
}

const EMPTY_SUMMARY: ImportResultSummary = {
  totalProcessed: 0,
  insertedCount: 0,
  skippedCount: 0,
  isFirstImport: false,
  dateFrom: null,
  dateTo: null,
  incomeTotal: 0,
  expenseTotal: 0,
  ambiguousDateCount: 0,
  linkedDebtPayments: 0,
  bank: null,
};

export function generateTransactionHash(date: string, amount: number, rawDescription: string): string {
  const cleanDate = (date || '').split('T')[0].trim();
  const cleanAmount = Math.abs(Number(amount)).toFixed(2);
  const sign = Number(amount) < 0 ? '-' : '+';

  const cleanDesc = (rawDescription || '')
    .trim()
    .toLowerCase()
    .replace(/^pending:\s*/i, '')
    .replace(/\s+/g, ' ');

  return `${cleanDate}_${sign}${cleanAmount}_${cleanDesc}`;
}

// Native Base64 to ArrayBuffer decoder (No Node.js 'buffer' dependency needed)
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function parseFileToTransactions(
  fileUri: string,
  fileName: string,
  customRules: CategoryRule[] = [],
  learned?: LearnedCategories
): Promise<ParsedStatement> {
  const cleanName = (fileName || '').toLowerCase();

  const cacheDir = FileSystem.cacheDirectory;
  const tempDestination = `${cacheDir}${Date.now()}_${fileName}`;

  await FileSystem.copyAsync({
    from: fileUri,
    to: tempDestination,
  });

  try {
    const headBase64 = await FileSystem.readAsStringAsync(tempDestination, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: STATEMENT_HEAD_BYTES,
    });
    const head = new Uint8Array(base64ToArrayBuffer(headBase64));

    const unsupported = describeUnsupportedStatement(cleanName, head);
    if (unsupported) throw new UnsupportedFileError(unsupported);

    const base64Data = await FileSystem.readAsStringAsync(tempDestination, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const arrayBuffer = base64ToArrayBuffer(base64Data);

    if (isSpreadsheetFile(cleanName, head)) {
      return parseExcelContent(arrayBuffer, customRules, learned);
    }
    // Read as bytes: not every bank exports UTF-8.
    return parseCSVContent(decodeStatementText(new Uint8Array(arrayBuffer)), customRules, learned);
  } finally {
    await FileSystem.deleteAsync(tempDestination, { idempotent: true });
  }
}

export async function processBatchImport(
  db: SQLiteDatabase,
  items: ImportTransactionPayload[],
  profileId: number,
  bank: BankId | null = null
): Promise<ImportResultSummary> {
  if (!items || items.length === 0 || !profileId) {
    return { ...EMPTY_SUMMARY, bank };
  }

  // Safely guarantee all core tables exist in SQLite before issuing query statements
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

    CREATE TABLE IF NOT EXISTS fixed_cost_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profileId INTEGER NOT NULL DEFAULT 1,
      keyword TEXT NOT NULL,
      category TEXT NOT NULL,
      overrideState TEXT NOT NULL DEFAULT 'FIXED',
      UNIQUE(keyword, profileId)
    );
  `);

  const existingRows = await db.getAllAsync<{ date: string; amount: number; rawDescription: string }>(
    `SELECT date, amount, rawDescription FROM transactions WHERE profileId = ?;`,
    [profileId]
  );

  const existingHashSet = new Set<string>(
    existingRows.map((r) => generateTransactionHash(r.date, r.amount, r.rawDescription))
  );

  const cleanTransactionsToInsert: Omit<Transaction, 'id'>[] = [];
  let skippedCount = 0;

  for (const item of items) {
    const hash = generateTransactionHash(item.date, item.amount, item.rawDescription);
    // Rows imported before name and memo columns were merged are stored under the legacy text.
    const legacyHash =
      item.legacyRawDescription !== undefined && item.legacyRawDescription !== item.rawDescription
        ? generateTransactionHash(item.date, item.amount, item.legacyRawDescription)
        : hash;

    const storedBefore = (item.previousKeys ?? []).some((key) =>
      existingHashSet.has(generateTransactionHash(key.date, key.amount, key.rawDescription))
    );

    if (existingHashSet.has(hash) || existingHashSet.has(legacyHash) || storedBefore) {
      skippedCount++;
    } else {
      existingHashSet.add(hash);
      const cleanDate = (item.date || '').split('T')[0].trim();
      cleanTransactionsToInsert.push({
        profileId,
        date: cleanDate,
        amount: Number(item.amount),
        rawDescription: item.rawDescription,
        merchant: item.merchant,
        category: item.category,
        monthName: item.monthName || cleanDate.slice(0, 7),
        isZeroFlagged: item.isZeroFlagged ?? 0,
        dateAmbiguous: item.dateAmbiguous ?? 0,
        counterpartyIban: item.counterpartyIban ?? null,
        txType: item.txType ?? null,
      });
    }
  }

  const { insertedCount, skippedCount: dbSkipped } = await insertTransactions(
    db,
    cleanTransactionsToInsert,
    profileId
  );

  let linkedDebtPayments = 0;
  if (insertedCount > 0) {
    try {
      linkedDebtPayments = await syncDebtPayments(db, profileId);
    } catch (error) {
      console.error('Failed to link debt payments after import:', error);
    }
  }

  let dateFrom: string | null = null;
  let dateTo: string | null = null;
  let incomeTotal = 0;
  let expenseTotal = 0;
  let ambiguousDateCount = 0;

  if (insertedCount > 0) {
    for (const tx of cleanTransactionsToInsert) {
      if (!dateFrom || tx.date < dateFrom) dateFrom = tx.date;
      if (!dateTo || tx.date > dateTo) dateTo = tx.date;
      if (tx.amount >= 0) incomeTotal += tx.amount;
      else expenseTotal += Math.abs(tx.amount);
      if (tx.dateAmbiguous) ambiguousDateCount++;
    }
  }

  return {
    totalProcessed: items.length,
    insertedCount,
    skippedCount: skippedCount + dbSkipped,
    isFirstImport: existingRows.length === 0,
    dateFrom,
    dateTo,
    incomeTotal,
    expenseTotal,
    ambiguousDateCount,
    linkedDebtPayments,
    bank,
  };
}