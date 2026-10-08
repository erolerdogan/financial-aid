import type { Message } from '@/i18n';
import {
  addMonths,
  computeMetrics,
  daysInMonth,
  detectNetIncome,
  indexMonths,
  isPartialMonth,
  monthOf,
  type HealthInput,
  type HealthTransaction,
  type MonthIndex,
} from '@/utils/budgetHealth';
import { merchantKey } from '@/utils/fixedCost';

// Pure: no database, no notifications. `runHealthAlerts` in `src/services/healthService.ts` stores the result.

export type AlertType =
  | 'missed_debt_payment'
  | 'new_recurring'
  | 'price_increase'
  | 'category_pace'
  | 'unusual_transaction'
  | 'savings_drop'
  | 'positive_category';

export const ALERT_TYPES: AlertType[] = [
  'missed_debt_payment',
  'new_recurring',
  'price_increase',
  'category_pace',
  'unusual_transaction',
  'savings_drop',
  'positive_category',
];

/** Types that run until the user changes the switches in Settings. */
export const DEFAULT_ENABLED_ALERTS: AlertType[] = ['missed_debt_payment', 'new_recurring'];

export type AlertStatus = 'new' | 'seen' | 'muted';

export interface HealthAlert {
  /** YYYY-MM */
  month: string;
  type: AlertType;
  /** Merchant, category or debt the alert is about; what "Don't alert me about this" mutes. */
  key: string;
  /** Params named `amount` and `usual` are money, `category` is a stored category name; see `alertText`. */
  message: Message;
  /** 3 = act on it, 2 = worth a look, 1 = good news. */
  severity: number;
}

export const MAX_ALERTS_PER_RUN = 3;

const PACE_FACTOR = 1.2;
const UNUSUAL_FACTOR = 3;
const UNUSUAL_MIN_SAMPLES = 5;
const RECURRING_TOLERANCE = 0.1;
const PRICE_INCREASE = 0.15;
const SAVINGS_DROP_POINTS = 8;
const DEBT_GRACE_DAYS = 3;
const POSITIVE_FACTOR = 0.8;
/** Pace says little in the first days of a month. */
const PACE_MIN_DAY = 5;
/** Good news is only given once most of the month is in. */
const POSITIVE_MIN_DAY = 25;
const HISTORY_MONTHS = 3;

interface Candidate extends HealthAlert {
  /** Orders alerts of the same severity: the larger amount first. */
  weight: number;
}

const merchantName = (tx: HealthTransaction): string =>
  tx.merchant && tx.merchant !== 'Unknown' ? tx.merchant : tx.rawDescription;

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const percentOver = (value: number, base: number): number => Math.round((value / base - 1) * 100);

/** Day of the month the statements reach: the last imported day while the month runs, its last day once it is over. */
function coverageDay(input: HealthInput, month: string): number {
  const days = daysInMonth(month);
  if (!isPartialMonth(month, input.today)) return days;

  let latest = 0;
  for (const tx of input.transactions) {
    if (monthOf(tx.date) === month) latest = Math.max(latest, Number(tx.date.slice(8, 10)));
  }
  return Math.min(days, latest);
}

function expensesByMonth(input: HealthInput): Map<string, HealthTransaction[]> {
  const byMonth = new Map<string, HealthTransaction[]>();
  for (const tx of input.transactions) {
    if (tx.amount >= 0) continue;
    if ((input.categoryGroups[tx.category] ?? 'none') === 'savings') continue;
    const month = monthOf(tx.date);
    const list = byMonth.get(month);
    if (list) list.push(tx);
    else byMonth.set(month, [tx]);
  }
  return byMonth;
}

const flexibleByCategory = (rows: HealthTransaction[] | undefined): Map<string, number> => {
  const totals = new Map<string, number>();
  for (const tx of rows ?? []) {
    if (tx.isFixed) continue;
    totals.set(tx.category, (totals.get(tx.category) ?? 0) + -tx.amount);
  }
  return totals;
};

/** Average flexible spend per category over the three months before `month` that have data. */
function flexibleNormals(
  index: MonthIndex,
  expenses: Map<string, HealthTransaction[]>,
  month: string
): Map<string, number> {
  const totals = new Map<string, number>();
  let months = 0;
  for (let i = 1; i <= HISTORY_MONTHS; i++) {
    const key = addMonths(month, -i);
    if (!index.has(key)) continue;
    months++;
    flexibleByCategory(expenses.get(key)).forEach((amount, category) =>
      totals.set(category, (totals.get(category) ?? 0) + amount)
    );
  }
  if (months === 0) return totals;
  totals.forEach((amount, category) => totals.set(category, amount / months));
  return totals;
}

