import { LANGUAGES, type LanguageCode, type TranslationKey, type TranslationParams } from '../i18n';
import { BANK_LABELS, type BankId } from '../utils/bankFormats';

/** Where the bank offers the export. */
export type GuideChannel = 'APP' | 'WEB' | 'BOTH';

export interface GuideStep {
  key: TranslationKey;
  /** Placeholder in the translated sentence → name of the entry in the guide's `labels`. */
  labels?: Record<string, string>;
}

/**
 * How to get a statement file out of one bank. Shown in the app (`src/app/export-guide.tsx`) and
 * rendered to web pages (`scripts/build-site.ts`).
 *
 * A bank is only listed when the parser recognises its export (`BANK_FORMATS`) and its steps were
 * checked against the page in `sourceUrl`; update `verified` when you check them again.
 */
export interface BankGuide {
  bank: BankId;
  /** Web path segment. */
  slug: string;
  /** Extra names people search for. */
  searchTerms: string[];
  /** File type to pick, as the app names it. */
  format: 'CSV' | 'Excel';
  channel: GuideChannel;
  /** Menu and button names as the bank shows them; never translated by us. */
  labels: Partial<Record<LanguageCode, Record<string, string>>>;
  steps: GuideStep[];
  note?: TranslationKey;
  /** The bank's own help page. */
  sourceUrl: string;
  /** `YYYY-MM` the steps were last checked. */
  verified: string;
}

const ACCOUNT_PERIOD: GuideStep = { key: 'guide.step.accountPeriod' };
const FORMAT: GuideStep = { key: 'guide.step.format', labels: { format: 'format' } };

export const BANK_GUIDES: BankGuide[] = [
  {
    // ing.nl could not be read by a script; the path was cross-checked with two independent guides.
    bank: 'ING',
    slug: 'ing',
    searchTerms: ['mijn ing', 'ing bank', 'ing bankieren'],
    format: 'CSV',
    channel: 'WEB',
    labels: {
      nl: {
        site: 'Mijn ING (ing.nl)',
        service: 'Service',
        download: 'Af- en bijschrijvingen downloaden',
        format: 'Kommagescheiden CSV',
      },
    },
    steps: [
      { key: 'guide.step.loginWeb', labels: { site: 'site' } },
      { key: 'guide.step.go2', labels: { a: 'service', b: 'download' } },
      ACCOUNT_PERIOD,
      FORMAT,
    ],
    sourceUrl: 'https://www.ing.nl/particulier/digitaal-bankieren/afschriften-downloaden',
    verified: '2026-10',
  },
  {
    bank: 'RABOBANK',
    slug: 'rabobank',
    searchTerms: ['rabo', 'rabo app', 'rabo online bankieren'],
    format: 'CSV',
    channel: 'BOTH',
    labels: {
      nl: {
        app: 'Rabo',
        site: 'Rabo Online Bankieren',
        settings: 'Instellingen',
        accounts: 'Betaalrekeningen',
        download: 'Transactieoverzicht',
        format: 'CSV',
      },
      en: {
        app: 'Rabo',
        site: 'Rabo Online Banking',
        settings: 'Settings',
        accounts: 'Payment accounts',
        download: 'Download transactions',
        format: 'CSV',
      },
    },
    steps: [
      { key: 'guide.step.openEither', labels: { app: 'app', site: 'site' } },
      { key: 'guide.step.go3', labels: { a: 'settings', b: 'accounts', c: 'download' } },
      ACCOUNT_PERIOD,
      FORMAT,
    ],
    sourceUrl:
      'https://www.rabobank.nl/particulieren/service/financiele-overzichten/overzicht-betaalrekening-ontvangen',
    verified: '2026-10',
  },
  {
    bank: 'ABN_AMRO',
    slug: 'abn-amro',
    searchTerms: ['abn', 'amro', 'abnamro', 'internet bankieren'],
    format: 'Excel',
    channel: 'BOTH',
    labels: {
      nl: {
        app: 'ABN AMRO',
        profile: 'Profiel',
        accounts: 'Rekeningen en betalen',
        statements: 'Afschriften en jaaroverzicht',
        kind: 'Soort overzicht',
        transactions: 'Bij- en afschrijvingen',
        format: 'xls',
      },
      en: {
        app: 'ABN AMRO',
        profile: 'Profile',
        accounts: 'Accounts and payments',
        statements: 'Bank statements and annual statement',
        kind: 'Overview types',
        transactions: 'Transactions',
        format: 'xls',
      },
    },
    steps: [
      { key: 'guide.step.openApp', labels: { app: 'app' } },
      { key: 'guide.step.go3', labels: { a: 'profile', b: 'accounts', c: 'statements' } },
      { key: 'guide.step.under', labels: { a: 'kind', b: 'transactions' } },
      ACCOUNT_PERIOD,
      FORMAT,
    ],
    note: 'guide.note.abnAmro',
    sourceUrl: 'https://www.abnamro.nl/nl/prive/betalen/bij-en-afschrijvingen/downloaden.html',
    verified: '2026-10',
  },
  {
    bank: 'BUNQ',
    slug: 'bunq',
    searchTerms: [],
    format: 'CSV',
    channel: 'APP',
    labels: {
      en: { app: 'bunq', accounting: 'Accounting', export: 'Export Statement', format: 'CSV' },
    },
    steps: [
      { key: 'guide.step.openApp', labels: { app: 'app' } },
      { key: 'guide.step.profileThen', labels: { a: 'accounting', b: 'export' } },
      ACCOUNT_PERIOD,
      FORMAT,
    ],
    sourceUrl: 'https://help.bunq.com/en/articles/how-do-i-export-a-bank-statement',
    verified: '2026-10',
  },
  {
    bank: 'REVOLUT',
    slug: 'revolut',
    searchTerms: [],
    format: 'Excel',
    channel: 'APP',
    labels: {
      en: {
        app: 'Revolut',
        home: 'Home',
        accounts: 'Accounts',
        more: 'More (...)',
        statement: 'Statement',
        format: 'Excel',
      },
    },
    steps: [
      { key: 'guide.step.openApp', labels: { app: 'app' } },
      { key: 'guide.step.go2', labels: { a: 'home', b: 'accounts' } },
      { key: 'guide.step.selectAccountThen', labels: { a: 'more' } },
      { key: 'guide.step.open', labels: { a: 'statement' } },
      { key: 'guide.step.period' },
      FORMAT,
    ],
    note: 'guide.note.revolut',
    sourceUrl:
      'https://help.revolut.com/help/profile-and-plan/managing-my-account/account-statement-per-chosen-currency/',
    verified: '2026-10',
  },
  {
    bank: 'N26',
    slug: 'n26',
    searchTerms: ['number26'],
    format: 'CSV',
    channel: 'WEB',
    labels: {
      en: {
        site: 'N26 WebApp',
        home: 'Home',
        downloads: 'Downloads',
        activity: 'Account Activity',
        format: 'CSV',
      },
    },
    steps: [
      { key: 'guide.step.loginWeb', labels: { site: 'site' } },
      { key: 'guide.step.open', labels: { a: 'home' } },
      { key: 'guide.step.selectAccountThen', labels: { a: 'downloads' } },
      { key: 'guide.step.dates', labels: { a: 'activity' } },
      FORMAT,
    ],
    note: 'guide.note.n26',
    sourceUrl:
      'https://support.n26.com/en-eu/account-and-personal-details/bank-statements-and-confirmations/how-to-get-bank-statement-n26',
    verified: '2026-10',
  },
  {
    bank: 'WISE',
    slug: 'wise',
    searchTerms: ['transferwise'],
    format: 'CSV',
    channel: 'BOTH',
    labels: {
      en: {
        app: 'Wise',
        site: 'wise.com',
        reports: 'Statements and reports',
        statements: 'Statements',
        create: 'Create a statement',
        format: 'CSV',
      },
    },
    steps: [
      { key: 'guide.step.openEither', labels: { app: 'app', site: 'site' } },
      { key: 'guide.step.profileThen', labels: { a: 'reports', b: 'statements' } },
      { key: 'guide.step.open', labels: { a: 'create' } },
      ACCOUNT_PERIOD,
      FORMAT,
    ],
    note: 'guide.note.wise',
    sourceUrl: 'https://wise.com/help/articles/2736049/how-do-i-download-a-statement',
    verified: '2026-10',
  },
];

