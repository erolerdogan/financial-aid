// Run with: npx tsx src/utils/freedom.test.ts
import {
  balanceAfter,
  compareScenarios,
  feeImpact,
  incomeToBalance,
  matchScenario,
  MAX_GOAL_YEARS,
  monthlyNeeded,
  projectGrowth,
  SCENARIOS,
  summarize,
  toReal,
  toRealRows,
  yearsToReach,
  type FreedomInput,
} from './freedom';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const near = (label: string, actual: number, expected: number, tolerance = 0.01): void =>
  check(label, Math.abs(actual - expected) <= tolerance, `got ${actual.toFixed(2)}, expected ${expected.toFixed(2)}`);

const base: FreedomInput = {
  years: 35,
  lumpSum: 10000,
  monthly: 250,
  annualIncreasePct: 0.05,
  returnPct: 0.09,
  feePct: 0,
};

const run = (overrides: Partial<FreedomInput> = {}) => {
  const input = { ...base, ...overrides };
  const rows = projectGrowth(input);
  return { rows, summary: summarize(rows, input) };
};

// Reference test vector (CLAUDE.md)
{
  const { rows, summary } = run();
  check('reference: 35 rows', rows.length === 35, `got ${rows.length}`);
  near('reference: totalInvested', summary.totalInvested, 280960.92);
  near('reference: finalBalance', summary.finalBalance, 1371766.71);
  near('reference: profit', summary.profit, 1371766.71 - 280960.92, 0.02);
  near('reference: year 1 start is the lump sum', rows[0].start, 10000);
  near('reference: year 1 contributions', rows[0].contributions, 3000);
  near('reference: year 1 profit', rows[0].profit, 0.09 * (10000 + 1500));
  check(
    'reference: each year starts at the previous end',
    rows.every((row, i) => i === 0 || row.start === rows[i - 1].end),
  );
}

// 0% return
{
  const { rows, summary } = run({ returnPct: 0 });
  near('0% return: finalBalance equals totalInvested', summary.finalBalance, summary.totalInvested);
  near('0% return: profit is 0', summary.profit, 0);
  check('0% return: no yearly profit', rows.every((row) => Math.abs(row.profit) < 1e-6));
}

// 0 contributions
{
  const { rows, summary } = run({ monthly: 0 });
  near('0 contributions: totalInvested is the lump sum', summary.totalInvested, 10000);
  near('0 contributions: lump sum compounds', summary.finalBalance, 10000 * Math.pow(1.09, 35));
  check('0 contributions: every year contributes 0', rows.every((row) => row.contributions === 0));
}

// Nothing invested at all
{
  const { summary } = run({ lumpSum: 0, monthly: 0 });
  near('nothing invested: finalBalance is 0', summary.finalBalance, 0);
}

// Fee greater than return
{
  const { rows, summary } = run({ returnPct: 0.02, feePct: 0.05 });
  check('fee > return: finalBalance below totalInvested', summary.finalBalance < summary.totalInvested);
  check('fee > return: profit is negative', summary.profit < 0);
  check('fee > return: balance never negative', rows.every((row) => row.end >= 0 && row.start >= 0));
}

// Extreme fee: balance floors at 0 instead of going negative
{
  const { rows, summary } = run({ returnPct: 0, feePct: 3 });
  check('extreme fee: balance never negative', rows.every((row) => row.end >= 0 && row.start >= 0));
  check('extreme fee: finalBalance is 0', summary.finalBalance === 0, `got ${summary.finalBalance}`);
  check(
    'extreme fee: rows stay consistent',
    rows.every((row) => Math.abs(row.start + row.contributions + row.profit - row.end) < 1e-6),
  );
}

// Years clamping
{
  check('years 0 clamps to 1', run({ years: 0 }).rows.length === 1);
  check('years -5 clamps to 1', run({ years: -5 }).rows.length === 1);
  check('years 100 clamps to 60', run({ years: 100 }).rows.length === 60);
  check('years NaN clamps to 1', run({ years: Number.NaN }).rows.length === 1);
  check('years 10.4 rounds to 10', run({ years: 10.4 }).rows.length === 10);
  check('years 60 stays 60', run({ years: 60 }).rows.length === 60);
}

// Scenarios: only returnPct differs, and the balances are projectGrowth's
{
  const input = { ...base, returnPct: 0.062, feePct: 0.004 };
  const results = compareScenarios(input);
  check(
    'scenarios: 5% / 7% / 9%',
    results.map((result) => result.returnPct).join() === '0.05,0.07,0.09',
  );
  for (const result of results) {
    const rows = projectGrowth({ ...input, returnPct: result.returnPct });
    check(
      `scenarios: ${result.label} matches projectGrowth`,
      result.finalBalance === rows[rows.length - 1].end,
      `got ${result.finalBalance}`,
    );
  }
  near('scenarios: optimistic at fee 0 is the reference vector', compareScenarios(base)[2].finalBalance, 1371766.71);
  check('scenarios: input is not mutated', input.returnPct === 0.062 && input.feePct === 0.004);
  check('scenarios: 7 / 100 matches Neutral', matchScenario(7 / 100) === 'NEUTRAL');
  check('scenarios: 0.07 * 100 / 100 matches Neutral', matchScenario((0.07 * 100) / 100) === 'NEUTRAL');
  check('scenarios: 6.5% matches none', matchScenario(0.065) === null);
  check('scenarios: NaN matches none', matchScenario(Number.NaN) === null);
  check('scenarios: every preset matches itself', SCENARIOS.every((s) => matchScenario(s.returnPct) === s.key));
}

