import { de } from './locales/de';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { it } from './locales/it';
import { nl } from './locales/nl';
import { pt } from './locales/pt';
import { ru } from './locales/ru';
import { tr } from './locales/tr';

export type LanguageCode = 'en' | 'nl' | 'de' | 'tr' | 'es' | 'ru' | 'fr' | 'pt' | 'it';

export interface LanguageDefinition {
  code: LanguageCode;
  /** Name in the language itself, shown in the picker. */
  label: string;
  /** Formatting locale when the device region does not belong to this language. */
  tag: string;
}

export const LANGUAGES: LanguageDefinition[] = [
  { code: 'en', label: 'English', tag: 'en-US' },
  { code: 'nl', label: 'Nederlands', tag: 'nl-NL' },
  { code: 'de', label: 'Deutsch', tag: 'de-DE' },
  { code: 'tr', label: 'Türkçe', tag: 'tr-TR' },
  { code: 'es', label: 'Español', tag: 'es-ES' },
  { code: 'fr', label: 'Français', tag: 'fr-FR' },
  { code: 'it', label: 'Italiano', tag: 'it-IT' },
  { code: 'pt', label: 'Português', tag: 'pt-BR' },
  { code: 'ru', label: 'Русский', tag: 'ru-RU' },
];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';
export const LANGUAGE_META_KEY = 'language';

type PluralForm = 'one' | 'few' | 'many' | 'other';
type EnglishKey = keyof typeof en;
type PluralBase<K> = K extends `${infer Base}_one` ? Base : never;
type PluralKey = `${PluralBase<EnglishKey>}_${PluralForm}`;

/** What `t` accepts: every plain key, plus the base name of each plural group. */
export type TranslationKey = Exclude<EnglishKey, PluralKey> | PluralBase<EnglishKey>;
export type TranslationParams = Record<string, string | number>;
export type TFunction = (key: TranslationKey, params?: TranslationParams) => string;

/** Shape of a locale file: every English key, plus the extra plural forms a language needs. */
export type Translations = Record<EnglishKey, string> &
  Partial<Record<`${PluralBase<EnglishKey>}_${'few' | 'many'}`, string>>;

/** A translatable message produced outside React (resolver reasons, suggestions); rendered with `t(key, params)`. */
export interface Message {
  key: TranslationKey;
  params?: TranslationParams;
}

export const DICTIONARIES: Record<LanguageCode, Record<string, string>> = { en, nl, de, tr, es, fr, it, pt, ru };

export const isLanguageCode = (value: unknown): value is LanguageCode =>
  LANGUAGES.some((language) => language.code === value);

interface DeviceLocale {
  languageCode: string | null;
  languageTag: string;
}

/** Saved choice first, then the first device language the app has, then English. */
export const resolveLanguage = (stored: string | null, deviceLocales: readonly DeviceLocale[]): LanguageCode => {
  if (isLanguageCode(stored)) return stored;
  for (const locale of deviceLocales) {
    if (isLanguageCode(locale.languageCode)) return locale.languageCode;
  }
  return DEFAULT_LANGUAGE;
};

/** Device tag when it is in the chosen language (keeps the region, e.g. `en-GB`), otherwise the language default. */
export const resolveTag = (language: LanguageCode, deviceLocales: readonly DeviceLocale[]): string => {
  const device = deviceLocales.find((locale) => locale.languageCode === language);
  return device?.languageTag ?? LANGUAGES.find((item) => item.code === language)?.tag ?? 'en-US';
};

// Written out instead of Intl.PluralRules, which Hermes does not ship on every platform.
export const pluralForm = (language: LanguageCode, count: number): PluralForm => {
  const n = Math.abs(count);
  if (language === 'ru') {
    if (!Number.isInteger(n)) return 'other';
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'one';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
    return 'many';
  }
  if (language === 'fr' || language === 'pt') return n < 2 ? 'one' : 'other';
  return n === 1 ? 'one' : 'other';
};

const safeLocaleString = (value: number, tag: string): string => {
  try {
    return value.toLocaleString(tag);
  } catch {
    return String(value);
  }
};

export const translate = (
  language: LanguageCode,
  key: TranslationKey,
  params?: TranslationParams,
  tag?: string
): string => {
  const fallback: Record<string, string | undefined> = en;
  const dictionary: Record<string, string | undefined> = DICTIONARIES[language] ?? fallback;
  let template: string | undefined;
  if (typeof params?.count === 'number') {
    const form = pluralForm(language, params.count);
    template =
      dictionary[`${key}_${form}`] ??
      dictionary[`${key}_other`] ??
      fallback[`${key}_${form}`] ??
      fallback[`${key}_other`];
  }
  const text = template ?? dictionary[key] ?? fallback[key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) return match;
    return typeof value === 'number' && name === 'count' ? safeLocaleString(value, tag ?? language) : String(value);
  });
};

// Active language for code that runs outside React (notifications, alerts raised from services).
// Components read `t` from `useI18n()` instead, so they re-render when the language changes.
let activeLanguage: LanguageCode = DEFAULT_LANGUAGE;
let activeTag = 'en-US';

export const setActiveLanguage = (language: LanguageCode, tag: string): void => {
  activeLanguage = language;
  activeTag = tag;
};
export const getActiveTag = (): string => activeTag;

export const tNow: TFunction = (key, params) => translate(activeLanguage, key, params, activeTag);
