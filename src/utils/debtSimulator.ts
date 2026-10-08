import type { DebtSummary } from '@/db/database';
import { MAX_DEBT_TERM_MONTHS } from './debt';

// Multi-debt payoff projection: pure, no database access. See docs/debts.md ("Payoff simulator").

export type DebtStrategy = 'AVALANCHE' | 'SNOWBALL' | 'NONE';
export type PlanStrategy = Exclude<DebtStrategy, 'NONE'>;

export interface SimDebt {
  id: number;
  name: string;
  balance: number;
  /** Yearly rate as a decimal (0.065); null when it is not known, which counts as 0. */
  apr: number | null;
  /** What is paid on this debt every month today. */
  minPayment: number;
}

export interface LumpSum {
  /** 1 = the first simulated month (the month after `startMonth`). */
  monthIndex: number;
  amount: number;
}

export interface SimInput {
  debts: SimDebt[];
  extraMonthly: number;
  lumpSums: LumpSum[];
  strategy: DebtStrategy;
  /** `YYYY-MM` of today; month `i` of the simulation is `startMonth + i`. */
  startMonth: string;
}

export type SimWarningCode = 'RATE_UNKNOWN' | 'PAYMENT_BELOW_INTEREST' | 'NO_PAYMENT' | 'OVER_LIMIT';

export interface SimWarning {
  code: SimWarningCode;
  /** null for a warning about the whole plan. */
  debtId: number | null;
}

export interface SimDebtResult {
  id: number;
  /** Month number in which the debt is cleared; 0 when it had no balance, null when never. */
  payoffIndex: number | null;
  payoffMonth: string | null;
  interestPaid: number;
}

export interface SimResult {
  debts: SimDebtResult[];
  totalInterest: number;
  /** Months until every debt is cleared; null when that does not happen within the limit. */
  months: number | null;
  debtFreeMonth: string | null;
  /** Total balance; index 0 is today, index `i` is after month `i`. */
  series: number[];
  warnings: SimWarning[];
}

export const MAX_SIM_MONTHS = MAX_DEBT_TERM_MONTHS;

const PAID_EPSILON = 0.005;

export const addMonths = (monthKey: string, count: number): string => {
  const [year, month] = monthKey.split('-').map(Number);
  const total = year * 12 + (month - 1) + count;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
};

/** Whole months from `from` to `to` (both `YYYY-MM`); negative when `to` is earlier. */
export const monthsBetween = (from: string, to: string): number => {
  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
};

export const currentMonthKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

interface OpenDebt {
  debt: SimDebt;
  balance: number;
  rate: number;
  interestPaid: number;
  payoffIndex: number | null;
}

const pickTarget = (open: OpenDebt[], strategy: PlanStrategy): OpenDebt | null => {
  let best: OpenDebt | null = null;
  for (const item of open) {
    if (item.payoffIndex !== null) continue;
    if (best === null) {
      best = item;
      continue;
    }
    const byRate = item.rate - best.rate;
    const byBalance = best.balance - item.balance;
    // AVALANCHE: highest rate, then smallest balance. SNOWBALL: smallest balance, then highest rate.
    const first = strategy === 'AVALANCHE' ? byRate : byBalance;
    const second = strategy === 'AVALANCHE' ? byBalance : byRate;
    if (first > 0 || (first === 0 && second > 0)) best = item;
  }
  return best;
};