// Real value: value / (1 + inflation)^years
{
  near('real: 1000 at 2.5% over 10 years', toReal(1000, 0.025, 10), 1000 / Math.pow(1.025, 10));
  near('real: 200 at 100% over 1 year is 100', toReal(200, 1, 1), 100);
  check('real: 0% inflation leaves the value alone', toReal(1234.56, 0, 35) === 1234.56);
  check('real: 0 years leaves the value alone', toReal(1234.56, 0.025, 0) === 1234.56);
  check('real: lower than nominal', toReal(1000, 0.025, 10) < 1000);
  check('real: more years, lower value', toReal(1000, 0.025, 20) < toReal(1000, 0.025, 10));
  check('real: higher inflation, lower value', toReal(1000, 0.05, 10) < toReal(1000, 0.025, 10));
  check('real: deflation raises the value', toReal(1000, -0.01, 10) > 1000);
  check('real: NaN inflation counts as 0', toReal(1000, Number.NaN, 10) === 1000);
  check('real: NaN value is 0', toReal(Number.NaN, 0.025, 10) === 0);
  check('real: inflation of -100% or less leaves the value alone', toReal(1000, -1, 10) === 1000);
  check('real: negative years count as 0', toReal(1000, 0.025, -3) === 1000);
}

// Real rows: per-year deflation of the reference plan
{
  const { rows, summary } = run();
  const real = toRealRows(rows, 0.025);
  const realSummary = summarize(real, base);
  check('real rows: same number of rows', real.length === rows.length);
  near('real rows: final balance', realSummary.finalBalance, summary.finalBalance / Math.pow(1.025, 35));
  check('real rows: Real is lower than Nominal', realSummary.finalBalance < summary.finalBalance);
  check(
    'real rows: every year end is deflated by its own year',
    real.every((row, i) => Math.abs(row.end - rows[i].end / Math.pow(1.025, row.year)) < 1e-6),
  );
  check('real rows: every year end is lower than nominal', real.every((row, i) => row.end < rows[i].end));
  near('real rows: year 1 starts at the lump sum', real[0].start, 10000);
  check(
    'real rows: each year starts at the previous end',
    real.every((row, i) => i === 0 || row.start === real[i - 1].end),
  );
  check(
    'real rows: rows stay consistent',
    real.every((row) => Math.abs(row.start + row.contributions + row.profit - row.end) < 1e-6),
  );
  near('real rows: total invested', realSummary.totalInvested, summary.totalInvested / Math.pow(1.025, 35));
  check(
    '0% inflation: real rows equal nominal rows',
    toRealRows(rows, 0).every((row, i) => row.end === rows[i].end && Math.abs(row.profit - rows[i].profit) < 1e-6),
  );
  check('real rows: input rows are not mutated', rows[34].end === summary.finalBalance);
  check('real rows: no rows in, no rows out', toRealRows([], 0.025).length === 0);
}

// Fee impact: 0% fee vs the entered fee
{
  const impact = feeImpact({ ...base, feePct: 0.015 });
  near('fee impact: without fee is the reference vector', impact.withoutFee, 1371766.71);
  near('fee impact: with fee matches projectGrowth', impact.withFee, run({ feePct: 0.015 }).summary.finalBalance);
  check('fee impact: fee 1.5% lowers the balance', impact.withFee < impact.withoutFee);
  near('fee impact: cost is the difference', impact.cost, impact.withoutFee - impact.withFee);
  check('fee impact: cost is positive', impact.cost > 0, `got ${impact.cost.toFixed(2)}`);
  check('fee impact: 0% fee costs nothing', feeImpact(base).cost === 0);
}

// Goal: 4% rule
{
  near('4% rule: 3000 a month needs 900000', incomeToBalance(3000), 900000);
  near('4% rule: 4% of the balance a year pays the income', (incomeToBalance(1234) * 0.04) / 12, 1234);
  check('4% rule: no income, no target', incomeToBalance(0) === 0);
}

// Goal: balance at any point in time
{
  const { rows } = run();
  check(
    'balanceAfter: whole years equal the projectGrowth rows',
    rows.every((row) => balanceAfter(base, row.year) === row.end),
  );
  near('balanceAfter: year 0 is the lump sum', balanceAfter(base, 0), 10000);
  check(
    'balanceAfter: rises through the year',
    balanceAfter(base, 9) < balanceAfter(base, 9.5) && balanceAfter(base, 9.5) < balanceAfter(base, 10),
  );
  check('balanceAfter: not capped at 60 years', balanceAfter(base, 61) > balanceAfter(base, 60));
}

