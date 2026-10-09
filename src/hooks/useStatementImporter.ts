import { useEntitlement } from '@/contexts/EntitlementContext';
import { useImportResult } from '@/contexts/ImportResultContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getAppMeta, getCustomRules, getLearnedCategories, getProfiles, Profile, setAppMeta } from '@/db/database';
import { usePaywall } from '@/hooks/usePaywall';
import { useProfileAccess } from '@/hooks/useProfileAccess';
import { runHealthAlerts } from '@/services/healthService';
import {
  type ImportResultSummary,
  type ImportTransactionPayload,
  pdfStatementsToTransactions,
  processBatchImport,
  ProRequiredError,
  readStatementFile,
} from '@/services/importService';
import type { BankId } from '@/utils/bankFormats';
import { PRO_OFFER_IMPORTS_KEY } from '@/utils/entitlement';
import { describeImportFailure, type ImportFailure, importFailureMessage } from '@/utils/importFailure';
import { cancelCurrentMonthReminders } from '@/utils/notifications';
import { checkChain } from '@/utils/pdfStatements/chain';
import { PdfExtractError, type PdfStatement, PdfStatementError } from '@/utils/pdfStatements/types';
import { UNSUPPORTED_MESSAGE_KEYS, UnsupportedFileError } from '@/utils/statementFormat';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Alert, AlertButton } from 'react-native';

interface UseStatementImporterOptions {
  onSuccess?: () => void | Promise<void>;
}

interface PickedFile {
  uri: string;
  name: string;
}

/** First and last booking date of the statements. */
function coveredPeriod(statements: PdfStatement[]): { dateFrom: string | null; dateTo: string | null } {
  let dateFrom: string | null = null;
  let dateTo: string | null = null;
  for (const statement of statements) {
    for (const row of statement.rows) {
      if (!dateFrom || row.date < dateFrom) dateFrom = row.date;
      if (!dateTo || row.date > dateTo) dateTo = row.date;
    }
  }
  return { dateFrom, dateTo };
}

