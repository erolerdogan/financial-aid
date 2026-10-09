// Run with: npx tsx src/utils/healthForecast.test.ts
import { DEFAULT_CATEGORY_GROUPS, DEFAULT_HOUSEHOLD } from '../constants/benchmarks';
import { indexMonths, type HealthDebt, type HealthInput, type HealthTransaction } from './budgetHealth';
import { forecastMonth, forecastNextMonth, forecastSample, typicalValue } from './healthForecast';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const near = (label: string, actual: number | null | undefined, expected: number, tolerance = 0.01): void =>
  check(
    label,
    typeof actual === 'number' && Math.abs(actual - expected) <= tolerance,
    `got ${typeof actual === 'number' ? actual.toFixed(2) : String(actual)}, expected ${expected.toFixed(2)}`
  );

const TODAY = '2026-10-07';
let nextId = 1;

const tx = (date: string, amount: number, category: string, isFixed = false, merchant = category): HealthTransaction => ({
  id: nextId++,
  date,
  amount,
  category,
  merchant,
  rawDescription: merchant,
  isFixed,
});

interface MonthSpec {
  income?: number;
  housing?: number;
  groceries?: number;
  dining?: number;
  hobby?: number;
}

/** Income 4000, fixed 1600 (housing, utilities, loan), flexible 800 (groceries, dining), 400 moved to savings. */
const monthRows = (month: string, spec: MonthSpec = {}): HealthTransaction[] => {
  const m = { income: 4000, housing: 1200, groceries: 500, dining: 300, hobby: 0, ...spec };
  const rows = [
    tx(`${month}-25`, m.income, 'Income', true, 'Employer'),
    tx(`${month}-01`, -m.housing, 'Housing', true, 'Landlord'),
    tx(`${month}-03`, -200, 'Utilities & Telecom', true, 'Energy Co'),
    tx(`${month}-05`, -200, 'Loan & Insurance', true, 'Car Loan'),
    tx(`${month}-10`, -m.groceries, 'Groceries', false, 'Supermarket'),
    tx(`${month}-15`, -m.dining, 'Dining Out', false, 'Bistro'),
    tx(`${month}-26`, -400, 'Financial Transfers', true, 'Savings Account'),
  ];
  if (m.hobby > 0) rows.push(tx(`${month}-12`, -m.hobby, 'Hobby', false, 'Hobby Shop'));
  return rows;
};

const CAR_LOAN: HealthDebt = {
  id: 1,
  name: 'Car loan',
  isMortgage: false,
  paymentAmount: 200,
  paymentDay: 5,
  startDate: '2025-01-05',
  active: true,
};

const SIX_MONTHS = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];

const makeInput = (
  months: string[] = SIX_MONTHS,
  specs: Record<string, MonthSpec> = {},
  overrides: Partial<HealthInput> = {}
): HealthInput => ({
  transactions: months.flatMap((month) => monthRows(month, specs[month])),
  debts: [CAR_LOAN],
  debtPayments: [],
  categoryGroups: { ...DEFAULT_CATEGORY_GROUPS },
  household: null,
  overrides: {},
  today: TODAY,
  ...overrides,
});

const everyMonth = (spec: MonthSpec): Record<string, MonthSpec> =>
  Object.fromEntries(SIX_MONTHS.map((month) => [month, spec]));

// --- Typical value -------------------------------------------------------
check('no values', typicalValue([]).value === 0);
check('fewer than four values: the median', typicalValue([1, 2, 9]).value === 2 && typicalValue([1, 2, 9]).dropped.length === 0);
{
  const oneOff = typicalValue([100, 100, 100, 100, 500]);
  check('a one-off is left out', oneOff.value === 100 && oneOff.dropped.join(',') === '4', JSON.stringify(oneOff));
  const steady = typicalValue([100, 105, 95, 110]);
  near('a steady series keeps every month', steady.value, 102.5);
  check('a steady series drops nothing', steady.dropped.length === 0);
  const rare = typicalValue([0, 0, 0, 0, 900, 0]);
  check('a cost that came once is not typical', rare.value === 0);
}

// --- Sample --------------------------------------------------------------
{
  const index = indexMonths(makeInput());
  check('forecast is for the month after the latest data', forecastMonth(index) === '2026-10');
  check('sample is the year to date', forecastSample(index, TODAY).join(',') === SIX_MONTHS.join(','));
  check('no data, no month', forecastMonth(indexMonths(makeInput([]))) === null);

  const running = indexMonths(makeInput([...SIX_MONTHS, '2026-10']));
  check('a running month moves the forecast on', forecastMonth(running) === '2026-11');
  check('a running month is not in the sample', forecastSample(running, TODAY).join(',') === SIX_MONTHS.join(','));

  const newYear = indexMonths(makeInput(['2025-09', '2025-10', '2025-11', '2025-12', '2026-01']));
  check(
    'a thin year is topped up to three months',
    forecastSample(newYear, '2026-02-10').join(',') === '2025-11,2025-12,2026-01',
    forecastSample(newYear, '2026-02-10').join(',')
  );

  const lastYear = indexMonths(makeInput(['2025-10', '2025-11', '2025-12', ...SIX_MONTHS]));
  check('earlier years are left out once the year has three months', forecastSample(lastYear, TODAY).length === 6);
}