// Acceptance: a solver result reproduces the target within 0.5%
const within = (label: string, actual: number, target: number): void =>
  check(
    label,
    Math.abs(actual - target) <= target * 0.005,
    `got ${actual.toFixed(2)}, target ${target.toFixed(2)}, off ${(((actual - target) / target) * 100).toFixed(4)}%`,
  );

const variants: { name: string; input: FreedomInput }[] = [
  { name: 'reference', input: base },
  { name: 'no lump sum', input: { ...base, lumpSum: 0 } },
  { name: 'fee 1.5%', input: { ...base, feePct: 0.015 } },
  { name: '0% return', input: { ...base, returnPct: 0 } },
  { name: 'flat contributions', input: { ...base, annualIncreasePct: 0 } },
  { name: 'shrinking contributions', input: { ...base, annualIncreasePct: -0.03 } },
];

// Goal: years needed at the current monthly amount
{
  for (const { name, input } of variants) {
    for (const target of [50000, 900000, 2500000]) {
      const years = yearsToReach(input, target);
      if (years === null) {
        check(`yearsToReach (${name}, ${target}): out of reach`, balanceAfter(input, MAX_GOAL_YEARS) < target);
        continue;
      }
      within(`yearsToReach (${name}, ${target}): ${years.toFixed(2)} years`, balanceAfter(input, years), target);
    }
  }

  near('yearsToReach: the reference balance takes 35 years', yearsToReach(base, 1371766.71) ?? -1, 35, 0.001);
  check('yearsToReach: already reached', yearsToReach(base, 10000) === 0 && yearsToReach(base, 0) === 0);
  check('yearsToReach: ignores the plan timeframe', yearsToReach({ ...base, years: 1 }, 900000) === yearsToReach(base, 900000));
  check('yearsToReach: more per month is faster', yearsToReach({ ...base, monthly: 500 }, 900000)! < yearsToReach(base, 900000)!);
  check('yearsToReach: nothing invested never gets there', yearsToReach({ ...base, lumpSum: 0, monthly: 0 }, 1000) === null);
  check(
    'yearsToReach: no growth and no contributions never gets there',
    yearsToReach({ ...base, monthly: 0, returnPct: 0 }, 20000) === null,
  );
  check('yearsToReach: fee above the return never gets there', yearsToReach({ ...base, monthly: 0, feePct: 0.2 }, 20000) === null);

  const realYears = yearsToReach(base, 900000, 0.025);
  check('yearsToReach: a real target takes longer', realYears !== null && realYears > yearsToReach(base, 900000)!);
  within("yearsToReach: real target in today's money", toReal(balanceAfter(base, realYears ?? 0), 0.025, realYears ?? 0), 900000);
  check('yearsToReach: inflation above the growth never gets there', yearsToReach({ ...base, monthly: 0 }, 20000, 0.1) === null);
}

// Goal: monthly amount needed for a timeframe
{
  for (const { name, input } of variants) {
    for (const years of [5, 20, 35]) {
      const target = 900000;
      const monthly = monthlyNeeded(input, target, years);
      if (monthly === null) {
        check(`monthlyNeeded (${name}, ${years}y): out of reach`, false);
        continue;
      }
      const plan = { ...input, monthly, years };
      const { finalBalance } = summarize(projectGrowth(plan), plan);
      if (monthly === 0) check(`monthlyNeeded (${name}, ${years}y): lump sum is enough`, finalBalance >= target);
      else within(`monthlyNeeded (${name}, ${years}y): ${monthly.toFixed(2)} a month`, finalBalance, target);
    }
  }

  near('monthlyNeeded: the reference balance needs 250', monthlyNeeded(base, 1371766.71, 35) ?? -1, 250, 0.001);
  check('monthlyNeeded: ignores the plan monthly amount', monthlyNeeded({ ...base, monthly: 9999 }, 900000, 20) === monthlyNeeded(base, 900000, 20));
  check('monthlyNeeded: lump sum alone is enough', monthlyNeeded(base, 10000, 10) === 0);
  check('monthlyNeeded: less time needs more', monthlyNeeded(base, 900000, 10)! > monthlyNeeded(base, 900000, 30)!);
  check('monthlyNeeded: a fee that wipes out the balance is out of reach', monthlyNeeded({ ...base, feePct: 3 }, 900000, 20) === null);

  const realMonthly = monthlyNeeded(base, 900000, 20, 0.025);
  check('monthlyNeeded: a real target needs more', realMonthly !== null && realMonthly > monthlyNeeded(base, 900000, 20)!);
  within("monthlyNeeded: real target in today's money", toReal(balanceAfter({ ...base, monthly: realMonthly ?? 0 }, 20), 0.025, 20), 900000);

  // The two solvers agree with each other.
  const needed = monthlyNeeded(base, 900000, 20) ?? 0;
  near('solvers agree: that monthly amount takes 20 years', yearsToReach({ ...base, monthly: needed }, 900000) ?? -1, 20, 0.001);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
if (failures > 0) throw new Error(`${failures} freedom check(s) failed`);
