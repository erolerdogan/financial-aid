import {
  getBenchmarkGroup,
  getRangesForHousehold,
  type BenchmarkGroupId,
  type BenchmarkRange,
  type Household,
} from '@/constants/benchmarks';
import type { Message } from '@/i18n';

// Pure: no database and no UI in this file. `src/services/healthService.ts` loads the input.

export interface HealthTransaction {
  id: number;
  /** YYYY-MM-DD */
  date: string;
  /** Expenses negative, income positive. */
  amount: number;
  category: string;
  merchant: string;
  rawDescription: string;
  isFixed: boolean;
}

export interface HealthDebt {
  id: number;
  name: string;
  isMortgage: boolean;
  paymentAmount: number;
  paymentDay: number;
  startDate: string | null;
  /** False once it is paid off. */
  active: boolean;
}

export interface HealthDebtPayment {
  debtId: number;
  date: string;
  amount: number;
}

export interface HealthInput {
  transactions: HealthTransaction[];
  debts: HealthDebt[];
  debtPayments: HealthDebtPayment[];
  /** Category name → benchmark group; a missing category has no benchmark. */
  categoryGroups: Record<string, BenchmarkGroupId>;
  household: Household | null;
  /** Category name → range the user accepted for it. */
  overrides: Record<string, BenchmarkRange>;
  /** YYYY-MM-DD */
  today: string;
}

export type HealthStatus = 'green' | 'yellow' | 'red' | 'grey';
export type IncomeSource = 'detected' | 'override' | 'none';

export interface NetIncome {
  value: number;
  source: IncomeSource;
}

export interface CategoryStatus {
  category: string;
  group: BenchmarkGroupId;
  amount: number;
  /** Share of net income in percent; null without income. */
  pct: number | null;
  range: BenchmarkRange | null;
  /** The range comes from "This is fine for us". */
  overridden: boolean;
  /** Average of the previous three months; null when there is no earlier month. */
  normal: number | null;
  normalPct: number | null;
  status: HealthStatus;
  higherIsBetter: boolean;
}

export type PillarId = 'savings' | 'housing' | 'fixed' | 'debt' | 'buffer';

export interface PillarScore {
  id: PillarId;
  weight: number;
  /** 0-100; null when the pillar cannot be judged (unknown buffer, no income). */
  score: number | null;
  /** The figure behind the score: a percentage of income, or months of fixed costs for the buffer. */
  value: number | null;
}

export interface HealthMetrics {
  netIncome: number;
  spending: number;
  saved: number;
  savingsRate: number | null;
  housingPct: number | null;
  fixedCosts: number;
  fixedPct: number | null;
  debtPayments: number;
  debtPct: number | null;
  bufferMonths: number | null;
}

export interface Improvement {
  pillar: PillarId;
  points: number;
  message: Message;
}

export interface HealthResult {
  month: string;
  /** False when there is no income or no data for the month: no score is shown. */
  enough: boolean;
  /** The month is still running, so its figures will move. */
  partial: boolean;
  score: number | null;
  income: NetIncome;
  metrics: HealthMetrics;
  pillars: PillarScore[];
  categories: CategoryStatus[];
  improvement: Improvement | null;
}

export const PILLAR_WEIGHTS: Record<PillarId, number> = {
  savings: 30,
  housing: 20,
  fixed: 15,
  debt: 20,
  buffer: 15,
};

export const PILLAR_ORDER: PillarId[] = ['savings', 'housing', 'fixed', 'debt', 'buffer'];

/** Where each pillar reaches a full score and where it reaches zero. */
export const PILLAR_THRESHOLDS: Record<PillarId, { full: number; zero: number }> = {
  savings: { full: 15, zero: 0 },
  housing: { full: 30, zero: 45 },
  fixed: { full: 55, zero: 75 },
  debt: { full: 10, zero: 30 },
  buffer: { full: 3, zero: 0 },
};

const YELLOW_MARGIN = 0.2;
const NORMAL_MONTHS = 3;
const INCOME_MONTHS = 3;
/** Money in from a source seen in one month only is a one-off (a loan, an inheritance) when it is this many typical months of income. */
const ONE_OFF_FACTOR = 1.5;

export const monthOf = (date: string): string => date.slice(0, 7);

export const addMonths = (month: string, delta: number): string => {
  const [year, monthNumber] = month.split('-').map(Number);
  const index = year * 12 + (monthNumber - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
};

export const daysInMonth = (month: string): number => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
};

/** The calendar month is not over yet. */
export const isPartialMonth = (month: string, today: string): boolean => month >= monthOf(today);

