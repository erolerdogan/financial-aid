export type ExportCell = string | number;

export interface ExportTransaction {
  date: string;
  merchant: string;
  category: string;
  amount: number;
  rawDescription: string;
}

export interface ExportLabels {
  date: string;
  merchant: string;
  category: string;
  amount: string;
  description: string;
  categoryName: (name: string) => string;
}

// A spreadsheet runs a cell that starts with one of these as a formula.
const FORMULA_START = /^[=+\-@\t\r]/;

/** Bank text is not ours: keep a spreadsheet from running it as a formula. */
export function safeText(value: string | null | undefined): string {
  const text = value ?? '';
  return FORMULA_START.test(text) ? `'${text}` : text;
}

/** Header row plus one row per transaction, oldest first. Amounts stay numbers (expenses negative). */
export function buildExportRows(transactions: ExportTransaction[], labels: ExportLabels): ExportCell[][] {
  const rows: ExportCell[][] = [
    [labels.date, labels.merchant, labels.category, labels.amount, labels.description],
  ];
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const tx of sorted) {
    rows.push([
      tx.date,
      safeText(tx.merchant),
      safeText(labels.categoryName(tx.category)),
      tx.amount,
      safeText(tx.rawDescription),
    ]);
  }
  return rows;
}

/** Profile name as a file name part: letters and digits kept, the rest becomes a dash. */
export function fileNamePart(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return cleaned.slice(0, 40);
}
