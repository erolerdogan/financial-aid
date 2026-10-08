import type { LanguageCode, TranslationParams } from '../../i18n';
import { FAQ_COPY, type FaqKey } from '../faq';
import { LEGAL_COPY, type LegalKey } from '../legal';
import { de } from './de';
import { en, type SiteCopy } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { nl } from './nl';
import { pt } from './pt';
import { ru } from './ru';
import { tr } from './tr';

export type { SiteCopy };
/** The web-only copy plus the legal texts and the FAQ, which the app shows as well (`src/content/legal`, `src/content/faq`). */
export type SiteKey = keyof SiteCopy | LegalKey | FaqKey;

const WEB_ONLY: Record<LanguageCode, SiteCopy> = { en, nl, de, tr, es, fr, it, pt, ru };

export const SITE_COPY = Object.fromEntries(
  Object.entries(WEB_ONLY).map(([code, copy]) => [
    code,
    { ...copy, ...LEGAL_COPY[code as LanguageCode], ...FAQ_COPY[code as LanguageCode] },
  ])
) as Record<LanguageCode, Record<SiteKey, string>>;

/** Same `{param}` syntax as `translate` in `src/i18n`; a placeholder without a value is left as it is. */
export const siteTranslate = (language: LanguageCode, key: SiteKey, params?: TranslationParams): string => {
  const text = SITE_COPY[language][key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
};
