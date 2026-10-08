import type { Message } from '@/i18n';
import { PdfExtractError, PdfStatementError } from './pdfStatements/types';
import { UNSUPPORTED_MESSAGE_KEYS, UnsupportedFileError } from './statementFormat';

/** Why one file of an import was left out. */
export type ImportFailure =
  /** Not a file the app reads; `message` is one of the English messages of `statementFormat.ts`. */
  | { kind: 'unsupported'; message: string }
  /** A PDF statement whose rows do not add up to its printed totals. */
  | { kind: 'totals'; code: 'TOTAL_DEBIT' | 'TOTAL_CREDIT' | 'NEW_BALANCE'; parsed: number; expected: number }
  /** A recognised PDF statement with a part the reader did not understand. */
  | { kind: 'unreadable' }
  /** The PDF reader did not answer in time. */
  | { kind: 'timeout' }
  /** A readable file without transactions. */
  | { kind: 'empty' }
  | { kind: 'failed' };

export function describeImportFailure(error: unknown): ImportFailure {
  if (error instanceof UnsupportedFileError) return { kind: 'unsupported', message: error.message };
  if (error instanceof PdfStatementError) {
    if (
      (error.code === 'TOTAL_DEBIT' || error.code === 'TOTAL_CREDIT' || error.code === 'NEW_BALANCE') &&
      error.parsed !== undefined &&
      error.expected !== undefined
    ) {
      return { kind: 'totals', code: error.code, parsed: error.parsed, expected: error.expected };
    }
    return { kind: 'unreadable' };
  }
  if (error instanceof PdfExtractError && error.reason === 'TIMEOUT') return { kind: 'timeout' };
  return { kind: 'failed' };
}

const TOTALS_KEYS = {
  TOTAL_DEBIT: 'import.failure.totalDebit',
  TOTAL_CREDIT: 'import.failure.totalCredit',
  NEW_BALANCE: 'import.failure.newBalance',
} as const;

/** The reason as a message; `money` formats an amount in the profile's currency. */
export function importFailureMessage(failure: ImportFailure, money: (value: number) => string): Message {
  switch (failure.kind) {
    case 'unsupported':
      return { key: UNSUPPORTED_MESSAGE_KEYS[failure.message] ?? 'import.unsupported.generic' };
    case 'totals':
      return {
        key: TOTALS_KEYS[failure.code],
        params: { parsed: money(failure.parsed), expected: money(failure.expected) },
      };
    case 'unreadable':
      return { key: 'import.failure.unreadable' };
    case 'timeout':
      return { key: 'import.failure.timeout' };
    case 'empty':
      return { key: 'import.failure.empty' };
    default:
      return { key: 'import.failedMessage' };
  }
}
