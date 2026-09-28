import { insertTransactions, Transaction } from '@/db/database';
import { parseCSVContent, parseExcelContent } from '@/utils/parser';
import * as FileSystem from 'expo-file-system/legacy';
import { SQLiteDatabase } from 'expo-sqlite';

export interface ImportTransactionPayload {
  date: string;
  amount: number;
  rawDescription: string;
  merchant: string;
  category: string;
  monthName?: string;
  isZeroFlagged?: number;
  dateAmbiguous?: number;
}

export interface ImportResultSummary {
  totalProcessed: number;
  insertedCount: number;
  skippedCount: number;
}

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

export async function parseFileToTransactions(fileUri: string, fileName: string) {
  const cleanName = (fileName || '').toLowerCase();

  const cacheDir = FileSystem.cacheDirectory;
  const tempDestination = `${cacheDir}${Date.now()}_${fileName}`;

  await FileSystem.copyAsync({
    from: fileUri,
    to: tempDestination,
  });

  try {
    if (cleanName.endsWith('.xlsx') || cleanName.endsWith('.xls')) {
      const base64Data = await FileSystem.readAsStringAsync(tempDestination, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const arrayBuffer = base64ToArrayBuffer(base64Data);
      return parseExcelContent(arrayBuffer);
    } else {
      const csvText = await FileSystem.readAsStringAsync(tempDestination, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return parseCSVContent(csvText);
    }
  } finally {
    await FileSystem.deleteAsync(tempDestination, { idempotent: true });
  }
}

export async function processBatchImport(
  db: SQLiteDatabase,
  items: ImportTransactionPayload[],
  profileId: number
): Promise<ImportResultSummary> {
  if (!items || items.length === 0 || !profileId) {
    return { totalProcessed: 0, insertedCount: 0, skippedCount: 0 };
  }

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

    if (existingHashSet.has(hash)) {
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
      });
    }
  }

  const { insertedCount, skippedCount: dbSkipped } = await insertTransactions(
    db,
    cleanTransactionsToInsert,
    profileId
  );

  return {
    totalProcessed: items.length,
    insertedCount,
    skippedCount: skippedCount + dbSkipped,
  };
}