/** For a bank without a guide of its own. */
export const GENERIC_STEPS: GuideStep[] = [
  { key: 'guide.generic.step1' },
  { key: 'guide.generic.step2' },
  { key: 'guide.generic.step3' },
];

export const CHANNEL_KEYS: Record<GuideChannel, TranslationKey> = {
  APP: 'guide.where.app',
  WEB: 'guide.where.web',
  BOTH: 'guide.where.both',
};

export const guideName = (guide: BankGuide): string => BANK_LABELS[guide.bank];

export const findGuide = (slug: string | undefined): BankGuide | null =>
  BANK_GUIDES.find((guide) => guide.slug === slug) ?? null;

const searchKey = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export function searchGuides(query: string): BankGuide[] {
  const needle = searchKey(query);
  if (!needle) return BANK_GUIDES;
  return BANK_GUIDES.filter((guide) =>
    [guideName(guide), ...guide.searchTerms].some((term) => searchKey(term).includes(needle))
  );
}

/** Language of the menu names a reader gets: their own, else English, else the bank's home language. */
export function labelLanguage(guide: BankGuide, language: LanguageCode): LanguageCode {
  if (guide.labels[language]) return language;
  if (guide.labels.en) return 'en';
  return (Object.keys(guide.labels) as LanguageCode[])[0] ?? language;
}

export const languageName = (code: LanguageCode): string =>
  LANGUAGES.find((language) => language.code === code)?.label ?? code;

export interface StepPart {
  text: string;
  /** A name taken from the bank's own screens. */
  label: boolean;
}

const LABEL_START = '\u0001';
const LABEL_END = '\u0002';

/**
 * A step as pieces of text, so the bank's menu names can be set apart (bold in the app, `<strong>`
 * on the web) whatever the word order of the language.
 */
export function stepParts(
  step: GuideStep,
  guide: BankGuide | null,
  language: LanguageCode,
  t: (key: TranslationKey, params?: TranslationParams) => string
): StepPart[] {
  const labels = guide ? guide.labels[labelLanguage(guide, language)] ?? {} : {};
  const params: TranslationParams = {};
  for (const [placeholder, name] of Object.entries(step.labels ?? {})) {
    params[placeholder] = `${LABEL_START}${labels[name] ?? name}${LABEL_END}`;
  }

  const parts: StepPart[] = [];
  for (const chunk of t(step.key, params).split(LABEL_START)) {
    const [first, rest] = chunk.split(LABEL_END);
    if (rest === undefined) {
      if (first) parts.push({ text: first, label: false });
    } else {
      parts.push({ text: first, label: true });
      if (rest) parts.push({ text: rest, label: false });
    }
  }
  return parts;
}
