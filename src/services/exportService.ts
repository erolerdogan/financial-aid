import { getAllTransactionsByDate } from '@/db/database';
import { fileDateStamp } from '@/services/backupService';
import { saveFile } from '@/services/fileSaver';
import { buildExportRows, fileNamePart, type ExportLabels } from '@/utils/exportRows';
import type { SQLiteDatabase } from 'expo-sqlite';
import Papa from 'papaparse';
import XLSX from 'xlsx';

export type ExportFormat = 'csv' | 'xlsx';

export type ExportResult = 'SAVED' | 'CANCELLED' | 'EMPTY';

export interface ExportOptions {
  profileId: number;
  profileName: string;
  format: ExportFormat;
  labels: ExportLabels;
  /** Sheet name in the Excel file. */
  sheetName: string;
}

const MIME_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// Date, merchant, category, amount, description.
const COLUMN_WIDTHS = [12, 28, 22, 12, 60];

/** Writes every transaction of the profile to a readable, unencrypted file and hands it to the system. */
export async function exportTransactions(db: SQLiteDatabase, options: ExportOptions): Promise<ExportResult> {
  // LIMIT -1 is SQLite for "no limit".
  const transactions = await getAllTransactionsByDate(db, options.profileId, '', -1);
  if (transactions.length === 0) return 'EMPTY';

  const rows = buildExportRows(transactions, options.labels);

  let bytes: Uint8Array;
  if (options.format === 'csv') {
    // The byte order mark makes Excel read the file as UTF-8.
    bytes = new TextEncoder().encode(`﻿${Papa.unparse(rows, { newline: '\r\n' })}`);
  } else {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = COLUMN_WIDTHS.map((wch) => ({ wch }));
    const workbook = XLSX.utils.book_new();
    // Excel refuses sheet names over 31 characters or with these characters.
    XLSX.utils.book_append_sheet(workbook, sheet, options.sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
    bytes = new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
  }

  const profile = fileNamePart(options.profileName);
  const name = `financial-aid-${profile ? `${profile}-` : ''}${fileDateStamp()}.${options.format}`;
  return (await saveFile(name, bytes, MIME_TYPES[options.format])) ? 'SAVED' : 'CANCELLED';
}
