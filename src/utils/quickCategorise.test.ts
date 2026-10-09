// Run with: npx tsx src/utils/quickCategorise.test.ts
import {
  buildSections,
  filterSections,
  ruleKeywordsFor,
  selectionState,
  toggleRow,
  toggleRows,
  visibleIds,
  type QuickGroup,
  type QuickRow,
} from './quickCategorise';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const row = (id: number, merchant: string, rawDescription = merchant): QuickRow => ({
  id,
  date: `2026-09-${String(id).padStart(2, '0')}`,
  amount: -10 * id,
  merchant,
  rawDescription,
});

const group = (
  key: string,
  ids: number[],
  total: number,
  extra: Partial<QuickGroup> = {}
): QuickGroup => ({
  key,
  title: key,
  iban: null,
  keyword: key.toUpperCase(),
  transactionIds: ids,
  total,
  suggestion: null,
  ...extra,
});

const rows = [
  row(1, 'Bakery Zonneveld'),
  row(2, 'Bakery Zonneveld'),
  row(3, 'Bakery Zonneveld', 'BAKERY ZONNEVELD TERMINAL 7'),
  row(4, 'Fietsen Molenaar'),
  row(5, 'Fietsen Molenaar'),
  row(6, 'Tandarts Vos'),
  row(7, 'Unknown', '0042'),
];
const bakery = group('Bakery Zonneveld', [1, 2, 3], 60, { suggestion: { category: 'Groceries' } });
const bikes = group('Fietsen Molenaar', [4, 5], 90);
const dentist = group('Tandarts Vos', [6], 60, { iban: 'NL00TEST0123456789' });
const groups = [bakery, bikes, dentist];

const sections = buildSections(rows, groups, 'Groceries');
check('one section per merchant plus the loose rows', sections.length === 4);
check('suggested merchant comes first', sections[0].key === bakery.key && sections[0].suggested);
check('then largest total', sections[1].key === bikes.key && sections[2].key === dentist.key);
check('loose rows last, without a group', sections[3].group === null && sections[3].data[0].id === 7);
check('rows stay with their merchant', sections[0].data.map((r) => r.id).join() === '1,2,3');
check(
  'no suggestion for another category',
  buildSections(rows, groups, 'Transport').every((section) => !section.suggested)
);
check(
  'a group with no rows left is dropped',
  buildSections(rows.slice(3), groups, 'Groceries').every((section) => section.key !== bakery.key)
);

check('empty search keeps everything', filterSections(sections, '  ') === sections);
const byMerchant = filterSections(sections, 'fietsen');
check('search by merchant keeps its rows', byMerchant.length === 1 && byMerchant[0].data.length === 2);
const byDescription = filterSections(sections, 'terminal');
check(
  'search by description keeps only the matching rows',
  byDescription.length === 1 && visibleIds(byDescription).join() === '3'
);
check('search with no match', filterSections(sections, 'qqq').length === 0);

let selected = new Set<number>();
selected = toggleRow(selected, 1);
check('toggle picks a row', selected.has(1));
check('toggle again clears it', !toggleRow(selected, 1).has(1));
check('state: some', selectionState(bakery.transactionIds, selected) === 'some');
check('state: none', selectionState(bikes.transactionIds, selected) === 'none');

check('partial merchant gives no rule', ruleKeywordsFor(groups, selected).length === 0);

selected = toggleRows(selected, bakery.transactionIds);
check('toggling a partly picked merchant picks all of it', selectionState(bakery.transactionIds, selected) === 'all');
check('full merchant gives one rule', ruleKeywordsFor(groups, selected).join() === 'BAKERY ZONNEVELD');
check('toggling a full merchant clears it', toggleRows(selected, bakery.transactionIds).size === 0);

selected = toggleRows(selected, dentist.transactionIds);
check(
  'IBAN wins over the keyword',
  ruleKeywordsFor(groups, selected).join() === 'BAKERY ZONNEVELD,NL00TEST0123456789'
);

selected = toggleRow(selected, 7);
check('loose rows never give a rule', ruleKeywordsFor(groups, selected).length === 2);

// "Select all" on a search that shows one of three bakery rows.
const partial = toggleRows(new Set<number>(), visibleIds(byDescription));
check('select all picks only the visible rows', partial.size === 1 && partial.has(3));
check('a merchant partly hidden by the search gives no rule', ruleKeywordsFor(groups, partial).length === 0);

check('nothing picked, no rules', ruleKeywordsFor(groups, new Set()).length === 0);

console.log(failures === 0 ? '\nAll quickCategorise tests passed.' : `\n${failures} quickCategorise test(s) failed.`);
if (failures > 0) process.exit(1);
