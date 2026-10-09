import { debtKeywordLength, evaluateDebtKeyword, MIN_DEBT_KEYWORD_LENGTH, normalizeMatchText } from '@/utils/debt';
import { fixedMatchText } from '@/utils/fixedCost';
import { merchantRuleKeyword } from '@/utils/parser';

/** An expense the debt form offers as a payment; `amount` is as stored (negative). */
export interface PickerRow {
  id: number;
  date: string;
  amount: number;
  merchant: string;
  rawDescription: string;
}

const MAX_NAME_LENGTH = 40;

const isExact = (row: PickerRow, keyword: string): boolean =>
  evaluateDebtKeyword(row.merchant, row.rawDescription, [keyword])?.strength === 'EXACT';

/** Keyword that links this transaction and the others of its lender; `null` when its name is too short. */
export function keywordForTransaction(row: PickerRow): string | null {
  const text = fixedMatchText(row);
  const keyword = [merchantRuleKeyword(text), normalizeMatchText(text)].find(
    (candidate) => debtKeywordLength(candidate) >= MIN_DEBT_KEYWORD_LENGTH && isExact(row, candidate)
  );
  return keyword ? keyword.toUpperCase() : null;
}

/** The rows a debt with this keyword links by itself. */
export function relatedIds(rows: PickerRow[], keyword: string): number[] {
  return rows.filter((row) => isExact(row, keyword)).map((row) => row.id);
}

/** Name shown for a row, and offered as the debt name. */
export function pickerRowTitle(row: PickerRow): string {
  return (row.merchant && row.merchant !== 'Unknown' ? row.merchant : row.rawDescription).trim();
}

export const debtNameFor = (row: PickerRow): string => pickerRowTitle(row).slice(0, MAX_NAME_LENGTH).trim();

/** Search on merchant and description; case, accents and punctuation do not count. */
export function filterPickerRows(rows: PickerRow[], query: string): PickerRow[] {
  const needle = normalizeMatchText(query);
  if (!needle) return rows;
  return rows.filter((row) => normalizeMatchText(`${row.merchant} ${row.rawDescription}`).includes(needle));
}
