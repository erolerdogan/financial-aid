// Run with: npx tsx src/utils/pdfStatements/crossDedup.test.ts
import { parseCSVContent } from '../parser';
import { parseAbnAmroPdf } from './abnamro';
import { crossFormatKeys, CrossFormatPool } from './crossDedup';
import { fakeStatementPages } from './fixtures';
import { pdfRowsToTransactions } from './toTransactions';
import type { PdfStatementRow } from './types';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

// The same bookings as ABN AMRO's TXT / CSV export prints them and as the PDF parser reads them.
const csvTransfer = {
  date: '2025-01-06',
  amount: -45,
  rawDescription:
    'SEPA Incasso algemeen doorlopend Incassant: NL00ZZZ000000000000  Naam: Fictieve Verzekeringen NV  IBAN: NL22TEST0000000002 Kenmerk: 99887766',
  counterpartyIban: 'NL22TEST0000000002',
};
const pdfTransfer = {
  date: '2025-01-06',
  amount: -45,
  rawDescription: 'Fictieve Verzekeringen NV SEPA Incasso algemeen doorlopend / Premie / Kenmerk: 99887766',
  counterpartyIban: 'NL22TEST0000000002',
};
const csvCard = {
  date: '2025-01-02',
  amount: -12.5,
  rawDescription: 'BEA, Apple Pay                   Bakkerij Voorbeeld 12,PAS123    NR:AB1234, 02.01.25/12:34 TESTSTAD',
  counterpartyIban: null,
};
const pdfCard = {
  date: '2025-01-02',
  amount: -12.5,
  rawDescription: 'Bakkerij Voorbeeld 12 BEA, Apple Pay / Bakkerij Voorbeeld 12,PAS123 / NR:AB1234, 02.01.25/12:34 / TESTSTAD',
  counterpartyIban: '',
};

const shares = (a: string[], b: string[]) => a.some((key) => b.includes(key));

check('transfer: CSV and PDF share a key', shares(crossFormatKeys(csvTransfer), crossFormatKeys(pdfTransfer)));
check('card payment: CSV and PDF share a key', shares(crossFormatKeys(csvCard), crossFormatKeys(pdfCard)));
check(
  'IBAN is read from the text when the column is empty (card, iDEAL, processors)',
  shares(crossFormatKeys({ ...csvTransfer, counterpartyIban: null }), crossFormatKeys(pdfTransfer))
);
check('"/IBAN/" notation', crossFormatKeys({ date: '2025-01-06', amount: -45, rawDescription: '/TRTP/SEPA/IBAN/NL22TEST0000000002/BIC/X' }).length === 1);
check('other date: no shared key', !shares(crossFormatKeys(csvTransfer), crossFormatKeys({ ...pdfTransfer, date: '2025-01-07' })));
check('other amount: no shared key', !shares(crossFormatKeys(csvTransfer), crossFormatKeys({ ...pdfTransfer, amount: -45.01 })));
check('other IBAN: no shared key', !shares(crossFormatKeys(csvTransfer), crossFormatKeys({ ...pdfTransfer, counterpartyIban: 'NL33TEST0000000003' })));
check(
  'other terminal and time: no shared key',
  !shares(crossFormatKeys(csvCard), crossFormatKeys({ ...pdfCard, rawDescription: 'BEA / NR:ZZ9999, 02.01.25/18:01' }))
);
check(
  'older time notation "12.34" equals "12:34"',
  shares(crossFormatKeys(csvCard), crossFormatKeys({ ...pdfCard, rawDescription: 'eCom 02.01.25/12.34' }))
);
check('same day, same amount, nothing else in common: no key at all', crossFormatKeys({ date: '2025-01-02', amount: -3.7, rawDescription: 'ABN AMRO Bank N.V. Basic Package 3,70' }).length === 0);

// Pool: one stored row absorbs one PDF row.
let pool = new CrossFormatPool([csvTransfer, csvCard]);
check('pool: PDF row found in the stored CSV rows', pool.take(crossFormatKeys(pdfTransfer)));
check('pool: a second identical PDF row is not absorbed by the same stored row', !pool.take(crossFormatKeys(pdfTransfer)));
check('pool: card row found', pool.take(crossFormatKeys(pdfCard)));

