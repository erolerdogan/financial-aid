import { SetupProgress } from '@/components/profile/ProfileSetup';
import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface FirstStatementStepProps {
  /** Position of this step among the profile questions, for the progress dots. */
  current: number;
  total: number;
  importing: boolean;
  onImport: () => void;
  onHelp: () => void;
  onDemo: () => void;
  onRestore: () => void;
  onClose: () => void;
  /** Given when the questions were just answered: the button at the top goes back to the last one instead of closing. */
  onBack?: () => void;
}

/** The last step of the first-launch questions: the user picks the first statement here. */
export function FirstStatementStep({ current, total, importing, onImport, onHelp, onDemo, onRestore, onClose, onBack }: FirstStatementStepProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const leave = onBack ?? onClose;

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!importing) leave();
      return true;
    });
    return () => subscription.remove();
  }, [importing, leave]);

  return (
    <View style={styles.fill}>
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.topBtn}
          onPress={leave}
          disabled={importing}
          accessibilityRole="button"
          accessibilityLabel={onBack ? t('common.back') : t('common.close')}
        >
          <Ionicons name={onBack ? 'chevron-back' : 'close'} size={24} color={colors.text} />
        </TouchableOpacity>
        <SetupProgress current={current} total={total} />
        <View style={styles.topBtn} />
      </View>

      <View style={styles.body}>
        <View style={[styles.iconWrap, { backgroundColor: colors.tintBackground }]}>
          <Ionicons name="document-text-outline" size={36} color={colors.accent} />
        </View>
        <SelectableText style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {t('setup.import.title')}
        </SelectableText>
        <SelectableText style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('setup.import.subtitle')}
        </SelectableText>
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
        onPress={onImport}
        disabled={importing}
        accessibilityRole="button"
      >
        {importing && <ActivityIndicator size="small" color="#FFFFFF" />}
        <Text style={styles.primaryText}>{importing ? t('welcome.processing') : t('welcome.import')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.link} onPress={onHelp} disabled={importing} accessibilityRole="link">
        <Ionicons name="help-circle-outline" size={16} color={colors.accent} />
        <Text style={[styles.linkText, { color: colors.accent }]}>{t('guide.link')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.link} onPress={onDemo} disabled={importing} accessibilityRole="button">
        <Ionicons name="sparkles-outline" size={16} color={colors.textSecondary} />
        <Text style={[styles.linkText, { color: colors.textSecondary }]}>{t('welcome.tryDemo')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.link}
        onPress={onRestore}
        disabled={importing}
        accessibilityRole="button"
        accessibilityLabel={t('backup.restoreFrom')}
      >
        <Ionicons name="cloud-download-outline" size={16} color={colors.textSecondary} />
        <Text style={[styles.linkText, { color: colors.textSecondary }]}>{t('welcome.restoreLink')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  topBtn: { minWidth: 64, minHeight: 44, justifyContent: 'center' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  iconWrap: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  primaryBtn: {
    flexDirection: 'row',
    gap: 10,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  primaryText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 },
  linkText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