export function simulateDebts(input: SimInput): SimResult {
  const { strategy, startMonth } = input;
  const extraMonthly = Math.max(0, input.extraMonthly || 0);

  const lumpByMonth = new Map<number, number>();
  for (const lump of input.lumpSums) {
    if (!(lump.amount > 0) || !Number.isInteger(lump.monthIndex) || lump.monthIndex < 1) continue;
    lumpByMonth.set(lump.monthIndex, (lumpByMonth.get(lump.monthIndex) ?? 0) + lump.amount);
  }

  const items: OpenDebt[] = input.debts.map((debt) => {
    const balance = Math.max(0, debt.balance || 0);
    return {
      debt,
      balance,
      rate: debt.apr !== null && debt.apr > 0 ? debt.apr : 0,
      interestPaid: 0,
      payoffIndex: balance <= PAID_EPSILON ? 0 : null,
    };
  });

  const totalBalance = () => items.reduce((sum, item) => sum + item.balance, 0);
  const allPaid = () => items.every((item) => item.payoffIndex !== null);
  const clear = (item: OpenDebt, month: number): number => {
    item.balance = 0;
    item.payoffIndex = month;
    return Math.max(0, item.debt.minPayment);
  };

  const series: number[] = [totalBalance()];
  // Payments of debts cleared in earlier months; from then on they go to the target debt.
  let rollover = 0;
  let month = 0;

  while (!allPaid() && month < MAX_SIM_MONTHS) {
    month++;
    let freed = 0;

    for (const item of items) {
      if (item.payoffIndex !== null) continue;
      const interest = (item.balance * item.rate) / 12;
      item.balance += interest;
      item.interestPaid += interest;
    }

    for (const item of items) {
      if (item.payoffIndex !== null) continue;
      const payment = Math.min(Math.max(0, item.debt.minPayment), item.balance);
      item.balance -= payment;
      if (item.balance <= PAID_EPSILON) freed += clear(item, month);
    }

    if (strategy !== 'NONE') {
      let pool = extraMonthly + (lumpByMonth.get(month) ?? 0) + rollover;
      while (pool > PAID_EPSILON) {
        const target = pickTarget(items, strategy);
        if (!target) break;
        const payment = Math.min(pool, target.balance);
        target.balance -= payment;
        pool -= payment;
        if (target.balance <= PAID_EPSILON) freed += clear(target, month);
      }
      rollover += freed;
    }

    series.push(totalBalance());
  }

  const debtFree = allPaid();
  const months = debtFree ? items.reduce((max, item) => Math.max(max, item.payoffIndex ?? 0), 0) : null;

  const warnings: SimWarning[] = [];
  for (const item of items) {
    const { debt } = item;
    if (!(debt.balance > PAID_EPSILON)) continue;
    if (debt.apr === null) warnings.push({ code: 'RATE_UNKNOWN', debtId: debt.id });
    if (item.payoffIndex !== null) continue;
    if (!(debt.minPayment > 0)) warnings.push({ code: 'NO_PAYMENT', debtId: debt.id });
    else if (debt.minPayment <= (debt.balance * item.rate) / 12) {
      warnings.push({ code: 'PAYMENT_BELOW_INTEREST', debtId: debt.id });
    }
  }
  if (!debtFree) warnings.push({ code: 'OVER_LIMIT', debtId: null });

  return {
    debts: items.map((item) => ({
      id: item.debt.id,
      payoffIndex: item.payoffIndex,
      payoffMonth: item.payoffIndex === null ? null : addMonths(startMonth, item.payoffIndex),
      interestPaid: item.interestPaid,
    })),
    totalInterest: items.reduce((sum, item) => sum + item.interestPaid, 0),
    months,
    debtFreeMonth: months === null ? null : addMonths(startMonth, months),
    series,
    warnings,
  };
}

export interface StrategyDiff {
  /** Against paying only the current payments; null when one of the two never ends. */
  monthsSaved: number | null;
  interestSaved: number | null;
  /** The first debt this strategy clears. */
  firstCleared: { id: number; payoffIndex: number; month: string } | null;
}

export interface StrategyComparison {
  baseline: SimResult;
  avalanche: SimResult;
  snowball: SimResult;
  diff: Record<PlanStrategy, StrategyDiff>;
}

const diffAgainst = (baseline: SimResult, result: SimResult): StrategyDiff => {
  const bothEnd = baseline.months !== null && result.months !== null;
  let first: SimDebtResult | null = null;
  for (const debt of result.debts) {
    if (debt.payoffIndex === null || debt.payoffIndex === 0) continue;
    if (first === null || debt.payoffIndex < (first.payoffIndex ?? 0)) first = debt;
  }
  return {
    monthsSaved: bothEnd ? (baseline.months ?? 0) - (result.months ?? 0) : null,
    interestSaved: bothEnd ? baseline.totalInterest - result.totalInterest : null,
    firstCleared:
      first && first.payoffIndex !== null && first.payoffMonth !== null
        ? { id: first.id, payoffIndex: first.payoffIndex, month: first.payoffMonth }
        : null,
  };
};

/** The same debts and extra payments run three ways; `strategy` of the input is ignored. */
export function compareStrategies(input: Omit<SimInput, 'strategy'>): StrategyComparison {
  const baseline = simulateDebts({ ...input, strategy: 'NONE' });
  const avalanche = simulateDebts({ ...input, strategy: 'AVALANCHE' });
  const snowball = simulateDebts({ ...input, strategy: 'SNOWBALL' });
  return {
    baseline,
    avalanche,
    snowball,
    diff: { AVALANCHE: diffAgainst(baseline, avalanche), SNOWBALL: diffAgainst(baseline, snowball) },
  };
}

// --- Saved plan -------------------------------------------------------------

export interface PlannedPayment {
  /** `YYYY-MM` in which the one-off payment is made. */
  month: string;
  amount: number;
}

export interface DebtPlan {
  extraMonthly: number;
  strategy: PlanStrategy;
  lumpSums: PlannedPayment[];
}

export const DEFAULT_DEBT_PLAN: DebtPlan = { extraMonthly: 0, strategy: 'AVALANCHE', lumpSums: [] };

export const MAX_LUMP_SUMS = 12;

const isMonthKey = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
};

