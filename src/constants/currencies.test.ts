// Run with: npx tsx src/constants/currencies.test.ts
import { LANGUAGES } from '../i18n';
import { CURRENCY_NAMES, currencyLabel } from '../i18n/currencyNames';
import { CURRENCIES, CURRENCY_CODES, currencyInfo } from './currencies';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  if (!condition) console.log(`FAIL  ${label}${detail ? `  (${detail})` : ''}`);
};

check('well over a hundred currencies', CURRENCY_CODES.length > 140, String(CURRENCY_CODES.length));
check('sorted by code', CURRENCY_CODES.join() === [...CURRENCY_CODES].sort().join());

for (const code of CURRENCY_CODES) {
  const { symbol, decimals } = CURRENCIES[code];
  check(`${code}: three capital letters`, /^[A-Z]{3}$/.test(code));
  check(`${code}: has a symbol`, symbol.trim().length > 0);
  check(`${code}: a symbol that ends in a letter ends in a space`, !/[\p{L}.]$/u.test(symbol), symbol);
  check(`${code}: 0, 2 or 3 decimals`, [0, 2, 3].includes(decimals), String(decimals));
  for (const { code: language } of LANGUAGES) {
    const name = CURRENCY_NAMES[language][code];
    check(`${code}: named in ${language}`, typeof name === 'string' && name.trim().length > 0 && name !== code);
  }
}

// The first seven currencies look as they always did.
const first: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CAD: 'CA$', AUD: 'A$', CHF: 'CHF ' };
for (const [code, symbol] of Object.entries(first)) {
  check(`${code} keeps its symbol`, currencyInfo(code).symbol === symbol, currencyInfo(code).symbol);
}

check('yen has no decimals', currencyInfo('JPY').decimals === 0);
check('euro has two', currencyInfo('EUR').decimals === 2);
check('Kuwaiti dinar has three', currencyInfo('KWD').decimals === 3);
check('no currency means euro', currencyInfo(null).symbol === '€' && currencyInfo(undefined).symbol === '€' && currencyInfo('').symbol === '€');
check(
  'an unknown code is shown by its code, with two decimals',
  currencyInfo('ZZZ').symbol === 'ZZZ ' && currencyInfo('ZZZ').decimals === 2
);
check('a prototype name is not a currency', currencyInfo('constructor').symbol === 'constructor ');

check('a name follows the language', currencyLabel('JPY', 'en') === 'Japanese Yen' && currencyLabel('JPY', 'de') === 'Japanischer Yen', currencyLabel('JPY', 'de'));
check('an unknown code is its own name', currencyLabel('ZZZ', 'nl') === 'ZZZ' && currencyLabel('constructor', 'en') === 'constructor');

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll checks passed.');
