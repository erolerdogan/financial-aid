// Run with: npx tsx src/utils/budgetHealth.test.ts
import { DEFAULT_CATEGORY_GROUPS, DEFAULT_HOUSEHOLD, getRangesForHousehold, type Household } from '../constants/benchmarks';
import {
  addMonths,
  biggestImprovement,
  categoryStatuses,
  computeHealth,
  computeMetrics,
  daysInMonth,
  detectNetIncome,
  healthHistory,
  healthScore,
  indexMonths,
  isPartialMonth,
  normalSpend,
  pillarScores,
  previousMonthWithData,
  rangeStatus,
  scaleScore,
  type HealthDebt,
  type HealthDebtPayment,
  type HealthInput,
  type HealthMetrics,
  type HealthTransaction,
} from './budgetHealth';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const near = (label: string, actual: number | null, expected: number, tolerance = 0.01): void =>
  check(
    label,
    actual !== null && Math.abs(actual - expected) <= tolerance,
    `got ${actual === null ? 'null' : actual.toFixed(2)}, expected ${expected.toFixed(2)}`
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
  utilities?: number;
  dining?: number;
  savings?: number;
  loan?: number;
  hobby?: number;
}

const DEFAULT_MONTH: Required<MonthSpec> = {
  income: 4000,
  housing: 1200,
  groceries: 500,
  utilities: 200,
  dining: 300,
  savings: 400,
  loan: 200,
  hobby: 0,
};

