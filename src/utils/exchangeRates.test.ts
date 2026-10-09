// Run with: npx tsx src/utils/exchangeRates.test.ts
import {
  conversionFactor,
  convertAmount,
  isFresh,
  parseRatesResponse,
  parseStoredRates,
} from './exchangeRates';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const NOW = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;
const answer = (extra: Record<string, unknown> = {}) => ({
  result: 'success',
  base_code: 'USD',
  time_last_update_unix: NOW / 1000 - 3600,
  time_next_update_unix: NOW / 1000 + 20 * 3600,
  rates: { USD: 1, EUR: 0.8, JPY: 160, KWD: 0.32 },
  ...extra,
});

// Reading the answer
const table = parseRatesResponse(answer(), NOW);
check('a good answer is read', table !== null && table.base === 'USD' && table.rates.EUR === 0.8);
check('the update times are kept in milliseconds', table?.updatedAt === NOW - HOUR && table?.nextUpdateAt === NOW + 20 * HOUR);
check('an error answer is refused', parseRatesResponse({ result: 'error', 'error-type': 'unsupported-code' }, NOW) === null);
check('an answer without rates is refused', parseRatesResponse(answer({ rates: undefined }), NOW) === null);
check('an answer without its own base is refused', parseRatesResponse(answer({ rates: { EUR: 0.8 } }), NOW) === null);
check('text is refused', parseRatesResponse('<html>', NOW) === null && parseRatesResponse(null, NOW) === null);
const odd = parseRatesResponse(answer({ rates: { USD: 1, EUR: 0, GBP: -1, CHF: '0.9', usd: 2, JPY: 160 } }), NOW);
check('a rate that is not a positive number is left out', JSON.stringify(Object.keys(odd?.rates ?? {})) === '["USD","JPY"]', JSON.stringify(odd?.rates));
check(
  'a table lasts at least an hour, whatever the answer says',
  parseRatesResponse(answer({ time_next_update_unix: NOW / 1000 - 60 }), NOW)?.nextUpdateAt === NOW + HOUR &&
    parseRatesResponse(answer({ time_next_update_unix: undefined }), NOW)?.nextUpdateAt === NOW + HOUR
);

// Freshness
check('a table is fresh until its next update', table !== null && isFresh(table, NOW + 19 * HOUR));
check('after the next update it is not', table !== null && !isFresh(table, NOW + 20 * HOUR));

// Storage
check('a stored table reads back the same', JSON.stringify(parseStoredRates(JSON.stringify(table))) === JSON.stringify(table));
check('nothing stored is no table', parseStoredRates(null) === null && parseStoredRates('') === null);
check('damaged storage is no table', parseStoredRates('{"base":"USD"') === null && parseStoredRates('{"base":"USD","rates":{"EUR":"x"},"updatedAt":1,"nextUpdateAt":2}') === null);

// Converting
if (table) {
  check('from the base', conversionFactor(table, 'USD', 'EUR') === 0.8);
  check('between two other currencies', conversionFactor(table, 'EUR', 'JPY') === 200, String(conversionFactor(table, 'EUR', 'JPY')));
  check('the same currency is 1', conversionFactor(table, 'EUR', 'EUR') === 1 && conversionFactor(table, 'ZZZ', 'ZZZ') === 1);
  check('a currency the table lacks gives no factor', conversionFactor(table, 'EUR', 'ZZZ') === null && conversionFactor(table, 'ZZZ', 'EUR') === null);
}
check('yen has no decimals', convertAmount(12.34, 200, 0) === 2468);
check('euro has two', convertAmount(1000, 0.00625, 2) === 6.25 && convertAmount(-19.99, 0.8, 2) === -15.99);
check('dinar has three', convertAmount(10, 0.4, 3) === 4 && convertAmount(12.34, 0.4, 3) === 4.936);

if (failures > 0) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll checks passed');
