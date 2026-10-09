// Run with: npx tsx src/utils/parser.test.ts
import type { CategoryRule } from '@/db/database';
import { classifyTransaction, matchKeywords, parseCSVContent } from './parser';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const match = (text: string, allowNameOnly: boolean, incoming = false): string =>
  JSON.stringify(matchKeywords(text, { allowNameOnly, incoming }));

const hit = (category: string, keyword: string): string => JSON.stringify({ category, keyword });

// The longest keyword wins, whatever its category
check('"UBER EATS" beats "UBER"', match('UBER EATS AMSTERDAM', true) === hit('Dining Out', 'UBER EATS'), match('UBER EATS AMSTERDAM', true));
check('"UBER" alone is transport', match('UBER 123', true) === hit('Transportation', 'UBER'), match('UBER 123', true));
check('"DISNEY PLUS" beats "PLUS"', match('DISNEY PLUS', false) === hit('Utilities & Telecom', 'DISNEY PLUS'), match('DISNEY PLUS', false));
check('a longer keyword beats a name-only word', match('Shell Shop', true) === hit('Transportation', 'SHELL'), match('Shell Shop', true));

// Name-only words count in a merchant name, not in a memo
check('"PLUS" counts in a name', match('PLUS UTRECHT', true) === hit('Groceries', 'PLUS'), match('PLUS UTRECHT', true));
check('"PLUS" does not count in a memo', match('PLUS UTRECHT', false) === 'null', match('PLUS UTRECHT', false));

// Parts match inside a word, words must stand alone
check('a part matches inside a compound', match('ZORGVERZEKERING', false) === hit('Loan & Insurance', 'VERZEKER'), match('ZORGVERZEKERING', false));
check('a word matches on its own', match('GAS', true) === hit('Utilities & Telecom', 'GAS'), match('GAS', true));
check('a word does not match inside a longer word', match('GASTRONOMIE', true) === 'null', match('GASTRONOMIE', true));
check('joined names are split', match('JD3001GammaEindhoven', true) === hit('Shopping & Retail', 'GAMMA'), match('JD3001GammaEindhoven', true));

// Incoming money
check(
  'incoming: a payment-method word is skipped',
  match('OVERBOEKING SPAARREKENING', false, true) === hit('Financial Transfers', 'SPAARREKENING'),
  match('OVERBOEKING SPAARREKENING', false, true),
);
check('incoming: spending categories are skipped', match('ALBERT HEIJN 1234', false, true) === 'null', match('ALBERT HEIJN 1234', false, true));

// Nothing to find
check('no keyword, no match', match('zzz', true) === 'null');
check('empty text, no match', match('', true) === 'null');

// classifyTransaction
const PETS_RULE: CategoryRule[] = [{ id: 1, profileId: 1, keyword: 'ZQX', category: 'Pets' }];
const classify = (merchant: string, rawDescription: string, amount: number, rules: CategoryRule[] = []): string =>
  classifyTransaction({ merchant, rawDescription }, rules, { amount });

check('the bank text refines the name', classify('Amazon', 'AMAZON PRIME NL', -5) === 'Utilities & Telecom', classify('Amazon', 'AMAZON PRIME NL', -5));
check('unmatched money in is income', classify('Acme', 'SALARY', 100) === 'Income', classify('Acme', 'SALARY', 100));
check('unmatched money out is uncategorised', classify('Alba', 'ZQX', -1) === 'Uncategorised', classify('Alba', 'ZQX', -1));
check(
  'a custom rule comes first',
  classify('Alba', 'ZQX', -1, PETS_RULE) === 'Pets',
  classify('Alba', 'ZQX', -1, PETS_RULE),
);

// Date order is decided for the whole file
const read = (rows: string[], header = 'Date,Description,Amount') => parseCSVContent([header, ...rows].join('\n'), []).transactions;
const datesOf = (rows: string[]): string => read(rows).map((tx) => `${tx.date}${tx.dateAmbiguous ? '?' : ''}`).join(' ');

check('no row settles the order: day first, flagged', datesOf(['03/04/2026,A,-1', '05/06/2026,B,-2']) === '2026-04-03? 2026-06-05?', datesOf(['03/04/2026,A,-1', '05/06/2026,B,-2']));
check('one day above 12 in front: day first, not flagged', datesOf(['03/04/2026,A,-1', '25/06/2026,B,-2']) === '2026-04-03 2026-06-25', datesOf(['03/04/2026,A,-1', '25/06/2026,B,-2']));
check('one day above 12 in second place: month first on every row', datesOf(['03/04/2026,A,-1', '06/25/2026,B,-2']) === '2026-03-04 2026-06-25', datesOf(['03/04/2026,A,-1', '06/25/2026,B,-2']));
check(
  'both orders in one file: day first, the open row flagged',
  datesOf(['03/04/2026,A,-1', '06/25/2026,B,-2', '25/06/2026,C,-3']) === '2026-04-03? 2026-06-25 2026-06-25',
  datesOf(['03/04/2026,A,-1', '06/25/2026,B,-2', '25/06/2026,C,-3']),
);
check('ISO dates are never reordered', datesOf(['2026-04-03,A,-1', '2026-06-25,B,-2']) === '2026-04-03 2026-06-25');
const monthFirst = read(['03/04/2026,A,-1', '06/25/2026,B,-2']);
check(
  'a row whose date reading changed carries the earlier one as a previous key',
  JSON.stringify(monthFirst[0].previousKeys) === JSON.stringify([{ date: '2026-04-03', amount: -1, rawDescription: 'A' }]) &&
    monthFirst[1].previousKeys === undefined,
  JSON.stringify(monthFirst.map((tx) => tx.previousKeys)),
);
check('a date no calendar has is not a row', datesOf(['2026-13-45,A,-1', '2026-02-30,B,-2', '2026-02-28,C,-3']) === '2026-02-28', datesOf(['2026-13-45,A,-1', '2026-02-30,B,-2', '2026-02-28,C,-3']));

// Amount signs
const amountOf = (cell: string): number | undefined => read([`2026-01-05;SHOP;${cell}`], 'Date;Description;Amount')[0]?.amount;
for (const [cell, expected] of [
  ['-45,00', -45],
  ['€ -45,00', -45],
  ['EUR -45,00', -45],
  ['45,00-', -45],
  ['\u221245,00', -45],
  ['(45,00)', -45],
  ['€ 45,00', 45],
  ['+45,00', 45],
  ['1.234,56', 1234.56],
] as const) {
  check(`amount "${cell}" is ${expected}`, amountOf(cell) === expected, String(amountOf(cell)));
}
const moved = read(['2026-01-05;SHOP;€ -45,00'], 'Date;Description;Amount')[0];
check(
  'a row whose sign reading changed carries the earlier amount as a previous key',
  JSON.stringify(moved.previousKeys) === JSON.stringify([{ date: '2026-01-05', amount: 45, rawDescription: 'SHOP' }]),
  JSON.stringify(moved.previousKeys),
);
check('an unchanged row carries no previous key', read(['2026-01-05;SHOP;-45,00'], 'Date;Description;Amount')[0].previousKeys === undefined);

if (failures > 0) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll checks passed');
