import { ImportProgressOverlay } from '@/components/ImportProgressOverlay';
import { ImportSummaryModal } from '@/components/modals/ImportSummaryModal';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getAppMeta, setAppMeta } from '@/db/database';
import { usePaywall } from '@/hooks/usePaywall';
import { useProfileAccess } from '@/hooks/useProfileAccess';
import { ImportResultSummary } from '@/services/importService';
import { PRO_OFFER_IMPORTS_KEY, PRO_OFFER_SHOWN_KEY, shouldOfferPro } from '@/utils/entitlement';
import { useIsFocused } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

// The summary sheet has to be gone before a screen can present.
const OFFER_DELAY_MS = 400;

interface ImportResultState {
  summary: ImportResultSummary;
  profileName: string;
}

/** Which file of a multi-file import is being read. */
export interface ImportProgress {
  current: number;
  total: number;
}

interface ImportResultContextType {
  result: ImportResultState | null;
  progress: ImportProgress | null;
  setImportProgress: (progress: ImportProgress | null) => void;
  showImportResult: (summary: ImportResultSummary, profileName: string) => void;
  dismissImportResult: () => void;
}

const ImportResultContext = createContext<ImportResultContextType>({
  result: null,
  progress: null,
  setImportProgress: () => {},
  showImportResult: () => {},
  dismissImportResult: () => {},
});

export function ImportResultProvider({ children }: { children: React.ReactNode }) {
  const [result, setResult] = useState<ImportResultState | null>(null);
  const [progress, setImportProgress] = useState<ImportProgress | null>(null);

  const showImportResult = useCallback((summary: ImportResultSummary, profileName: string) => {
    setResult({ summary, profileName });
  }, []);

  const dismissImportResult = useCallback(() => setResult(null), []);

  const value = useMemo(
    () => ({ result, progress, setImportProgress, showImportResult, dismissImportResult }),
    [result, progress, showImportResult, dismissImportResult]
  );

  return <ImportResultContext.Provider value={value}>{children}</ImportResultContext.Provider>;
}

export const useImportResult = () => useContext(ImportResultContext);

// Rendered inside each screen that can be on top after an import. A sheet mounted at the root
// cannot present over a native modal screen (Settings) and leaves the UI blocked.
export function ImportSummaryHost() {
  const { result, progress, dismissImportResult } = useImportResult();
  const isFocused = useIsFocused();
  const db = useSQLiteContext();
  const { source } = useEntitlement();
  const { isDemoMode } = useProfile();
  const { readOnly } = useProfileAccess();
  const { openPaywall } = usePaywall();

  // The one unasked Pro offer: once ever, when the summary of a later import is closed.
  const handleClose = async () => {
    dismissImportResult();
    try {
      const [imports, shown] = await Promise.all([
        getAppMeta(db, PRO_OFFER_IMPORTS_KEY),
        getAppMeta(db, PRO_OFFER_SHOWN_KEY),
      ]);
      const due = shouldOfferPro({
        isPro: source !== 'free',
        isDemo: isDemoMode,
        readOnly,
        imports: Number(imports) || 0,
        shown: shown !== null,
      });
      if (!due) return;
      await setAppMeta(db, PRO_OFFER_SHOWN_KEY, '1');
      setTimeout(() => openPaywall('offer'), OFFER_DELAY_MS);
    } catch (error) {
      console.warn('Pro offer warning:', error);
    }
  };

  if (!isFocused) return null;
  if (progress) return <ImportProgressOverlay />;
  if (!result) return null;

  return (
    <ImportSummaryModal
      visible
      summary={result.summary}
      profileName={result.profileName}
      onClose={handleClose}
    />
  );
}
