// Run with: npx tsx src/utils/pdfStatements/abnamro.test.ts
import { detectAbnAmroPdf, parseAbnAmroPdf } from './abnamro';
import { type FakeStatement, fakeStatementPages } from './fixtures';
import { numberIdenticalRows } from './numbering';
import { PdfStatementError, type PdfStatementErrorCode } from './types';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const equal = (label: string, actual: unknown, expected: unknown): void =>
  check(label, actual === expected, `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);

// Newer layout: Dutch headers, Bkdatum column, statement of 15 January (December rows are last year).
const NEWER: FakeStatement = {
  dutch: true,
  date: '15-01-2025',
  number: 1,
  previous: '1.000,00 +/CREDIT',
  next: '2.384,25 +/CREDIT',
  debit: '115,75',
  credit: '1.500,00',
  pages: [
    [
      {
        date: '30-12',
        type: 'SEPA Overboeking',
        amount: '1.500,00',
        credit: true,
        valueDate: '30-12',
        lines: [
          'IBAN: NL11TEST0000000001',
          'BIC: TESTNL2A',
          'Naam: Voorbeeld Werkgever',
          'B.V.',
          // 31 characters or more: the column is full, the next line continues mid-word.
          'Omschrijving: Salaris december 20',
          '24 periode 12',
          'Kenmerk: NOTPROVIDED',
        ],
      },
      {
        date: '31-12',
        type: 'SEPA Incasso algemeen doorlopend',
        amount: '45,00',
        // Booked on New Year's Eve, processed in January: the row stays in December.
        bkdatum: '02-01-2025',
        lines: [
          'Incassant: NL00ZZZ000000000000',
          'Naam: Fictieve Verzekeringen NV',
          'Machtiging: 1234567',
          'Omschrijving: Premie polis',
          '5678 januari',
          'IBAN: NL22TEST0000000002',
          'Kenmerk: 99887766',
        ],
      },
    ],
    [
      {
        date: '02-01',
        type: 'BEA, Apple Pay',
        amount: '12,50',
        bkdatum: '02-01-2025',
        lines: ['Bakkerij Voorbeeld 12,PAS123', 'NR:AB1234, 02.01.25/12:34', 'TESTSTAD'],
      },
      {
        date: '0 3-01',
        type: 'eCom, Apple Pay',
        amount: '8,25',
        lines: ['voorbeeldwinkel.nl TEST', '03.01.25/09:15', 'Teststad'],
      },
      { date: '04-01', type: 'Kosten 2,00 pakket', amount: '50,00' },
    ],
  ],
};

const newer = parseAbnAmroPdf(fakeStatementPages(NEWER));
check('newer layout: recognised', detectAbnAmroPdf(fakeStatementPages(NEWER)));
equal('newer layout: row count', newer.rows.length, 5);
equal('header: IBAN', newer.meta.iban, 'NL00ABNA0123456789');
equal('header: statement date', newer.meta.date, '2025-01-15');
equal('header: statement number', newer.meta.number, 1);
equal('summary: previous balance', newer.meta.previousBalance, 1000);
equal('summary: new balance', newer.meta.newBalance, 2384.25);
equal('summary: total debit', newer.meta.totalDebit, 115.75);
equal('summary: total credit', newer.meta.totalCredit, 1500);

const [salary, insurance, bakery, shop, fee] = newer.rows;
equal('year rollover: December row of a January statement', salary.date, '2024-12-30');
equal('credit amount is positive', salary.amount, 1500);
equal('counterparty IBAN', salary.counterpartyIban, 'NL11TEST0000000001');
equal('wrapped name, short line: joined with a space', salary.name, 'Voorbeeld Werkgever B.V.');
equal(
  'wrapped description, full line: glued; NOTPROVIDED dropped',
  salary.description,
  'SEPA Overboeking / Salaris december 2024 periode 12'
);
equal('Bkdatum in the next year does not move a December row', insurance.date, '2024-12-31');
equal('debit amount is negative', insurance.amount, -45);
equal('direct debit name', insurance.name, 'Fictieve Verzekeringen NV');
equal(
  'description with Kenmerk',
  insurance.description,
  'SEPA Incasso algemeen doorlopend / Premie polis 5678 januari / Kenmerk: 99887766'
);
equal('card payment: name without the card number', bakery.name, 'Bakkerij Voorbeeld 12');
equal(
  'card payment: description keeps the free lines',
  bakery.description,
  'BEA, Apple Pay / Bakkerij Voorbeeld 12,PAS123 / NR:AB1234, 02.01.25/12:34 / TESTSTAD'
);
equal('card payment: no IBAN', bakery.counterpartyIban, '');
equal('spaced date "0 3-01"', shop.date, '2025-01-03');
equal('eCom name', shop.name, 'voorbeeldwinkel.nl TEST');
equal('amount left of the debit column belongs to the description', fee.description, 'Kosten 2,00 pakket');
equal('booking without follow-up lines: name is the type', fee.name, 'Kosten 2,00 pakket');
equal('its amount is the one in the debit column', fee.amount, -50);

// Older layout: English headers, labels printed over the values in another font, a booking that
// continues on the next page, a "DIG" marker line.
const OLDER: FakeStatement = {
  overlap: true,
  date: '28-03-2023',
  number: 3,
  previous: '50,00 -/DEBIT',
  next: '129,10 +/CREDIT',
  debit: '20,90',
  credit: '200,00',
  pages: [
    [
      {
        date: '27-02',
        type: 'SEPA Overboeking',
        amount: '200,00',
        credit: true,
        valueDate: '27-02',
        lines: ['IBAN: NL33TEST0000000003', 'Naam: J Voorbeeld'],
      },
      { date: '01-03', type: 'SEPA iDEAL', amount: '20,90', valueDate: '01-03', lines: ['IBAN: NL44TEST0000000004'] },
    ],
    [{ lines: ['Naam: Webwinkel Fictief', 'Omschrijving: Bestelling 1001', 'DIG'] }],
  ],
};

const older = parseAbnAmroPdf(fakeStatementPages(OLDER));
check('older layout: recognised', detectAbnAmroPdf(fakeStatementPages(OLDER)));
equal('older layout: row count', older.rows.length, 2);
equal('older layout: debit previous balance is negative', older.meta.previousBalance, -50);
equal('older layout: statement number', older.meta.number, 3);
equal('same-year row', older.rows[0].date, '2023-02-27');
equal('value date is not part of the text', older.rows[0].name, 'J Voorbeeld');
equal('overlapping label font is ignored', older.rows[0].description, 'SEPA Overboeking');
equal('booking continues on the next page', older.rows[1].name, 'Webwinkel Fictief');
equal('"DIG" marker line skipped', older.rows[1].description, 'SEPA iDEAL / Bestelling 1001');

// Totals
const throwsCode = (label: string, statement: FakeStatement, code: PdfStatementErrorCode): void => {
  try {
    parseAbnAmroPdf(fakeStatementPages(statement));
    check(label, false, 'did not throw');
  } catch (error) {
    const ok = error instanceof PdfStatementError && error.code === code;
    check(label, ok, `got ${(error as Error).message}`);
    if (ok) check(`${label}: counts as a totals mismatch`, (error as PdfStatementError).isTotalsMismatch);
  }
};

throwsCode('total debit mismatch', { ...NEWER, debit: '115,76' }, 'TOTAL_DEBIT');
throwsCode('total credit mismatch', { ...NEWER, credit: '1.499,00' }, 'TOTAL_CREDIT');
throwsCode('new balance mismatch', { ...NEWER, next: '2.384,26 +/CREDIT' }, 'NEW_BALANCE');
// A booking that was not read (here: dropped from the page) shows up as a total that is off.
throwsCode('missing booking', { ...NEWER, pages: [NEWER.pages[0], NEWER.pages[1].slice(1)] }, 'TOTAL_DEBIT');

const mismatch = (() => {
  try {
    parseAbnAmroPdf(fakeStatementPages({ ...NEWER, debit: '120,00' }));
  } catch (error) {
    return error as PdfStatementError;
  }
  return null;
})();
equal('mismatch reports what was parsed', mismatch?.parsed, 115.75);
equal('mismatch reports what the statement prints', mismatch?.expected, 120);

// Other documents
const letter = [{ width: 595, height: 842, items: [{ str: 'Geachte heer Voorbeeld', x0: 50, x1: 150, top: 100, bottom: 109, fontName: 'f', fontSize: 9 }] }];
check('a letter is not an ABN AMRO statement', !detectAbnAmroPdf(letter));
check('no pages: not recognised', !detectAbnAmroPdf([]));
try {
  parseAbnAmroPdf(letter);
  check('letter throws NO_TABLE', false);
} catch (error) {
  check('letter throws NO_TABLE', error instanceof PdfStatementError && error.code === 'NO_TABLE');
  check('NO_TABLE is not a totals mismatch', !(error as PdfStatementError).isTotalsMismatch);
}

// Identical same-day bookings
const numbered = numberIdenticalRows([
  { date: '2025-01-03', name: 'Kiosk', description: 'BEA / Kiosk', amount: -2.5, counterpartyIban: '' },
  { date: '2025-01-02', name: 'Kiosk', description: 'BEA / Kiosk', amount: -2.5, counterpartyIban: '' },
  { date: '2025-01-03', name: 'Kiosk', description: 'BEA / Kiosk', amount: -2.5, counterpartyIban: '' },
  { date: '2025-01-03', name: 'Kiosk', description: 'BEA / Kiosk', amount: -2.5, counterpartyIban: '' },
  { date: '2025-01-03', name: 'Kiosk', description: 'BEA / Kiosk', amount: -3.5, counterpartyIban: '' },
]);
equal('numbering: sorted by date', numbered.rows.map((row) => row.date).join(), '2025-01-02,2025-01-03,2025-01-03,2025-01-03,2025-01-03');
equal(
  'numbering: repeats get (2), (3)',
  numbered.rows.map((row) => row.description).join(' | '),
  'BEA / Kiosk | BEA / Kiosk | BEA / Kiosk (2) | BEA / Kiosk (3) | BEA / Kiosk'
);
equal('numbering: count', numbered.numbered, 2);

if (failures > 0) {
  console.log(`\n${failures} checks failed`);
  process.exit(1);
}
console.log('\nAll checks passed');