// --- Figures -------------------------------------------------------------
{
  const plain = forecastNextMonth(makeInput());
  check('plain forecast month', plain?.month === '2026-10' && plain.from === '2026-04' && plain.to === '2026-09');
  check('plain months used', plain?.monthsUsed === 6 && plain.monthsDropped === 0);
  near('plain income', plain?.income, 4000);
  near('fixed costs leave out the savings transfer', plain?.fixed, 1600);
  near('plain flexible', plain?.flexible, 800);
  near('plain left over', plain?.leftOver, 1600);
  check('income is detected', plain?.incomeSource === 'detected');
  check('nothing to suggest in a healthy budget', plain?.improvement === null && plain.categories.length === 0);

  const oneOffs = forecastNextMonth(makeInput(SIX_MONTHS, { '2026-06': { hobby: 3000 }, '2026-07': { income: 9000 } }));
  near('a holiday does not raise flexible spending', oneOffs?.flexible, 800);
  near('a bonus from the employer is income', oneOffs?.income, 29000 / 6);
  check('the unusual spending month is counted', oneOffs?.monthsDropped === 1, `${oneOffs?.monthsDropped}`);
  check('a bonus is not a one-off payment', oneOffs?.oneOffs === 0);

  const withRows = (rows: HealthTransaction[]) => {
    const input = makeInput();
    return forecastNextMonth({ ...input, transactions: [...input.transactions, ...rows] });
  };
  const loan = withRows([tx('2026-06-14', 12000, 'Income', false, 'Credit Bank')]);
  near('a loan paid out is not income', loan?.income, 4000);
  check('the loan is reported as a one-off', loan?.oneOffs === 1, `${loan?.oneOffs}`);
  const gift = withRows([tx('2026-06-14', 600, 'Income', false, 'Aunt')]);
  near('a small one-off stays income', gift?.income, 24600 / 6);
  check('a small one-off is not reported', gift?.oneOffs === 0);
  const sideJob = withRows([tx('2026-06-14', 7000, 'Income', false, 'Client'), tx('2026-08-14', 7000, 'Income', false, 'Client')]);
  near('a large payment from a returning source is income', sideJob?.income, 38000 / 6);
  const debtCategory = withRows([tx('2026-06-14', 900, 'Loan & Insurance', false, 'Credit Bank')]);
  near('money in under a debt category is not income', debtCategory?.income, 4000);
  check('money in under a debt category is not reported', debtCategory?.oneOffs === 0);

  const short = forecastNextMonth(makeInput(['2026-07', '2026-08', '2026-09'], { '2026-09': { dining: 900 } }));
  near('three months use the median', short?.flexible, 800);
  check('three months drop nothing', short?.monthsDropped === 0);

  const running = forecastNextMonth(makeInput([...SIX_MONTHS, '2026-10'], { '2026-10': { dining: 5000 } }));
  near('a running month does not count', running?.flexible, 800);

  check('one month is not enough', forecastNextMonth(makeInput(['2026-09'])) === null);
  check('two months are enough', forecastNextMonth(makeInput(['2026-08', '2026-09'])) !== null);
  check('no income, no forecast', forecastNextMonth(makeInput(SIX_MONTHS, everyMonth({ income: 0 }))) === null);

  const typed = forecastNextMonth(
    makeInput(SIX_MONTHS, { '2026-07': { income: 9000 } }, { household: { ...DEFAULT_HOUSEHOLD, netIncomeOverride: 5000 } })
  );
  check('typed income wins', typed?.income === 5000 && typed.incomeSource === 'override');
  near('typed income left over', typed?.leftOver, 2600);
  check('typed income reports no one-offs', typed?.monthsDropped === 0 && typed.oneOffs === 0);
}

// --- Suggestions ---------------------------------------------------------
{
  // Dining 600 = 15% (max 10%), groceries 700 = 17.5% (max 14%), a hobby without a group.
  const heavy = forecastNextMonth(makeInput(SIX_MONTHS, everyMonth({ dining: 600, groceries: 700, hobby: 400 })));
  check(
    'categories above their range, largest gap first',
    heavy?.categories.map((item) => item.category).join(',') === 'Dining Out,Groceries',
    heavy?.categories.map((item) => item.category).join(',')
  );
  near('dining typical', heavy?.categories[0]?.typical, 600);
  near('dining cut', heavy?.categories[0]?.cut, 200);
  near('groceries cut', heavy?.categories[1]?.cut, 140);

  const accepted = forecastNextMonth(
    makeInput(SIX_MONTHS, everyMonth({ dining: 600 }), { overrides: { 'Dining Out': { min: 10, max: 18 } } })
  );
  check('an accepted range is not suggested', accepted?.categories.length === 0);

  const once = forecastNextMonth(makeInput(SIX_MONTHS, { '2026-08': { dining: 2000 } }));
  check('one heavy month is not a suggestion', once?.categories.length === 0);

  // Housing 1800 = 45% scores zero; fixed 2200 = 55% and savings 25% stay full; the buffer is unknown.
  const housing = forecastNextMonth(makeInput(SIX_MONTHS, everyMonth({ housing: 1800 })));
  check('pillar suggestion', housing?.improvement?.pillar === 'housing', housing?.improvement?.pillar);
  check('pillar suggestion points', housing?.improvement?.points === 24, `${housing?.improvement?.points}`);
  check('pillar suggestion is a message', housing?.improvement?.message.key === 'health.improve.housing');

  const paidOff = forecastNextMonth(
    makeInput(SIX_MONTHS, {}, { debts: [{ ...CAR_LOAN, paymentAmount: 1600 }] })
  );
  check('scheduled debt payments are judged', paidOff?.improvement?.pillar === 'debt', paidOff?.improvement?.pillar);
  const closed = forecastNextMonth(
    makeInput(SIX_MONTHS, {}, { debts: [{ ...CAR_LOAN, paymentAmount: 1600, active: false }] })
  );
  check('a paid-off debt is not', closed?.improvement === null);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
if (failures > 0) process.exit(1);
