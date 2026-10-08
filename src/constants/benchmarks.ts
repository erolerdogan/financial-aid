import type { TranslationKey } from '@/i18n';

export type BenchmarkGroupId =
  | 'housing'
  | 'utilities'
  | 'groceries'
  | 'transport'
  | 'childcare'
  | 'insurance_health'
  | 'dining'
  | 'shopping'
  | 'savings'
  | 'debt'
  | 'none';

/** Typical share of net monthly income, in percent. */
export interface BenchmarkRange {
  min: number;
  max: number;
}

export interface BenchmarkGroup {
  id: BenchmarkGroupId;
  label: TranslationKey;
  /** Null for "No benchmark". */
  range: BenchmarkRange | null;
  /** Savings: being under the range is the problem, not being over it. */
  higherIsBetter?: boolean;
}

export const BENCHMARK_GROUPS: BenchmarkGroup[] = [
  { id: 'housing', label: 'health.group.housing', range: { min: 25, max: 35 } },
  { id: 'utilities', label: 'health.group.utilities', range: { min: 5, max: 8 } },
  { id: 'groceries', label: 'health.group.groceries', range: { min: 10, max: 14 } },
  { id: 'transport', label: 'health.group.transport', range: { min: 6, max: 12 } },
  { id: 'childcare', label: 'health.group.childcare', range: { min: 5, max: 15 } },
  { id: 'insurance_health', label: 'health.group.insuranceHealth', range: { min: 4, max: 8 } },
  { id: 'dining', label: 'health.group.dining', range: { min: 5, max: 10 } },
  { id: 'shopping', label: 'health.group.shopping', range: { min: 3, max: 6 } },
  { id: 'savings', label: 'health.group.savings', range: { min: 10, max: 20 }, higherIsBetter: true },
  { id: 'debt', label: 'health.group.debt', range: { min: 0, max: 15 } },
  { id: 'none', label: 'health.group.none', range: null },
];

const GROUPS_BY_ID = new Map(BENCHMARK_GROUPS.map((group) => [group.id, group]));

export const isBenchmarkGroupId = (value: unknown): value is BenchmarkGroupId =>
  typeof value === 'string' && GROUPS_BY_ID.has(value as BenchmarkGroupId);

export const getBenchmarkGroup = (id: BenchmarkGroupId): BenchmarkGroup =>
  GROUPS_BY_ID.get(id) ?? BENCHMARK_GROUPS[BENCHMARK_GROUPS.length - 1];

/** Built-in category name (as stored) → benchmark group. Anything else starts without a group. */
export const DEFAULT_CATEGORY_GROUPS: Record<string, BenchmarkGroupId> = {
  Housing: 'housing',
  'Utilities & Telecom': 'utilities',
  Groceries: 'groceries',
  Transportation: 'transport',
  Childcare: 'childcare',
  'Health & Care': 'insurance_health',
  'Dining Out': 'dining',
  'Shopping & Retail': 'shopping',
  'Financial Transfers': 'savings',
  'Loan & Insurance': 'debt',
  'Credit Card Payments': 'debt',
  'Taxes & Municipal Fees': 'none',
  Uncategorised: 'none',
};

export type HousingType = 'rent' | 'own';

export interface Household {
  adults: number;
  children: number;
  housingType: HousingType;
  /** Net monthly income typed by the user; null = use the detected value. */
  netIncomeOverride: number | null;
  /** Savings set aside for emergencies; null = not given. */
  safetySavings: number | null;
}

export const DEFAULT_HOUSEHOLD: Household = {
  adults: 2,
  children: 0,
  housingType: 'rent',
  netIncomeOverride: null,
  safetySavings: null,
};

const CHILD_POINTS = 2;
const SINGLE_ADULT_POINTS = 2;

export type BenchmarkRanges = Record<BenchmarkGroupId, BenchmarkRange | null>;

/**
 * Typical ranges for this household. Each child adds 2 points to the Groceries and Childcare max;
 * a single adult takes 2 points off the Groceries min and max. Renters and owners share the Housing range.
 */
export function getRangesForHousehold(household: Household | null): BenchmarkRanges {
  const ranges = {} as BenchmarkRanges;
  for (const group of BENCHMARK_GROUPS) {
    ranges[group.id] = group.range ? { ...group.range } : null;
  }
  if (!household) return ranges;

  const children = Math.max(0, Math.floor(household.children));
  const groceries = ranges.groceries;
  const childcare = ranges.childcare;

  if (groceries) {
    groceries.max += children * CHILD_POINTS;
    if (household.adults <= 1) {
      groceries.min = Math.max(0, groceries.min - SINGLE_ADULT_POINTS);
      groceries.max = Math.max(groceries.min, groceries.max - SINGLE_ADULT_POINTS);
    }
  }
  if (childcare) childcare.max += children * CHILD_POINTS;

  return ranges;
}
