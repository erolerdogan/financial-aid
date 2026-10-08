// Run with: npx tsx src/utils/healthAlerts.test.ts
import { DEFAULT_CATEGORY_GROUPS } from '../constants/benchmarks';
import type { HealthDebt, HealthDebtPayment, HealthInput, HealthTransaction } from './budgetHealth';
import {
  ALERT_TYPES,
  alertMuteKey,
  buildHealthAlerts,
  DEFAULT_ENABLED_ALERTS,
  enabledAlertTypes,
  MAX_ALERTS_PER_RUN,
  selectAlerts,
  type AlertType,
  type HealthAlert,
} from './healthAlerts';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

let nextId = 1;

const tx = (date: string, amount: number, category: string, merchant: string, isFixed = false): HealthTransaction => ({
  id: nextId++,
  date,
  amount,
  category,
  merchant,
  rawDescription: merchant,
  isFixed,
});

interface MonthSpec {
  energy?: number;
  groceries?: number;
  dining?: number;
  /** Last day of the month that has transactions; rows after it are left out. */
  until?: number;
}

/** Salary, rent, energy and the car loan are fixed; groceries and dining are flexible, split over the month. */
const monthRows = (month: string, spec: MonthSpec = {}): HealthTransaction[] => {
  const energy = spec.energy ?? 200;
  const groceries = spec.groceries ?? 500;
  const dining = spec.dining ?? 300;
  const rows = [
    tx(`${month}-01`, -1200, 'Housing', 'Landlord', true),
    tx(`${month}-03`, -energy, 'Utilities & Telecom', 'Energy Co', true),
    tx(`${month}-05`, -200, 'Loan & Insurance', 'Car Loan Bank', true),
    tx(`${month}-08`, -groceries / 2, 'Groceries', 'Supermarket'),
    tx(`${month}-12`, -dining / 2, 'Dining Out', 'Bistro'),
    tx(`${month}-20`, -groceries / 2, 'Groceries', 'Supermarket'),
    tx(`${month}-22`, -dining / 2, 'Dining Out', 'Bistro'),
    tx(`${month}-25`, 4000, 'Income', 'Employer', true),
    tx(`${month}-26`, -400, 'Financial Transfers', 'Savings Account', true),
  ];
  const until = spec.until;
  return until === undefined ? rows : rows.filter((row) => Number(row.date.slice(8, 10)) <= until);
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

const payments = (months: string[]): HealthDebtPayment[] => months.map((month) => ({ debtId: 1, date: `${month}-05`, amount: 200 }));

const MONTHS = ['2026-06', '2026-07', '2026-08', '2026-09'];

const makeInput = (specs: Record<string, MonthSpec> = {}, overrides: Partial<HealthInput> = {}): HealthInput => ({
  transactions: MONTHS.flatMap((month) => monthRows(month, specs[month])),
  debts: [CAR_LOAN],
  debtPayments: payments(MONTHS),
  categoryGroups: { ...DEFAULT_CATEGORY_GROUPS },
  household: null,
  overrides: {},
  today: '2026-10-07',
  ...overrides,
});

const ofType = (alerts: HealthAlert[], type: AlertType): HealthAlert[] => alerts.filter((alert) => alert.type === type);

// --- Quiet month ---------------------------------------------------------
{
  const alerts = buildHealthAlerts(makeInput(), '2026-09');
  check('a month like the others raises nothing', alerts.length === 0, alerts.map((a) => a.type).join(','));
  check('a month without data raises nothing', buildHealthAlerts(makeInput(), '2026-03').length === 0);
  check('no transactions at all', buildHealthAlerts(makeInput({}, { transactions: [] }), '2026-09').length === 0);
}

// --- Missed debt payment -------------------------------------------------
{
  const missed = buildHealthAlerts(makeInput({}, { debtPayments: payments(['2026-06', '2026-07', '2026-08']) }), '2026-09');
  const alert = ofType(missed, 'missed_debt_payment')[0];
  check('no payment in a complete month', !!alert);
  check('missed payment key is the debt name', alert?.key === 'Car loan');
  check('missed payment message', alert?.message.key === 'health.alert.missedDebt' && alert.message.params?.day === 5);
  check('missed payment is the most severe', alert?.severity === 3 && missed[0].type === 'missed_debt_payment');

  check('paid: no alert', ofType(buildHealthAlerts(makeInput(), '2026-09'), 'missed_debt_payment').length === 0);

  const paidOff = makeInput({}, { debts: [{ ...CAR_LOAN, active: false }], debtPayments: [] });
  check('paid-off debt: no alert', ofType(buildHealthAlerts(paidOff, '2026-09'), 'missed_debt_payment').length === 0);

  const newDebt = makeInput({}, { debts: [{ ...CAR_LOAN, startDate: '2026-09-20' }], debtPayments: [] });
  check('debt that started this month: no alert', ofType(buildHealthAlerts(newDebt, '2026-09'), 'missed_debt_payment').length === 0);

  const noPayment = makeInput({}, { debts: [{ ...CAR_LOAN, paymentAmount: 0 }], debtPayments: [] });
  check('debt without a monthly payment: no alert', ofType(buildHealthAlerts(noPayment, '2026-09'), 'missed_debt_payment').length === 0);

  // Running month: statements up to the 3rd cannot show a payment due on the 5th.
  const early = makeInput({}, { today: '2026-10-20' });
  early.transactions.push(...monthRows('2026-10', { until: 3 }));
  check('statement stops before the due day: no alert', ofType(buildHealthAlerts(early, '2026-10'), 'missed_debt_payment').length === 0);

  // Statements up to the 8th cover the due day plus three days of grace.
  const late = makeInput({}, { today: '2026-10-20' });
  late.transactions.push(...monthRows('2026-10', { until: 8 }));
  check('statement covers the due day: alert', ofType(buildHealthAlerts(late, '2026-10'), 'missed_debt_payment').length === 1);

  const latePaid = makeInput({}, { today: '2026-10-20', debtPayments: payments([...MONTHS, '2026-10']) });
  latePaid.transactions.push(...monthRows('2026-10', { until: 8 }));
  check('running month, paid: no alert', ofType(buildHealthAlerts(latePaid, '2026-10'), 'missed_debt_payment').length === 0);

  const endOfMonth: HealthDebt = { ...CAR_LOAN, paymentDay: 31 };
  const short = makeInput({}, { debts: [endOfMonth], debtPayments: [] });
  check('due day past the end of the month is clamped', ofType(buildHealthAlerts(short, '2026-09'), 'missed_debt_payment')[0]?.message.params?.day === 30);
}

// --- New recurring charge ------------------------------------------------
{
  const input = makeInput();
  input.transactions.push(tx('2026-08-14', -12.99, 'Shopping & Retail', 'Streamio'), tx('2026-09-14', -12.99, 'Shopping & Retail', 'Streamio'));
  const alert = ofType(buildHealthAlerts(input, '2026-09'), 'new_recurring')[0];
  check('same merchant and amount two months in a row', alert?.key === 'Streamio');
  check('new recurring message', alert?.message.key === 'health.alert.newRecurring' && alert.message.params?.amount === 12.99);
  check('first occurrence alone: no alert', ofType(buildHealthAlerts(input, '2026-08'), 'new_recurring').length === 0);

  const tolerance = makeInput();
  tolerance.transactions.push(tx('2026-08-14', -12.99, 'Shopping & Retail', 'Streamio'), tx('2026-09-14', -13.99, 'Shopping & Retail', 'Streamio'));
  check('amount within 10%: alert', ofType(buildHealthAlerts(tolerance, '2026-09'), 'new_recurring').length === 1);

  const different = makeInput();
  different.transactions.push(tx('2026-08-14', -12.99, 'Shopping & Retail', 'Streamio'), tx('2026-09-14', -29.99, 'Shopping & Retail', 'Streamio'));
  check('amount far apart: no alert', ofType(buildHealthAlerts(different, '2026-09'), 'new_recurring').length === 0);

  const known = makeInput();
  known.transactions.push(
    tx('2026-06-14', -12.99, 'Shopping & Retail', 'Streamio'),
    tx('2026-08-14', -12.99, 'Shopping & Retail', 'Streamio'),
    tx('2026-09-14', -12.99, 'Shopping & Retail', 'Streamio')
  );
  check('merchant seen before: no alert', ofType(buildHealthAlerts(known, '2026-09'), 'new_recurring').length === 0);

  // First import of two months: everything would look new.
  const firstImport = makeInput({}, { transactions: [...monthRows('2026-08'), ...monthRows('2026-09')], debtPayments: payments(['2026-08', '2026-09']) });
  check('no older statements: no alert', ofType(buildHealthAlerts(firstImport, '2026-09'), 'new_recurring').length === 0);

  const refund = makeInput();
  refund.transactions.push(tx('2026-08-14', 12.99, 'Income', 'Streamio'), tx('2026-09-14', 12.99, 'Income', 'Streamio'));
  check('money coming in is not a charge', ofType(buildHealthAlerts(refund, '2026-09'), 'new_recurring').length === 0);
}

// --- Price increase ------------------------------------------------------
{
  const up = buildHealthAlerts(makeInput({ '2026-09': { energy: 240 } }), '2026-09');
  const alert = ofType(up, 'price_increase')[0];
  check('20% above the 3-month average', alert?.key === 'Energy Co');
  check('price increase figures', alert?.message.params?.amount === 240 && alert.message.params?.usual === 200 && alert.message.params?.percent === 20);

  check('12.5% is not enough', ofType(buildHealthAlerts(makeInput({ '2026-09': { energy: 225 } }), '2026-09'), 'price_increase').length === 0);
  check('a lower price: no alert', ofType(buildHealthAlerts(makeInput({ '2026-09': { energy: 150 } }), '2026-09'), 'price_increase').length === 0);

  const shortHistory = makeInput({ '2026-09': { energy: 240 } }, { transactions: ['2026-07', '2026-08'].flatMap((m) => monthRows(m)).concat(monthRows('2026-09', { energy: 240 })) });
  check('needs three earlier months', ofType(buildHealthAlerts(shortHistory, '2026-09'), 'price_increase').length === 0);

  // The supermarket is charged twice a month, so it is not a single recurring charge.
  check('several charges a month are not compared', ofType(buildHealthAlerts(makeInput({ '2026-09': { groceries: 900 } }), '2026-09'), 'price_increase').length === 0);
}

// --- Category pace -------------------------------------------------------
{
  const whole = buildHealthAlerts(makeInput({ '2026-09': { groceries: 700 } }), '2026-09');
  const alert = ofType(whole, 'category_pace')[0];
  check('40% above normal over a whole month', alert?.key === 'Groceries' && alert.message.key === 'health.alert.paceMonth');
  check('pace figures', alert?.message.params?.amount === 700 && alert.message.params?.percent === 40);
  check('15% above normal: no alert', ofType(buildHealthAlerts(makeInput({ '2026-09': { groceries: 575 } }), '2026-09'), 'category_pace').length === 0);

  // Running month, statements up to the 15th: usual pace is 500 * 15 / 31 = 242; 400 is 65% above.
  const running = makeInput({}, { today: '2026-10-16' });
  running.transactions.push(...monthRows('2026-10', { groceries: 800, until: 15 }), tx('2026-10-15', -4, 'Transportation', 'Bus'));
  const runningAlerts = buildHealthAlerts(running, '2026-10');
  const pace = ofType(runningAlerts, 'category_pace').find((a) => a.key === 'Groceries');
  check('ahead of pace mid-month', pace?.message.key === 'health.alert.pace' && pace.message.params?.amount === 400, JSON.stringify(pace?.message.params));
  check('pace percent', pace?.message.params?.percent === 65);
  check('rent on the 1st is fixed and never "ahead of pace"', !ofType(runningAlerts, 'category_pace').some((a) => a.key === 'Housing'));
  check('dining on pace: no alert', !ofType(runningAlerts, 'category_pace').some((a) => a.key === 'Dining Out'));

  const firstDays = makeInput({}, { today: '2026-10-04' });
  firstDays.transactions.push(tx('2026-10-02', -300, 'Groceries', 'Supermarket'));
  check('first days of the month: no pace alert', ofType(buildHealthAlerts(firstDays, '2026-10'), 'category_pace').length === 0);

  const noHistory = makeInput({}, { transactions: monthRows('2026-09', { groceries: 900 }), debtPayments: payments(['2026-09']) });
  check('no normal yet: no pace alert', ofType(buildHealthAlerts(noHistory, '2026-09'), 'category_pace').length === 0);
}

// --- Unusual transaction -------------------------------------------------
{
  const withHistory = (amount: number): HealthInput => {
    const input = makeInput();
    for (const month of ['2026-06', '2026-07', '2026-08']) {
      input.transactions.push(tx(`${month}-09`, -30, 'Shopping & Retail', 'Corner Shop'), tx(`${month}-19`, -40, 'Shopping & Retail', 'Corner Shop'));
    }
    input.transactions.push(tx('2026-09-11', -amount, 'Shopping & Retail', 'Electro World'));
    return input;
  };

  // Median of 30, 40, 30, 40, 30, 40 is 35; three times that is 105.
  const big = ofType(buildHealthAlerts(withHistory(450), '2026-09'), 'unusual_transaction')[0];
  check('more than three times the median', big?.key === 'Electro World');
  check('unusual figures', big?.message.params?.amount === 450 && big.message.params?.usual === 35 && big.message.params?.category === 'Shopping & Retail');
  check('at three times the median: no alert', ofType(buildHealthAlerts(withHistory(105), '2026-09'), 'unusual_transaction').length === 0);

  const rent = makeInput();
  rent.transactions.push(tx('2026-09-02', -5000, 'Housing', 'Notary', true));
  check('fixed costs are not judged', ofType(buildHealthAlerts(rent, '2026-09'), 'unusual_transaction').length === 0);

  const fewSamples = makeInput();
  fewSamples.transactions.push(tx('2026-08-09', -30, 'Hobby', 'Hobby Shop'), tx('2026-09-09', -900, 'Hobby', 'Hobby Shop'));
  check('too few earlier purchases: no alert', ofType(buildHealthAlerts(fewSamples, '2026-09'), 'unusual_transaction').length === 0);

  const twice = withHistory(450);
  twice.transactions.push(tx('2026-09-13', -300, 'Shopping & Retail', 'Electro World'));
  const twiceAlerts = ofType(buildHealthAlerts(twice, '2026-09'), 'unusual_transaction');
  check('one alert per merchant, for the largest', twiceAlerts.length === 1 && twiceAlerts[0].message.params?.amount === 450);
}

// --- Savings rate --------------------------------------------------------
{
  // Usual: income 4000, spending 2400 → 40%. Dining 700 instead of 300 → 30%.
  const drop = ofType(buildHealthAlerts(makeInput({ '2026-09': { dining: 700 } }), '2026-09'), 'savings_drop')[0];
  check('a drop of 10 points', drop?.message.params?.from === 40 && drop.message.params?.to === 30);
  check('savings drop severity', drop?.severity === 3 && drop.key === 'savings');

  check('a drop of 6 points: no alert', ofType(buildHealthAlerts(makeInput({ '2026-09': { dining: 540 } }), '2026-09'), 'savings_drop').length === 0);
  check('a rise: no alert', ofType(buildHealthAlerts(makeInput({ '2026-09': { dining: 0 } }), '2026-09'), 'savings_drop').length === 0);

  const running = makeInput({}, { today: '2026-10-28' });
  running.transactions.push(...monthRows('2026-10', { dining: 2000 }));
  check('running month: no savings alert', ofType(buildHealthAlerts(running, '2026-10'), 'savings_drop').length === 0);

  const gap = makeInput({ '2026-09': { dining: 700 } }, { transactions: [...monthRows('2026-06'), ...monthRows('2026-09', { dining: 700 })] });
  check('no previous month to compare with: no alert', ofType(buildHealthAlerts(gap, '2026-09'), 'savings_drop').length === 0);
}

// --- Positive ------------------------------------------------------------
{
  const good = ofType(buildHealthAlerts(makeInput({ '2026-09': { dining: 100 } }), '2026-09'), 'positive_category')[0];
  check('clearly below normal', good?.key === 'Dining Out' && good.severity === 1);
  check('positive figures', good?.message.params?.amount === 100 && good.message.params?.percent === 67);
  check('10% below normal is not "clearly"', ofType(buildHealthAlerts(makeInput({ '2026-09': { dining: 270 } }), '2026-09'), 'positive_category').length === 0);

  const early = makeInput({}, { today: '2026-10-16' });
  early.transactions.push(...monthRows('2026-10', { dining: 20, until: 15 }));
  check('mid-month: too early for good news', ofType(buildHealthAlerts(early, '2026-10'), 'positive_category').length === 0);
}

// --- Selection -----------------------------------------------------------
{
  const busy = makeInput({ '2026-09': { energy: 240, groceries: 700, dining: 100 } }, { debtPayments: payments(['2026-06', '2026-07', '2026-08']) });
  busy.transactions.push(tx('2026-08-14', -12.99, 'Shopping & Retail', 'Streamio'), tx('2026-09-14', -12.99, 'Shopping & Retail', 'Streamio'));
  const all = buildHealthAlerts(busy, '2026-09');
  const types = all.map((alert) => alert.type);
  check('several alert types at once', ['missed_debt_payment', 'new_recurring', 'price_increase', 'category_pace', 'positive_category'].every((type) => types.includes(type as AlertType)), types.join(','));
  check('ordered by severity', all.every((alert, i) => i === 0 || all[i - 1].severity >= alert.severity));
  check('good news comes last', all[all.length - 1].type === 'positive_category');

  check('default switches', enabledAlertTypes({}).join(',') === DEFAULT_ENABLED_ALERTS.join(','));
  check('a saved switch wins over the default', !enabledAlertTypes({ new_recurring: false }).includes('new_recurring'));
  check('turning a type on', enabledAlertTypes({ positive_category: true }).includes('positive_category'));
  check('every type known', ALERT_TYPES.length === 7);

  const byDefault = selectAlerts(all, { enabled: enabledAlertTypes({}) });
  check('defaults keep only the two default types', byDefault.length === 2 && byDefault.every((a) => DEFAULT_ENABLED_ALERTS.includes(a.type)));

  const everything = selectAlerts(all, { enabled: ALERT_TYPES });
  check('at most three per run', everything.length === MAX_ALERTS_PER_RUN);
  check('the most severe is kept', everything[0].type === 'missed_debt_payment');
  check('good news is squeezed out by three more important alerts', !everything.some((a) => a.type === 'positive_category'));

  const muted = selectAlerts(all, { enabled: ALERT_TYPES, mutedKeys: [alertMuteKey('missed_debt_payment', 'Car loan')] });
  check('a muted key is skipped', !muted.some((a) => a.type === 'missed_debt_payment') && muted.length === 3);

  const otherType = selectAlerts(all, { enabled: ALERT_TYPES, mutedKeys: [alertMuteKey('price_increase', 'Car loan')] });
  check('a mute is per type', otherType.some((a) => a.type === 'missed_debt_payment'));

  check('nothing enabled: nothing kept', selectAlerts(all, { enabled: [] }).length === 0);
  check('custom max', selectAlerts(all, { enabled: ALERT_TYPES, max: 1 }).length === 1);

  const onlyGood = selectAlerts(buildHealthAlerts(makeInput({ '2026-09': { dining: 100 } }), '2026-09'), { enabled: ALERT_TYPES });
  check('good news shows when there is room', onlyGood.some((a) => a.type === 'positive_category'));
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
if (failures > 0) process.exit(1);