const toPct = (amount: number, income: number): number | null => (income > 0 ? (amount / income) * 100 : null);

export interface MonthBucket {
  /** Money in that counts as income; see `indexMonths`. */
  income: number;
  /** Large one-off payments left out of `income`. */
  oneOffs: number;
  /** Money out, without transfers to savings. */
  spending: number;
  fixed: number;
  /** Money out per category, savings transfers included. */
  byCategory: Map<string, number>;
  byGroup: Map<BenchmarkGroupId, number>;
  count: number;
}

export type MonthIndex = Map<string, MonthBucket>;

const groupOf = (input: Pick<HealthInput, 'categoryGroups'>, category: string): BenchmarkGroupId =>
  input.categoryGroups[category] ?? 'none';

export const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Money coming back from savings, or in a debt category (a loan paid out, a refund on the card), is not income. */
const canBeIncome = (group: BenchmarkGroupId): boolean => group !== 'savings' && group !== 'debt';

const sourceOf = (tx: HealthTransaction): string =>
  (tx.merchant && tx.merchant !== 'Unknown' ? tx.merchant : tx.rawDescription).trim().toLowerCase();

/**
 * Tells a large one-off payment from income: its source is seen in one month only and it is more than 1.5 times the
 * money that comes in in a typical month. A bonus from the employer or an uneven month of a freelancer stays income.
 */
function oneOffTest(input: Pick<HealthInput, 'transactions' | 'categoryGroups'>): (tx: HealthTransaction) => boolean {
  const moneyIn = new Map<string, number>();
  const sourceMonths = new Map<string, Set<string>>();

  for (const tx of input.transactions) {
    const month = monthOf(tx.date);
    if (!moneyIn.has(month)) moneyIn.set(month, 0);
    if (tx.amount <= 0 || !canBeIncome(groupOf(input, tx.category))) continue;
    moneyIn.set(month, (moneyIn.get(month) ?? 0) + tx.amount);
    const source = sourceOf(tx);
    const months = sourceMonths.get(source);
    if (months) months.add(month);
    else sourceMonths.set(source, new Set([month]));
  }

  const limit = median(Array.from(moneyIn.values())) * ONE_OFF_FACTOR;
  return (tx) => limit > 0 && tx.amount > limit && sourceMonths.get(sourceOf(tx))?.size === 1;
}

/** Every function below takes the result, so a year of months costs one scan of the months. */
export function indexMonths(input: Pick<HealthInput, 'transactions' | 'categoryGroups'>): MonthIndex {
  const index: MonthIndex = new Map();
  const isOneOff = oneOffTest(input);

  for (const tx of input.transactions) {
    const month = monthOf(tx.date);
    let bucket = index.get(month);
    if (!bucket) {
      bucket = { income: 0, oneOffs: 0, spending: 0, fixed: 0, byCategory: new Map(), byGroup: new Map(), count: 0 };
      index.set(month, bucket);
    }
    bucket.count++;

    const group = groupOf(input, tx.category);
    if (tx.amount > 0) {
      if (!canBeIncome(group)) continue;
      if (isOneOff(tx)) bucket.oneOffs++;
      else bucket.income += tx.amount;
      continue;
    }
    if (tx.amount === 0) continue;

    const amount = -tx.amount;
    bucket.byCategory.set(tx.category, (bucket.byCategory.get(tx.category) ?? 0) + amount);
    bucket.byGroup.set(group, (bucket.byGroup.get(group) ?? 0) + amount);
    if (group === 'savings') continue;
    bucket.spending += amount;
    if (tx.isFixed) bucket.fixed += amount;
  }

  return index;
}

/** The complete months the averages are taken from: up to three, ending at `month` (or just before it while it runs). */
function referenceMonths(index: MonthIndex, month: string, today: string, count: number): string[] {
  const last = isPartialMonth(month, today) ? addMonths(month, -1) : month;
  const months: string[] = [];
  for (let i = 0; i < count; i++) {
    const candidate = addMonths(last, -i);
    if (index.has(candidate)) months.push(candidate);
  }
  return months;
}

/**
 * Net monthly income: the figure the user typed wins; otherwise the average income of the last three complete months
 * that have data. A month that is still running is only used when there is nothing else.
 */