function paceAndPositive(
  input: HealthInput,
  month: string,
  index: MonthIndex,
  expenses: Map<string, HealthTransaction[]>,
  day: number
): Candidate[] {
  const days = daysInMonth(month);
  const whole = day >= days;
  const normals = flexibleNormals(index, expenses, month);
  const spent = flexibleByCategory(expenses.get(month));
  const alerts: Candidate[] = [];

  normals.forEach((normal, category) => {
    if (normal <= 0) return;
    const amount = spent.get(category) ?? 0;
    const expected = normal * (day / days);

    if (day >= PACE_MIN_DAY && amount > expected * PACE_FACTOR && amount - expected >= normal * 0.1) {
      alerts.push({
        month,
        type: 'category_pace',
        key: category,
        severity: 2,
        weight: amount - expected,
        message: {
          key: whole ? 'health.alert.paceMonth' : 'health.alert.pace',
          params: { category, amount, percent: percentOver(amount, expected) },
        },
      });
    }

    if (day >= POSITIVE_MIN_DAY && amount < expected * POSITIVE_FACTOR) {
      alerts.push({
        month,
        type: 'positive_category',
        key: category,
        severity: 1,
        weight: expected - amount,
        message: {
          key: 'health.alert.positive',
          params: { category, amount, percent: Math.round((1 - amount / expected) * 100) },
        },
      });
    }
  });

  return alerts;
}

function unusualTransactions(month: string, expenses: Map<string, HealthTransaction[]>): Candidate[] {
  const history = new Map<string, number[]>();
  for (let i = 1; i <= HISTORY_MONTHS; i++) {
    for (const tx of expenses.get(addMonths(month, -i)) ?? []) {
      if (tx.isFixed) continue;
      const list = history.get(tx.category);
      if (list) list.push(-tx.amount);
      else history.set(tx.category, [-tx.amount]);
    }
  }

  // One alert per merchant: its largest purchase.
  const byMerchant = new Map<string, Candidate>();
  for (const tx of expenses.get(month) ?? []) {
    if (tx.isFixed) continue;
    const samples = history.get(tx.category);
    if (!samples || samples.length < UNUSUAL_MIN_SAMPLES) continue;
    const usual = median(samples);
    const amount = -tx.amount;
    if (usual <= 0 || amount <= usual * UNUSUAL_FACTOR) continue;

    const key = merchantName(tx);
    const existing = byMerchant.get(key);
    if (existing && existing.weight >= amount) continue;
    byMerchant.set(key, {
      month,
      type: 'unusual_transaction',
      key,
      severity: 2,
      weight: amount,
      message: { key: 'health.alert.unusual', params: { merchant: key, amount, usual, category: tx.category } },
    });
  }
  return Array.from(byMerchant.values());
}

type MerchantCharges = Map<string, { name: string; amounts: number[] }>;

const chargesByMerchant = (rows: HealthTransaction[] | undefined): MerchantCharges => {
  const charges: MerchantCharges = new Map();
  for (const tx of rows ?? []) {
    const key = merchantKey(tx);
    const entry = charges.get(key);
    if (entry) entry.amounts.push(-tx.amount);
    else charges.set(key, { name: merchantName(tx), amounts: [-tx.amount] });
  }
  return charges;
};

const within = (a: number, b: number, tolerance: number): boolean =>
  Math.abs(a - b) <= Math.max(a, b) * tolerance;

function newRecurring(month: string, index: MonthIndex, expenses: Map<string, HealthTransaction[]>): Candidate[] {
  const previousMonth = addMonths(month, -1);

  // Without older statements every merchant would look new.
  let hasHistory = false;
  for (const key of index.keys()) if (key < previousMonth) hasHistory = true;
  if (!hasHistory) return [];

  const seenBefore = new Set<string>();
  expenses.forEach((rows, key) => {
    if (key >= previousMonth) return;
    rows.forEach((tx) => seenBefore.add(merchantKey(tx)));
  });

  const previous = chargesByMerchant(expenses.get(previousMonth));
  const alerts: Candidate[] = [];

  chargesByMerchant(expenses.get(month)).forEach((current, key) => {
    if (seenBefore.has(key)) return;
    const earlier = previous.get(key);
    if (!earlier) return;
    const amount = current.amounts.find((value) =>
      earlier.amounts.some((other) => within(value, other, RECURRING_TOLERANCE))
    );
    if (amount === undefined) return;

    alerts.push({
      month,
      type: 'new_recurring',
      key: current.name,
      severity: 2,
      weight: amount,
      message: { key: 'health.alert.newRecurring', params: { merchant: current.name, amount } },
    });
  });

  return alerts;
}

