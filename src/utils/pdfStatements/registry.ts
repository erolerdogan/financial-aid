import type { BankId } from '../bankFormats';
import { detectAbnAmroPdf, parseAbnAmroPdf } from './abnamro';
import type { PdfPage, PdfStatement } from './types';

export interface PdfStatementParser {
  bank: BankId;
  detect: (pages: PdfPage[]) => boolean;
  /** Throws `PdfStatementError` when the statement cannot be read completely. */
  parse: (pages: PdfPage[]) => PdfStatement;
}

/** PDF layouts the app can read, tried in order (like `BANK_FORMATS` for CSV / Excel). */
export const PDF_STATEMENT_PARSERS: PdfStatementParser[] = [
  { bank: 'ABN_AMRO', detect: detectAbnAmroPdf, parse: parseAbnAmroPdf },
];

/** `true` when no page carries text: a scan or a photo saved as PDF. */
export const hasNoText = (pages: PdfPage[]): boolean => pages.every((page) => page.items.length === 0);

/** The statement, or `null` when no registered layout matches. */
export function parsePdfStatement(pages: PdfPage[]): PdfStatement | null {
  const parser = PDF_STATEMENT_PARSERS.find((candidate) => candidate.detect(pages));
  return parser ? parser.parse(pages) : null;
}