export function detectNetIncome(input: HealthInput, month: string, index: MonthIndex = indexMonths(input)): NetIncome {
  const override = input.household?.netIncomeOverride;
  if (typeof override === 'number' && override > 0) return { value: override, source: 'override' };

  const months = referenceMonths(index, month, input.today, INCOME_MONTHS);
  const sample = months.length > 0 ? months : index.has(month) ? [month] : [];
  if (sample.length === 0) return { value: 0, source: 'none' };

  const total = sample.reduce((sum, key) => sum + (index.get(key)?.income ?? 0), 0);
  const value = total / sample.length;
  return value > 0 ? { value, source: 'detected' } : { value: 0, source: 'none' };
}

/** "Your normal": what the category cost on average in the three months before `month` (months without data are left out). */
export function normalSpend(index: MonthIndex, category: string, month: string): number | null {
  let total = 0;
  let months = 0;
  for (let i = 1; i <= NORMAL_MONTHS; i++) {
    const bucket = index.get(addMonths(month, -i));
    if (!bucket) continue;
    months++;
    total += bucket.byCategory.get(category) ?? 0;
  }
  return months > 0 ? total / months : null;
}

export function rangeStatus(pct: number | null, range: BenchmarkRange | null, higherIsBetter: boolean): HealthStatus {
  if (pct === null || !range) return 'grey';
  if (higherIsBetter) {
    if (pct >= range.min) return 'green';
    return pct >= range.min * (1 - YELLOW_MARGIN) ? 'yellow' : 'red';
  }
  if (pct <= range.max) return 'green';
  return pct <= range.max * (1 + YELLOW_MARGIN) ? 'yellow' : 'red';
}

/** Range for one category: the user's own range first, then the household's range for its group. */
export function rangeForCategory(
  input: Pick<HealthInput, 'categoryGroups' | 'household' | 'overrides'>,
  category: string
): { range: BenchmarkRange | null; overridden: boolean } {
  const override = input.overrides[category];
  if (override) return { range: override, overridden: true };
  return { range: getRangesForHousehold(input.household)[groupOf(input, category)], overridden: false };
}

