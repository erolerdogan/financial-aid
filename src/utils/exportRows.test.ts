// Run with: npx tsx src/utils/exportRows.test.ts
import Papa from 'papaparse';
import { buildExportRows, fileNamePart, safeText, type ExportLabels, type ExportTransaction } from './exportRows';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const labels: ExportLabels = {
  date: 'Datum',
  merchant: 'Naam',
  category: 'Categorie',
  amount: 'Bedrag',
  description: 'Omschrijving',
  categoryName: (name) => (name === 'Groceries' ? 'Boodschappen' : name),
};

const transactions: ExportTransaction[] = [
  { date: '2026-03-02', merchant: 'Albert Heijn', category: 'Groceries', amount: -23.45, rawDescription: 'AH 1234, "Amsterdam"' },
  { date: '2026-01-25', merchant: 'Employer BV', category: 'Income', amount: 2500, rawDescription: 'Salaris januari' },
  { date: '2026-02-10', merchant: '=HYPERLINK("http://x")', category: 'My Own', amount: -1, rawDescription: '-5 korting\nregel 2' },
];

const rows = buildExportRows(transactions, labels);

check('header row uses the labels', rows[0].join('|') === 'Datum|Naam|Categorie|Bedrag|Omschrijving');
check('one row per transaction', rows.length === transactions.length + 1);
check('oldest first', rows.slice(1).map((row) => row[0]).join(',') === '2026-01-25,2026-02-10,2026-03-02');
check('amounts stay numbers with their sign', rows[1][3] === 2500 && rows[3][3] === -23.45);
check('built-in category is translated', rows[3][2] === 'Boodschappen');
check('custom category is kept as typed', rows[2][2] === 'My Own');
check('formula in the merchant is neutralised', rows[2][1] === `'=HYPERLINK("http://x")`);
check('leading minus in the bank text is neutralised', String(rows[2][4]).startsWith(`'-5`));
check('input order is not changed', transactions[0].date === '2026-03-02');

check('safeText leaves ordinary text alone', safeText('Albert Heijn') === 'Albert Heijn');
check('safeText handles empty values', safeText(null) === '' && safeText(undefined) === '');
check('safeText covers + and @', safeText('+31 6') === `'+31 6` && safeText('@home') === `'@home`);

const csv = Papa.unparse(rows, { newline: '\r\n' });
const back = Papa.parse<string[]>(csv).data;
check('CSV survives quotes, commas and line breaks', back.length === rows.length && back[3][4] === 'AH 1234, "Amsterdam"');
check('CSV keeps a dot as the decimal separator', back[3][3] === '-23.45');

check('profile name becomes a file name part', fileNamePart('  Erol & Co. ') === 'erol-co');
check('accents are kept', fileNamePart('Zoë') === 'zoë');
check('symbols only gives an empty part', fileNamePart('***') === '');

console.log(failures === 0 ? '\nAll tests passed.' : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
