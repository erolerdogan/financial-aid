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
  LockedBackup,
  openSafetyCopy,
  PendingBackup,
  pickBackup,
  summarizeDatabase,
  unlockBackup,
} from '@/services/backupService';
import { ExportFormat, exportTransactions } from '@/services/exportService';
import { MIN_PASSWORD_LENGTH } from '@/utils/backupFormat';
import type { TranslationKey } from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

interface BackupRestoreModalProps {
  visible: boolean;
  onClose: () => void;
}

type BusyAction = 'backup' | 'restore' | 'undo' | 'export';

type Step = 'menu' | 'setPassword' | 'enterPassword';

type PasswordError = 'backup.passwordTooShort' | 'backup.passwordMismatch';

/** Last choice of the "Protect with a password" switch: '0' is off, anything else on. */
const ENCRYPT_KEY = 'backupEncrypt';
const ERROR_COLOR = '#FF3B30';

const ERROR_MESSAGES: Record<BackupError['code'], TranslationKey> = {
  NOT_BACKUP: 'backup.error.notBackup',
  DAMAGED: 'backup.error.damaged',
  NEWER_VERSION: 'backup.error.newer',
  WRONG_PASSWORD: 'backup.error.wrongPassword',
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

export function BackupRestoreModal({ visible, onClose }: BackupRestoreModalProps) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t, format, categoryName } = useI18n();

  const formatDate = (date: Date): string => format.date(date, DATE_OPTIONS);
  const formatDateKey = format.day;

  const describeCounts = (summary: BackupSummary): string =>
    `${t('backup.profiles', { count: summary.profiles })}, ${t('common.transactions', { count: summary.transactions })}`;

  const describeRange = (summary: BackupSummary): string =>
    summary.firstDate && summary.lastDate
      ? ` (${formatDateKey(summary.firstDate)} – ${formatDateKey(summary.lastDate)})`
      : '';
  const { isDemoMode, reloadAfterRestore, activeProfile } = useProfile();

  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [step, setStep] = useState<Step>('menu');
  const [protect, setProtect] = useState(true);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [passwordError, setPasswordError] = useState<PasswordError | null>(null);
  const [locked, setLocked] = useState<LockedBackup | null>(null);
  const [unlockFailed, setUnlockFailed] = useState(false);
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

  /** Back to the three rows; typed passwords and a picked file are dropped. */
  const resetStep = () => {
    setStep('menu');
    setPassword('');
    setRepeat('');
    setPasswordError(null);
    setLocked(null);
    setUnlockFailed(false);
  };

  const handleShow = () => {
    resetStep();
    refreshStatus();
  };

  const handleClose = () => {
    if (busy) return;
    resetStep();
    onClose();
  };

  const handleRequestClose = () => {
    if (busy) return;
    if (step === 'menu') onClose();
    else resetStep();
  };

  const showError = (title: string, error: unknown) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const message =
      `${error instanceof BackupError ? t(ERROR_MESSAGES[error.code]) : t('backup.error.generic')} ${t('backup.unchanged')}`;
    if (!(error instanceof BackupError)) console.error(`${title}:`, error);
    Alert.alert(title, message);
  };

  const runBackup = async (secret?: string) => {
    setBusy('backup');
    try {
      const saved = await exportBackup(db, secret);
      if (saved) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refreshStatus();
        resetStep();
      }
    } catch (error) {
      showError(t('backup.failedTitle'), error);
    } finally {
      setBusy(null);
    }
  };

  const handleBackup = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProtect((await getAppMeta(db, ENCRYPT_KEY)) !== '0');
    setStep('setPassword');
  };

  const handleToggleProtect = (value: boolean) => {
    Haptics.selectionAsync();
    setProtect(value);
    setPasswordError(null);
  };

  const handleSubmitBackup = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (protect) {
      const error: PasswordError | null =
        password.length < MIN_PASSWORD_LENGTH
          ? 'backup.passwordTooShort'
          : password !== repeat
            ? 'backup.passwordMismatch'
            : null;
      setPasswordError(error);
      if (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      await setAppMeta(db, ENCRYPT_KEY, '1');
      runBackup(password);
      return;
    }

    await setAppMeta(db, ENCRYPT_KEY, '0');
    runBackup();
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
      if (!backup) return;
      if ('locked' in backup) {
        setLocked(backup);
        setStep('enterPassword');
      } else {
        await confirmReplace(backup, 'restore');
      }
    } catch (error) {
      showError(t('backup.cannotRestoreTitle'), error);
    } finally {
      setBusy(null);
    }
  };

  const handleUnlock = async () => {
    if (!locked || password.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUnlockFailed(false);
    setBusy('restore');
    try {
      const backup = await unlockBackup(locked, password);
      resetStep();
      await confirmReplace(backup, 'restore');
    } catch (error) {
      if (error instanceof BackupError && error.code === 'WRONG_PASSWORD') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setUnlockFailed(true);
      } else {
        resetStep();
        showError(t('backup.cannotRestoreTitle'), error);
      }
    } finally {
      setBusy(null);
    }
  };

  const runExport = async (exportFormat: ExportFormat) => {
    if (!activeProfile) return;
    setBusy('export');
    try {
      const result = await exportTransactions(db, {
        profileId: activeProfile.id,
        profileName: activeProfile.name,
        format: exportFormat,
        sheetName: t('backup.sheetName'),
        labels: {
          date: t('backup.column.date'),
          merchant: t('backup.column.merchant'),
          category: t('backup.column.category'),
          amount: t('backup.column.amount'),
          description: t('backup.column.description'),
          categoryName,
        },
      });
      if (result === 'SAVED') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (result === 'EMPTY') {
        Alert.alert(t('backup.exportEmptyTitle'), t('backup.exportEmptyMessage'));
      }
    } catch (error) {
      showError(t('backup.exportFailedTitle'), error);
    } finally {
      setBusy(null);
    }
  };

  const handleExport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(t('backup.export'), t('backup.exportMessage'), [
      { text: t('backup.exportCsv'), onPress: () => runExport('csv') },
      { text: t('backup.exportExcel'), onPress: () => runExport('xlsx') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
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

  const renderField = (
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    options: { isNew: boolean; autoFocus?: boolean; onSubmit?: () => void }
  ) => (
    <TextInput
      style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      textContentType={options.isNew ? 'newPassword' : 'password'}
      autoFocus={options.autoFocus}
      editable={busy === null}
      returnKeyType="done"
      onSubmitEditing={options.onSubmit}
    />
  );

  const renderActions = (action: BusyAction, label: string, onPress: () => void, enabled: boolean) => (
    <View style={styles.actionRow}>
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: colors.track }, busy !== null && styles.rowDisabled]}
        onPress={resetStep}
        disabled={busy !== null}
      >
        <Text style={[styles.actionText, { color: colors.text }]}>{t('common.cancel')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: colors.accent }, !enabled && busy === null && styles.rowDisabled]}
        onPress={onPress}
        disabled={busy !== null || !enabled}
      >
        {busy === action ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={[styles.actionText, styles.primaryText]}>{label}</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderMenu = () => (
    <>
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

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {renderRow(
        'export',
        'download-outline',
        t('backup.export'),
        t('backup.exportSub', { profile: activeProfile?.name ?? '' }),
        handleExport
      )}

      <Text style={[styles.footer, { color: colors.textSecondary }]}>
        {isDemoMode
          ? t('backup.demoNote')
          : t('backup.footer')}
      </Text>
    </>
  );

  const renderSetPassword = () => (
    <>
      <View style={styles.header}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <Text style={[styles.title, { color: colors.text }]}>{t('backup.backUp')}</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{t('backup.protect')}</Text>
          <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{t('backup.protectSub')}</Text>
        </View>
        <Switch
          value={protect}
          onValueChange={handleToggleProtect}
          disabled={busy !== null}
          trackColor={{ false: '#78788029', true: colors.accent }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#78788029"
        />
      </View>

      {protect ? (
        <>
          {renderField(password, setPassword, t('backup.password'), { isNew: true, autoFocus: true })}
          {renderField(repeat, setRepeat, t('backup.passwordRepeat'), { isNew: true, onSubmit: handleSubmitBackup })}
          {passwordError && (
            <Text style={[styles.note, { color: ERROR_COLOR }]}>
              {t(passwordError, { min: MIN_PASSWORD_LENGTH })}
            </Text>
          )}
          <Text style={[styles.note, { color: colors.textSecondary }]}>{t('backup.passwordWarning')}</Text>
        </>
      ) : (
        <Text style={[styles.note, { color: colors.textSecondary }]}>{t('backup.noticeMessage')}</Text>
      )}

      {renderActions('backup', t('backup.backUp'), handleSubmitBackup, true)}
    </>
  );

  const renderEnterPassword = () => (
    <>
      <View style={styles.header}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <Text style={[styles.title, { color: colors.text }]}>{t('backup.unlockTitle')}</Text>
      </View>

      <Text style={[styles.note, { color: colors.textSecondary }]}>{t('backup.unlockSub')}</Text>
      {renderField(password, setPassword, t('backup.password'), {
        isNew: false,
        autoFocus: true,
        onSubmit: handleUnlock,
      })}
      {unlockFailed && (
        <Text style={[styles.note, { color: ERROR_COLOR }]}>
          {`${t('backup.error.wrongPassword')} ${t('backup.unchanged')}`}
        </Text>
      )}

      {renderActions('restore', t('backup.unlock'), handleUnlock, password.length > 0)}
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onShow={handleShow} onRequestClose={handleRequestClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={handleClose}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { backgroundColor: colors.card }]}>
              {step === 'setPassword'
                ? renderSetPassword()
                : step === 'enterPassword'
                  ? renderEnterPassword()
                  : renderMenu()}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  dismissArea: { flex: 1, justifyContent: 'flex-end' },
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
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginTop: 8,
  },
  note: { fontSize: 12, lineHeight: 16, marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  actionBtn: { flex: 1, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  actionText: { fontSize: 15, fontWeight: '600' },
  primaryText: { color: '#FFFFFF' },
});