pool = new CrossFormatPool([csvTransfer, { ...csvTransfer, rawDescription: `${csvTransfer.rawDescription} bis` }]);
check('pool: two stored rows absorb two PDF rows', pool.take(crossFormatKeys(pdfTransfer)) && pool.take(crossFormatKeys(pdfTransfer)));
check('pool: and not a third', !pool.take(crossFormatKeys(pdfTransfer)));

// A stored row that an incoming row matched exactly is not available for another row.
pool = new CrossFormatPool([pdfTransfer]);
pool.use(0);
check('pool: stored row matched exactly is taken out', !pool.take(crossFormatKeys(pdfTransfer)));
check('pool: no keys, no match', !new CrossFormatPool([csvTransfer]).take([]));

// PDF rows take the same road as the CSV the reference script writes.
const { rows } = parseAbnAmroPdf(
  fakeStatementPages({
    date: '15-01-2025',
    number: 1,
    previous: '100,00 +/CREDIT',
    next: '1.542,50 +/CREDIT',
    debit: '57,50',
    credit: '1.500,00',
    pages: [
      [
        { date: '02-01', type: 'BEA, Apple Pay', amount: '12,50', lines: ['Bakkerij "Voorbeeld" 12,PAS123', 'NR:AB1234, 02.01.25/12:34', 'TESTSTAD'] },
        { date: '06-01', type: 'SEPA Incasso algemeen doorlopend', amount: '45,00', lines: ['Naam: Fictieve Verzekeringen NV', 'Omschrijving: Premie', 'IBAN: NL22TEST0000000002', 'Kenmerk: 99887766'] },
        { date: '10-01', type: 'SEPA Overboeking', amount: '1.500,00', credit: true, lines: ['IBAN: NL11TEST0000000001', 'Naam: Voorbeeld Werkgever B.V.', 'Omschrijving: Salaris'] },
      ],
    ],
  })
);

const quote = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
const toCsv = (list: PdfStatementRow[]) =>
  ['Date,Name,Description,Amount,Counterparty IBAN']
    .concat(list.map((row) => [row.date, row.name, row.description, row.amount.toFixed(2), row.counterpartyIban].map(quote).join(',')))
    .join('\n');

const fromPdf = pdfRowsToTransactions(rows, 'ABN_AMRO');
const fromCsv = parseCSVContent(toCsv(rows));
check('three rows read', fromPdf.transactions.length === 3);
check('bank is set', fromPdf.bank === 'ABN_AMRO');
check(
  'same rows as the CSV with these columns',
  JSON.stringify(fromPdf.transactions.map(({ crossKeys, ...rest }) => rest)) === JSON.stringify(fromCsv.transactions),
  JSON.stringify(fromPdf.transactions[0])
);
check('no previousKeys: the dedup key is the CSV one', fromPdf.transactions.every((tx) => tx.previousKeys === undefined));
check('expense is negative', fromPdf.transactions[0].amount === -12.5);
check('card row carries terminal and time keys', (fromPdf.transactions[0].crossKeys ?? []).length === 2);
check(
  'direct debit carries the IBAN key from the statement column',
  (fromPdf.transactions[1].crossKeys ?? []).includes('2025-01-06|-45.00|iban:NL22TEST0000000002'),
  JSON.stringify(fromPdf.transactions[1].crossKeys)
);
check('every PDF row carries crossKeys, even when empty', fromPdf.transactions.every((tx) => Array.isArray(tx.crossKeys)));
check('PDF direct debit matches the stored CSV row', new CrossFormatPool([csvTransfer]).take(fromPdf.transactions[1].crossKeys ?? []));
check('PDF card row matches the stored CSV row', new CrossFormatPool([csvCard]).take(fromPdf.transactions[0].crossKeys ?? []));
check('no rows', pdfRowsToTransactions([], 'ABN_AMRO').transactions.length === 0);

if (failures > 0) {
  console.log(`\n${failures} checks failed`);
  process.exit(1);
}
console.log('\nAll checks passed');
