import { ImportProgressOverlay } from '@/components/ImportProgressOverlay';
import { ImportSummaryModal } from '@/components/modals/ImportSummaryModal';
import { ImportResultSummary } from '@/services/importService';
import { useIsFocused } from 'expo-router';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

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

  if (!isFocused) return null;
  if (progress) return <ImportProgressOverlay />;
  if (!result) return null;

  return (
    <ImportSummaryModal
      visible
      summary={result.summary}
      profileName={result.profileName}
      onClose={dismissImportResult}
    />
  );
}
