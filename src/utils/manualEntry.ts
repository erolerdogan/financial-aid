// Pure rules of a transaction entered by hand (the "+" of the tab bar → Add expense / Add income).

export type ManualEntryType = 'expense' | 'income';

/** `txType` of a row that was typed in, not imported. Only these rows can be deleted one by one. */
export const MANUAL_TX_TYPE = 'MANUAL';

export const isManualEntryType = (value: unknown): value is ManualEntryType => value === 'expense' || value === 'income';

export const dateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * Reads a typed amount: "12,50", "12.50", "1.234,56" and "1,234.56" all work. The last separator is
 * the decimal one unless it is followed by exactly three digits and no other kind of separator is
 * there ("1.234" is one thousand), or the currency has no decimals. Null when it is not a positive amount.
 */
export function parseAmountInput(text: string, decimals: number): number | null {
  const clean = text.replace(/[\s ']/g, '');
  if (!/^\d[\d.,]*$/.test(clean) && !/^[.,]\d+$/.test(clean)) return null;

  const lastSeparator = Math.max(clean.lastIndexOf('.'), clean.lastIndexOf(','));
  let whole = clean;
  let fraction = '';
  if (lastSeparator >= 0) {
    const after = clean.slice(lastSeparator + 1);
    const mixed = clean.includes('.') && clean.includes(',');
    const repeated = clean.split(clean[lastSeparator]).length > 2;
    const thousands = decimals === 0 || repeated || (!mixed && after.length === 3 && decimals < 3);
    if (!thousands) {
      whole = clean.slice(0, lastSeparator);
      fraction = after;
    }
  }

  const value = Number(`${whole.replace(/[.,]/g, '') || '0'}.${fraction || '0'}`);
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return rounded > 0 ? rounded : null;
}

/** Expenses are stored negative, income positive. */
export const signedAmount = (type: ManualEntryType, value: number): number =>
  type === 'expense' ? -Math.abs(value) : Math.abs(value);

export type ManualEntryError = 'amount' | 'description' | 'date';

export interface ManualEntryInput {
  type: ManualEntryType;
  amountText: string;
  description: string;
  /** `YYYY-MM-DD`. */
  date: string;
}

export type ManualEntryResult =
  | { ok: true; amount: number; description: string; date: string; monthName: string }
  | { ok: false; error: ManualEntryError };

/** Checks the form and returns the row to store. `today` is `YYYY-MM-DD`; a later date is refused. */
export function buildManualEntry(input: ManualEntryInput, decimals: number, today: string): ManualEntryResult {
  const value = parseAmountInput(input.amountText, decimals);
  if (value === null) return { ok: false, error: 'amount' };
  const description = input.description.trim().replace(/\s+/g, ' ');
  if (!description) return { ok: false, error: 'description' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date > today) return { ok: false, error: 'date' };
  return {
    ok: true,
    amount: signedAmount(input.type, value),
    description,
    date: input.date,
    monthName: input.date.slice(0, 7),
  };
}
