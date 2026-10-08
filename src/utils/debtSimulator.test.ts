// Run with: npx tsx src/utils/debtSimulator.test.ts
import { projectDebtPayoff } from './debt';
import {
  addMonths,
  buildChartSeries,
  compareStrategies,
  extraSliderMax,
  extraSliderStep,
  isEmptyDebtPlan,
  MAX_SIM_MONTHS,
  monthsBetween,
  planToInput,
  sanitizeDebtPlan,
  simulateDebts,
  toSimDebts,
  type SimDebt,
  type SimInput,
} from './debtSimulator';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const near = (label: string, actual: number, expected: number, tolerance = 0.01): void =>
  check(label, Math.abs(actual - expected) <= tolerance, `got ${actual.toFixed(2)}, expected ${expected.toFixed(2)}`);

const START = '2026-10';

const run = (debts: SimDebt[], overrides: Partial<SimInput> = {}) =>
  simulateDebts({ debts, extraMonthly: 0, lumpSums: [], strategy: 'NONE', startMonth: START, ...overrides });

const payoff = (result: ReturnType<typeof run>, id: number) => result.debts.find((d) => d.id === id)?.payoffIndex ?? null;

// Made-up debts: A is the expensive one, B the small one, C the big cheap one.
const A: SimDebt = { id: 1, name: 'Card', balance: 6000, apr: 0.2, minPayment: 150 };
const B: SimDebt = { id: 2, name: 'Phone', balance: 1500, apr: 0.05, minPayment: 60 };
const C: SimDebt = { id: 3, name: 'Car', balance: 12000, apr: 0.08, minPayment: 280 };
const three = [A, B, C];

// Month helpers
{
  check('addMonths: same year', addMonths('2026-10', 2) === '2026-12');
  check('addMonths: over the year end', addMonths('2026-10', 3) === '2027-01');
  check('addMonths: zero', addMonths('2026-10', 0) === '2026-10');
  check('addMonths: many years', addMonths('2026-10', 600) === '2076-10');
  check('monthsBetween: forward', monthsBetween('2026-10', '2027-03') === 5);
  check('monthsBetween: backward', monthsBetween('2026-10', '2026-08') === -2);
}

// A single debt on its current payment matches the closed formula
for (const [balance, aprPercent, payment] of [
  [10000, 6.5, 320],
  [2500, 19.9, 75],
  [1500, 0, 250],
  [185000, 3.2, 900],
] as const) {
  const formula = projectDebtPayoff(balance, aprPercent, payment);
  const result = run([{ id: 1, name: 'Loan', balance, apr: aprPercent / 100, minPayment: payment }]);
  const label = `single ${balance} @ ${aprPercent}%`;
  check(`${label}: months match projectDebtPayoff`, result.months === formula.months, `got ${result.months}, formula ${formula.months}`);
  // The formula counts a full last payment, so it is never below the simulation and at most one payment above.
  const gap = (formula.totalInterest ?? 0) - result.totalInterest;
  check(`${label}: interest within one payment`, gap >= -0.01 && gap <= payment + 0.01, `gap ${gap.toFixed(2)}`);
  check(`${label}: debt-free month`, result.debtFreeMonth === addMonths(START, formula.months ?? 0));
  check(`${label}: series ends at zero`, result.series.length === (formula.months ?? 0) + 1 && result.series[result.series.length - 1] === 0);
}

// Interest of the first month
{
  const result = run([{ id: 1, name: 'Loan', balance: 1200, apr: 0.12, minPayment: 100 }]);
  near('first month: 1% interest, then the payment', result.series[1], 1200 + 12 - 100);
}

// Avalanche vs snowball order
{
  const avalanche = run(three, { strategy: 'AVALANCHE', extraMonthly: 200 });
  const snowball = run(three, { strategy: 'SNOWBALL', extraMonthly: 200 });
  const order = (result: ReturnType<typeof run>) =>
    [...result.debts].sort((x, y) => (x.payoffIndex ?? 0) - (y.payoffIndex ?? 0)).map((d) => d.id).join(',');
  check('avalanche: highest rate first', (payoff(avalanche, 1) ?? 0) < (payoff(avalanche, 2) ?? 0), order(avalanche));
  check('snowball: smallest balance first', order(snowball) === '2,1,3', order(snowball));
  check('snowball: small debt goes sooner than under avalanche', (payoff(snowball, 2) ?? 0) < (payoff(avalanche, 2) ?? 0));
  check('avalanche: never more interest than snowball', avalanche.totalInterest <= snowball.totalInterest + 0.01);
  check('both end', avalanche.months !== null && snowball.months !== null);
}