export function categoryStatuses(
  input: HealthInput,
  month: string,
  index: MonthIndex = indexMonths(input),
  income: NetIncome = detectNetIncome(input, month, index)
): CategoryStatus[] {
  const bucket = index.get(month);
  const names = new Set<string>(bucket ? bucket.byCategory.keys() : []);
  for (let i = 1; i <= NORMAL_MONTHS; i++) {
    index.get(addMonths(month, -i))?.byCategory.forEach((_, name) => names.add(name));
  }

  const ranges = getRangesForHousehold(input.household);
  const statuses: CategoryStatus[] = [];

  for (const category of names) {
    const amount = bucket?.byCategory.get(category) ?? 0;
    const normal = normalSpend(index, category, month);
    if (amount <= 0 && !(normal && normal > 0)) continue;

    const group = groupOf(input, category);
    const override = input.overrides[category];
    const range = override ?? ranges[group];
    const higherIsBetter = getBenchmarkGroup(group).higherIsBetter === true;
    const pct = toPct(amount, income.value);

    statuses.push({
      category,
      group,
      amount,
      pct,
      range,
      overridden: !!override,
      normal,
      normalPct: normal === null ? null : toPct(normal, income.value),
      status: rangeStatus(pct, range, higherIsBetter),
      higherIsBetter,
    });
  }

  return statuses.sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Linear between the value that scores zero and the value that scores 100; works in either direction. */
export const scaleScore = (value: number, zeroAt: number, fullAt: number): number =>
  clamp(((value - zeroAt) / (fullAt - zeroAt)) * 100, 0, 100);

export function pillarScores(metrics: HealthMetrics): PillarScore[] {
  const values: Record<PillarId, number | null> = {
    savings: metrics.savingsRate,
    housing: metrics.housingPct,
    fixed: metrics.fixedPct,
    debt: metrics.debtPct,
    buffer: metrics.bufferMonths,
  };

  return PILLAR_ORDER.map((id) => {
    const value = values[id];
    const { zero, full } = PILLAR_THRESHOLDS[id];
    return {
      id,
      weight: PILLAR_WEIGHTS[id],
      value,
      score: value === null ? null : scaleScore(value, zero, full),
    };
  });
}

/** Weighted average of the pillars that could be judged; the others give their weight to the rest. */
export function healthScore(pillars: PillarScore[]): number | null {
  let weight = 0;
  let total = 0;
  for (const pillar of pillars) {
    if (pillar.score === null) continue;
    weight += pillar.weight;
    total += pillar.weight * pillar.score;
  }
  return weight > 0 ? Math.round(total / weight) : null;
}

/** The single pillar change that adds the most points; null when every pillar is already at its target. */
export function biggestImprovement(pillars: PillarScore[]): Improvement | null {
  const weight = pillars.reduce((sum, pillar) => (pillar.score === null ? sum : sum + pillar.weight), 0);
  if (weight === 0) return null;

  let best: Improvement | null = null;
  for (const pillar of pillars) {
    if (pillar.score === null) continue;
    const points = Math.round((pillar.weight * (100 - pillar.score)) / weight);
    if (points < 1 || (best && points <= best.points)) continue;
    best = {
      pillar: pillar.id,
      points,
      message: {
        key: `health.improve.${pillar.id}`,
        params: { target: PILLAR_THRESHOLDS[pillar.id].full, points },
      },
    };
  }
  return best;
}

/** Payments on debts other than the mortgage. While the month runs, a payment that is still to come counts at its usual amount. */
function debtPaymentsFor(input: HealthInput, month: string): number {
  const debts = new Map(input.debts.filter((debt) => !debt.isMortgage).map((debt) => [debt.id, debt]));
  const paid = new Set<number>();
  let total = 0;

  for (const payment of input.debtPayments) {
    if (monthOf(payment.date) !== month || !debts.has(payment.debtId)) continue;
    total += payment.amount;
    paid.add(payment.debtId);
  }

  if (isPartialMonth(month, input.today)) {
    for (const debt of debts.values()) {
      if (!debt.active || paid.has(debt.id)) continue;
      if (debt.startDate && monthOf(debt.startDate) > month) continue;
      total += debt.paymentAmount;
    }
  }
  return total;
}

export function computeMetrics(
  input: HealthInput,
  month: string,
  index: MonthIndex = indexMonths(input),
  income: NetIncome = detectNetIncome(input, month, index)
): HealthMetrics {
  const bucket = index.get(month);
  const netIncome = income.value;
  const spending = bucket?.spending ?? 0;
  const fixedCosts = bucket?.fixed ?? 0;
  const debtPayments = debtPaymentsFor(input, month);

  // The buffer is measured against a usual month, not against a month that has only just started.
  const reference = referenceMonths(index, month, input.today, INCOME_MONTHS);
  const usualFixed =
    reference.length > 0
      ? reference.reduce((sum, key) => sum + (index.get(key)?.fixed ?? 0), 0) / reference.length
      : fixedCosts;

  const safety = input.household?.safetySavings;
  let bufferMonths: number | null = null;
  if (typeof safety === 'number' && safety >= 0) {
    bufferMonths = usualFixed > 0 ? safety / usualFixed : safety > 0 ? PILLAR_THRESHOLDS.buffer.full : 0;
  }

  const hasIncome = netIncome > 0;
  return {
    netIncome,
    spending,
    saved: netIncome - spending,
    savingsRate: hasIncome ? ((netIncome - spending) / netIncome) * 100 : null,
    housingPct: toPct(bucket?.byGroup.get('housing') ?? 0, netIncome),
    fixedCosts,
    fixedPct: toPct(fixedCosts, netIncome),
    debtPayments,
    debtPct: toPct(debtPayments, netIncome),
    bufferMonths: hasIncome ? bufferMonths : null,
  };
}

export function computeHealth(input: HealthInput, month: string, index: MonthIndex = indexMonths(input)): HealthResult {
  const income = detectNetIncome(input, month, index);
  const metrics = computeMetrics(input, month, index, income);
  const enough = income.source !== 'none' && index.has(month);
  const pillars = pillarScores(metrics);

  return {
    month,
    enough,
    partial: isPartialMonth(month, input.today),
    score: enough ? healthScore(pillars) : null,
    income,
    metrics,
    pillars,
    categories: categoryStatuses(input, month, index, income),
    improvement: enough ? biggestImprovement(pillars) : null,
  };
}

export interface HealthHistoryPoint {
  month: string;
  score: number;
}

/** Scores of the months with data, oldest first, ending at `endMonth`. */
export function healthHistory(
  input: HealthInput,
  endMonth: string,
  count = 12,
  index: MonthIndex = indexMonths(input)
): HealthHistoryPoint[] {
  const points: HealthHistoryPoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const month = addMonths(endMonth, -i);
    if (!index.has(month)) continue;
    const income = detectNetIncome(input, month, index);
    if (income.source === 'none') continue;
    const score = healthScore(pillarScores(computeMetrics(input, month, index, income)));
    if (score !== null) points.push({ month, score });
  }
  return points;
}

/** The latest month before `month` that has data, or null. */
export function previousMonthWithData(index: MonthIndex, month: string): string | null {
  let previous: string | null = null;
  for (const key of index.keys()) {
    if (key < month && (previous === null || key > previous)) previous = key;
  }
  return previous;
}