/** A plan from stored values; anything malformed falls back to the default for that field. */
export const sanitizeDebtPlan = (extraMonthly: unknown, strategy: unknown, lumpSumsJson: unknown): DebtPlan => {
  let parsed: unknown = [];
  if (typeof lumpSumsJson === 'string') {
    try {
      parsed = JSON.parse(lumpSumsJson);
    } catch {
      parsed = [];
    }
  }
  const lumpSums: PlannedPayment[] = [];
  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      if (lumpSums.length >= MAX_LUMP_SUMS) break;
      if (typeof entry !== 'object' || entry === null) continue;
      const { month, amount } = entry as { month?: unknown; amount?: unknown };
      if (!isMonthKey(month) || typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) continue;
      lumpSums.push({ month, amount });
    }
  }
  return {
    extraMonthly: typeof extraMonthly === 'number' && Number.isFinite(extraMonthly) && extraMonthly > 0 ? extraMonthly : 0,
    strategy: strategy === 'SNOWBALL' ? 'SNOWBALL' : 'AVALANCHE',
    lumpSums,
  };
};

/** True when the plan changes nothing about the money put in (rollover aside). */
export const isEmptyDebtPlan = (plan: DebtPlan): boolean =>
  !(plan.extraMonthly > 0) && !plan.lumpSums.some((lump) => lump.amount > 0);

type DebtRow = Pick<DebtSummary, 'id' | 'name' | 'balance' | 'apr' | 'paymentAmount' | 'isPaidOff'>;

/** Debts that still have a balance. The stored rate is a percent and 0 means "not entered". */
export const toSimDebts = (debts: readonly DebtRow[]): SimDebt[] =>
  debts
    .filter((debt) => !debt.isPaidOff && debt.balance > PAID_EPSILON)
    .map((debt) => ({
      id: debt.id,
      name: debt.name,
      balance: debt.balance,
      apr: debt.apr > 0 ? debt.apr / 100 : null,
      minPayment: Math.max(0, debt.paymentAmount),
    }));

/** One-off payments by calendar month become month numbers; months that are not in the future are left out. */
export const planToInput = (debts: SimDebt[], plan: DebtPlan, startMonth: string): Omit<SimInput, 'strategy'> => ({
  debts,
  extraMonthly: plan.extraMonthly,
  lumpSums: plan.lumpSums
    .map((lump) => ({ monthIndex: monthsBetween(startMonth, lump.month), amount: lump.amount }))
    .filter((lump) => lump.monthIndex >= 1 && lump.monthIndex <= MAX_SIM_MONTHS && lump.amount > 0),
  startMonth,
});

// --- Controls and chart -----------------------------------------------------

/** Upper end of the "extra per month" slider: twice the current payments, at least 200, never more than is owed. */
export const extraSliderMax = (debts: readonly SimDebt[]): number => {
  const owed = debts.reduce((sum, debt) => sum + Math.max(0, debt.balance), 0);
  const payments = debts.reduce((sum, debt) => sum + Math.max(0, debt.minPayment), 0);
  const step = extraSliderStep(Math.max(200, payments * 2));
  const raw = Math.min(Math.max(200, payments * 2), owed);
  return Math.max(step, Math.ceil(raw / step) * step);
};

/** 10 for everyday amounts; a larger power of ten for currencies with big numbers, so the slider keeps 200 to 2000 stops. */
export const extraSliderStep = (max: number): number =>
  Math.max(10, Math.pow(10, Math.floor(Math.log10(Math.max(max, 1) / 200))));

export interface ChartSeries {
  /** Month number of each point (0 = today). */
  indexes: number[];
  baseline: number[];
  plan: number[];
}

const NEVER_ENDING_HORIZON = 120;

/**
 * Both balance paths on one month axis, thinned to `maxPoints`. A path that ended reads 0 afterwards;
 * the axis runs to the later payoff, or 10 years when neither path ends.
 */
export const buildChartSeries = (baseline: SimResult, plan: SimResult, maxPoints = 48): ChartSeries => {
  const ends = [baseline.months, plan.months].filter((value): value is number => value !== null);
  const horizon = Math.max(1, ends.length > 0 ? Math.max(...ends) : NEVER_ENDING_HORIZON);
  const at = (result: SimResult, index: number): number => {
    if (index < result.series.length) return result.series[index];
    return result.months === null ? result.series[result.series.length - 1] : 0;
  };

  const count = Math.min(horizon + 1, Math.max(2, maxPoints));
  const indexes: number[] = [];
  for (let i = 0; i < count; i++) {
    const index = Math.round((i * horizon) / (count - 1));
    if (indexes[indexes.length - 1] !== index) indexes.push(index);
  }
  return {
    indexes,
    baseline: indexes.map((index) => at(baseline, index)),
    plan: indexes.map((index) => at(plan, index)),
  };
};
