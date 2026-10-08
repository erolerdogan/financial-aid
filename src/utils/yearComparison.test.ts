// Run with: npx tsx src/utils/yearComparison.test.ts
import {
  MAX_COMPARE_YEARS,
  compareMonth,
  pickSeriesColors,
  resolveCompareYears,
  toggleCompareYear,
} from './yearComparison';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const same = (a: string[], b: string[]): boolean => JSON.stringify(a) === JSON.stringify(b);

const YEARS = ['2026', '2025', '2024', '2023', '2022', '2021'];

// Default (nothing picked yet)
check('default is the previous year', same(resolveCompareYears('2026', YEARS, null), ['2025']));
check('default is empty without a previous year', same(resolveCompareYears('2026', ['2026', '2024'], null), []));
check('default follows the selected year', same(resolveCompareYears('2024', YEARS, null), ['2023']));

// Explicit picks
check('explicit empty pick shows no other year', same(resolveCompareYears('2026', YEARS, []), []));
check('picks are sorted newest first', same(resolveCompareYears('2026', YEARS, ['2023', '2025']), ['2025', '2023']));
check('selected year is dropped from picks', same(resolveCompareYears('2025', YEARS, ['2025', '2024']), ['2024']));
check('years without data are dropped', same(resolveCompareYears('2026', ['2026', '2025'], ['2025', '2019']), ['2025']));
check('duplicates are dropped', same(resolveCompareYears('2026', YEARS, ['2025', '2025']), ['2025']));
check(
  'picks are capped',
  resolveCompareYears('2026', YEARS, ['2025', '2024', '2023', '2022', '2021']).length === MAX_COMPARE_YEARS
);

// Toggle
check('toggle adds a year', same(toggleCompareYear(['2025'], '2023'), ['2025', '2023']));
check('toggle keeps newest first', same(toggleCompareYear(['2023'], '2025'), ['2025', '2023']));
check('toggle removes a year', same(toggleCompareYear(['2025', '2023'], '2025'), ['2023']));
const full = ['2025', '2024', '2023', '2022'];
check('toggle ignores an add beyond the cap', same(toggleCompareYear(full, '2021'), full));
check('toggle still removes at the cap', same(toggleCompareYear(full, '2024'), ['2025', '2023', '2022']));

// Colours
const PALETTE = ['#FF9500', '#AF52DE', '#00C7BE'];
check('colours come in palette order', same(pickSeriesColors(2, PALETTE, '#007AFF'), ['#FF9500', '#AF52DE']));
check('the avoided colour is skipped', same(pickSeriesColors(2, PALETTE, '#ff9500'), ['#AF52DE', '#00C7BE']));
check('colours wrap when the palette is short', same(pickSeriesColors(3, PALETTE, '#FF9500'), ['#AF52DE', '#00C7BE', '#AF52DE']));
check('no colours for no series', pickSeriesColors(0, PALETTE, '#007AFF').length === 0);
check('empty palette', pickSeriesColors(2, [], '#007AFF').length === 0);

// Month comparison
const values = [100, 250, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const more = compareMonth(300, values, 1);
check('month spent more', more.previous === 250 && more.diff === 50);
const less = compareMonth(40, values, 0);
check('month spent less', less.previous === 100 && less.diff === -60);
check('missing year counts as zero', compareMonth(40, undefined, 0).previous === 0);
check('month outside the list counts as zero', compareMonth(40, values, 12).previous === 0);

console.log(failures === 0 ? '\nAll yearComparison tests passed.' : `\n${failures} yearComparison test(s) failed.`);
if (failures > 0) process.exit(1);