// Tie-breaks
{
  const sameRate: SimDebt[] = [
    { id: 1, name: 'Big', balance: 5000, apr: 0.1, minPayment: 100 },
    { id: 2, name: 'Small', balance: 1000, apr: 0.1, minPayment: 100 },
  ];
  const avalanche = run(sameRate, { strategy: 'AVALANCHE', extraMonthly: 300 });
  check('avalanche tie on rate: smallest balance first', (payoff(avalanche, 2) ?? 0) < (payoff(avalanche, 1) ?? 0));

  // After the first month both stand at exactly 2000: 2000 + 0 - 0 and 1600 * 1.5 - 400 (rate picked so the floats are exact).
  const sameBalance: SimDebt[] = [
    { id: 1, name: 'Cheap', balance: 2000, apr: 0, minPayment: 0 },
    { id: 2, name: 'Dear', balance: 1600, apr: 6, minPayment: 400 },
  ];
  const first = simulateDebts({ debts: sameBalance, extraMonthly: 0, lumpSums: [{ monthIndex: 1, amount: 2000 }], strategy: 'SNOWBALL', startMonth: START });
  check('snowball tie on balance: highest rate first', payoff(first, 2) === 1 && payoff(first, 1) !== 1, `dear ${payoff(first, 2)}, cheap ${payoff(first, 1)}`);
}

// Rollover: a cleared debt's payment moves to the next one
{
  const debts: SimDebt[] = [
    { id: 1, name: 'Short', balance: 300, apr: 0, minPayment: 100 },
    { id: 2, name: 'Long', balance: 1200, apr: 0, minPayment: 100 },
  ];
  const none = run(debts);
  const rolled = run(debts, { strategy: 'SNOWBALL' });
  check('no strategy: long debt takes 12 months', payoff(none, 2) === 12);
  check('no strategy: short debt takes 3 months', payoff(none, 1) === 3);
  // Months 1-3 pay 100; from month 4 the freed 100 is added: 900 left / 200 = 5 more months (4.5 rounded up).
  check('rollover: long debt done in month 8', payoff(rolled, 2) === 8, `got ${payoff(rolled, 2)}`);
  near('rollover: month 4 pays 200', rolled.series[3] - rolled.series[4], 200);
  near('no rollover in the month a debt is cleared', rolled.series[2] - rolled.series[3], 200);
}

// Spill-over within one month
{
  const debts: SimDebt[] = [
    { id: 1, name: 'Tiny', balance: 100, apr: 0, minPayment: 0 },
    { id: 2, name: 'Next', balance: 500, apr: 0, minPayment: 0 },
  ];
  const result = run(debts, { strategy: 'SNOWBALL', extraMonthly: 300 });
  check('spill: first debt cleared in month 1', payoff(result, 1) === 1);
  near('spill: the rest goes to the next debt', result.series[1], 300);
  check('spill: all done in month 2', result.months === 2);
}

// A lump sum shortens the timeline
{
  const plain = run(three, { strategy: 'AVALANCHE' });
  const lump = run(three, { strategy: 'AVALANCHE', lumpSums: [{ monthIndex: 3, amount: 4000 }] });
  check('lump sum: sooner', (lump.months ?? 999) < (plain.months ?? 0), `${lump.months} vs ${plain.months}`);
  check('lump sum: less interest', lump.totalInterest < plain.totalInterest);
  near('lump sum: unchanged before its month', lump.series[2], plain.series[2]);
  near('lump sum: applied in its month', plain.series[3] - lump.series[3], 4000);
  const ignored = run(three, { lumpSums: [{ monthIndex: 3, amount: 4000 }] });
  const baseline = run(three);
  check('no strategy: lump sums and extra are not applied', ignored.months === baseline.months);
  const bad = run(three, { strategy: 'AVALANCHE', lumpSums: [{ monthIndex: 0, amount: 500 }, { monthIndex: 2.5, amount: 500 }, { monthIndex: 4, amount: -5 }] });
  check('lump sum: invalid entries ignored', bad.months === plain.months);
}

