import { findOnLines, groupLines, linesText, type PdfWord, toWords } from './lines';
import { type PdfPage, type PdfStatement, PdfStatementError, type PdfStatementRow } from './types';

// Port of scripts/reference/abnamro_pdf_to_csv.py (`parse_statement`), 2023-2026 layouts.

const FIELD_RE = /^(IBAN|BIC|Naam|Omschrijving|Kenmerk|Incassant|Machtiging|Voor|Betalingskenm\.):\s*(.*)$/;
/** The description column wraps at a fixed width, often mid-word. */
const WRAP_WIDTH = 31;
const AMOUNT_RE = /^\d{1,3}(?:\.\d{3})*,\d{2}$/;
const DATE_RE = /^\d{2}-\d{2}$/;
const BOOKDATE_RE = /Bookdate|Boekdatum/;
const DEBIT_RE = /Amount\s*debit|Bedrag\s*debet/;
const CREDIT_RE = /Amount\s*credit|Bedrag\s*credit/;
// "12.04.01.312 NL60ABNA0120401312 29-05-2026 3 1 005" -> IBAN, date, statement number
const HEADER_RE = /\b(NL\d{2}[A-Z]{4}\d{10})\s+(\d{2}-\d{2}-\d{4})\s+\d+\s+\d+\s+(\d{1,4})\b/;
// Previous balance, new balance, total debit, total credit. The reference only allows "+/" before
// CREDIT / DEBIT; "-/" is accepted too (the balance check below catches a wrong reading).
const SUMMARY_RE =
  /([\d.,]+)\s*[+-]?\/?(CREDIT|DEBIT)\s+([\d.,]+)\s*[+-]?\/?(CREDIT|DEBIT)\s+([\d.,]+)\s+([\d.,]+)/;

/** "1.234,56" in cents. */
const toCents = (text: string): number => Number(text.replace(/[.,]/g, ''));

/** Older statements print some dates with a gap: "2 8-03-2024" -> "28-03-2024". */
const normalizeSpacedDates = (text: string): string =>
  text.replace(/(?<!\S)(\d) (\d-\d{2}(?:-\d{4})?)(?!\S)/g, '$1$2');

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

interface Booking {
  bookdate: string;
  cents: number;
  year: number | null;
  type: string;
  lines: string[];
}

/** The font most of the text below the table header is set in: the transaction data. */
function dominantFont(words: PdfWord[]): string | null {
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word.fontName, (counts.get(word.fontName) ?? 0) + word.text.length);
  let best: string | null = null;
  for (const [font, count] of counts) {
    if (best === null || count > (counts.get(best) ?? 0)) best = font;
  }
  return best;
}

export function detectAbnAmroPdf(pages: PdfPage[]): boolean {
  let bank = false;
  let table = false;
  for (const page of pages) {
    for (const item of page.items) {
      if (/ABN\s?AMRO|\bNL\d{2}ABNA\d{10}\b/i.test(item.str)) bank = true;
    }
    if (!table) {
      const lines = groupLines(toWords(page.items));
      table = !!findOnLines(lines, BOOKDATE_RE) && !!findOnLines(lines, DEBIT_RE);
    }
    if (bank && table) return true;
  }
  return false;
}

/**
 * Reads one statement and checks it against its printed totals and balances.
 * Throws `PdfStatementError` when the layout is not understood or the totals do not match.
 */
