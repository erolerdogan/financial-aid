// Run with: npx tsx src/utils/profileSetup.test.ts
import { DEFAULT_HOUSEHOLD } from '../constants/benchmarks';
import { AVATAR_COLORS, buildHousehold, defaultCurrency, parseOptionalAmount, SETUP_STEPS, setupSteps } from './profileSetup';

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
check('an unsupported currency falls back to EUR', defaultCurrency('TRY', supported) === 'EUR');
check('no region currency falls back to EUR', defaultCurrency(null, supported) === 'EUR' && defaultCurrency(undefined, supported) === 'EUR');

// Shape
check('three steps: profile, household, money', SETUP_STEPS.join() === 'profile,household,money');
check('a new profile is asked the profile steps only', setupSteps(false).join() === 'profile,household,money');
check(
  'first launch adds the theme and the passcode lock at the end',
  setupSteps(true).join() === 'profile,household,money,appearance,security'
);
check('six avatar colours, blue first', AVATAR_COLORS.length === 6 && AVATAR_COLORS[0] === '#007AFF');

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll checks passed.');
