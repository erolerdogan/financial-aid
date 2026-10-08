import type { CategoryRule } from '@/db/database';
import type { BankId } from '../bankFormats';
import { type LearnedCategories, type ParsedStatement, parseStatementRows } from '../parser';
import { crossFormatKeys } from './crossDedup';
import type { PdfStatementRow } from './types';

/**
 * PDF rows as import rows. They go through the same reading as a CSV with the columns Date, Name,
 * Description, Amount, Counterparty IBAN, so merchant, category and the dedup key are the same as
 * for that file. Each row also carries the keys that recognise it in the bank's own CSV export.
 */
export function pdfRowsToTransactions(
  rows: PdfStatementRow[],
  bank: BankId | null,
  customRules: CategoryRule[] = [],
  learned?: LearnedCategories
): ParsedStatement {
  const parsed = parseStatementRows(rows, customRules, learned);
  if (parsed.transactions.length !== rows.length) {
    throw new Error(`Read ${parsed.transactions.length} of ${rows.length} statement rows`);
  }

  return {
    bank,
    transactions: parsed.transactions.map((transaction, index) => ({
      ...transaction,
      crossKeys: crossFormatKeys({
        date: transaction.date,
        amount: transaction.amount,
        rawDescription: transaction.rawDescription,
        counterpartyIban: rows[index].counterpartyIban,
      }),
    })),
  };
}