export function parseAbnAmroPdf(pages: PdfPage[]): PdfStatement {
  const bookings: Booking[] = [];
  let current: Booking | null = null;
  let firstText: string | null = null;

  for (const page of pages) {
    const words = toWords(page.items);
    const pageLines = groupLines(words);
    const header = findOnLines(pageLines, BOOKDATE_RE);
    if (!header) continue;

    const debit = findOnLines(pageLines, DEBIT_RE);
    const credit = findOnLines(pageLines, CREDIT_RE);
    if (!debit || !credit) throw new PdfStatementError('NO_COLUMNS');

    // Labels and values overlap in the older PDFs, so only the font of the transaction data is read.
    const font = dominantFont(words.filter((word) => word.top > header.top + 8));
    if (font === null) continue;
    const dataWords = words.filter((word) => word.fontName === font);

    if (firstText === null) {
      // Data-font text first, then the whole page (newer PDFs print the header values in another font).
      firstText = normalizeSpacedDates(`${linesText(groupLines(dataWords))}\n${linesText(pageLines)}`);
    }

    for (const line of groupLines(dataWords.filter((word) => word.top > header.top + 8))) {
      let ws = line.words;
      if (ws.length >= 2 && /^\d$/.test(ws[0].text) && /^\d-\d{2}$/.test(ws[1].text)) {
        ws = [{ ...ws[0], text: ws[0].text + ws[1].text, x1: ws[1].x1 }, ...ws.slice(2)];
      }
      const texts = ws.map((word) => word.text);
      if (texts.length === 1 && texts[0] === 'DIG') continue;

      if (DATE_RE.test(texts[0]) && ws[0].x0 < 70) {
        let cents: number | null = null;
        let year: number | null = null;
        const desc: string[] = [];
        for (const word of ws.slice(1)) {
          if (cents === null && AMOUNT_RE.test(word.text) && word.x1 > debit.x0) {
            // Debit amounts end before the credit column starts.
            cents = word.x1 <= credit.x0 + 5 ? -toCents(word.text) : toCents(word.text);
          } else if (cents === null) {
            desc.push(word.text);
          } else {
            const bkdatum = /^\d{2}-\d{2}-(\d{4})$/.exec(word.text);
            if (bkdatum) year = Number(bkdatum[1]);
          }
        }
        if (cents === null) throw new PdfStatementError('NO_AMOUNT');
        current = { bookdate: texts[0], cents, year, type: desc.join(' '), lines: [] };
        bookings.push(current);
      } else if (current) {
        const text = texts.join(' ').replace(/^\(\d{2}-\d{2}\)\s*/, ''); // value date
        if (text) current.lines.push(text);
      }
    }
  }

  if (firstText === null) throw new PdfStatementError('NO_TABLE');

  const summary = SUMMARY_RE.exec(firstText);
  if (!summary) throw new PdfStatementError('NO_SUMMARY');
  const signed = (value: string, side: string) => toCents(value) * (side === 'CREDIT' ? 1 : -1);
  const previous = signed(summary[1], summary[2]);
  const next = signed(summary[3], summary[4]);
  const totalDebit = toCents(summary[5]);
  const totalCredit = toCents(summary[6]);

  const head = HEADER_RE.exec(firstText);
  if (!head) throw new PdfStatementError('NO_HEADER');
  const iban = head[1];
  const [statementDay, statementMonth, statementYear] = head[2].split('-').map(Number);
  const statementNumber = Number(head[3]);

  const rows: PdfStatementRow[] = [];
  let debitCents = 0;
  let creditCents = 0;

  for (const booking of bookings) {
    const [day, month] = booking.bookdate.split('-').map(Number);
    let year = month > statementMonth ? statementYear - 1 : statementYear;
    if (booking.year && !(month === 12 && booking.year === year + 1)) year = booking.year;

    // A line without "Key:" continues the previous field; it is glued without a space when the
    // previous line was full width.
    const fields: Record<string, string> = {};
    const free: string[] = [];
    let last: string | null = null;
    let lastLength = 0;
    for (const line of booking.lines) {
      const field = FIELD_RE.exec(line);
      if (field) {
        last = field[1];
        fields[last] = field[2];
      } else if (last !== null) {
        fields[last] += (lastLength >= WRAP_WIDTH ? '' : ' ') + line;
      } else {
        free.push(line);
        continue;
      }
      lastLength = Array.from(line).length;
    }

    // Card payments (BEA / eCom) have no "Naam:"; the merchant is the first free line.
    const cardName = free.length > 0 ? free[0].replace(/,\s*PAS\d+.*$/, '').trim() : '';
    const memo = [booking.type];
    if (fields.Omschrijving) memo.push(fields.Omschrijving);
    memo.push(...free);
    if (fields.Kenmerk && fields.Kenmerk !== 'NOTPROVIDED') memo.push(`Kenmerk: ${fields.Kenmerk}`);

    if (booking.cents < 0) debitCents -= booking.cents;
    else creditCents += booking.cents;

    rows.push({
      date: `${pad(year, 4)}-${pad(month)}-${pad(day)}`,
      name: fields.Naam || cardName || booking.type,
      description: memo.filter(Boolean).join(' / '),
      amount: booking.cents / 100,
      counterpartyIban: fields.IBAN ?? '',
    });
  }

  if (debitCents !== totalDebit) throw new PdfStatementError('TOTAL_DEBIT', debitCents / 100, totalDebit / 100);
  if (creditCents !== totalCredit) {
    throw new PdfStatementError('TOTAL_CREDIT', creditCents / 100, totalCredit / 100);
  }
  if (previous - debitCents + creditCents !== next) {
    throw new PdfStatementError('NEW_BALANCE', (previous - debitCents + creditCents) / 100, next / 100);
  }

  return {
    rows,
    meta: {
      bank: 'ABN_AMRO',
      iban,
      date: `${pad(statementYear, 4)}-${pad(statementMonth)}-${pad(statementDay)}`,
      year: statementYear,
      number: statementNumber,
      previousBalance: previous / 100,
      newBalance: next / 100,
      totalDebit: totalDebit / 100,
      totalCredit: totalCredit / 100,
      count: rows.length,
    },
  };
}
