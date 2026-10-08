// Run with: npx tsx src/content/site/site.test.ts
import { LANGUAGES } from '../../i18n';
import { CHANGELOG } from './changelog';
import { SITE_COPY, siteTranslate } from './index';

let failures = 0;

function check(name: string, pass: boolean, detail = '') {
  if (!pass) failures++;
  if (!pass) console.log(`FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

const placeholders = (text: string): string => Array.from(new Set(text.match(/\{\w+\}/g) ?? [])).sort().join(',');
const english: Record<string, string> = SITE_COPY.en;

for (const { code } of LANGUAGES) {
  const copy: Record<string, string> | undefined = SITE_COPY[code];
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
  }
  for (const key of Object.keys(copy)) {
    check(`${code}: ${key} exists in English`, key in english);
  }
}

// A sentence left in English by accident shows up as an exact copy. Names and short labels may match.
const SAME_IN_EVERY_LANGUAGE = /^(nav\.label|nav\.privacy|common\.screenshotAlt|changelog\.version|privacy\.s4Title|privacy\.s8Title|support\.contactTitle|nav\.disclaimer|disclaimer\.title|terms\.s3Link|legal\.supportPage)$/;
for (const { code } of LANGUAGES) {
  if (code === 'en') continue;
  const copy: Record<string, string> = SITE_COPY[code];
  for (const key of Object.keys(english)) {
    if (SAME_IN_EVERY_LANGUAGE.test(key)) continue;
    check(`${code}: ${key} is not the English text`, copy[key] !== english[key]);
  }
}

for (const entry of CHANGELOG) {
  check(`changelog ${entry.version}: version format`, /^\d+\.\d+\.\d+$/.test(entry.version));
  check(`changelog ${entry.version}: date format`, !entry.date || /^\d{4}-\d{2}-\d{2}$/.test(entry.date));
  check(`changelog ${entry.version}: has items`, entry.items.length > 0);
  for (const item of entry.items) check(`changelog ${entry.version}: ${item} exists`, item in english);
}

check('translate params', siteTranslate('en', 'changelog.version', { version: '1.0.0' }) === 'Version 1.0.0');
check('translate keeps unknown placeholders', siteTranslate('en', 'changelog.version').includes('{version}'));
check('translate nl', siteTranslate('nl', 'nav.features') === 'Functies');

if (failures > 0) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('All tests passed.');
