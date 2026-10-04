export type FreedomInput = {
  years: number;
  lumpSum: number;
  monthly: number;
  /** Decimals, e.g. 0.09 for 9%. */
  annualIncreasePct: number;
  returnPct: number;
  feePct: number;
};

export type YearRow = {
  year: number;
  start: number;
  contributions: number;
  profit: number;
  end: number;
  cumulativeInvested: number;
};

export type FreedomSummary = {
  totalInvested: number;
  profit: number;
  finalBalance: number;
};

export const MIN_YEARS = 1;
export const MAX_YEARS = 60;

const finite = (value: number): number => (Number.isFinite(value) ? value : 0);

const amount = (value: number): number => Math.max(0, finite(value));

export const clampYears = (years: number): number =>
  Math.min(MAX_YEARS, Math.max(MIN_YEARS, Math.round(finite(years))));

/**
 * Balance after `fraction` of a year. Contributions arrive through the year, so on average
 * half of them earn the rate.
 */
const growYear = (start: number, contributions: number, netRate: number, fraction = 1): number => {
  const paid = contributions * fraction;
  return Math.max(0, start + paid + netRate * fraction * (start + paid / 2));
};

export const projectGrowth = (input: FreedomInput): YearRow[] => {
  const years = clampYears(input.years);
  const lumpSum = amount(input.lumpSum);
  const monthly = amount(input.monthly);
  // Contributions can shrink year over year, but never below zero.
  const growth = Math.max(0, 1 + finite(input.annualIncreasePct));
  const netRate = finite(input.returnPct) - finite(input.feePct);

  const rows: YearRow[] = [];
  let start = lumpSum;
  let cumulativeInvested = lumpSum;

  for (let year = 1; year <= years; year++) {
    const contributions = monthly * 12 * Math.pow(growth, year - 1);
    const end = growYear(start, contributions, netRate);
    cumulativeInvested += contributions;
    rows.push({
      year,
      start,
      contributions,
      profit: end - start - contributions,
      end,
      cumulativeInvested,
    });
    start = end;
  }

  return rows;
};

export const summarize = (rows: YearRow[], input: FreedomInput): FreedomSummary => {
  const last = rows[rows.length - 1];
  const totalInvested = last ? last.cumulativeInvested : amount(input.lumpSum);
  const finalBalance = last ? last.end : totalInvested;
  return { totalInvested, profit: finalBalance - totalInvested, finalBalance };
};

/** `value` in today's money: `value / (1 + inflation)^years`. Deflation (a negative rate) raises it. */
export const toReal = (value: number, inflationPct: number, years: number): number => {
  const base = 1 + finite(inflationPct);
  if (base <= 0) return finite(value);
  return finite(value) / Math.pow(base, Math.max(0, finite(years)));
};

/**
 * Rows in today's money. Each year is deflated by its own year count, and a year starts where
 * the previous one ended, so `profit` is the real gain of that year (it can be negative).
 */
export const toRealRows = (rows: YearRow[], inflationPct: number): YearRow[] =>
  rows.map((row) => {
    const start = toReal(row.start, inflationPct, row.year - 1);
    const contributions = toReal(row.contributions, inflationPct, row.year);
    const end = toReal(row.end, inflationPct, row.year);
    return {
      year: row.year,
      start,
      contributions,
      profit: end - start - contributions,
      end,
      cumulativeInvested: toReal(row.cumulativeInvested, inflationPct, row.year),
    };
  });

export type FeeImpact = {
  /** Final balance with a 0% fee. */
  withoutFee: number;
  /** Final balance with the entered fee. */
  withFee: number;
  /** What the fee costs over the whole period: `withoutFee - withFee`. */
  cost: number;
};

export const feeImpact = (input: FreedomInput): FeeImpact => {
  const finalBalance = (plan: FreedomInput) => summarize(projectGrowth(plan), plan).finalBalance;
  const withoutFee = finalBalance({ ...input, feePct: 0 });
  const withFee = finalBalance(input);
  return { withoutFee, withFee, cost: withoutFee - withFee };
};

export type ScenarioKey = 'PESSIMISTIC' | 'NEUTRAL' | 'OPTIMISTIC';

export type Scenario = { key: ScenarioKey; label: string; returnPct: number };