// Zero and unknown rate
{
  const zero = run([{ id: 1, name: 'Zero', balance: 1000, apr: 0, minPayment: 100 }]);
  const unknown = run([{ id: 1, name: 'Unknown', balance: 1000, apr: null, minPayment: 100 }]);
  check('zero rate: 10 months, no interest', zero.months === 10 && zero.totalInterest === 0);
  check('zero rate: no warning', zero.warnings.length === 0);
  check('unknown rate: same numbers as zero', unknown.months === 10 && unknown.totalInterest === 0);
  check('unknown rate: flagged', unknown.warnings.length === 1 && unknown.warnings[0].code === 'RATE_UNKNOWN' && unknown.warnings[0].debtId === 1);
}

// Payment below interest
{
  const stuck: SimDebt = { id: 1, name: 'Stuck', balance: 10000, apr: 0.24, minPayment: 150 };
  const result = run([stuck]);
  check('below interest: never debt-free', result.months === null && result.debtFreeMonth === null);
  check('below interest: per-debt payoff is null', result.debts[0].payoffIndex === null && result.debts[0].payoffMonth === null);
  check('below interest: warning', result.warnings.some((w) => w.code === 'PAYMENT_BELOW_INTEREST' && w.debtId === 1));
  check('below interest: over the limit', result.warnings.some((w) => w.code === 'OVER_LIMIT' && w.debtId === null));
  check('below interest: stops at the month limit', result.series.length === MAX_SIM_MONTHS + 1);
  check('below interest: balance grows', result.series[12] > 10000);

  const rescued = run([stuck], { strategy: 'AVALANCHE', extraMonthly: 400 });
  check('below interest: extra payments clear it', rescued.months !== null);
  check('below interest: no warning once it is cleared', rescued.warnings.length === 0);

  const equal = run([{ id: 1, name: 'Equal', balance: 12000, apr: 0.12, minPayment: 120 }]);
  check('payment equal to interest: never', equal.months === null && equal.warnings.some((w) => w.code === 'PAYMENT_BELOW_INTEREST'));
  check('matches the formula: null', projectDebtPayoff(12000, 12, 120).months === null);

  const noPayment = run([{ id: 1, name: 'Idle', balance: 500, apr: 0, minPayment: 0 }]);
  check('no payment: never, flagged', noPayment.months === null && noPayment.warnings.some((w) => w.code === 'NO_PAYMENT'));
}

// A slow debt that ends just inside / outside the limit
{
  const inside = run([{ id: 1, name: 'Slow', balance: 600, apr: 0, minPayment: 1 }]);
  const outside = run([{ id: 1, name: 'Slower', balance: 601, apr: 0, minPayment: 1 }]);
  check('limit: 600 months is still reached', inside.months === 600);
  check('limit: 601 months is not', outside.months === null && outside.warnings.some((w) => w.code === 'OVER_LIMIT'));
}

// Already-paid debt and no debts
{
  const paid: SimDebt = { id: 9, name: 'Done', balance: 0, apr: 0.1, minPayment: 500 };
  const withPaid = run([paid, B], { strategy: 'AVALANCHE' });
  const alone = run([B], { strategy: 'AVALANCHE' });
  check('paid debt: payoff index 0, this month', payoff(withPaid, 9) === 0 && withPaid.debts[0].payoffMonth === START);
  check('paid debt: its old payment is not rolled over', withPaid.months === alone.months);
  check('paid debt: no warning for it', withPaid.warnings.length === 0);

  const empty = run([]);
  check('no debts: debt-free now', empty.months === 0 && empty.debtFreeMonth === START && empty.series.length === 1 && empty.series[0] === 0);
  const allPaid = run([paid]);
  check('only paid debts: debt-free now', allPaid.months === 0 && allPaid.totalInterest === 0);
}