function priceIncreases(month: string, expenses: Map<string, HealthTransaction[]>): Candidate[] {
  const history = [1, 2, 3].map((i) => chargesByMerchant(expenses.get(addMonths(month, -i))));
  const alerts: Candidate[] = [];

  chargesByMerchant(expenses.get(month)).forEach((current, key) => {
    // A recurring merchant here: charged exactly once in this month and in each of the three before it.
    if (current.amounts.length !== 1) return;
    const earlier = history.map((charges) => charges.get(key));
    if (earlier.some((entry) => !entry || entry.amounts.length !== 1)) return;

    const usual = earlier.reduce((sum, entry) => sum + (entry?.amounts[0] ?? 0), 0) / earlier.length;
    const amount = current.amounts[0];
    if (usual <= 0 || amount <= usual * (1 + PRICE_INCREASE)) return;

    alerts.push({
      month,
      type: 'price_increase',
      key: current.name,
      severity: 2,
      weight: amount - usual,
      message: {
        key: 'health.alert.priceIncrease',
        params: { merchant: current.name, amount, usual, percent: percentOver(amount, usual) },
      },
    });
  });

  return alerts;
}

function savingsDrop(input: HealthInput, month: string, index: MonthIndex): Candidate[] {
  // The rate of a running month still moves with every bill.
  if (isPartialMonth(month, input.today)) return [];
  const previousMonth = addMonths(month, -1);
  if (!index.has(month) || !index.has(previousMonth)) return [];

  const rate = (key: string): number | null =>
    computeMetrics(input, key, index, detectNetIncome(input, key, index)).savingsRate;
  const now = rate(month);
  const before = rate(previousMonth);
  if (now === null || before === null || before - now <= SAVINGS_DROP_POINTS) return [];

  return [
    {
      month,
      type: 'savings_drop',
      key: 'savings',
      severity: 3,
      weight: before - now,
      message: { key: 'health.alert.savingsDrop', params: { from: Math.round(before), to: Math.round(now) } },
    },
  ];
}

function missedDebtPayments(input: HealthInput, month: string, index: MonthIndex, day: number): Candidate[] {
  if (!index.has(month)) return [];
  const days = daysInMonth(month);
  const paid = new Set<number>();
  for (const payment of input.debtPayments) {
    if (monthOf(payment.date) === month) paid.add(payment.debtId);
  }

  const alerts: Candidate[] = [];
  for (const debt of input.debts) {
    if (!debt.active || debt.paymentAmount <= 0 || paid.has(debt.id)) continue;
    if (debt.startDate && monthOf(debt.startDate) >= month) continue;

    const dueDay = Math.min(Math.max(1, debt.paymentDay), days);
    // Statements that stop before the due day cannot show the payment yet.
    const covered = day >= days || day >= dueDay + DEBT_GRACE_DAYS;
    if (!covered) continue;

    alerts.push({
      month,
      type: 'missed_debt_payment',
      key: debt.name,
      severity: 3,
      weight: debt.paymentAmount,
      message: { key: 'health.alert.missedDebt', params: { name: debt.name, day: dueDay } },
    });
  }
  return alerts;
}

/** Every alert the month's data supports, the most important first. Settings and mutes are applied by `selectAlerts`. */
export function buildHealthAlerts(input: HealthInput, month: string): HealthAlert[] {
  const index = indexMonths(input);
  if (!index.has(month)) return [];

  const expenses = expensesByMonth(input);
  const day = coverageDay(input, month);

  const candidates: Candidate[] = [
    ...missedDebtPayments(input, month, index, day),
    ...savingsDrop(input, month, index),
    ...newRecurring(month, index, expenses),
    ...priceIncreases(month, expenses),
    ...paceAndPositive(input, month, index, expenses, day),
    ...unusualTransactions(month, expenses),
  ];

  return candidates
    .sort((a, b) => b.severity - a.severity || b.weight - a.weight || a.key.localeCompare(b.key))
    .map(({ weight: _weight, ...alert }) => alert);
}

export const alertMuteKey = (type: AlertType, key: string): string => `${type}|${key}`;

/** Which types run: the saved switches, and the defaults for types the user never touched. */
export function enabledAlertTypes(settings: Partial<Record<AlertType, boolean>>): AlertType[] {
  return ALERT_TYPES.filter((type) => settings[type] ?? DEFAULT_ENABLED_ALERTS.includes(type));
}

/** Drops disabled types and muted keys, then keeps the three most important. Expects `buildHealthAlerts` order. */
export function selectAlerts(
  candidates: HealthAlert[],
  options: { enabled: AlertType[]; mutedKeys?: string[]; max?: number }
): HealthAlert[] {
  const muted = new Set(options.mutedKeys ?? []);
  return candidates
    .filter((alert) => options.enabled.includes(alert.type) && !muted.has(alertMuteKey(alert.type, alert.key)))
    .sort((a, b) => b.severity - a.severity)
    .slice(0, options.max ?? MAX_ALERTS_PER_RUN);
}
