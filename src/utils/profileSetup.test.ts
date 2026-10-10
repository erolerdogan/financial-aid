// Run with: npx tsx src/utils/profileSetup.test.ts
import { DEFAULT_HOUSEHOLD } from '../constants/benchmarks';
import { CURRENCY_CODES } from '../constants/currencies';
import {
  AVATAR_COLORS,
  buildHousehold,
  defaultCurrency,
  incomeOverrideToSave,
  incomePrefill,
  isProfileNameTaken,
  parseOptionalAmount,
  SETUP_STEPS,
  setupSteps,
} from './profileSetup';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

// Amounts
check('an empty amount is not given', parseOptionalAmount('') === null && parseOptionalAmount('   ') === null);
check('a number is read', parseOptionalAmount('3200') === 3200);
check('a decimal comma is read', parseOptionalAmount('3200,50') === 3200.5);
check('zero is a valid amount', parseOptionalAmount('0') === 0);
check('a negative amount is rejected', Number.isNaN(parseOptionalAmount('-5')));
check('text is rejected', Number.isNaN(parseOptionalAmount('abc')));

// Income prefill of the household sheet
check('no typed income starts with the detected average, rounded', incomePrefill(null, 3187.6) === '3188');
check('a typed income is never replaced', incomePrefill(2500, 3187.6) === '');
check('nothing detected leaves the field empty', incomePrefill(null, null) === '' && incomePrefill(null, 0.2) === '');
check('an untouched prefill is not saved as typed', incomeOverrideToSave('3188', '3188') === null);
check('a changed figure is saved', incomeOverrideToSave('3300', '3188') === 3300);
check('an empty or zero income is not saved', incomeOverrideToSave('', '3188') === null && incomeOverrideToSave('0', '') === null);
check('a typed figure without a prefill is saved', incomeOverrideToSave('3188', '') === 3188);

// Household
const skipped = buildHousehold({});
check('every step skipped gives the default household', JSON.stringify(skipped) === JSON.stringify(DEFAULT_HOUSEHOLD));

const answered = buildHousehold({ adults: 1, children: 3, housingType: 'own', incomeText: '4100', savingsText: '9000' });
check('the people and the home are kept', answered.adults === 1 && answered.children === 3 && answered.housingType === 'own');
check('the typed income is kept', answered.netIncomeOverride === 4100);
check('the savings buffer is kept', answered.safetySavings === 9000);

check('an income of 0 means "use the detected income"', buildHousehold({ incomeText: '0' }).netIncomeOverride === null);
check('a savings buffer of 0 is an answer', buildHousehold({ savingsText: '0' }).safetySavings === 0);
check('an unreadable income is left out', buildHousehold({ incomeText: 'abc' }).netIncomeOverride === null);
check('an unreadable savings buffer is left out', buildHousehold({ savingsText: '-1' }).safetySavings === null);
check(
  'only the money step skipped keeps the household answers',
  buildHousehold({ adults: 4, children: 2, housingType: 'own' }).adults === 4 &&
    buildHousehold({ adults: 4, children: 2, housingType: 'own' }).netIncomeOverride === null
);

// Currency
const supported = ['EUR', 'USD', 'GBP'];
check('a supported region currency is preselected', defaultCurrency('USD', supported) === 'USD');
check('the code is matched without case', defaultCurrency('gbp', supported) === 'GBP');
check('an unsupported currency falls back to EUR', defaultCurrency('ZZZ', supported) === 'EUR');
check('every offered currency can be the region default', defaultCurrency('TRY', CURRENCY_CODES) === 'TRY' && defaultCurrency('jpy', CURRENCY_CODES) === 'JPY');
check('no region currency falls back to EUR', defaultCurrency(null, supported) === 'EUR' && defaultCurrency(undefined, supported) === 'EUR');

// Shape
check('three steps: profile, household, money', SETUP_STEPS.join() === 'profile,household,money');
check('a new profile is asked the profile steps only', setupSteps(false).join() === 'profile,household,money');
check(
  'first launch adds the theme and the passcode lock at the end',
  setupSteps(true).join() === 'profile,household,money,appearance,security'
);
check('six avatar colours, blue first', AVATAR_COLORS.length === 6 && AVATAR_COLORS[0] === '#007AFF');

// Unique profile names
const existing = [{ id: 1, name: 'Personal' }, { id: 2, name: 'Work' }];
check('the same name is taken', isProfileNameTaken('Work', existing));
check('case and surrounding spaces are ignored', isProfileNameTaken('  personal ', existing));
check('a new name is free', !isProfileNameTaken('Family', existing));
check('a profile keeps its own name', !isProfileNameTaken('Work', existing, 2));
check('an empty name is not reported as taken', !isProfileNameTaken('  ', existing));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll checks passed.');