// Extra 0
{
  const baseline = run([A]);
  const avalanche = run([A], { strategy: 'AVALANCHE' });
  const snowball = run([A], { strategy: 'SNOWBALL' });
  check('extra 0, one debt: avalanche equals baseline', avalanche.months === baseline.months);
  check('extra 0, one debt: snowball equals baseline', snowball.months === baseline.months);
  near('extra 0, one debt: same interest', avalanche.totalInterest, baseline.totalInterest);
  check('extra 0, one debt: same path', avalanche.series.every((value, i) => Math.abs(value - baseline.series[i]) < 1e-6));

  // With several debts only the rollover separates a strategy from the baseline.
  const many = run(three);
  const manyPlan = run(three, { strategy: 'AVALANCHE' });
  const firstCleared = Math.min(...manyPlan.debts.map((d) => d.payoffIndex ?? 0));
  check('extra 0, three debts: identical until the first debt is cleared', manyPlan.series.slice(0, firstCleared + 1).every((value, i) => Math.abs(value - many.series[i]) < 1e-6));
  check('extra 0, three debts: rollover is never slower', (manyPlan.months ?? 999) <= (many.months ?? 0));
  check('negative extra counts as 0', run([A], { strategy: 'AVALANCHE', extraMonthly: -50 }).months === baseline.months);
}

// compareStrategies
{
  const comparison = compareStrategies({ debts: three, extraMonthly: 200, lumpSums: [], startMonth: START });
  check('compare: baseline is the no-strategy run', comparison.baseline.months === run(three).months);
  check('compare: avalanche saves months', (comparison.diff.AVALANCHE.monthsSaved ?? 0) > 0);
  check('compare: snowball saves months', (comparison.diff.SNOWBALL.monthsSaved ?? 0) > 0);
  near('compare: interest saved', comparison.diff.AVALANCHE.interestSaved ?? 0, comparison.baseline.totalInterest - comparison.avalanche.totalInterest);
  check('compare: avalanche saves at least as much interest', (comparison.diff.AVALANCHE.interestSaved ?? 0) >= (comparison.diff.SNOWBALL.interestSaved ?? 0) - 0.01);
  check('compare: snowball clears the small debt first', comparison.diff.SNOWBALL.firstCleared?.id === 2);
  check('compare: first cleared month key', comparison.diff.SNOWBALL.firstCleared?.month === addMonths(START, comparison.diff.SNOWBALL.firstCleared?.payoffIndex ?? 0));

  const stuck = compareStrategies({ debts: [{ id: 1, name: 'Stuck', balance: 10000, apr: 0.24, minPayment: 150 }], extraMonthly: 400, lumpSums: [], startMonth: START });
  check('compare: no saving figures when the baseline never ends', stuck.diff.AVALANCHE.monthsSaved === null && stuck.diff.AVALANCHE.interestSaved === null && stuck.avalanche.months !== null);
  const none = compareStrategies({ debts: [], extraMonthly: 100, lumpSums: [], startMonth: START });
  check('compare: no debts', none.diff.AVALANCHE.monthsSaved === 0 && none.diff.AVALANCHE.firstCleared === null);
}

// Stored plan
{
  const plan = sanitizeDebtPlan(150, 'SNOWBALL', '[{"month":"2027-01","amount":1000},{"month":"2027-13","amount":5},{"month":"x","amount":5},{"month":"2027-02","amount":-1},{"month":"2027-03","amount":"7"},null,{"month":"2027-04","amount":0}]');
  check('plan: values kept', plan.extraMonthly === 150 && plan.strategy === 'SNOWBALL');
  check('plan: malformed one-off payments dropped', plan.lumpSums.length === 2 && plan.lumpSums[0].month === '2027-01' && plan.lumpSums[1].amount === 0);
  const broken = sanitizeDebtPlan('abc', 'NONE', '{not json');
  check('plan: broken values fall back', broken.extraMonthly === 0 && broken.strategy === 'AVALANCHE' && broken.lumpSums.length === 0);
  check('plan: negative extra is 0', sanitizeDebtPlan(-5, 'AVALANCHE', '[]').extraMonthly === 0);
  const many = sanitizeDebtPlan(0, 'AVALANCHE', JSON.stringify(Array.from({ length: 30 }, () => ({ month: '2027-01', amount: 1 }))));
  check('plan: one-off payments capped', many.lumpSums.length === 12);
  check('plan: empty', isEmptyDebtPlan(broken) && isEmptyDebtPlan({ ...broken, lumpSums: [{ month: '2027-01', amount: 0 }] }) && !isEmptyDebtPlan(plan));

  const input = planToInput(three, { extraMonthly: 50, strategy: 'AVALANCHE', lumpSums: [
    { month: '2026-09', amount: 100 }, { month: '2026-10', amount: 100 }, { month: '2026-11', amount: 100 }, { month: '2027-10', amount: 200 }, { month: '2027-11', amount: 0 },
  ] }, START);
  check('plan to input: past and current months dropped', input.lumpSums.length === 2);
  check('plan to input: month numbers', input.lumpSums[0].monthIndex === 1 && input.lumpSums[1].monthIndex === 12);
  check('plan to input: extra', input.extraMonthly === 50 && input.startMonth === START);
}

