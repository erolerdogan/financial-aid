// Run with: npx tsx src/content/faq/faq.test.ts
import { DICTIONARIES, LANGUAGES } from '../../i18n';
import { en } from './en';
import { FAQ_APP_NAMES, FAQ_COPY, FAQ_GROUPS, faqParams, faqTranslate, type FaqKey } from './index';

let failures = 0;

function check(name: string, pass: boolean, detail = '') {
  if (!pass) failures++;
  if (!pass) console.log(`FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

const placeholderNames = (text: string): string[] =>
  Array.from(new Set((text.match(/\{\w+\}/g) ?? []).map((match) => match.slice(1, -1)))).sort();
const placeholders = (text: string): string => placeholderNames(text).join(',');
const english: Record<string, string> = en;

for (const { code } of LANGUAGES) {
  const copy: Record<string, string> | undefined = FAQ_COPY[code];
  check(`${code}: copy exists`, !!copy);
  if (!copy) continue;

  for (const key of Object.keys(english)) {
    const text = copy[key];
    check(`${code}: ${key} is translated`, typeof text === 'string' && text.trim().length > 0);
    if (typeof text !== 'string') continue;
    check(
      `${code}: ${key} keeps its placeholders`,
      placeholders(text) === placeholders(english[key]),
      `${placeholders(text)} vs ${placeholders(english[key])}`
    );
    if (code !== 'en') check(`${code}: ${key} is not the English text`, text !== english[key]);
  }
  for (const key of Object.keys(copy)) check(`${code}: ${key} exists in English`, key in english);
}

// Every key is shown somewhere, and no question is listed twice.
const used = new Set<FaqKey>(['faq.title', 'faq.description', 'faq.intro']);
for (const group of FAQ_GROUPS) {
  check(`${group.id}: has questions`, group.items.length > 0);
  if (typeof group.title === 'string') used.add(group.title);
  else check(`${group.id}: title is an app label`, group.title.app in DICTIONARIES.en);
  for (const item of group.items) {
    check(`${item.q} is listed once`, !used.has(item.q));
    check(`${item.q} has its own answer`, item.a === item.q.replace(/\.q$/, '.a'));
    used.add(item.q).add(item.a);
  }
}
for (const key of Object.keys(english)) check(`${key} is used by a group`, used.has(key as FaqKey));

// A placeholder is the bank list or a label of the app, and every label is used by a text.
const appNames: Record<string, string> = FAQ_APP_NAMES;
const usedNames = new Set<string>();
for (const [key, text] of Object.entries(english)) {
  for (const name of placeholderNames(text)) {
    usedNames.add(name);
    check(`${key}: {${name}} has a value`, name === 'banks' || name in appNames);
  }
}
for (const [name, key] of Object.entries(appNames)) {
  check(`{${name}} is used by a text`, usedNames.has(name));
  for (const { code } of LANGUAGES) check(`${code}: ${key} exists in the app`, key in DICTIONARIES[code]);
}

const params = faqParams((key) => DICTIONARIES.en[key], 'ING, bunq');
for (const { code } of LANGUAGES) {
  for (const key of Object.keys(english) as FaqKey[]) {
    check(`${code}: ${key} has no placeholder left`, !/\{\w+\}/.test(faqTranslate(code, key, params)));
  }
}
check('translate fills the bank list', faqTranslate('en', 'faq.import.banks.a', params).includes('ING, bunq'));
check('translate fills an app label', faqTranslate('en', 'faq.privacy.delete.a', params).startsWith('You → Reset'));
check('translate keeps unknown placeholders', faqTranslate('en', 'faq.import.banks.a').includes('{banks}'));

if (failures > 0) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('All tests passed.');
