import { PRO_TESTING_ENABLED } from '@/constants/buildConfig';
import type { FeatureFlag, LimitKey } from '@/constants/features';
import { useProfile } from '@/contexts/ProfileContext';
import { setAppMeta } from '@/db/database';
import {
  can as canFor,
  type EntitlementSource,
  isProSource,
  limit as limitFor,
  PRO_DEV_OVERRIDE_KEY,
  PRO_OFFER_SHOWN_KEY,
  resolveSource,
} from '@/utils/entitlement';
import { useSQLiteContext } from 'expo-sqlite';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/** What a read-only notice is about: the whole profile, or one item beyond a free limit. */
export interface ReadOnlyNotice {
  kind: 'profile' | 'budget' | 'debt';
  /** A way to remove the item, offered in the sheet: deleting is never gated. */
  onRemove?: () => void;
}

interface EntitlementContextType {
  /** Whether Pro features are open. True in the demo workspace, which shows the whole app. */
  isPro: boolean;
  can: (flag: FeatureFlag) => boolean;
  limit: (key: LimitKey) => number;
  /** The tier itself, without the demo exception. */
  source: EntitlementSource;
  /** Development and Pro testing builds only (`PRO_TESTING_ENABLED`). */
  setDevOverride: (enabled: boolean) => void;
  /** Reads the tier again, after the purchase service changed it. */
  refresh: () => void;
  readOnlyNotice: ReadOnlyNotice | null;
  showReadOnly: (notice: ReadOnlyNotice) => void;
  hideReadOnly: () => void;
}

const EntitlementContext = createContext<EntitlementContextType>({
  isPro: false,
  can: () => false,
  limit: (key) => limitFor(false, key),
  source: 'free',
  setDevOverride: () => {},
  refresh: () => {},
  readOnlyNotice: null,
  showReadOnly: () => {},
  hideReadOnly: () => {},
});

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const { isDemoMode } = useProfile();

  const readOverride = useCallback((): string | null => {
    // Any other build does not even read the key: a value left by a test build or a restored backup stays unused.
    if (!PRO_TESTING_ENABLED) return null;
    try {
      return (
        db.getFirstSync<{ value: string }>(`SELECT value FROM app_meta WHERE key = ?;`, [PRO_DEV_OVERRIDE_KEY])
          ?.value ?? null
      );
    } catch {
      return null;
    }
  }, [db]);

  // Read synchronously so the first frame already knows the tier.
  const [devOverride, setDevOverrideState] = useState<string | null>(readOverride);
  const [readOnlyNotice, setReadOnlyNotice] = useState<ReadOnlyNotice | null>(null);

  const source = resolveSource(devOverride, PRO_TESTING_ENABLED);
  const isPro = isProSource(source) || isDemoMode;

  const setDevOverride = useCallback(
    (enabled: boolean) => {
      if (!PRO_TESTING_ENABLED) return;
      const value = enabled ? '1' : '0';
      setDevOverrideState(value);
      setAppMeta(db, PRO_DEV_OVERRIDE_KEY, value).catch((err) => console.warn('Entitlement save warning:', err));
      // Back to Free: the one-time offer can be tested again.
      if (!enabled) {
        db.runAsync(`DELETE FROM app_meta WHERE key = ?;`, [PRO_OFFER_SHOWN_KEY]).catch((err) =>
          console.warn('Offer reset warning:', err)
        );
      }
    },
    [db]
  );

  const refresh = useCallback(() => setDevOverrideState(readOverride()), [readOverride]);
  const showReadOnly = useCallback((notice: ReadOnlyNotice) => setReadOnlyNotice(notice), []);
  const hideReadOnly = useCallback(() => setReadOnlyNotice(null), []);

  const value = useMemo<EntitlementContextType>(
    () => ({
      isPro,
      can: (flag) => canFor(isPro, flag),
      limit: (key) => limitFor(isPro, key),
      source,
      setDevOverride,
      refresh,
      readOnlyNotice,
      showReadOnly,
      hideReadOnly,
    }),
    [isPro, source, setDevOverride, refresh, readOnlyNotice, showReadOnly, hideReadOnly]
  );

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

export const useEntitlement = () => useContext(EntitlementContext);
