// Run with: npx tsx src/utils/calendarNav.test.ts
import {
  clampMonth,
  isMonthDisabled,
  isYearDisabled,
  monthKey,
  monthTouchesRange,
  yearOptions,
  yearTouchesRange,
} from './calendarNav';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const same = (a: number[], b: number[]): boolean => JSON.stringify(a) === JSON.stringify(b);

const TODAY = new Date(2026, 9, 8);
const MIN = '2023-03-14';
const MAX = '2026-10-02';

// Year list
check('years run from the first to the last bound', same(yearOptions(MIN, MAX, TODAY), [2023, 2024, 2025, 2026]));
check('one year when both bounds share it', same(yearOptions('2025-02-01', '2025-11-30', TODAY), [2025]));
const open = yearOptions(null, null, TODAY);
check('no bounds: ten years back from today', open[0] === 2016 && open[open.length - 1] === 2026 && open.length === 11);
check('no max: up to the current year', same(yearOptions('2024-06-01', null, TODAY), [2024, 2025, 2026]));
check('no min: ten years before the max', yearOptions(null, '2020-01-31', TODAY)[0] === 2010);
check('min after today still gives a list', same(yearOptions('2027-01-01', null, TODAY), [2027]));

// Month keys and bounds
check('month key is zero padded', monthKey(2023, 2) === '2023-03' && monthKey(2023, 11) === '2023-12');
check('month before the first bound is disabled', isMonthDisabled('2023-02', MIN, MAX));
check('month of the first bound is enabled', !isMonthDisabled('2023-03', MIN, MAX));
check('month of the last bound is enabled', !isMonthDisabled('2026-10', MIN, MAX));
check('month after the last bound is disabled', isMonthDisabled('2026-11', MIN, MAX));
check('no bounds: every month is enabled', !isMonthDisabled('1999-01', null, null));
check('year outside the bounds is disabled', isYearDisabled(2022, MIN, MAX) && isYearDisabled(2027, MIN, MAX));
check('year inside the bounds is enabled', !isYearDisabled(2023, MIN, MAX) && !isYearDisabled(2026, MIN, MAX));

// Clamping
check('month inside the bounds is kept', clampMonth(2024, 5, MIN, MAX) === '2024-06');
check('month before the bounds moves to the first month', clampMonth(2023, 0, MIN, MAX) === '2023-03');
check('month after the bounds moves to the last month', clampMonth(2026, 11, MIN, MAX) === '2026-10');
check('no bounds: nothing is clamped', clampMonth(2030, 11, null, null) === '2030-12');

// Selection overlap
check('nothing selected touches no month', !monthTouchesRange('2024-06', null, null));
check('single day touches only its month', monthTouchesRange('2024-06', '2024-06-10', null) && !monthTouchesRange('2024-07', '2024-06-10', null));
check('range touches the months it spans', ['2024-11', '2024-12', '2025-01'].every((m) => monthTouchesRange(m, '2024-11-20', '2025-01-05')));
check('range does not touch the months around it', !monthTouchesRange('2024-10', '2024-11-20', '2025-01-05') && !monthTouchesRange('2025-02', '2024-11-20', '2025-01-05'));
check('range touches both of its years', yearTouchesRange(2024, '2024-11-20', '2025-01-05') && yearTouchesRange(2025, '2024-11-20', '2025-01-05'));
check('range does not touch other years', !yearTouchesRange(2023, '2024-11-20', '2025-01-05') && !yearTouchesRange(2026, '2024-11-20', '2025-01-05'));
check('nothing selected touches no year', !yearTouchesRange(2024, null, null));

console.log(failures === 0 ? '\nAll calendarNav tests passed.' : `\n${failures} calendarNav test(s) failed.`);
if (failures > 0) process.exit(1);
