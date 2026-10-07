// Run with: npx tsx src/content/bankGuides.test.ts
import { LANGUAGES, translate } from '../i18n';
import { en } from '../i18n/locales/en';
import { BANK_LABELS } from '../utils/bankFormats';
import {
  BANK_GUIDES,
  GENERIC_STEPS,
  findGuide,
  guideName,
  labelLanguage,
  searchGuides,
  stepParts,
  type GuideStep,
} from './bankGuides';

let failures = 0;

const check = (label: string, condition: boolean, detail = ''): void => {
  if (!condition) failures++;
  if (!condition) console.log(`FAIL  ${label}${detail ? `  (${detail})` : ''}`);
};

const english: Record<string, string> = en;
const placeholders = (text: string): string[] => Array.from(new Set(text.match(/\{(\w+)\}/g) ?? [])).sort();

const checkStep = (label: string, step: GuideStep, labelSets: Record<string, string>[]): void => {
  const text = english[step.key];
  check(`${label}: ${step.key} exists`, typeof text === 'string');
  if (typeof text !== 'string') return;

  const wanted = placeholders(text);
  const given = Object.keys(step.labels ?? {}).map((name) => `{${name}}`).sort();
  check(`${label}: ${step.key} fills its placeholders`, wanted.join() === given.join(), `${wanted} vs ${given}`);

  for (const name of Object.values(step.labels ?? {})) {
    for (const labels of labelSets) {
      check(`${label}: label "${name}" is defined`, typeof labels[name] === 'string' && labels[name].length > 0);
    }
  }
};

const slugs = new Set<string>();
const banks = new Set<string>();

for (const guide of BANK_GUIDES) {
  const label = guide.slug;
  check(`${label}: slug is unique`, !slugs.has(guide.slug));
  check(`${label}: one guide per bank`, !banks.has(guide.bank));
  slugs.add(guide.slug);
  banks.add(guide.bank);

  check(`${label}: slug is url safe`, /^[a-z0-9]+(-[a-z0-9]+)*$/.test(guide.slug));
  // Only banks whose export the parser recognises get a guide (`npx tsx src/utils/bankFormats.test.ts`).
  check(`${label}: the parser knows this bank`, guide.bank in BANK_LABELS);
  check(`${label}: has a source page`, /^https:\/\//.test(guide.sourceUrl));
  check(`${label}: has a checked month`, /^\d{4}-(0[1-9]|1[0-2])$/.test(guide.verified));
  check(`${label}: has steps`, guide.steps.length >= 3 && guide.steps.length <= 6);

  const labelSets = Object.values(guide.labels);
  check(`${label}: has menu names`, labelSets.length > 0);
  for (const step of guide.steps) checkStep(label, step, labelSets);
  if (guide.note) check(`${label}: note exists`, typeof english[guide.note] === 'string');

  for (const { code } of LANGUAGES) {
    for (const step of guide.steps) {
      const text = stepParts(step, guide, code, (key, params) => translate(code, key, params))
        .map((part) => part.text)
        .join('');
      check(`${label} ${code}: ${step.key} has no open placeholder`, !/[{}\u0001\u0002]/.test(text), text);
    }
  }
}

for (const step of GENERIC_STEPS) checkStep('generic', step, []);

// Menu names: the reader's language, else English, else the bank's own.
const ing = findGuide('ing');
const abn = findGuide('abn-amro');
check('ing exists', ing !== null);
check('abn exists', abn !== null);
if (ing && abn) {
  check('ing nl labels', labelLanguage(ing, 'nl') === 'nl');
  check('ing falls back to nl', labelLanguage(ing, 'de') === 'nl');
  check('abn en for de', labelLanguage(abn, 'de') === 'en');
  check('abn nl for nl', labelLanguage(abn, 'nl') === 'nl');

  const parts = stepParts(ing.steps[1], ing, 'en', (key, params) => translate('en', key, params));
  check('labels are set apart', parts.filter((part) => part.label).map((part) => part.text).join('|') === 'Service|Af- en bijschrijvingen downloaden');
  check('text keeps its order', parts.map((part) => part.text).join('') === 'Go to Service, then Af- en bijschrijvingen downloaden.');
}

check('search: empty lists all', searchGuides('  ').length === BANK_GUIDES.length);
check('search: rabo', searchGuides('rabo').map((guide) => guide.slug).join() === 'rabobank');
check('search: abn amro with space', searchGuides('ABN Amro').map((guide) => guide.slug).join() === 'abn-amro');
check('search: transferwise', searchGuides('transferwise').map((guide) => guide.slug).join() === 'wise');
check('search: unknown', searchGuides('zzz').length === 0);
check('names come from the parser', BANK_GUIDES.every((guide) => guideName(guide) === BANK_LABELS[guide.bank]));

if (failures > 0) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('All tests passed.');
