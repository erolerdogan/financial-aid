// Run with: npx tsx src/utils/manualEntry.test.ts
import { buildManualEntry, dateKey, isManualEntryType, parseAmountInput, signedAmount } from './manualEntry';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const amount = (label: string, text: string, decimals: number, expected: number | null): void => {
  const got = parseAmountInput(text, decimals);
  check(`amount: ${label}`, got === expected, `${text} → ${got}`);
};

amount('plain', '12', 2, 12);
amount('decimal point', '12.50', 2, 12.5);
amount('decimal comma', '12,50', 2, 12.5);
amount('one decimal digit', '4,5', 2, 4.5);
amount('point thousands, comma decimals', '1.234,56', 2, 1234.56);
amount('comma thousands, point decimals', '1,234.56', 2, 1234.56);
amount('three digits after one separator is thousands', '1.234', 2, 1234);
amount('repeated separator is thousands', '1.234.567', 2, 1234567);
amount('spaces as thousands', '1 234,50', 2, 1234.5);
amount('leading separator', ',5', 2, 0.5);
amount('rounded to the currency decimals', '2,999', 3, 2.999);
amount('more digits than the currency has', '2.9999', 2, 3);
amount('no decimals: separator is thousands', '1.500', 0, 1500);
amount('no decimals: short fraction is thousands too', '12,5', 0, 125);
amount('three decimals: three digits are a fraction', '1.234', 3, 1.234);
amount('zero', '0', 2, null);
amount('zero with decimals', '0,00', 2, null);
amount('empty', '', 2, null);
amount('negative', '-5', 2, null);
amount('letters', '12a', 2, null);
amount('symbol', '€12', 2, null);

check('sign: expense is negative', signedAmount('expense', 12.5) === -12.5);
check('sign: income is positive', signedAmount('income', 12.5) === 12.5);
check('sign: a negative value is not flipped back', signedAmount('expense', -3) === -3);

check('type: expense', isManualEntryType('expense'));
check('type: income', isManualEntryType('income'));
check('type: anything else', !isManualEntryType('transfer') && !isManualEntryType(undefined));

check('date key pads month and day', dateKey(new Date(2026, 0, 5)) === '2026-01-05');

const TODAY = '2026-10-10';
const base = { type: 'expense' as const, amountText: '12,50', description: '  Corner   market ', date: '2026-10-09' };

const good = buildManualEntry(base, 2, TODAY);
check('entry: stored negative', good.ok && good.amount === -12.5);
check('entry: description is trimmed and collapsed', good.ok && good.description === 'Corner market');
check('entry: month comes from the date', good.ok && good.monthName === '2026-10');

const income = buildManualEntry({ ...base, type: 'income' }, 2, TODAY);
check('entry: income is positive', income.ok && income.amount === 12.5);

const error = (input: Partial<typeof base>): string => {
  const result = buildManualEntry({ ...base, ...input }, 2, TODAY);
  return result.ok ? 'ok' : result.error;
};
check('entry: no amount', error({ amountText: '' }) === 'amount');
check('entry: zero amount', error({ amountText: '0' }) === 'amount');
check('entry: empty description', error({ description: '   ' }) === 'description');
check('entry: today is allowed', error({ date: TODAY }) === 'ok');
check('entry: tomorrow is refused', error({ date: '2026-10-11' }) === 'date');
check('entry: malformed date', error({ date: '10-10-2026' }) === 'date');
check('entry: amount is checked first', error({ amountText: 'x', description: '' }) === 'amount');

if (failures > 0) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll checks passed');
