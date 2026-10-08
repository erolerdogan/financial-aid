import type { BankId } from '../bankFormats';

/** One run of text on a PDF page; coordinates in points from the top-left corner. */
export interface PdfItem {
  str: string;
  x0: number;
  x1: number;
  top: number;
  bottom: number;
  fontName: string;
  fontSize: number;
  /** Set on text that does not run left to right (margin print); its x1 / top are not meaningful. */
  rotated?: boolean;
}

export interface PdfPage {
  width: number;
  height: number;
  items: PdfItem[];
}

/** A text item as pdf.js returns it (`getTextContent`). */
export interface RawPdfItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}

/** A page as the WebView host and `scripts/pdf-to-items.ts` hand it over: viewport at scale 1 plus raw items. */
export interface RawPdfPage {
  width: number;
  height: number;
  /** Viewport transform (PDF space to top-left space). */
  transform: number[];
  items: RawPdfItem[];
}

/** One booking read from a PDF statement, before it goes through the import pipeline. */
export interface PdfStatementRow {
  /** `YYYY-MM-DD` */
  date: string;
  name: string;
  description: string;
  /** Expenses negative, income positive. */
  amount: number;
  counterpartyIban: string;
}

export interface PdfStatementMeta {
  bank: BankId;
  iban: string;
  /** Statement date, `YYYY-MM-DD`. */
  date: string;
  year: number;
  number: number;
  previousBalance: number;
  newBalance: number;
  totalDebit: number;
  totalCredit: number;
  count: number;
}

export interface PdfStatement {
  rows: PdfStatementRow[];
  meta: PdfStatementMeta;
}

export type PdfStatementErrorCode =
  | 'NO_TABLE'
  | 'NO_COLUMNS'
  | 'NO_SUMMARY'
  | 'NO_HEADER'
  | 'NO_AMOUNT'
  | 'TOTAL_DEBIT'
  | 'TOTAL_CREDIT'
  | 'NEW_BALANCE';

const TOTALS_CODES: PdfStatementErrorCode[] = ['TOTAL_DEBIT', 'TOTAL_CREDIT', 'NEW_BALANCE'];

/** A statement that was recognised but could not be read completely; nothing of it may be imported. */
export class PdfStatementError extends Error {
  readonly code: PdfStatementErrorCode;
  /** For the totals checks: what the rows add up to and what the statement prints. */
  readonly parsed?: number;
  readonly expected?: number;

  constructor(code: PdfStatementErrorCode, parsed?: number, expected?: number) {
    super(
      parsed !== undefined && expected !== undefined
        ? `${code}: parsed ${parsed.toFixed(2)} vs statement ${expected.toFixed(2)}`
        : code
    );
    this.name = 'PdfStatementError';
    this.code = code;
    this.parsed = parsed;
    this.expected = expected;
    Object.setPrototypeOf(this, PdfStatementError.prototype);
  }

  /** The rows do not add up to the printed totals (as opposed to a layout that was not understood). */
  get isTotalsMismatch(): boolean {
    return TOTALS_CODES.includes(this.code);
  }
}

export type PdfExtractReason = 'DAMAGED' | 'PASSWORD' | 'TIMEOUT';

/** The PDF's text could not be read at all (before any bank layout is tried). */
export class PdfExtractError extends Error {
  readonly reason: PdfExtractReason;

  constructor(reason: PdfExtractReason, detail = '') {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = 'PdfExtractError';
    this.reason = reason;
    Object.setPrototypeOf(this, PdfExtractError.prototype);
  }
}
