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

const formatDate = (key: string): string => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatAmount = (value: number): string =>
  value.toLocaleString(undefined, { maximumFractionDigits: 0 });

const plural = (count: number, singular: string, pluralForm: string): string =>
  `${count} ${count === 1 ? singular : pluralForm}`;

export function ImportSummaryModal({ visible, summary, profileName, onClose }: ImportSummaryModalProps) {
  const { colors, isDark } = useTheme();
  const { currencySymbol } = useProfile();

  const hasNewRows = !!summary && summary.insertedCount > 0;

  useEffect(() => {
    if (!visible || !summary) return;
    Haptics.notificationAsync(
      hasNewRows ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
    ).catch(() => {});
  }, [visible, summary, hasNewRows]);

  if (!summary) return null;

  const chipBg = isDark ? '#2C2C2E' : '#F2F2F7';
  const importedLabel = plural(summary.insertedCount, 'transaction', 'transactions');

  const title = !hasNewRows
    ? 'Nothing new to import'
    : summary.isFirstImport
    ? "You're all set"
    : `${importedLabel} imported`;

  const dateRange =
    summary.dateFrom && summary.dateTo
      ? summary.dateFrom === summary.dateTo
        ? formatDate(summary.dateFrom)
        : `${formatDate(summary.dateFrom)} – ${formatDate(summary.dateTo)}`
      : null;

  const subtitle = !hasNewRows
    ? `All ${plural(summary.totalProcessed, 'transaction', 'transactions')} in this file ${
        summary.totalProcessed === 1 ? 'is' : 'are'
      } already in ${profileName}.`
    : summary.isFirstImport
    ? `${importedLabel} imported into ${profileName}`
    : profileName;

  const notes: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [];
  if (hasNewRows) {
    if (summary.ambiguousDateCount > 0) {
      notes.push({
        icon: 'calendar-outline',
        text: `${plural(summary.ambiguousDateCount, 'date needs', 'dates need')} checking`,
      });
    }
    if (summary.skippedCount > 0) {
      notes.push({
        icon: 'copy-outline',
        text: `${plural(summary.skippedCount, 'duplicate', 'duplicates')} skipped`,
      });
    }
    if (summary.linkedDebtPayments > 0) {
      notes.push({
        icon: 'link-outline',
        text: `${plural(summary.linkedDebtPayments, 'debt payment', 'debt payments')} linked`,
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
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Income</Text>
                  <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                    {currencySymbol}
                    {formatAmount(summary.incomeTotal)}
                  </Text>
                </View>
                <View style={[styles.statTile, { backgroundColor: chipBg }]}>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Spending</Text>
                  <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                    {currencySymbol}
                    {formatAmount(summary.expenseTotal)}
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
                  <Text style={[styles.footerBtnText, { color: colors.text }]}>Review</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.footerBtn, { backgroundColor: colors.accent }]}
                onPress={handleDone}
              >
                <Text style={[styles.footerBtnText, { color: '#FFFFFF' }]}>
                  {hasNewRows && summary.isFirstImport ? 'View Dashboard' : 'Done'}
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