/** A plain month: salary on the 25th, bills at the start, the rest spread out. */
const monthRows = (month: string, spec: MonthSpec = {}): HealthTransaction[] => {
  const m = { ...DEFAULT_MONTH, ...spec };
  const rows: HealthTransaction[] = [];
  if (m.income > 0) rows.push(tx(`${month}-25`, m.income, 'Income', true, 'Employer'));
  if (m.housing > 0) rows.push(tx(`${month}-01`, -m.housing, 'Housing', true, 'Landlord'));
  if (m.utilities > 0) rows.push(tx(`${month}-03`, -m.utilities, 'Utilities & Telecom', true, 'Energy Co'));
  if (m.loan > 0) rows.push(tx(`${month}-05`, -m.loan, 'Loan & Insurance', true, 'Car Loan'));
  if (m.groceries > 0) rows.push(tx(`${month}-10`, -m.groceries, 'Groceries', false, 'Supermarket'));
  if (m.dining > 0) rows.push(tx(`${month}-15`, -m.dining, 'Dining Out', false, 'Bistro'));
  if (m.savings > 0) rows.push(tx(`${month}-26`, -m.savings, 'Financial Transfers', true, 'Savings Account'));
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

const loanPayments = (months: string[], amount = 200, debtId = 1): HealthDebtPayment[] =>
  months.map((month) => ({ debtId, date: `${month}-05`, amount }));

const FULL_MONTHS = ['2026-06', '2026-07', '2026-08', '2026-09'];

const makeInput = (overrides: Partial<HealthInput> = {}, specs: Record<string, MonthSpec> = {}): HealthInput => ({
  transactions: FULL_MONTHS.flatMap((month) => monthRows(month, specs[month])),
  debts: [CAR_LOAN],
  debtPayments: loanPayments(FULL_MONTHS),
  categoryGroups: { ...DEFAULT_CATEGORY_GROUPS },
  household: null,
  overrides: {},
  today: TODAY,
  ...overrides,
});

const household = (overrides: Partial<Household> = {}): Household => ({ ...DEFAULT_HOUSEHOLD, ...overrides });

// --- Dates ---------------------------------------------------------------
check('addMonths forward over a year end', addMonths('2026-11', 3) === '2027-02');
check('addMonths back over a year start', addMonths('2026-01', -1) === '2025-12');
check('addMonths zero', addMonths('2026-10', 0) === '2026-10');
check('daysInMonth February in a leap year', daysInMonth('2028-02') === 29);
check('daysInMonth September', daysInMonth('2026-09') === 30);
check('current month is partial', isPartialMonth('2026-10', TODAY));
check('last month is complete', !isPartialMonth('2026-09', TODAY));

// --- Household ranges ----------------------------------------------------
{
  const base = getRangesForHousehold(null);
  check('base groceries range', base.groceries?.min === 10 && base.groceries?.max === 14);
  check('no benchmark has no range', base.none === null);

  const twoKids = getRangesForHousehold(household({ children: 2 }));
  check('two children raise the groceries max by 4', twoKids.groceries?.max === 18 && twoKids.groceries?.min === 10);
  check('two children raise the childcare max by 4', twoKids.childcare?.max === 19 && twoKids.childcare?.min === 5);

  const single = getRangesForHousehold(household({ adults: 1 }));
  check('single adult lowers groceries by 2', single.groceries?.min === 8 && single.groceries?.max === 12);

  const singleParent = getRangesForHousehold(household({ adults: 1, children: 1 }));
  check('single adult with a child', singleParent.groceries?.min === 8 && singleParent.groceries?.max === 14);

  const rent = getRangesForHousehold(household({ housingType: 'rent' }));
  const own = getRangesForHousehold(household({ housingType: 'own' }));
  check('owners and renters share the housing range', rent.housing?.min === own.housing?.min && rent.housing?.max === own.housing?.max);
  check('ranges are copies', getRangesForHousehold(null).groceries?.max === 14);
}

// --- Net income ----------------------------------------------------------
{
  const input = makeInput();
  const income = detectNetIncome(input, '2026-09');
  near('detected income is the 3-month average', income.value, 4000);
  check('detected source', income.source === 'detected');

  const varied = makeInput({}, { '2026-07': { income: 3400 }, '2026-08': { income: 4000 }, '2026-09': { income: 4600 }, '2026-06': { income: 9999 } });
  near('average uses the last three complete months only', detectNetIncome(varied, '2026-09').value, 4000);

  const withOverride = makeInput({ household: household({ netIncomeOverride: 5200 }) });
  const overridden = detectNetIncome(withOverride, '2026-09');
  check('override wins', overridden.value === 5200 && overridden.source === 'override');

  const zeroOverride = makeInput({ household: household({ netIncomeOverride: 0 }) });
  check('an override of 0 is ignored', detectNetIncome(zeroOverride, '2026-09').source === 'detected');

  const empty = makeInput({ transactions: [], debtPayments: [] });
  const none = detectNetIncome(empty, '2026-09');
  check('no transactions: no income', none.source === 'none' && none.value === 0);

  const spendingOnly = makeInput({ transactions: monthRows('2026-09', { income: 0 }) });
  check('no income transactions: source none', detectNetIncome(spendingOnly, '2026-09').source === 'none');

  // Money coming back from savings is not income.
  const savingsBack = makeInput();
  savingsBack.transactions.push(tx('2026-09-20', 3000, 'Financial Transfers', false, 'Savings Account'));
  near('money from savings is not income', detectNetIncome(savingsBack, '2026-09').value, 4000);

  // A running month takes its income from the months before it.
  const running = makeInput();
  running.transactions.push(tx('2026-10-02', -1200, 'Housing', true, 'Landlord'));
  const runningIncome = detectNetIncome(running, '2026-10');
  near('running month uses the previous complete months', runningIncome.value, 4000);

  const onlyRunning = makeInput({ transactions: [tx('2026-10-01', 2500, 'Income'), tx('2026-10-02', -900, 'Housing', true)] });
  near('a running month is used when it is all there is', detectNetIncome(onlyRunning, '2026-10').value, 2500);

  const oneMonth = makeInput({ transactions: monthRows('2026-09'), debtPayments: loanPayments(['2026-09']) });
  near('one month of data', detectNetIncome(oneMonth, '2026-09').value, 4000);

  const gap = makeInput({ transactions: [...monthRows('2026-07', { income: 3000 }), ...monthRows('2026-09', { income: 5000 })] });
  near('a month without data is left out of the average', detectNetIncome(gap, '2026-09').value, 4000);
}

// --- Categories ----------------------------------------------------------
{
  const input = makeInput();
  const statuses = categoryStatuses(input, '2026-09');
  const find = (name: string) => statuses.find((row) => row.category === name);

  const housing = find('Housing');
  near('housing share of income', housing?.pct ?? null, 30);
  check('housing within range is green', housing?.status === 'green');
  near('your normal is the average of the previous months', housing?.normal ?? null, 1200);
  near('normal as a share of income', housing?.normalPct ?? null, 30);
  check('sorted by amount', statuses[0].category === 'Housing');
  check('income is not listed as a category', !find('Income'));

  check('range status: under the minimum is still green', rangeStatus(2, { min: 5, max: 10 }, false) === 'green');
  check('range status: at the max is green', rangeStatus(10, { min: 5, max: 10 }, false) === 'green');
  check('range status: 20% above the max is yellow', rangeStatus(12, { min: 5, max: 10 }, false) === 'yellow');
  check('range status: beyond that is red', rangeStatus(12.1, { min: 5, max: 10 }, false) === 'red');
  check('range status: no range is grey', rangeStatus(12, null, false) === 'grey');
  check('range status: no income is grey', rangeStatus(null, { min: 5, max: 10 }, false) === 'grey');
  check('savings: at the minimum is green', rangeStatus(10, { min: 10, max: 20 }, true) === 'green');
  check('savings: above the max is green', rangeStatus(35, { min: 10, max: 20 }, true) === 'green');
  check('savings: a little under is yellow', rangeStatus(8, { min: 10, max: 20 }, true) === 'yellow');
  check('savings: well under is red', rangeStatus(7.9, { min: 10, max: 20 }, true) === 'red');

  const yellowDining = categoryStatuses(makeInput({}, { '2026-09': { dining: 460 } }), '2026-09').find((r) => r.category === 'Dining Out');
  check('dining at 11.5% is yellow', yellowDining?.status === 'yellow', `${yellowDining?.pct}`);
  near('normal ignores the month itself', yellowDining?.normal ?? null, 300);

  const redDining = categoryStatuses(makeInput({}, { '2026-09': { dining: 600 } }), '2026-09').find((r) => r.category === 'Dining Out');
  check('dining at 15% is red', redDining?.status === 'red');

  const savings = find('Financial Transfers');
  check('savings category is reversed', savings?.higherIsBetter === true && savings.status === 'green');
  const lowSavings = categoryStatuses(makeInput({}, { '2026-09': { savings: 200 } }), '2026-09').find((r) => r.category === 'Financial Transfers');
  check('saving 5% is red', lowSavings?.status === 'red');

  const custom = categoryStatuses(makeInput({}, { '2026-09': { hobby: 150 } }), '2026-09').find((r) => r.category === 'Hobby');
  check('custom category without a group is grey', custom?.status === 'grey' && custom.group === 'none' && custom.range === null);
  check('custom category has no earlier months: normal 0', custom?.normal === 0);

  const grouped = makeInput({}, { '2026-09': { hobby: 150 } });
  grouped.categoryGroups.Hobby = 'shopping';
  const groupedHobby = categoryStatuses(grouped, '2026-09').find((r) => r.category === 'Hobby');
  check('a group gives the custom category a range', groupedHobby?.range?.max === 6 && groupedHobby.status === 'green');

  const overridden = makeInput({ overrides: { 'Dining Out': { min: 12, max: 18 } } }, { '2026-09': { dining: 600 } });
  const overriddenDining = categoryStatuses(overridden, '2026-09').find((r) => r.category === 'Dining Out');
  check('"This is fine for us" range wins', overriddenDining?.status === 'green' && overriddenDining.overridden && overriddenDining.range?.max === 18);

  const bigFamily = makeInput({ household: household({ children: 2 }) }, { '2026-09': { groceries: 700 } });
  const plain = makeInput({}, { '2026-09': { groceries: 700 } });
  check('groceries at 17.5% is red without children', categoryStatuses(plain, '2026-09').find((r) => r.category === 'Groceries')?.status === 'red');
  check('groceries at 17.5% is green with two children', categoryStatuses(bigFamily, '2026-09').find((r) => r.category === 'Groceries')?.status === 'green');

  const noIncome = makeInput({ transactions: monthRows('2026-09', { income: 0 }) });
  const noIncomeRows = categoryStatuses(noIncome, '2026-09');
  check('without income every row is grey', noIncomeRows.length > 0 && noIncomeRows.every((row) => row.status === 'grey' && row.pct === null));

  const firstMonth = makeInput({ transactions: monthRows('2026-09') });
  check('first month has no normal', categoryStatuses(firstMonth, '2026-09').every((row) => row.normal === null));

  const dropped = makeInput({}, { '2026-09': { dining: 0 } });
  const droppedDining = categoryStatuses(dropped, '2026-09').find((r) => r.category === 'Dining Out');
  check('a category with a normal but no spend this month is still listed', droppedDining?.amount === 0 && droppedDining.normal === 300);

  near('normalSpend helper', normalSpend(indexMonths(input), 'Groceries', '2026-09'), 500);
  check('normalSpend without earlier months', normalSpend(indexMonths(input), 'Groceries', '2026-06') === null);
}

// --- Pillars and score ---------------------------------------------------
{
  near('savings: 7.5% is half', scaleScore(7.5, 0, 15), 50);
  near('savings: above 15% is capped', scaleScore(40, 0, 15), 100);
  near('savings: negative is zero', scaleScore(-5, 0, 15), 0);
  near('housing: 30% is full', scaleScore(30, 45, 30), 100);
  near('housing: 37.5% is half', scaleScore(37.5, 45, 30), 50);
  near('housing: 45% is zero', scaleScore(45, 45, 30), 0);
  near('housing: 60% stays zero', scaleScore(60, 45, 30), 0);
  near('fixed costs: 65% is half', scaleScore(65, 75, 55), 50);
  near('debt: 20% is half', scaleScore(20, 30, 10), 50);
  near('buffer: 1.5 months is half', scaleScore(1.5, 0, 3), 50);

  const input = makeInput();
  const metrics = computeMetrics(input, '2026-09');
  near('spending leaves out the transfer to savings', metrics.spending, 2400);
  near('saved', metrics.saved, 1600);
  near('savings rate', metrics.savingsRate, 40);
  near('housing share', metrics.housingPct, 30);
  near('fixed costs', metrics.fixedCosts, 1600);
  near('fixed share', metrics.fixedPct, 40);
  near('debt payments', metrics.debtPayments, 200);
  near('debt share', metrics.debtPct, 5);
  check('buffer unknown without a savings figure', metrics.bufferMonths === null);

  const pillars = pillarScores(metrics);
  check('five pillars', pillars.length === 5);
  check('weights add up to 100', pillars.reduce((sum, p) => sum + p.weight, 0) === 100);
  check('unknown buffer has no score', pillars.find((p) => p.id === 'buffer')?.score === null);
  check('healthy month scores 100 with the buffer left out', healthScore(pillars) === 100);
  check('nothing to improve at 100', biggestImprovement(pillars) === null);

  // Savings 7.5% (50), housing 37.5% (50), fixed 65% (50), debt 20% (50), buffer 1.5 months (50).
  const half: HealthMetrics = { ...metrics, savingsRate: 7.5, housingPct: 37.5, fixedPct: 65, debtPct: 20, bufferMonths: 1.5 };
  check('all pillars at half give 50', healthScore(pillarScores(half)) === 50);

  // Savings at zero, the rest full: 70 of 100 points.
  const noSavings: HealthMetrics = { ...metrics, savingsRate: 0, bufferMonths: 3 };
  check('savings pillar is worth 30 points', healthScore(pillarScores(noSavings)) === 70);
  const improvement = biggestImprovement(pillarScores(noSavings));
  check('biggest improvement is savings, +30', improvement?.pillar === 'savings' && improvement.points === 30);
  check('improvement message', improvement?.message.key === 'health.improve.savings' && improvement.message.params?.target === 15 && improvement.message.params?.points === 30);

  // Unknown buffer: the other four share the weight. Savings 0 → (85 - 30) / 85 = 64.7.
  const reweighted: HealthMetrics = { ...metrics, savingsRate: 0, bufferMonths: null };
  check('unknown buffer re-weights the others', healthScore(pillarScores(reweighted)) === 65);
  check('re-weighted improvement points', biggestImprovement(pillarScores(reweighted))?.points === 35);

  // Housing at 45% (0 of 20) against savings at 9% (60 of 100 → 12 points to gain): housing wins.
  const housingHeavy: HealthMetrics = { ...metrics, housingPct: 45, savingsRate: 9, bufferMonths: 3 };
  check('picks the pillar with the most points', biggestImprovement(pillarScores(housingHeavy))?.pillar === 'housing');

  const allUnknown: HealthMetrics = { ...metrics, savingsRate: null, housingPct: null, fixedPct: null, debtPct: null, bufferMonths: null };
  check('no known pillar: no score', healthScore(pillarScores(allUnknown)) === null);
  check('no known pillar: no improvement', biggestImprovement(pillarScores(allUnknown)) === null);
}

// --- Buffer --------------------------------------------------------------
{
  const three = computeMetrics(makeInput({ household: household({ safetySavings: 4800 }) }), '2026-09');
  near('4800 against 1600 of fixed costs is 3 months', three.bufferMonths, 3);

  const half = computeMetrics(makeInput({ household: household({ safetySavings: 2400 }) }), '2026-09');
  near('2400 is 1.5 months', half.bufferMonths, 1.5);
  near('buffer pillar at half', pillarScores(half).find((p) => p.id === 'buffer')?.score ?? null, 50);

  const zero = computeMetrics(makeInput({ household: household({ safetySavings: 0 }) }), '2026-09');
  check('a buffer of 0 is known and scores zero', zero.bufferMonths === 0 && pillarScores(zero).find((p) => p.id === 'buffer')?.score === 0);
  // 85 points full, buffer 0 of 15.
  check('score with an empty buffer', healthScore(pillarScores(zero)) === 85);

  const noFixed = makeInput({ household: household({ safetySavings: 1000 }) });
  noFixed.transactions = noFixed.transactions.map((row) => ({ ...row, isFixed: false }));
  near('savings with no fixed costs count as a full buffer', computeMetrics(noFixed, '2026-09').bufferMonths, 3);
}

// --- Debts ---------------------------------------------------------------
{
  const noDebts = makeInput({ debts: [], debtPayments: [] });
  const metrics = computeMetrics(noDebts, '2026-09');
  check('no debts: nothing paid', metrics.debtPayments === 0 && metrics.debtPct === 0);
  check('no debts: debt pillar is full', pillarScores(metrics).find((p) => p.id === 'debt')?.score === 100);

  const mortgage: HealthDebt = { ...CAR_LOAN, id: 2, name: 'Mortgage', isMortgage: true, paymentAmount: 1200 };
  const withMortgage = makeInput({ debts: [mortgage], debtPayments: loanPayments(FULL_MONTHS, 1200, 2) });
  check('mortgage payments are left out', computeMetrics(withMortgage, '2026-09').debtPayments === 0);

  const both = makeInput({
    debts: [CAR_LOAN, mortgage],
    debtPayments: [...loanPayments(FULL_MONTHS), ...loanPayments(FULL_MONTHS, 1200, 2)],
  });
  near('only the car loan counts', computeMetrics(both, '2026-09').debtPayments, 200);

  const heavy = makeInput({ debts: [{ ...CAR_LOAN, paymentAmount: 800 }], debtPayments: loanPayments(FULL_MONTHS, 800) });
  const heavyMetrics = computeMetrics(heavy, '2026-09');
  near('800 of 4000 is 20%', heavyMetrics.debtPct, 20);
  near('20% is half the debt pillar', pillarScores(heavyMetrics).find((p) => p.id === 'debt')?.score ?? null, 50);

  const unpaidPast = makeInput({ debtPayments: loanPayments(['2026-06', '2026-07', '2026-08']) });
  check('a complete month counts only what was paid', computeMetrics(unpaidPast, '2026-09').debtPayments === 0);

  // Running month: the payment has not come through yet, so the usual amount is counted.
  const running = makeInput();
  running.transactions.push(tx('2026-10-01', -1200, 'Housing', true, 'Landlord'));
  near('running month counts the payment that is still due', computeMetrics(running, '2026-10').debtPayments, 200);

  const runningPaid = makeInput({ debtPayments: [...loanPayments(FULL_MONTHS), ...loanPayments(['2026-10'], 210)] });
  runningPaid.transactions.push(tx('2026-10-05', -210, 'Loan & Insurance', true, 'Car Loan'));
  near('running month with the payment in does not count it twice', computeMetrics(runningPaid, '2026-10').debtPayments, 210);

  const paidOff = makeInput({ debts: [{ ...CAR_LOAN, active: false }] });
  paidOff.transactions.push(tx('2026-10-01', -1200, 'Housing', true, 'Landlord'));
  check('a paid-off debt expects nothing', computeMetrics(paidOff, '2026-10').debtPayments === 0);

  const future = makeInput({ debts: [{ ...CAR_LOAN, startDate: '2026-11-05' }], debtPayments: [] });
  future.transactions.push(tx('2026-10-01', -1200, 'Housing', true, 'Landlord'));
  check('a debt that starts later expects nothing yet', computeMetrics(future, '2026-10').debtPayments === 0);
}

// --- Whole result --------------------------------------------------------
{
  const result = computeHealth(makeInput(), '2026-09');
  check('normal month: enough data', result.enough && !result.partial);
  check('normal month: score 100', result.score === 100);
  check('normal month: categories listed', result.categories.length === 6);
  check('normal month: nothing to improve', result.improvement === null);

  const tight = computeHealth(makeInput({ household: household({ safetySavings: 1600 }) }, { '2026-09': { housing: 1500, dining: 900 } }), '2026-09');
  // Spending 3300 → savings 17.5% (100). Housing 37.5% (50). Fixed 1900 = 47.5% (100). Debt 5% (100). Buffer 1600 / 1600 = 1 month (33.3).
  // 30 + 10 + 15 + 20 + 5 = 80.
  check('mixed month score', tight.score === 80, `${tight.score}`);
  check('mixed month improvement is housing or buffer (+10 each): first wins', tight.improvement?.pillar === 'housing' && tight.improvement.points === 10);

  const empty = computeHealth(makeInput({ transactions: [], debts: [], debtPayments: [] }), '2026-09');
  check('no data: not enough', !empty.enough && empty.score === null && empty.improvement === null && empty.categories.length === 0);

  const noIncome = computeHealth(makeInput({ transactions: monthRows('2026-09', { income: 0 }) }), '2026-09');
  check('no income: not enough, no score', !noIncome.enough && noIncome.score === null);
  check('no income: categories still listed', noIncome.categories.length > 0);

  const overrideOnly = computeHealth(
    makeInput({ transactions: monthRows('2026-09', { income: 0 }), household: household({ netIncomeOverride: 4000 }) }),
    '2026-09'
  );
  check('typed income makes a score possible', overrideOnly.enough && overrideOnly.score === 100 && overrideOnly.income.source === 'override');

  const noMonthData = computeHealth(makeInput(), '2026-03');
  check('a month without data has no score', !noMonthData.enough && noMonthData.score === null);

  const oneMonth = computeHealth(makeInput({ transactions: monthRows('2026-09'), debtPayments: loanPayments(['2026-09']) }), '2026-09');
  check('one month of data gives a score', oneMonth.enough && oneMonth.score === 100);

  const running = makeInput();
  running.transactions.push(tx('2026-10-01', -1200, 'Housing', true, 'Landlord'), tx('2026-10-03', -200, 'Utilities & Telecom', true, 'Energy Co'));
  const partial = computeHealth(running, '2026-10');
  check('running month is flagged partial', partial.partial && partial.enough);
  near('running month income comes from earlier months', partial.income.value, 4000);
  check('running month still scores', partial.score !== null);

  const future = computeHealth(makeInput(), '2026-12');
  check('a future month is partial and has no score', future.partial && future.score === null);
}

// --- History -------------------------------------------------------------
{
  const input = makeInput({}, { '2026-08': { housing: 1800 } });
  const history = healthHistory(input, '2026-09');
  check('history has the months with data', history.map((point) => point.month).join(',') === FULL_MONTHS.join(','));
  check('history is oldest first', history[0].month === '2026-06');
  check('history scores are numbers', history.every((point) => Number.isInteger(point.score)));
  // 2026-08: housing 45% → 0 of 20, fixed 2200 = 55% (full), savings 25% (full): 65 of 85.
  check('a heavy housing month scores lower', history[2].score === 76, `${history[2].score}`);
  check('history window', healthHistory(input, '2026-09', 2).length === 2);
  check('empty history', healthHistory(makeInput({ transactions: [] }), '2026-09').length === 0);

  const index = indexMonths(input);
  check('previous month with data', previousMonthWithData(index, '2026-09') === '2026-08');
  check('no previous month', previousMonthWithData(index, '2026-06') === null);
  const gap = indexMonths(makeInput({ transactions: [...monthRows('2026-05'), ...monthRows('2026-09')] }));
  check('previous month skips gaps', previousMonthWithData(gap, '2026-09') === '2026-05');
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
if (failures > 0) process.exit(1);
