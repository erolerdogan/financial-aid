// Run with: npx tsx src/utils/storeLinks.test.ts
import { getStoreLinks, STORE_IDS } from './storeLinks';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const ids = { appStoreId: '1234567890', androidPackage: 'com.example.app' };

// iOS
const ios = getStoreLinks('ios', ids);
check('iOS rate opens the store page', ios?.rate === 'https://apps.apple.com/app/id1234567890', ios?.rate);
check(
  'iOS review opens the review sheet',
  ios?.review === 'https://apps.apple.com/app/id1234567890?action=write-review',
  ios?.review,
);
check('an "id" prefix is accepted', getStoreLinks('ios', { ...ids, appStoreId: 'id1234567890' })?.rate === ios?.rate);
check('no App Store ID, no links', getStoreLinks('ios', { ...ids, appStoreId: null }) === null);
check('an empty App Store ID, no links', getStoreLinks('ios', { ...ids, appStoreId: ' ' }) === null);
check('a non-numeric App Store ID, no links', getStoreLinks('ios', { ...ids, appStoreId: 'com.example' }) === null);

// Android
const android = getStoreLinks('android', ids);
check(
  'Android rate opens the store page',
  android?.rate === 'https://play.google.com/store/apps/details?id=com.example.app',
  android?.rate,
);
check(
  'Android review opens the reviews',
  android?.review === 'https://play.google.com/store/apps/details?id=com.example.app&showAllReviews=true',
  android?.review,
);
check('no package, no links', getStoreLinks('android', { ...ids, androidPackage: null }) === null);

// Other platforms and the shipped IDs
check('web has no store', getStoreLinks('web', ids) === null);
check('the shipped Android package is the one in app.json', STORE_IDS.androidPackage === 'com.financialaid.app');

if (failures > 0) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll checks passed');
