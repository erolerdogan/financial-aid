import type { PdfItem, PdfPage, PdfStatementMeta } from './types';

// Builds made-up ABN AMRO statement pages for the tests. Every name, IBAN and amount is invented.

const CHAR = 4.5;
const DATA = 'f_data';
const LABEL = 'f_label';
const DEBIT_X0 = 408.2;
const CREDIT_X0 = 537.7;

export interface FakeBooking {
  /** As printed: "02-01", or "0 2-01" for the older gap print. */
  date: string;
  type: string;
  /** As printed: "1.234,56". */
  amount: string;
  credit?: boolean;
  /** Bkdatum column, "02-01-2025". */
  bkdatum?: string;
  /** Value date printed under the booking date, "02-01". */
  valueDate?: string;
  lines?: string[];
}

export interface FakeStatement {
  dutch?: boolean;
  /** Older PDFs: labels sit on top of the values in another font. */
  overlap?: boolean;
  iban?: string;
  /** "15-01-2025" */
  date: string;
  number: number;
  /** As printed: "1.000,00 +/CREDIT" */
  previous: string;
  next: string;
  debit: string;
  credit: string;
  /** Bookings per page; an entry of only `lines` continues the last booking of the page before. */
  pages: (FakeBooking | { lines: string[] })[][];
}

const item = (top: number, x: number, str: string, fontName = DATA, right = false, fontSize = 9): PdfItem => {
  const width = str.length * CHAR;
  const x0 = right ? x - width : x;
  return { str, x0, x1: x0 + width, top, bottom: top + fontSize, fontName, fontSize };
};

export function fakeStatementPages(statement: FakeStatement): PdfPage[] {
  const iban = statement.iban ?? 'NL00ABNA0123456789';

  return statement.pages.map((bookings, pageIndex) => {
    const items: PdfItem[] = [];
    // Margin print in the data font, turned 90 degrees.
    items.push({ ...item(399, 15.5, 'ABN AMRO Bank N.V.'), rotated: true });
    items.push(item(41, 42, 'ABN AMRO', LABEL));

    let top = 53;
    if (pageIndex === 0) {
      const labelTop = statement.overlap ? 158 : 149;
      items.push(item(labelTop, 43.7, statement.dutch ? 'Rekeningnummer' : 'Account number', LABEL, false, 8));
      items.push(item(labelTop, 179.8, 'IBAN', LABEL, false, 8));
      items.push(item(labelTop, 315.8, statement.dutch ? 'Datum' : 'Date', LABEL, false, 8));
      items.push(item(158, 43.7, '12.34.56.789'));
      items.push(item(158, 179.8, iban));
      items.push(item(158, 315.8, statement.date));
      items.push(item(159.4, 452.9, String(statement.pages.length)));
      items.push(item(158, 517.8, '1'));
      items.push(item(158, 551.7, String(statement.number).padStart(3, '0')));

      const summaryLabelTop = statement.overlap ? 186 : 177;
      items.push(item(summaryLabelTop, 43.7, statement.dutch ? 'Vorig saldo' : 'Previous balance', LABEL, false, 8));
      items.push(item(summaryLabelTop, 179.8, statement.dutch ? 'Nieuw saldo' : 'New balance', LABEL, false, 8));
      items.push(item(186, 43.7, statement.previous));
      items.push(item(186, 179.8, statement.next));
      items.push(item(186, 315.8, statement.debit));
      items.push(item(186, 452.9, statement.credit));
      top = 215;
    }

    items.push(item(top, 45.67, statement.dutch ? 'Boekdatum' : 'Bookdate', LABEL, false, 8));
    items.push(item(top + 9, 45.67, statement.dutch ? '(Rentedatum)' : '(Value date)', LABEL, false, 7));
    items.push(item(top, 100.28, statement.dutch ? 'Omschrijving' : 'Description', LABEL, false, 8));
    items.push(item(top, DEBIT_X0, statement.dutch ? 'Bedrag debet' : 'Amount debit', LABEL, false, 8));
    items.push(item(top, CREDIT_X0, statement.dutch ? 'Bedrag credit' : 'Amount credit', LABEL, false, 8));
    top += 20;

    for (const booking of bookings) {
      if ('date' in booking) {
        items.push(item(top + 0.2, 45.72, booking.date));
        items.push(item(top, 100.28, booking.type));
        items.push(item(top + 0.2, booking.credit ? 578.6 : 445.3, booking.amount, DATA, true));
        if (booking.bkdatum) items.push(item(top + 0.2, 585, booking.bkdatum));
        if (booking.valueDate) items.push(item(top + 10.4, 45.72, `(${booking.valueDate})`, DATA, false, 7));
        if (statement.overlap) items.push(item(top + 0.5, 101, 'Type', LABEL, false, 8));
        top += 11.65;
      }
      for (const line of booking.lines ?? []) {
        items.push(item(top, 100.28, line));
        top += 11.65;
      }
      top += 13;
    }

    return { width: 589.6, height: Math.max(417.5, top + 20), items };
  });
}

export const fakeMeta = (overrides: Partial<PdfStatementMeta> = {}): PdfStatementMeta => ({
  bank: 'ABN_AMRO',
  iban: 'NL00ABNA0123456789',
  date: '2025-01-15',
  year: 2025,
  number: 1,
  previousBalance: 0,
  newBalance: 0,
  totalDebit: 0,
  totalCredit: 0,
  count: 0,
  ...overrides,
});
