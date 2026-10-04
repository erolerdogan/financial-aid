import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getAppMeta, getProfiles, setAppMeta, syncDebtPayments } from '@/db/database';
import {
  applyBackup,
  BackupError,
  BackupSummary,
  discardBackup,
  exportBackup,
  getLastBackupDate,
  getSafetyCopyDate,
  openSafetyCopy,
  PendingBackup,
  pickBackup,
  summarizeDatabase,
} from '@/services/backupService';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

interface BackupRestoreModalProps {
  visible: boolean;
  onClose: () => void;
}

type BusyAction = 'backup' | 'restore' | 'undo';

const NOTICE_SEEN_KEY = 'backupNoticeSeen';
const UNCHANGED = 'Your data was not changed.';

const ERROR_MESSAGES: Record<BackupError['code'], string> = {
  NOT_BACKUP: `This file is not a Financial Aid backup. ${UNCHANGED}`,
  DAMAGED: `This backup file is damaged and cannot be read. ${UNCHANGED}`,
  NEWER_VERSION: `This backup was made with a newer version of the app. Update the app, then try again. ${UNCHANGED}`,
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

const formatDate = (date: Date): string => date.toLocaleDateString(undefined, DATE_OPTIONS);

const formatDateKey = (key: string): string => {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  return formatDate(new Date(y, m - 1, d));
};

const plural = (count: number, singular: string, pluralForm: string): string =>
  `${count.toLocaleString()} ${count === 1 ? singular : pluralForm}`;

const describeCounts = (summary: BackupSummary): string =>
  `${plural(summary.profiles, 'profile', 'profiles')}, ${plural(summary.transactions, 'transaction', 'transactions')}`;

const describeRange = (summary: BackupSummary): string =>
  summary.firstDate && summary.lastDate
    ? ` (${formatDateKey(summary.firstDate)} – ${formatDateKey(summary.lastDate)})`
    : '';

export function BackupRestoreModal({ visible, onClose }: BackupRestoreModalProps) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { isDemoMode, reloadAfterRestore } = useProfile();

  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [safetyCopy, setSafetyCopy] = useState<Date | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      setLastBackup(await getLastBackupDate(db));
      setSafetyCopy(getSafetyCopyDate());
    } catch (error) {
      console.error('Backup status error:', error);
    }
  }, [db]);

  const disabled = busy !== null || isDemoMode;

  const showError = (title: string, error: unknown) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const message =
      error instanceof BackupError ? ERROR_MESSAGES[error.code] : `Something went wrong. ${UNCHANGED}`;
    if (!(error instanceof BackupError)) console.error(`${title}:`, error);
    Alert.alert(title, message);
  };

  const runBackup = async () => {
    setBusy('backup');
    try {
      const saved = await exportBackup(db);
      if (saved) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refreshStatus();
      }
    } catch (error) {
      showError('Backup Failed', error);
    } finally {
      setBusy(null);
    }
  };

  const handleBackup = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (await getAppMeta(db, NOTICE_SEEN_KEY)) {
      runBackup();
      return;
    }
    Alert.alert(
      'Before You Back Up',
      'The backup file contains all profiles and is not encrypted. Store it somewhere only you can access.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            await setAppMeta(db, NOTICE_SEEN_KEY, '1');
            runBackup();
          },
        },
      ]
    );
  };

  const apply = async (backup: PendingBackup, action: BusyAction) => {
    setBusy(action);
    try {
      await applyBackup(db, backup);
      for (const profile of await getProfiles(db)) {
        await syncDebtPayments(db, profile.id);
      }
      await reloadAfterRestore();
      await refreshStatus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        action === 'undo' ? 'Restore Undone' : 'Restore Complete',
        `${describeCounts(backup.summary)} are now on this device.\n\n` +
          'The data that was replaced was kept as a safety copy. Use "Undo Last Restore" to bring it back.'
      );
    } catch (error) {
      showError('Restore Failed', error);
    } finally {
      setBusy(null);
    }
  };

  /** Tells the user exactly what is in the backup and what will be lost before anything changes. */
  const confirmReplace = async (backup: PendingBackup, action: BusyAction) => {
    const device = await summarizeDatabase(db);
    const source = action === 'undo' ? 'Safety copy' : 'Backup';
    const madeOn = backup.createdAt ? ` from ${formatDate(backup.createdAt)}` : '';
    const backupLine = `${source}${madeOn}: ${describeCounts(backup.summary)}${describeRange(backup.summary)}.`;
    const cancel = { text: 'Cancel', style: 'cancel' as const, onPress: () => discardBackup(backup) };

    if (device.transactions === 0) {
      Alert.alert('Restore Backup?', backupLine, [
        cancel,
        { text: 'Restore', onPress: () => apply(backup, action) },
      ], { cancelable: false });
      return;
    }

    const lines = [backupLine, `This device: ${describeCounts(device)}${describeRange(device)}.`];
    const backupNewest = backup.summary.lastDate;
    if (device.lastDate && (!backupNewest || device.lastDate > backupNewest)) {
      lines.push(
        `This device has transactions newer than the ${source.toLowerCase()} (up to ${formatDateKey(device.lastDate)}). They will be removed.`
      );
    }
    lines.push(
      'Everything currently in the app, in all profiles, will be replaced. Transactions, categories, rules, goals and debts that are not in this file will be lost. Nothing is merged.'
    );

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Replace All Data?', lines.join('\n\n'), [
      cancel,
      { text: 'Replace All Data', style: 'destructive', onPress: () => apply(backup, action) },
    ], { cancelable: false });
  };

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy('restore');
    try {
      const backup = await pickBackup();
      if (backup) await confirmReplace(backup, 'restore');
    } catch (error) {
      showError('Cannot Restore', error);
    } finally {
      setBusy(null);
    }
  };

  const handleUndo = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy('undo');
    try {
      const backup = await openSafetyCopy();
      if (backup) await confirmReplace(backup, 'undo');
    } catch (error) {
      showError('Cannot Undo Restore', error);
    } finally {
      setBusy(null);
    }
  };

  const renderRow = (
    action: BusyAction,
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    subtitle: string,
    onPress: () => void
  ) => (
    <TouchableOpacity
      style={[styles.row, disabled && busy !== action && styles.rowDisabled]}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      {busy === action ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onShow={refreshStatus} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={busy ? undefined : onClose}>
        <TouchableWithoutFeedback>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.header}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              <Text style={[styles.title, { color: colors.text }]}>Backup & Restore</Text>
            </View>

            {renderRow(
              'backup',
              'cloud-upload-outline',
              'Back Up Data',
              lastBackup ? `Last backup: ${formatDate(lastBackup)}` : 'Never backed up',
              handleBackup
            )}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {renderRow(
              'restore',
              'cloud-download-outline',
              'Restore from Backup',
              'Replaces all data on this device with the contents of a backup file.',
              handleRestore
            )}

            {safetyCopy && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                {renderRow(
                  'undo',
                  'arrow-undo-outline',
                  'Undo Last Restore',
                  `Brings back the data replaced on ${formatDate(safetyCopy)}.`,
                  handleUndo
                )}
              </>
            )}

            <Text style={[styles.footer, { color: colors.textSecondary }]}>
              {isDemoMode
                ? 'Backup and restore are not available in the demo workspace.'
                : 'A backup contains all profiles and is not encrypted. It is saved only where you choose; the app never uploads it.'}
            </Text>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
  },
  header: { alignItems: 'center', marginBottom: 8 },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 12, alignSelf: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowDisabled: { opacity: 0.4 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: { height: StyleSheet.hairlineWidth },
  footer: { fontSize: 12, lineHeight: 16, marginTop: 12 },
});
