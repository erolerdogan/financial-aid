// Run with: npx tsx src/utils/debtPicker.test.ts
import {
  debtNameFor,
  filterPickerRows,
  keywordForTransaction,
  relatedIds,
  type PickerRow,
} from './debtPicker';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const row = (id: number, merchant: string, rawDescription = merchant, amount = -250): PickerRow => ({
  id,
  date: `2026-0${(id % 9) + 1}-05`,
  amount,
  merchant,
  rawDescription,
});

const rows: PickerRow[] = [
  row(1, 'Northwind Lening 100200301'),
  row(2, 'Northwind Lening 100200302'),
  row(3, 'NORTHWIND LENING 100200303', 'NORTHWIND LENING 100200303 TERMIJN', -310),
  row(4, 'Harbour Kredi Ödeme'),
  row(5, 'Unknown', 'Northwind Lening 100200305 incasso'),
  row(6, 'Corner Bakery'),
  row(7, 'AB'),
];

const keyword = keywordForTransaction(rows[0]);
check('a keyword is derived from the merchant', keyword === 'NORTHWIND LENING', String(keyword));

const related = relatedIds(rows, keyword ?? '');
check('reference numbers do not split a lender', [1, 2, 3].every((id) => related.includes(id)), related.join(','));
check('a row found only by its description is related too', related.includes(5));
check('another lender is not selected', !related.includes(4) && !related.includes(6));
check('a different amount still counts as related', related.includes(3));

check('the tapped row is always in its own group', rows.every((r) => {
  const k = keywordForTransaction(r);
  return k === null || relatedIds(rows, k).includes(r.id);
}));

check('a name under three characters gives no keyword', keywordForTransaction(rows[6]) === null);
check(
  'an unknown merchant falls back to the description',
  keywordForTransaction(rows[4]) === 'NORTHWIND LENING',
  String(keywordForTransaction(rows[4]))
);

check('the debt name is the merchant', debtNameFor(rows[2]) ==='NORTHWIND LENING 100200303');
check('the debt name is cut at 40 characters', debtNameFor(row(8, 'A'.repeat(60))).length === 40);
check('an unknown merchant is named after the description', debtNameFor(rows[4]).startsWith('Northwind'));

check('an empty search keeps every row', filterPickerRows(rows, '  ').length === rows.length);
check('search ignores case', filterPickerRows(rows, 'bakery').map((r) => r.id).join() === '6');
check('search ignores accents', filterPickerRows(rows, 'odeme').map((r) => r.id).join() === '4');
check('search reads the description', filterPickerRows(rows, 'incasso').map((r) => r.id).join() === '5');
check('search without a hit is empty', filterPickerRows(rows, 'zzz').length === 0);

console.log(failures === 0 ? '\nAll debtPicker tests passed.' : `\n${failures} debtPicker test(s) failed.`);
if (failures > 0) process.exit(1);
