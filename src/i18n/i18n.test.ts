// Run with: npx tsx src/i18n/i18n.test.ts
import { createFormatters } from './format';
import { DICTIONARIES, LANGUAGES, pluralForm, resolveLanguage, resolveTag, translate } from './index';
import { en } from './locales/en';

let failures = 0;

function check(name: string, pass: boolean, detail = '') {
  if (!pass) failures++;
  if (!pass) console.log(`FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

const placeholders = (text: string): string => Array.from(new Set(text.match(/\{\w+\}/g) ?? [])).sort().join(',');
const english: Record<string, string> = en;
const EXTRA_FORMS = /_(few|many)$/;

for (const { code } of LANGUAGES) {
  const dictionary = DICTIONARIES[code];
  check(`${code}: dictionary exists`, !!dictionary);
  if (!dictionary) continue;

  for (const key of Object.keys(english)) {
    const text = dictionary[key];
    check(`${code}: ${key} is translated`, typeof text === 'string' && text.trim().length > 0);
    if (typeof text !== 'string') continue;
    check(
      `${code}: ${key} keeps its placeholders`,
      placeholders(text) === placeholders(english[key]),
      `${placeholders(text)} vs ${placeholders(english[key])}`
    );
  }

  for (const key of Object.keys(dictionary)) {
    if (key in english) continue;
    const base = key.replace(EXTRA_FORMS, '');
    check(`${code}: ${key} belongs to a plural group`, EXTRA_FORMS.test(key) && `${base}_other` in english);
    check(
      `${code}: ${key} keeps its placeholders`,
      placeholders(dictionary[key]) === placeholders(english[`${base}_other`] ?? '')
    );
  }
}

// Russian needs every form of every plural group.
const russian = DICTIONARIES.ru ?? {};
for (const key of Object.keys(english).filter((k) => k.endsWith('_one'))) {
  const base = key.slice(0, -4);
  check(`ru: ${base} has few and many`, `${base}_few` in russian && `${base}_many` in russian);
}

check('plural en 1', pluralForm('en', 1) === 'one');
check('plural en 0', pluralForm('en', 0) === 'other');
check('plural fr 0', pluralForm('fr', 0) === 'one');
check('plural ru 1', pluralForm('ru', 1) === 'one');
check('plural ru 21', pluralForm('ru', 21) === 'one');
check('plural ru 3', pluralForm('ru', 3) === 'few');
check('plural ru 11', pluralForm('ru', 11) === 'many');
check('plural ru 5', pluralForm('ru', 5) === 'many');
check('plural ru 1.5', pluralForm('ru', 1.5) === 'other');

check('translate plural one', translate('en', 'common.transactions', { count: 1 }) === '1 transaction');
check('translate plural other', translate('en', 'common.transactions', { count: 3 }) === '3 transactions');
check('translate params', translate('en', 'debt.ofAmount', { amount: '€5' }) === 'of €5');
check('translate keeps unknown placeholders', translate('en', 'debt.ofAmount', {}) === 'of {amount}');
check('translate nl', translate('nl', 'common.cancel') === 'Annuleren');
check('translate ru few', translate('ru', 'common.transactions', { count: 3 }).startsWith('3 '));

const device = (languageCode: string, languageTag: string) => [{ languageCode, languageTag }];
check('resolve stored wins', resolveLanguage('de', device('nl', 'nl-NL')) === 'de');
check('resolve device', resolveLanguage(null, device('nl', 'nl-BE')) === 'nl');
check('resolve empty stored follows device', resolveLanguage('', device('tr', 'tr-TR')) === 'tr');
check('resolve unknown device falls back', resolveLanguage(null, device('ja', 'ja-JP')) === 'en');
check('resolve second device language', resolveLanguage(null, [...device('ja', 'ja-JP'), ...device('es', 'es-MX')]) === 'es');
check('tag keeps device region', resolveTag('en', device('en', 'en-GB')) === 'en-GB');
check('tag default when device differs', resolveTag('nl', device('en', 'en-US')) === 'nl-NL');

check('money en', createFormatters('en-US').money(1234.5, '€', 2) === '€1,234.50');
check('money nl', createFormatters('nl-NL').money(1234.5, '€', 2) === '€1.234,50');
check('money de whole', createFormatters('de-DE').money(1234567, '€') === '€1.234.567');
check('month year nl', createFormatters('nl-NL').monthYear('2026-10') === 'oktober 2026');
check('range single day', createFormatters('en-US').range('2026-10-05', '2026-10-05') === createFormatters('en-US').day('2026-10-05'));

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
if (failures > 0) process.exit(1);
