import { setAppMeta } from '@/db/database';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_META_KEY,
  LanguageCode,
  Message,
  TFunction,
  isLanguageCode,
  resolveLanguage,
  resolveTag,
  setActiveLanguage,
  translate,
} from '@/i18n';
import { categoryLabel, formatMessages } from '@/i18n/categories';
import { currencyLabel } from '@/i18n/currencyNames';
import { Formatters, createFormatters } from '@/i18n/format';
import { refreshImportReminderText } from '@/utils/notifications';
import { useLocales } from 'expo-localization';
import { useSQLiteContext } from 'expo-sqlite';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

interface LanguageContextType {
  /** Language in use. */
  language: LanguageCode;
  /** Saved choice; null = follow the device. */
  storedLanguage: LanguageCode | null;
  setLanguage: (language: LanguageCode | null) => void;
  t: TFunction;
  format: Formatters;
  /** Display name of a category (built-in names translated). */
  categoryName: (name: string) => string;
  /** Name of a currency for its code, e.g. "Japanese Yen". */
  currencyName: (code: string) => string;
  /** One line for messages built outside React (fixed-cost reasons, suggestions). */
  describe: (messages: readonly Message[]) => string;
}

const defaultT: TFunction = (key, params) => translate(DEFAULT_LANGUAGE, key, params);

const LanguageContext = createContext<LanguageContextType>({
  language: DEFAULT_LANGUAGE,
  storedLanguage: null,
  setLanguage: () => {},
  t: defaultT,
  format: createFormatters('en-US'),
  categoryName: (name) => categoryLabel(name, defaultT),
  currencyName: (code) => currencyLabel(code, DEFAULT_LANGUAGE),
  describe: (messages) => formatMessages(messages, defaultT),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const deviceLocales = useLocales();

  // Read synchronously so the first frame is already in the saved language.
  const [storedLanguage, setStoredLanguage] = useState<LanguageCode | null>(() => {
    try {
      const stored = db.getFirstSync<{ value: string }>(`SELECT value FROM app_meta WHERE key = ?;`, [
        LANGUAGE_META_KEY,
      ])?.value;
      return isLanguageCode(stored) ? stored : null;
    } catch {
      return null;
    }
  });

  const language = resolveLanguage(storedLanguage, deviceLocales);
  const tag = resolveTag(language, deviceLocales);
  // Kept in step during render so `tNow` is right for effects that run before this provider's own.
  setActiveLanguage(language, tag);

  const previousLanguage = useRef(language);
  useEffect(() => {
    if (previousLanguage.current === language) return;
    previousLanguage.current = language;
    refreshImportReminderText().catch((err) => console.warn('Reminder language warning:', err));
  }, [language]);

  const setLanguage = useCallback(
    (next: LanguageCode | null) => {
      setStoredLanguage(next);
      // Empty value = follow the device.
      setAppMeta(db, LANGUAGE_META_KEY, next ?? '').catch((err) => console.warn('Language save warning:', err));
    },
    [db]
  );

  const value = useMemo<LanguageContextType>(() => {
    const t: TFunction = (key, params) => translate(language, key, params, tag);
    return {
      language,
      storedLanguage,
      setLanguage,
      t,
      format: createFormatters(tag),
      categoryName: (name) => categoryLabel(name, t),
      currencyName: (code) => currencyLabel(code, language),
      describe: (messages) => formatMessages(messages, t, tag),
    };
  }, [language, tag, storedLanguage, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useI18n = () => useContext(LanguageContext);
