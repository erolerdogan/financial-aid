import { ImportSummaryModal } from '@/components/modals/ImportSummaryModal';
import { ImportResultSummary } from '@/services/importService';
import { useIsFocused } from 'expo-router';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface ImportResultState {
  summary: ImportResultSummary;
  profileName: string;
}

interface ImportResultContextType {
  result: ImportResultState | null;
  showImportResult: (summary: ImportResultSummary, profileName: string) => void;
  dismissImportResult: () => void;
}

const ImportResultContext = createContext<ImportResultContextType>({
  result: null,
  showImportResult: () => {},
  dismissImportResult: () => {},
});

export function ImportResultProvider({ children }: { children: React.ReactNode }) {
  const [result, setResult] = useState<ImportResultState | null>(null);

  const showImportResult = useCallback((summary: ImportResultSummary, profileName: string) => {
    setResult({ summary, profileName });
  }, []);

  const dismissImportResult = useCallback(() => setResult(null), []);

  const value = useMemo(
    () => ({ result, showImportResult, dismissImportResult }),
    [result, showImportResult, dismissImportResult]
  );

  return <ImportResultContext.Provider value={value}>{children}</ImportResultContext.Provider>;
}

export const useImportResult = () => useContext(ImportResultContext);

// Rendered inside each screen that can be on top after an import. A sheet mounted at the root
// cannot present over a native modal screen (Settings) and leaves the UI blocked.
export function ImportSummaryHost() {
  const { result, dismissImportResult } = useImportResult();
  const isFocused = useIsFocused();

  if (!isFocused || !result) return null;

  return (
    <ImportSummaryModal
      visible
      summary={result.summary}
      profileName={result.profileName}
      onClose={dismissImportResult}
    />
  );
}
