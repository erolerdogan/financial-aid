import { useImportResult } from '@/contexts/ImportResultContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getCustomRules, getLearnedCategories, getProfiles } from '@/db/database';
import { parseFileToTransactions, processBatchImport } from '@/services/importService';
import { cancelCurrentMonthReminders } from '@/utils/notifications';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

interface UseStatementImporterOptions {
  onSuccess?: () => void | Promise<void>;
}

export function useStatementImporter(options?: UseStatementImporterOptions) {
  const db = useSQLiteContext();
  const { activeProfile, refreshProfiles, switchProfile } = useProfile();
  const { showImportResult } = useImportResult();
  const [importing, setImporting] = useState(false);
  const isPickingRef = useRef(false);

  const importStatement = async () => {
    if (isPickingRef.current || importing) return;
    isPickingRef.current = true;

    try {
      if (!db) return;

      // 1. Resolve exact target profile ID safely from db if React context is pending
      let targetProfile = activeProfile;
      if (!targetProfile) {
        const dbProfiles = await getProfiles(db);
        targetProfile = dbProfiles[0] ?? null;
      }

      if (!targetProfile) {
        Alert.alert('Import Error', 'No active profile found. Please create a profile first.');
        return;
      }

      const targetProfileId = targetProfile.id;

      // 2. Open document picker
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

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setImporting(true);

      const asset = result.assets[0];
      const [customRules, learned] = await Promise.all([
        getCustomRules(db, targetProfileId),
        getLearnedCategories(db, targetProfileId),
      ]);
      const parsedTransactions = await parseFileToTransactions(
        asset.uri,
        asset.name || '',
        customRules,
        learned
      );

      if (!parsedTransactions || parsedTransactions.length === 0) {
        Alert.alert('Import Warning', 'No valid transactions found in file.');
        return;
      }

      // 3. Import strictly bound to targetProfileId
      const summary = await processBatchImport(db, parsedTransactions, targetProfileId);

      // 4. Ensure target profile is explicitly active in state and refresh context
      switchProfile(targetProfile);
      await refreshProfiles();
      await cancelCurrentMonthReminders();

      if (options?.onSuccess) {
        await options.onSuccess();
      }

      showImportResult(summary, targetProfile.name);
    } catch (error: any) {
      console.error('Import Error:', error);
      Alert.alert('Import Failed', error?.message || 'An error occurred during import.');
    } finally {
      setImporting(false);
      isPickingRef.current = false;
    }
  };

  return {
    importStatement,
    importing,
  };
}