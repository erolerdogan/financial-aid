import { getBenchmarkGroup } from '@/constants/benchmarks';
import {
  addMonths,
  biggestImprovement,
  indexMonths,
  isPartialMonth,
  median,
  monthOf,
  PILLAR_THRESHOLDS,
  pillarScores,
  rangeForCategory,
  rangeStatus,
  type HealthInput,
  type HealthMetrics,
  type Improvement,
  type MonthBucket,
  type MonthIndex,
} from '@/utils/budgetHealth';

// Pure: no database and no UI in this file. `src/services/healthService.ts` loads the input.

export interface ForecastCategory {
  category: string;
  /** What the category usually costs in a month. */
  typical: number;
  /** How much less a month brings it back to the top of its range. */
  cut: number;
}

export interface HealthForecast {
  /** The month the forecast is for: the one after the latest month with data. */
  month: string;
  /** First and last month the typical values come from. */
  from: string;
  to: string;
  monthsUsed: number;
  /** Months left out of the fixed or flexible figure as unusual. */
  monthsDropped: number;
  /** Large one-off payments (a loan, an inheritance) in those months that are not counted as income. */
  oneOffs: number;
  income: number;
  incomeSource: 'detected' | 'override';
  fixed: number;
  flexible: number;
  leftOver: number;
  /** The pillar change that adds the most, judged on the forecast month; null when every pillar is at its target. */
  improvement: Improvement | null;
  /** Categories that usually run above their range, the largest gap first. */
  categories: ForecastCategory[];
}

/** Below this the calendar year is topped up with the months before it. */
const SAMPLE_FILL = 3;
const MIN_MONTHS = 2;
/** With fewer values an outlier cannot be told from a trend, so the median is used. */
const ROBUST_MIN = 4;
/** 2.5 standard deviations, with the MAD scaled to one (× 1.4826). */
const OUTLIER_FACTOR = 2.5 * 1.4826;
/** A steady series has a MAD near zero; a month within 15% of the median is never an outlier. */
const OUTLIER_MIN_SPREAD = 0.15;
const MAX_CATEGORIES = 3;

/**
 * The usual value of a monthly spending series without its one-offs (a yearly bill, a holiday): the average of the
 * values near the median. `dropped` holds the positions that were left out.
 */
export function typicalValue(values: number[]): { value: number; dropped: number[] } {
  if (values.length === 0) return { value: 0, dropped: [] };
  const mid = median(values);
  if (values.length < ROBUST_MIN) return { value: mid, dropped: [] };

  const spread = median(values.map((value) => Math.abs(value - mid)));
  const limit = Math.max(OUTLIER_FACTOR * spread, OUTLIER_MIN_SPREAD * Math.abs(mid));
  const dropped: number[] = [];
  let total = 0;
  values.forEach((value, position) => {
    if (Math.abs(value - mid) > limit) dropped.push(position);
    else total += value;
  });

  const kept = values.length - dropped.length;
  return kept > 0 ? { value: total / kept, dropped } : { value: mid, dropped: [] };
}

/** The month after the latest month with data; null without data. */
export function forecastMonth(index: MonthIndex): string | null {
  let latest: string | null = null;
  for (const key of index.keys()) {
    if (latest === null || key > latest) latest = key;
  }
  return latest === null ? null : addMonths(latest, 1);
}

/**
 * The complete months the forecast is taken from, oldest first: those of the forecast month's calendar year, topped up
 * with the months before it while there are fewer than three.
 */
export function forecastSample(index: MonthIndex, today: string): string[] {
  const target = forecastMonth(index);
  if (!target) return [];

  const yearStart = `${target.slice(0, 4)}-01`;
  const complete = Array.from(index.keys())
    .filter((key) => key < target && !isPartialMonth(key, today))
    .sort();
  const sample = complete.filter((key) => key >= yearStart);
  const earlier = complete.filter((key) => key < yearStart);
  while (sample.length < SAMPLE_FILL && earlier.length > 0) sample.unshift(earlier.pop() as string);
  return sample;
}

const toPct = (amount: number, income: number): number => (amount / income) * 100;

/**
 * Next month as a typical month of this year: income, fixed and flexible spending, what is left, and what to change.
 * Null with fewer than two complete months or without income.
 */
export function forecastNextMonth(input: HealthInput, index: MonthIndex = indexMonths(input)): HealthForecast | null {
  const month = forecastMonth(index);
  const sample = forecastSample(index, input.today);
  if (!month || sample.length < MIN_MONTHS) return null;

  const buckets = sample.map((key) => index.get(key) as MonthBucket);
  const typical = (pick: (bucket: MonthBucket) => number) => typicalValue(buckets.map(pick));

  const override = input.household?.netIncomeOverride;
  const hasOverride = typeof override === 'number' && override > 0;
  // Income is a plain average: an uneven month or a bonus is real income. Loans and the like are already left out.
  const detected = buckets.reduce((sum, bucket) => sum + bucket.income, 0) / buckets.length;
  const income = hasOverride ? override : detected;
  if (income <= 0) return null;

  const fixed = typical((bucket) => bucket.fixed);
  const flexible = typical((bucket) => bucket.spending - bucket.fixed);
  const dropped = new Set([...fixed.dropped, ...flexible.dropped]);
  const spending = fixed.value + flexible.value;

  let debtPayments = 0;
  for (const debt of input.debts) {
    if (debt.isMortgage || !debt.active) continue;
    if (debt.startDate && monthOf(debt.startDate) > month) continue;
    debtPayments += debt.paymentAmount;
  }

  const safety = input.household?.safetySavings;
  let bufferMonths: number | null = null;
  if (typeof safety === 'number' && safety >= 0) {
    bufferMonths = fixed.value > 0 ? safety / fixed.value : safety > 0 ? PILLAR_THRESHOLDS.buffer.full : 0;
  }

  const metrics: HealthMetrics = {
    netIncome: income,
    spending,
    saved: income - spending,
    savingsRate: toPct(income - spending, income),
    housingPct: toPct(typical((bucket) => bucket.byGroup.get('housing') ?? 0).value, income),
    fixedCosts: fixed.value,
    fixedPct: toPct(fixed.value, income),
    debtPayments,
    debtPct: toPct(debtPayments, income),
    bufferMonths,
  };

  const names = new Set<string>();
  for (const bucket of buckets) bucket.byCategory.forEach((_, name) => names.add(name));

  const categories: ForecastCategory[] = [];
  for (const category of names) {
    // Putting more into savings is never something to cut.
    if (getBenchmarkGroup(input.categoryGroups[category] ?? 'none').higherIsBetter) continue;
    const usual = typical((bucket) => bucket.byCategory.get(category) ?? 0).value;
    const { range } = rangeForCategory(input, category);
    if (!range) continue;
    const status = rangeStatus(toPct(usual, income), range, false);
    if (status !== 'yellow' && status !== 'red') continue;
    categories.push({ category, typical: usual, cut: usual - (range.max / 100) * income });
  }
  categories.sort((a, b) => b.cut - a.cut || a.category.localeCompare(b.category));

  return {
    month,
    from: sample[0],
    to: sample[sample.length - 1],
    monthsUsed: sample.length,
    monthsDropped: dropped.size,
    oneOffs: hasOverride ? 0 : buckets.reduce((sum, bucket) => sum + bucket.oneOffs, 0),
    income,
    incomeSource: hasOverride ? 'override' : 'detected',
    fixed: fixed.value,
    flexible: flexible.value,
    leftOver: income - spending,
    improvement: biggestImprovement(pillarScores(metrics)),
    categories: categories.slice(0, MAX_CATEGORIES),
  };
}
