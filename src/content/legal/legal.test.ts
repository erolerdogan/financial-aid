// Run with: npx tsx src/content/legal/legal.test.ts
import { LANGUAGES } from '../../i18n';
import { en } from './en';
import { LEGAL_COPY, LEGAL_DOCUMENTS, isLegalPage, legalTranslate, type LegalKey } from './index';

let failures = 0;

function check(name: string, pass: boolean, detail = '') {
  if (!pass) failures++;
  if (!pass) console.log(`FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

const placeholders = (text: string): string => Array.from(new Set(text.match(/\{\w+\}/g) ?? [])).sort().join(',');
const english: Record<string, string> = en;

// Names and short labels may be the same word as in English.
const SAME_IN_EVERY_LANGUAGE = /^(privacy\.s4Title|privacy\.s8Title|disclaimer\.title|terms\.s3Link)$/;
for (const { code } of LANGUAGES) {
  const copy: Record<string, string> | undefined = LEGAL_COPY[code];
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
    if (code !== 'en' && !SAME_IN_EVERY_LANGUAGE.test(key)) {
      check(`${code}: ${key} is not the English text`, text !== english[key]);
    }
  }
  for (const key of Object.keys(copy)) check(`${code}: ${key} exists in English`, key in english);
}

// Every key is shown somewhere, and a `{link}` in a text has the words that fill it.
const used = new Set<LegalKey>(['privacy.updated', 'privacy.description', 'terms.description', 'disclaimer.description']);
for (const [page, document] of Object.entries(LEGAL_DOCUMENTS)) {
  check(`${page}: date format`, /^\d{4}-\d{2}-\d{2}$/.test(document.updated));
  used.add(document.title).add(document.summary);
  check(`${page}: summary has no placeholder`, placeholders(en[document.summary]) === '');
  for (const section of document.sections) {
    if (typeof section.title === 'string') used.add(section.title);
    used.add(section.text);
    if (section.link) used.add(section.link);
    check(
      `${page}: ${section.text} link matches its placeholder`,
      (placeholders(en[section.text]) === '{link}') === !!section.link,
      placeholders(en[section.text])
    );
  }
}
for (const key of Object.keys(english)) check(`${key} is used by a document`, used.has(key as LegalKey));

check('isLegalPage accepts a page', isLegalPage('terms'));
check('isLegalPage rejects other values', !isLegalPage('support') && !isLegalPage(undefined) && !isLegalPage(['terms']));
check('translate params', legalTranslate('en', 'privacy.updated', { date: 'today' }) === 'Last updated: today');
check('translate keeps unknown placeholders', legalTranslate('en', 'privacy.updated').includes('{date}'));

if (failures > 0) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('All tests passed.');
