import { useI18n } from '@/contexts/LanguageContext';
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
import type { TranslationKey } from '@/i18n';
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

const ERROR_MESSAGES: Record<BackupError['code'], TranslationKey> = {
  NOT_BACKUP: 'backup.error.notBackup',
  DAMAGED: 'backup.error.damaged',
  NEWER_VERSION: 'backup.error.newer',
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

export function BackupRestoreModal({ visible, onClose }: BackupRestoreModalProps) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t, format } = useI18n();

  const formatDate = (date: Date): string => format.date(date, DATE_OPTIONS);
  const formatDateKey = format.day;

  const describeCounts = (summary: BackupSummary): string =>
    `${t('backup.profiles', { count: summary.profiles })}, ${t('common.transactions', { count: summary.transactions })}`;

  const describeRange = (summary: BackupSummary): string =>
    summary.firstDate && summary.lastDate
      ? ` (${formatDateKey(summary.firstDate)} – ${formatDateKey(summary.lastDate)})`
      : '';
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
      `${error instanceof BackupError ? t(ERROR_MESSAGES[error.code]) : t('backup.error.generic')} ${t('backup.unchanged')}`;
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
      showError(t('backup.failedTitle'), error);
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
      t('backup.noticeTitle'),
      t('backup.noticeMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.continue'),
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
        action === 'undo' ? t('backup.undoneTitle') : t('backup.completeTitle'),
        `${t('backup.nowOnDevice', { counts: describeCounts(backup.summary) })}\n\n${t('backup.safetyKept')}`
      );
    } catch (error) {
      showError(t('backup.restoreFailedTitle'), error);
    } finally {
      setBusy(null);
    }
  };

  /** Tells the user exactly what is in the backup and what will be lost before anything changes. */
  const confirmReplace = async (backup: PendingBackup, action: BusyAction) => {
    const device = await summarizeDatabase(db);
    const source = action === 'undo' ? t('backup.sourceSafety') : t('backup.sourceBackup');
    const contents = `${describeCounts(backup.summary)}${describeRange(backup.summary)}`;
    const backupLine = backup.createdAt
      ? t('backup.lineFrom', { source, date: formatDate(backup.createdAt), contents })
      : t('backup.line', { source, contents });
    const cancel = { text: t('common.cancel'), style: 'cancel' as const, onPress: () => discardBackup(backup) };

    if (device.transactions === 0) {
      Alert.alert(t('backup.restoreTitle'), backupLine, [
        cancel,
        { text: t('backup.restore'), onPress: () => apply(backup, action) },
      ], { cancelable: false });
      return;
    }

    const lines = [
      backupLine,
      t('backup.deviceLine', { contents: `${describeCounts(device)}${describeRange(device)}` }),
    ];
    const backupNewest = backup.summary.lastDate;
    if (device.lastDate && (!backupNewest || device.lastDate > backupNewest)) {
      lines.push(
        t(action === 'undo' ? 'backup.newerThanSafety' : 'backup.newerThanBackup', {
          date: formatDateKey(device.lastDate),
        })
      );
    }
    lines.push(
      t('backup.replaceWarning')
    );

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(t('backup.replaceTitle'), lines.join('\n\n'), [
      cancel,
      { text: t('backup.replaceConfirm'), style: 'destructive', onPress: () => apply(backup, action) },
    ], { cancelable: false });
  };

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy('restore');
    try {
      const backup = await pickBackup();
      if (backup) await confirmReplace(backup, 'restore');
    } catch (error) {
      showError(t('backup.cannotRestoreTitle'), error);
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
      showError(t('backup.cannotUndoTitle'), error);
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
              <Text style={[styles.title, { color: colors.text }]}>{t('settings.backup')}</Text>
            </View>

            {renderRow(
              'backup',
              'cloud-upload-outline',
              t('backup.backUp'),
              lastBackup ? t('backup.lastBackup', { date: formatDate(lastBackup) }) : t('backup.never'),
              handleBackup
            )}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {renderRow(
              'restore',
              'cloud-download-outline',
              t('backup.restoreFrom'),
              t('backup.restoreSub'),
              handleRestore
            )}

            {safetyCopy && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                {renderRow(
                  'undo',
                  'arrow-undo-outline',
                  t('backup.undo'),
                  t('backup.undoSub', { date: formatDate(safetyCopy) }),
                  handleUndo
                )}
              </>
            )}

            <Text style={[styles.footer, { color: colors.textSecondary }]}>
              {isDemoMode
                ? t('backup.demoNote')
                : t('backup.footer')}
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
