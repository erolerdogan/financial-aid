import { useImportResult } from '@/contexts/ImportResultContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getCustomRules, getLearnedCategories, getProfiles, Profile } from '@/db/database';
import { parseFileToTransactions, processBatchImport } from '@/services/importService';
import { cancelCurrentMonthReminders } from '@/utils/notifications';
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

export function useStatementImporter(options?: UseStatementImporterOptions) {
  const db = useSQLiteContext();
  const { activeProfile, refreshProfiles, switchProfile } = useProfile();
  const { showImportResult } = useImportResult();
  const { t } = useI18n();
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

  const runImport = async (targetProfile: Profile, fileUri: string, fileName: string) => {
    const targetProfileId = targetProfile.id;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setImporting(true);

    const [customRules, learned] = await Promise.all([
      getCustomRules(db, targetProfileId),
      getLearnedCategories(db, targetProfileId),
    ]);
    const { transactions: parsedTransactions, bank } = await parseFileToTransactions(
      fileUri,
      fileName,
      customRules,
      learned
    );

    if (!parsedTransactions || parsedTransactions.length === 0) {
      Alert.alert(
        t('import.noneTitle'),
        t('import.noneMessage'),
        wrongFileButtons()
      );
      return;
    }

    // Import strictly bound to targetProfileId
    const summary = await processBatchImport(db, parsedTransactions, targetProfileId, bank);

    // Ensure target profile is explicitly active in state and refresh context
    switchProfile(targetProfile);
    await refreshProfiles();
    await cancelCurrentMonthReminders();

    if (options?.onSuccess) {
      await options.onSuccess();
    }

    showImportResult(summary, targetProfile.name);
  };

  const handleImportError = (error: any) => {
    if (error instanceof UnsupportedFileError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const key = UNSUPPORTED_MESSAGE_KEYS[error.message];
      Alert.alert(t('import.unsupportedTitle'), key ? t(key) : error.message, wrongFileButtons());
      return;
    }
    console.error('Import Error:', error);
    Alert.alert(t('import.failedTitle'), error?.message || t('import.failedMessage'));
  };

  const importStatement = async () => {
    if (isPickingRef.current || importing) return;
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
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      await runImport(targetProfile, asset.uri, asset.name || '');
    } catch (error: any) {
      handleImportError(error);
    } finally {
      setImporting(false);
      isPickingRef.current = false;
    }
  };

  // A file handed over by another app (share sheet); same path as a picked file.
  const importSharedFile = async (fileUri: string, fileName: string) => {
    if (isPickingRef.current || importing) return;
    isPickingRef.current = true;

    try {
      if (!db) return;

      const targetProfile = await resolveTargetProfile();
      if (!targetProfile) return;

      // The name becomes part of a temp path; content URIs can yield anything.
      const safeName = fileName.replace(/[^\w.-]+/g, '_');
      await runImport(targetProfile, fileUri, safeName);
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
  };
}