export const SCENARIOS: Scenario[] = [
  { key: 'PESSIMISTIC', label: 'Cautious', returnPct: 0.05 },
  { key: 'NEUTRAL', label: 'Expected', returnPct: 0.07 },
  { key: 'OPTIMISTIC', label: 'Optimistic', returnPct: 0.09 },
];

/** The scenario whose return equals `returnPct`, or null for a custom return. */
export const matchScenario = (returnPct: number): ScenarioKey | null =>
  SCENARIOS.find((scenario) => Math.abs(scenario.returnPct - returnPct) < 1e-9)?.key ?? null;

export type ScenarioResult = Scenario & { finalBalance: number };

/** Final balance per scenario; everything except `returnPct` comes from `input`. */
export const compareScenarios = (input: FreedomInput): ScenarioResult[] =>
  SCENARIOS.map((scenario) => {
    const scenarioInput = { ...input, returnPct: scenario.returnPct };
    return { ...scenario, finalBalance: summarize(projectGrowth(scenarioInput), scenarioInput).finalBalance };
  });

export type GoalType = 'BALANCE' | 'INCOME';

/** The 4% rule: a balance is assumed to pay out 4% a year. An assumption, not a guarantee. */
export const SAFE_WITHDRAWAL_RATE = 0.04;

/** Balance needed for a monthly passive income: `income * 12 / 0.04`. */
export const incomeToBalance = (monthlyIncome: number): number => (amount(monthlyIncome) * 12) / SAFE_WITHDRAWAL_RATE;

/** `yearsToReach` gives up past this horizon. */
export const MAX_GOAL_YEARS = 100;

const SOLVER_STEPS = 60;

/**
 * Balance after `years`, which may be fractional and is not capped at `MAX_YEARS`.
 * Whole years equal the `end` of that `projectGrowth` row.
 */
export const balanceAfter = (input: FreedomInput, years: number): number => {
  const span = Math.max(0, finite(years));
  const monthly = amount(input.monthly);
  const growth = Math.max(0, 1 + finite(input.annualIncreasePct));
  const netRate = finite(input.returnPct) - finite(input.feePct);

  let balance = amount(input.lumpSum);
  for (let year = 1; year - 1 < span; year++) {
    const contributions = monthly * 12 * Math.pow(growth, year - 1);
    balance = growYear(balance, contributions, netRate, Math.min(1, span - (year - 1)));
  }
  return balance;
};

/**
 * Years (fractional) until the balance first reaches `target` with the plan's monthly amount;
 * `input.years` is ignored. With `inflationPct` the target is in today's money.
 * 0 when the lump sum already covers it, null when it is not reached within `MAX_GOAL_YEARS`.
 */
export const yearsToReach = (input: FreedomInput, target: number, inflationPct = 0): number | null => {
  const goal = finite(target);
  const valueAt = (years: number) => toReal(balanceAfter(input, years), inflationPct, years);
  if (valueAt(0) >= goal) return 0;

  for (let year = 1; year <= MAX_GOAL_YEARS; year++) {
    if (valueAt(year) < goal) continue;
    let low = year - 1;
    let high = year;
    for (let step = 0; step < SOLVER_STEPS; step++) {
      const mid = (low + high) / 2;
      if (valueAt(mid) >= goal) high = mid;
      else low = mid;
    }
    return high;
  }
  return null;
};

/**
 * Monthly amount (first year; later years follow `annualIncreasePct`) that reaches `target`
 * after `years`; `input.monthly` and `input.years` are ignored. With `inflationPct` the target
 * is in today's money. 0 when the lump sum alone gets there, null when no amount does.
 */
export const monthlyNeeded = (
  input: FreedomInput,
  target: number,
  years: number,
  inflationPct = 0
): number | null => {
  const span = clampYears(years);
  const goal = finite(target) * Math.pow(Math.max(0, 1 + finite(inflationPct)), span);
  const balanceWith = (monthly: number) => balanceAfter({ ...input, monthly }, span);
  if (balanceWith(0) >= goal) return 0;

  let high = Math.max(1, goal / (span * 12));
  while (balanceWith(high) < goal) {
    high *= 2;
    if (!Number.isFinite(high) || high > 1e15) return null;
  }

  let low = 0;
  for (let step = 0; step < SOLVER_STEPS; step++) {
    const mid = (low + high) / 2;
    if (balanceWith(mid) >= goal) high = mid;
    else low = mid;
  }
  return high;
};
