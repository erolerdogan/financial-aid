import type { PdfStatementRow } from './types';

/**
 * Rows sorted by date, with identical bookings numbered. Same date, amount and text would collapse
 * into one row on import (the dedup key); they are separate bookings (the statement totals prove
 * it), so the repeats get " (2)", " (3)". The suffix is deterministic, so a re-import still dedups.
 */
export function numberIdenticalRows(rows: PdfStatementRow[]): { rows: PdfStatementRow[]; numbered: number } {
  const sorted = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => (a.row.date < b.row.date ? -1 : a.row.date > b.row.date ? 1 : a.index - b.index))
    .map(({ row }) => row);

  const seen = new Map<string, number>();
  let numbered = 0;
  const result = sorted.map((row) => {
    const key = JSON.stringify([row.date, row.amount.toFixed(2), row.name, row.description]);
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 1) return row;
    numbered++;
    return { ...row, description: `${row.description} (${count})` };
  });

  return { rows: result, numbered };
}
