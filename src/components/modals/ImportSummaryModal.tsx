import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ImportResultSummary } from '@/services/importService';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

interface ImportSummaryModalProps {
  visible: boolean;
  summary: ImportResultSummary | null;
  profileName: string;
  onClose: () => void;
}

export function ImportSummaryModal({ visible, summary, profileName, onClose }: ImportSummaryModalProps) {
  const { colors } = useTheme();
  const { t, format } = useI18n();
  const { currencySymbol } = useProfile();

  const hasNewRows = !!summary && summary.insertedCount > 0;

  useEffect(() => {
    if (!visible || !summary) return;
    Haptics.notificationAsync(
      hasNewRows ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
    ).catch(() => {});
  }, [visible, summary, hasNewRows]);

  if (!summary) return null;

  const chipBg = colors.surface;

  const title = !hasNewRows
    ? t('import.nothingNew')
    : summary.isFirstImport
    ? t('import.allSet')
    : t('import.imported', { count: summary.insertedCount });

  const dateRange =
    summary.dateFrom && summary.dateTo
      ? format.range(summary.dateFrom, summary.dateTo)
      : null;

  const subtitle = !hasNewRows
    ? t('import.allAlready', { count: summary.totalProcessed, profile: profileName })
    : summary.isFirstImport
    ? t('import.importedInto', { count: summary.insertedCount, profile: profileName })
    : profileName;

  const notes: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [];
  if (hasNewRows) {
    if (summary.ambiguousDateCount > 0) {
      notes.push({
        icon: 'calendar-outline',
        text: t('import.datesCheck', { count: summary.ambiguousDateCount }),
      });
    }
    if (summary.skippedCount > 0) {
      notes.push({
        icon: 'copy-outline',
        text: t('import.duplicates', { count: summary.skippedCount }),
      });
    }
    if (summary.linkedDebtPayments > 0) {
      notes.push({
        icon: 'link-outline',
        text: t('import.debtLinked', { count: summary.linkedDebtPayments }),
      });
    }
  }

  const handleReview = () => {
    Haptics.selectionAsync().catch(() => {});
    onClose();
    router.navigate('/(tabs)/transactions');
  };

  const handleDone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableWithoutFeedback>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.header}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              <View style={[styles.iconBadge, { backgroundColor: hasNewRows ? colors.tintBackground : chipBg }]}>
                <Ionicons
                  name={hasNewRows ? 'checkmark' : 'documents-outline'}
                  size={30}
                  color={hasNewRows ? colors.accent : colors.textSecondary}
                />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
              {hasNewRows && dateRange && (
                <Text style={[styles.dateRange, { color: colors.accent }]}>{dateRange}</Text>
              )}
            </View>

            {hasNewRows && (
              <View style={styles.statRow}>
                <View style={[styles.statTile, { backgroundColor: chipBg }]}>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('category.income')}</Text>
                  <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                    {format.money(summary.incomeTotal, currencySymbol, { maximumFractionDigits: 0 })}
                  </Text>
                </View>
                <View style={[styles.statTile, { backgroundColor: chipBg }]}>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('import.spending')}</Text>
                  <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                    {format.money(summary.expenseTotal, currencySymbol, { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              </View>
            )}

            {notes.length > 0 && (
              <View style={styles.notes}>
                {notes.map((note) => (
                  <View key={note.text} style={styles.noteRow}>
                    <Ionicons name={note.icon} size={16} color={colors.textSecondary} />
                    <Text style={[styles.noteText, { color: colors.textSecondary }]}>{note.text}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.footer}>
              {hasNewRows && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.footerBtn, { backgroundColor: chipBg }]}
                  onPress={handleReview}
                >
                  <Text style={[styles.footerBtnText, { color: colors.text }]}>{t('transactions.review')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.footerBtn, { backgroundColor: colors.accent }]}
                onPress={handleDone}
              >
                <Text style={[styles.footerBtnText, { color: '#FFFFFF' }]}>
                  {hasNewRows && summary.isFirstImport ? t('import.viewDashboard') : t('common.done')}
                </Text>
              </TouchableOpacity>
            </View>
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
  header: { alignItems: 'center', marginBottom: 18 },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 20 },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 21, marginTop: 6, paddingHorizontal: 12 },
  dateRange: { fontSize: 13, fontWeight: '600', marginTop: 6 },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  statTile: { flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  statLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  notes: { gap: 8, marginBottom: 4, paddingHorizontal: 4 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noteText: { fontSize: 14, fontWeight: '500' },
  footer: { flexDirection: 'row', gap: 12, marginTop: 16 },
  footerBtn: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  footerBtnText: { fontSize: 16, fontWeight: '700' },
});
