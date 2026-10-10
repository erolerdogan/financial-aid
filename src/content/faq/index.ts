import type { LanguageCode, TranslationKey, TranslationParams } from '../../i18n';
import { de } from './de';
import { en, type FaqCopy, type FaqKey } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { nl } from './nl';
import { pt } from './pt';
import { ru } from './ru';
import { tr } from './tr';

export type { FaqCopy, FaqKey };

export const FAQ_COPY: Record<LanguageCode, FaqCopy> = { en, nl, de, tr, es, fr, it, pt, ru };

/** Same `{param}` syntax as `translate` in `src/i18n`; a placeholder without a value is left as it is. */
export const faqTranslate = (language: LanguageCode, key: FaqKey, params?: TranslationParams): string => {
  const text = FAQ_COPY[language][key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
};

/** Placeholders that stand for a label of the app, so an answer names a screen or a row the way the app does. */
export const FAQ_APP_NAMES = {
  // The You tab; the placeholder kept its name from when that was the Settings screen.
  settings: 'tabs.you',
  account: 'account.title',
  importRow: 'settings.import',
  guide: 'guide.settingsRow',
  backup: 'settings.backup',
  reset: 'settings.reset',
  categories: 'settings.categories',
  budgets: 'settings.budgets',
  reminders: 'settings.importReminders',
  demo: 'welcome.tryDemo',
  exitDemo: 'demo.exit',
  restore: 'welcome.restoreLink',
  undo: 'backup.undo',
  home: 'tabs.home',
  trends: 'tabs.trends',
  transactions: 'tabs.transactions',
  forYou: 'inbox.title',
  health: 'health.title',
  growth: 'freedom.name',
  income: 'category.income',
  uncategorised: 'category.uncategorised',
  fixed: 'fixed.fixed',
  flexible: 'fixed.flexible',
  resetAuto: 'detail.resetAuto',
} satisfies Record<string, TranslationKey>;

/** The values for every placeholder of the FAQ: the app's labels through `t`, and the list of recognised banks. */
export const faqParams = (t: (key: TranslationKey) => string, banks: string): TranslationParams => {
  const params: TranslationParams = { banks };
  for (const [name, key] of Object.entries(FAQ_APP_NAMES)) params[name] = t(key);
  return params;
};

export type FaqGroupId = 'start' | 'import' | 'categories' | 'plan' | 'privacy' | 'profiles';

export interface FaqGroup {
  id: FaqGroupId;
  /** A heading of its own, or the name the app already has for a tab. */
  title: FaqKey | { app: TranslationKey };
  items: { q: FaqKey; a: FaqKey }[];
}

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: 'start',
    title: 'faq.start.title',
    items: [
      { q: 'faq.start.what.q', a: 'faq.start.what.a' },
      { q: 'faq.start.bank.q', a: 'faq.start.bank.a' },
      { q: 'faq.start.statement.q', a: 'faq.start.statement.a' },
      { q: 'faq.start.demo.q', a: 'faq.start.demo.a' },
    ],
  },
  {
    id: 'import',
    title: 'faq.import.title',
    items: [
      { q: 'faq.import.files.q', a: 'faq.import.files.a' },
      { q: 'faq.import.banks.q', a: 'faq.import.banks.a' },
      { q: 'faq.import.pdf.q', a: 'faq.import.pdf.a' },
      { q: 'faq.import.twice.q', a: 'faq.import.twice.a' },
      { q: 'faq.import.share.q', a: 'faq.import.share.a' },
      { q: 'faq.import.coverage.q', a: 'faq.import.coverage.a' },
      { q: 'faq.import.manual.q', a: 'faq.import.manual.a' },
    ],
  },
  {
    id: 'categories',
    title: 'faq.categories.title',
    items: [
      { q: 'faq.categories.how.q', a: 'faq.categories.how.a' },
      { q: 'faq.categories.fix.q', a: 'faq.categories.fix.a' },
      { q: 'faq.categories.review.q', a: 'faq.categories.review.a' },
      { q: 'faq.categories.fixed.q', a: 'faq.categories.fixed.a' },
      { q: 'faq.categories.budget.q', a: 'faq.categories.budget.a' },
      { q: 'faq.categories.own.q', a: 'faq.categories.own.a' },
    ],
  },
  {
    id: 'plan',
    title: { app: 'tabs.plan' },
    items: [
      { q: 'faq.plan.score.q', a: 'faq.plan.score.a' },
      { q: 'faq.plan.income.q', a: 'faq.plan.income.a' },
      { q: 'faq.plan.debts.q', a: 'faq.plan.debts.a' },
      { q: 'faq.plan.growth.q', a: 'faq.plan.growth.a' },
      { q: 'faq.plan.advice.q', a: 'faq.plan.advice.a' },
    ],
  },
  {
    id: 'privacy',
    title: 'faq.privacy.title',
    items: [
      { q: 'faq.privacy.where.q', a: 'faq.privacy.where.a' },
      { q: 'faq.privacy.account.q', a: 'faq.privacy.account.a' },
      { q: 'faq.privacy.lost.q', a: 'faq.privacy.lost.a' },
      { q: 'faq.privacy.backup.q', a: 'faq.privacy.backup.a' },
      { q: 'faq.privacy.password.q', a: 'faq.privacy.password.a' },
      { q: 'faq.privacy.delete.q', a: 'faq.privacy.delete.a' },
    ],
  },
  {
    id: 'profiles',
    title: 'faq.profiles.title',
    items: [
      { q: 'faq.profiles.what.q', a: 'faq.profiles.what.a' },
      { q: 'faq.profiles.currency.q', a: 'faq.profiles.currency.a' },
      { q: 'faq.profiles.languages.q', a: 'faq.profiles.languages.a' },
      { q: 'faq.profiles.notifications.q', a: 'faq.profiles.notifications.a' },
    ],
  },
];
