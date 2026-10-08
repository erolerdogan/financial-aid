import type { LanguageCode, TranslationKey, TranslationParams } from '../../i18n';
import { de } from './de';
import { en, type LegalCopy, type LegalKey } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { nl } from './nl';
import { pt } from './pt';
import { ru } from './ru';
import { tr } from './tr';

export type { LegalCopy, LegalKey };

export const LEGAL_COPY: Record<LanguageCode, LegalCopy> = { en, nl, de, tr, es, fr, it, pt, ru };

/** Same `{param}` syntax as `translate` in `src/i18n`; a placeholder without a value is left as it is. */
export const legalTranslate = (language: LanguageCode, key: LegalKey, params?: TranslationParams): string => {
  const text = LEGAL_COPY[language][key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
};

export type LegalPage = 'privacy' | 'terms' | 'disclaimer';

export interface LegalSection {
  /** A heading of its own, or the name the app already has for a feature. */
  title: LegalKey | { app: TranslationKey };
  text: LegalKey;
  /** The words that stand in for `{link}` in `text`; on the website they are a link. */
  link?: LegalKey;
}

export interface LegalDocument {
  title: LegalKey;
  summary: LegalKey;
  /** `YYYY-MM-DD`. Change it together with the text. */
  updated: string;
  sections: LegalSection[];
}

export const LEGAL_DOCUMENTS: Record<LegalPage, LegalDocument> = {
  privacy: {
    title: 'privacy.title',
    summary: 'privacy.summary',
    updated: '2026-10-08',
    sections: [
      { title: 'privacy.s1Title', text: 'privacy.s1Text' },
      { title: 'privacy.s2Title', text: 'privacy.s2Text' },
      { title: 'privacy.s3Title', text: 'privacy.s3Text' },
      { title: 'privacy.s4Title', text: 'privacy.s4Text' },
      { title: 'privacy.s5Title', text: 'privacy.s5Text' },
      { title: 'privacy.s6Title', text: 'privacy.s6Text', link: 'privacy.s6Link' },
      { title: 'privacy.s7Title', text: 'privacy.s7Text' },
      { title: 'privacy.s8Title', text: 'privacy.s8Text', link: 'legal.supportPage' },
    ],
  },
  terms: {
    title: 'terms.title',
    summary: 'terms.summary',
    updated: '2026-10-08',
    sections: [
      { title: 'terms.s1Title', text: 'terms.s1Text' },
      { title: 'terms.s2Title', text: 'terms.s2Text' },
      { title: 'terms.s3Title', text: 'terms.s3Text', link: 'terms.s3Link' },
      { title: 'terms.s4Title', text: 'terms.s4Text', link: 'terms.s4Link' },
      { title: 'terms.s5Title', text: 'terms.s5Text' },
      { title: 'terms.s6Title', text: 'terms.s6Text' },
      { title: 'terms.s7Title', text: 'terms.s7Text' },
      { title: 'terms.s8Title', text: 'terms.s8Text' },
      // "Changes" and "Contact" are the headings of the privacy policy.
      { title: 'privacy.s7Title', text: 'terms.changesText' },
      { title: 'privacy.s8Title', text: 'terms.contactText', link: 'legal.supportPage' },
    ],
  },
  disclaimer: {
    title: 'disclaimer.title',
    summary: 'disclaimer.summary',
    updated: '2026-10-08',
    sections: [
      { title: 'disclaimer.s1Title', text: 'disclaimer.s1Text' },
      { title: { app: 'health.title' }, text: 'disclaimer.healthText' },
      { title: { app: 'freedom.name' }, text: 'disclaimer.freedomText' },
      { title: { app: 'home.debts.title' }, text: 'disclaimer.debtsText' },
      { title: 'disclaimer.s5Title', text: 'disclaimer.s5Text' },
      { title: 'disclaimer.s6Title', text: 'disclaimer.s6Text' },
    ],
  },
};

export const isLegalPage = (value: unknown): value is LegalPage =>
  typeof value === 'string' && value in LEGAL_DOCUMENTS;