// Debt rows from the database shape
{
  const sim = toSimDebts([
    { id: 1, name: 'Car', balance: 8000, apr: 6.5, paymentAmount: 320, isPaidOff: false },
    { id: 2, name: 'Friend', balance: 750, apr: 0, paymentAmount: 250, isPaidOff: false },
    { id: 3, name: 'Old', balance: 0, apr: 5, paymentAmount: 100, isPaidOff: true },
  ]);
  check('rows: paid-off debts left out', sim.length === 2);
  near('rows: percent becomes a decimal', sim[0].apr ?? 0, 0.065, 1e-9);
  check('rows: rate 0 is unknown', sim[1].apr === null);
  check('rows: payment', sim[0].minPayment === 320);
}

// Slider range
{
  check('slider: twice the payments', extraSliderMax(three) === 980, `got ${extraSliderMax(three)}`);
  check('slider: at least 200', extraSliderMax([{ id: 1, name: 'x', balance: 5000, apr: 0, minPayment: 20 }]) === 200);
  check('slider: never more than is owed, rounded up to a step', extraSliderMax([{ id: 1, name: 'x', balance: 95, apr: 0, minPayment: 20 }]) === 100);
  check('slider: no debts', extraSliderMax([]) === 10);
  check('slider: step 10', extraSliderStep(980) === 10 && extraSliderStep(200) === 10 && extraSliderStep(1999) === 10);
  check('slider: larger step for big numbers', extraSliderStep(60000) === 100 && extraSliderStep(2500000) === 10000);
  const big = extraSliderMax([{ id: 1, name: 'x', balance: 9000000, apr: 0, minPayment: 31250 }]);
  check('slider: max is a multiple of its step', big === 62500 - (62500 % 100) + (62500 % 100 === 0 ? 0 : 100), `got ${big}`);
}

// Chart series
{
  const comparison = compareStrategies({ debts: three, extraMonthly: 200, lumpSums: [], startMonth: START });
  const chart = buildChartSeries(comparison.baseline, comparison.avalanche, 24);
  check('chart: thinned', chart.indexes.length <= 24 && chart.indexes.length >= 2);
  check('chart: starts today, ends at the later payoff', chart.indexes[0] === 0 && chart.indexes[chart.indexes.length - 1] === comparison.baseline.months);
  check('chart: same length for both paths', chart.baseline.length === chart.indexes.length && chart.plan.length === chart.indexes.length);
  check('chart: both start at the same balance', chart.baseline[0] === chart.plan[0]);
  check('chart: plan is at zero at the end', chart.plan[chart.plan.length - 1] === 0 && chart.baseline[chart.baseline.length - 1] === 0);
  check('chart: indexes rise', chart.indexes.every((value, i) => i === 0 || value > chart.indexes[i - 1]));
  check('chart: plan never above the baseline', chart.plan.every((value, i) => value <= chart.baseline[i] + 0.01));

  const short = run([{ id: 1, name: 'x', balance: 300, apr: 0, minPayment: 100 }]);
  const shortChart = buildChartSeries(short, short, 48);
  check('chart: short path keeps every month', shortChart.indexes.join(',') === '0,1,2,3');

  const stuck = run([{ id: 1, name: 'Stuck', balance: 10000, apr: 0.24, minPayment: 150 }]);
  const stuckChart = buildChartSeries(stuck, stuck, 48);
  check('chart: ten years when nothing ends', stuckChart.indexes[stuckChart.indexes.length - 1] === 120);
  const rescued = run([{ id: 1, name: 'Stuck', balance: 10000, apr: 0.24, minPayment: 150 }], { strategy: 'AVALANCHE', extraMonthly: 400 });
  const mixed = buildChartSeries(stuck, rescued, 48);
  check('chart: runs to the plan payoff when only the plan ends', mixed.indexes[mixed.indexes.length - 1] === rescued.months);
  const empty = run([]);
  check('chart: no debts still gives two points', buildChartSeries(empty, empty).indexes.join(',') === '0,1');
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
if (failures > 0) throw new Error(`${failures} debt simulator check(s) failed`);