export function useStatementImporter(options?: UseStatementImporterOptions) {
  const db = useSQLiteContext();
  const { activeProfile, refreshProfiles, switchProfile, currencySymbol, currencyDecimals, isDemoMode } = useProfile();
  const { showImportResult, setImportProgress } = useImportResult();
  const { t, format } = useI18n();
  const { can } = useEntitlement();
  const { openPaywall } = usePaywall();
  const { guardWrite } = useProfileAccess();
  const [importing, setImporting] = useState(false);
  const isPickingRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  // The wrong kind of file usually means the bank's export was not found; offer the guide.
  const wrongFileButtons = (): AlertButton[] | undefined =>
    pathname === '/export-guide'
      ? undefined
      : [
          { text: t('guide.howToExport'), onPress: () => router.push('/export-guide') },
          { text: t('common.ok'), style: 'cancel' },
        ];

  // Resolve exact target profile safely from db if React context is pending
  const resolveTargetProfile = async () => {
    let targetProfile = activeProfile;
    if (!targetProfile) {
      const dbProfiles = await getProfiles(db);
      targetProfile = dbProfiles[0] ?? null;
    }

    if (!targetProfile) {
      Alert.alert(t('import.errorTitle'), t('import.noProfile'));
    }
    return targetProfile;
  };

  const failureText = (failure: ImportFailure): string => {
    const message = importFailureMessage(failure, (value) => format.money(value, currencySymbol, currencyDecimals));
    return t(message.key, message.params);
  };

  const handleImportError = (error: any, fileName = '') => {
    if (error instanceof UnsupportedFileError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const key = UNSUPPORTED_MESSAGE_KEYS[error.message];
      Alert.alert(t('import.unsupportedTitle'), key ? t(key) : error.message, wrongFileButtons());
      return;
    }
    // A PDF statement that was recognised but not read completely: nothing of it is imported.
    if (error instanceof PdfStatementError || error instanceof PdfExtractError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const reason = failureText(describeImportFailure(error));
      Alert.alert(t('import.fileFailedTitle'), fileName ? `${fileName}\n\n${reason}` : reason);
      return;
    }
    console.error('Import Error:', error);
    Alert.alert(t('import.failedTitle'), error?.message || t('import.failedMessage'));
  };

  const runImport = async (targetProfile: Profile, files: PickedFile[]) => {
    const targetProfileId = targetProfile.id;
    const single = files.length === 1;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setImporting(true);

    const [customRules, learned] = await Promise.all([
      getCustomRules(db, targetProfileId),
      getLearnedCategories(db, targetProfileId),
    ]);

    const tableRows: ImportTransactionPayload[] = [];
    const banks = new Set<BankId | null>();
    const pdfStatements: PdfStatement[] = [];
    const failedFiles: ImportResultSummary['failedFiles'] = [];
    // PDF statements are a Pro feature: without it they are left unread and the paywall opens.
    const allowPdf = can('pdfImport');
    let pdfBlocked = false;

    try {
      for (const [index, file] of files.entries()) {
        if (!single) setImportProgress({ current: index + 1, total: files.length });
        try {
          const read = await readStatementFile(file.uri, file.name, customRules, learned, {
            allowPdf,
            decimals: currencyDecimals,
          });
          if (read.kind === 'pdf') {
            pdfStatements.push(read.statement);
          } else if (read.parsed.transactions.length === 0) {
            failedFiles.push({ fileName: file.name, failure: { kind: 'empty' } });
          } else {
            tableRows.push(...read.parsed.transactions);
            banks.add(read.parsed.bank);
          }
        } catch (error) {
          if (error instanceof ProRequiredError) {
            pdfBlocked = true;
            continue;
          }
          // One file: say why. Several: the others still go in, and the summary lists this one.
          if (single) {
            handleImportError(error, file.name);
            return;
          }
          if (!(error instanceof UnsupportedFileError || error instanceof PdfStatementError)) {
            console.warn('Import: file left out:', error);
          }
          failedFiles.push({ fileName: file.name, failure: describeImportFailure(error) });
        }
      }
    } finally {
      setImportProgress(null);
    }

    // Across the statements: duplicates out, balance gaps and numbering jumps reported.
    const { kept, problems } = checkChain(pdfStatements);
    const pdfParsed = pdfStatementsToTransactions(kept, customRules, learned);
    if (kept.length > 0) banks.add(pdfParsed.bank);
    const parsedTransactions = [...tableRows, ...pdfParsed.transactions];

    if (pdfBlocked && parsedTransactions.length === 0 && failedFiles.length === 0) {
      openPaywall('pdfImport');
      return;
    }

    if (parsedTransactions.length === 0 && (single || (failedFiles.length === 0 && problems.length === 0))) {
      Alert.alert(
        t('import.noneTitle'),
        t('import.noneMessage'),
        wrongFileButtons()
      );
      return;
    }

    // Import strictly bound to targetProfileId
    const imported = await processBatchImport(
      db,
      parsedTransactions,
      targetProfileId,
      banks.size === 1 ? [...banks][0] : null
    );
    const summary: ImportResultSummary = {
      ...imported,
      statements: pdfStatements.length > 0 ? { read: kept.length, ...coveredPeriod(kept), problems } : null,
      failedFiles,
    };

    await cancelCurrentMonthReminders();

    // After the reminders are cleared (these are shown at once, not scheduled) and before the refresh,
    // so Home reloads with the new alerts already stored.
    try {
      // Budget Health and its alerts are a Pro feature.
      if (can('budgetHealth')) await runHealthAlerts(db, targetProfileId);
    } catch (error) {
      console.error('Failed to run health alerts after import:', error);
    }

    // Ensure target profile is explicitly active in state and refresh context
    switchProfile(targetProfile);
    await refreshProfiles();

    if (options?.onSuccess) {
      await options.onSuccess();
    }

    // Counted for the one-time Pro offer, which opens when a summary is closed.
    if (imported.insertedCount > 0) {
      try {
        const count = Number(await getAppMeta(db, PRO_OFFER_IMPORTS_KEY)) || 0;
        await setAppMeta(db, PRO_OFFER_IMPORTS_KEY, String(count + 1));
      } catch (error) {
        console.warn('Import count warning:', error);
      }
    }

    // The paywall goes on top; the summary shows once it is closed.
    if (pdfBlocked) openPaywall('pdfImport');
    showImportResult(summary, targetProfile.name);
  };

  const importStatement = async () => {
    // The demo workspace is wiped on exit; an import there would be lost.
    if (isDemoMode) return;
    if (isPickingRef.current || importing) return;
    // A profile beyond the free limit takes no new statements.
    if (!guardWrite()) return;
    isPickingRef.current = true;

    try {
      if (!db) return;

      const targetProfile = await resolveTargetProfile();
      if (!targetProfile) return;

      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/pdf',
          '*/*',
        ],
        copyToCacheDirectory: true,
        // Bank statements in PDF come one per month; a year of them is picked in one go.
        multiple: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      await runImport(
        targetProfile,
        result.assets.map((asset) => ({ uri: asset.uri, name: asset.name || '' }))
      );
    } catch (error: any) {
      handleImportError(error);
    } finally {
      setImporting(false);
      isPickingRef.current = false;
    }
  };

  // A file handed over by another app (share sheet); same path as a picked file.
  const importSharedFile = async (fileUri: string, fileName: string) => {
    if (isDemoMode) {
      Alert.alert(t('demo.importBlockedTitle'), t('demo.importBlockedMessage'));
      return;
    }
    if (isPickingRef.current || importing) return;
    if (!guardWrite()) return;
    isPickingRef.current = true;

    try {
      if (!db) return;

      const targetProfile = await resolveTargetProfile();
      if (!targetProfile) return;

      // The name becomes part of a temp path; content URIs can yield anything.
      const safeName = fileName.replace(/[^\w.-]+/g, '_');
      await runImport(targetProfile, [{ uri: fileUri, name: safeName }]);
    } catch (error: any) {
      handleImportError(error);
    } finally {
      setImporting(false);
      isPickingRef.current = false;
    }
  };

  return {
    importStatement,
    importSharedFile,
    importing,
    importDisabled: isDemoMode,
  };
}
