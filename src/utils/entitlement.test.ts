// Run with: npx tsx src/utils/entitlement.test.ts
import { FEATURES } from '@/constants/features';
import {
  can,
  canAdd,
  editableIds,
  isItemReadOnly,
  isProfileReadOnly,
  isProSource,
  isThemeLocked,
  limit,
  resolveSource,
  shouldOfferPro,
} from './entitlement';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

// Source
check('no override is free', resolveSource(null, true) === 'free');
check('override in a testing build is dev', resolveSource('1', true) === 'dev');
check('override is ignored when testing is off', resolveSource('1', false) === 'free');
check('override off is ignored when testing is off', resolveSource('0', false) === 'free');
check('no override is free when testing is off', resolveSource(null, false) === 'free');
check('override off is free', resolveSource('0', true) === 'free');
check('free is not pro', !isProSource('free'));
check('dev counts as pro', isProSource('dev'));
check('pro counts as pro', isProSource('pro'));

// can()
for (const flag of FEATURES.flags) {
  check(`free cannot ${flag}`, !can(false, flag));
  check(`pro can ${flag}`, can(true, flag));
}

// limit()
check('free: one profile', limit(false, 'maxProfiles') === 1);
check('free: three budgets', limit(false, 'maxBudgets') === 3);
check('free: two debts', limit(false, 'maxDebts') === 2);
check('pro: no profile limit', limit(true, 'maxProfiles') === Infinity);
check('pro: no budget limit', limit(true, 'maxBudgets') === Infinity);
check('pro: no debt limit', limit(true, 'maxDebts') === Infinity);

// Adding
check('free: third budget is allowed', canAdd(false, 'maxBudgets', 2));
check('free: fourth budget is not', !canAdd(false, 'maxBudgets', 3));
check('free: second debt is allowed', canAdd(false, 'maxDebts', 1));
check('free: third debt is not', !canAdd(false, 'maxDebts', 2));
check('free: second profile is not', !canAdd(false, 'maxProfiles', 1));
check('pro: tenth profile is allowed', canAdd(true, 'maxProfiles', 9));
check('pro: fourth budget is allowed', canAdd(true, 'maxBudgets', 3));

// Read-only items: the oldest stay editable
const debts = [4, 7, 9, 12];
check('free: the two oldest debts stay editable', editableIds(false, 'maxDebts', debts).join(',') === '4,7');
check('pro: every debt is editable', editableIds(true, 'maxDebts', debts).join(',') === '4,7,9,12');
check('free: second debt is editable', !isItemReadOnly(false, 'maxDebts', debts, 7));
check('free: third debt is read-only', isItemReadOnly(false, 'maxDebts', debts, 9));
check('free: fourth debt is read-only', isItemReadOnly(false, 'maxDebts', debts, 12));
check('pro: fourth debt is editable', !isItemReadOnly(true, 'maxDebts', debts, 12));
check('an unknown id is not read-only', !isItemReadOnly(false, 'maxDebts', debts, 99));
check(
  'deleting an old debt makes the next one editable',
  !isItemReadOnly(false, 'maxDebts', debts.filter((id) => id !== 4), 9)
);

const budgets = ['Groceries', 'Dining', 'Transport', 'Shopping'];
check('free: third budget is editable', !isItemReadOnly(false, 'maxBudgets', budgets, 'Transport'));
check('free: fourth budget is read-only', isItemReadOnly(false, 'maxBudgets', budgets, 'Shopping'));
check('free: a category without a budget is not read-only', !isItemReadOnly(false, 'maxBudgets', budgets, 'Health'));

// Read-only profiles
check('free: the only profile is editable', !isProfileReadOnly(false, [1], 1, false));
check('free: the oldest profile is editable', !isProfileReadOnly(false, [1, 2, 3], 1, false));
check('free: an extra profile is read-only', isProfileReadOnly(false, [1, 2, 3], 2, false));
check('pro: an extra profile is editable', !isProfileReadOnly(true, [1, 2, 3], 3, false));
check('the demo workspace is never read-only', !isProfileReadOnly(false, [1], 2, true));
check('no active profile is not read-only', !isProfileReadOnly(false, [1, 2], null, false));
check('free: the oldest profile left is editable', !isProfileReadOnly(false, [2, 3], 2, false));

// Themes
check('free: Classic is open', !isThemeLocked(false, 'classic'));
check('free: Sunset is open', !isThemeLocked(false, 'sunset'));
check('free: Aurora is open', !isThemeLocked(false, 'aurora'));
check('free: Midnight Gold is locked', isThemeLocked(false, 'midnightGold'));
check('free: Orchid is locked', isThemeLocked(false, 'orchid'));
check('pro: Orchid is open', !isThemeLocked(true, 'orchid'));

// One-time offer
const offer = { isPro: false, isDemo: false, readOnly: false, imports: 1, shown: false };
check('offer after the first import', shouldOfferPro(offer));
check('no offer before an import', !shouldOfferPro({ ...offer, imports: 0 }));
check('no offer twice', !shouldOfferPro({ ...offer, shown: true }));
check('no offer for pro', !shouldOfferPro({ ...offer, isPro: true }));
check('no offer in the demo', !shouldOfferPro({ ...offer, isDemo: true }));
check('no offer on a read-only profile', !shouldOfferPro({ ...offer, readOnly: true }));
check('offer still due after a later import', shouldOfferPro({ ...offer, imports: 5 }));

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
if (failures > 0) process.exit(1);
