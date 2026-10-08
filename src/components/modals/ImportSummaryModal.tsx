import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ImportResultSummary } from '@/services/importService';
import { BANK_LABELS } from '@/utils/bankFormats';
import { importFailureMessage } from '@/utils/importFailure';
import type { ChainProblem } from '@/utils/pdfStatements/chain';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

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
    ? summary.totalProcessed > 0
      ? t('import.allAlready', { count: summary.totalProcessed, profile: profileName })
      : summary.failedFiles.length > 0
      ? t('import.filesSkipped', { count: summary.failedFiles.length })
      : profileName
    : summary.isFirstImport
    ? t('import.importedInto', { count: summary.insertedCount, profile: profileName })
    : profileName;

  const notes: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [];
  if (summary.bank) {
    notes.push({
      icon: 'business-outline',
      text: t('import.recognisedAs', { bank: BANK_LABELS[summary.bank] }),
    });
  }
  if (summary.statements && summary.statements.read > 0) {
    const { read, dateFrom, dateTo } = summary.statements;
    const period = dateFrom && dateTo ? ` · ${format.range(dateFrom, dateTo)}` : '';
    notes.push({ icon: 'documents-outline', text: t('import.statementsRead', { count: read }) + period });
    notes.push({ icon: 'shield-checkmark-outline', text: t('import.totalsChecked') });
  }
  if (summary.possibleDuplicateCount > 0) {
    notes.push({
      icon: 'copy-outline',
      text: t('import.possibleDuplicates', { count: summary.possibleDuplicateCount }),
    });
  }
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

  // What needs a look: statements that are missing or doubled, and files that were left out.
  const money = (value: number) => format.money(value, currencySymbol, 2);
  const statementLabel = (ref: { year: number; number: number }) =>
    `${ref.year}/${String(ref.number).padStart(3, '0')}`;
  const problemText = (problem: ChainProblem): string => {
    if (problem.kind === 'DUPLICATE') return t('import.problem.duplicate', { statement: statementLabel(problem) });
    const params = { after: statementLabel(problem.after), next: statementLabel(problem.next) };
    return problem.kind === 'GAP'
      ? t('import.problem.gap', { ...params, difference: money(Math.abs(problem.difference)) })
      : t('import.problem.numbering', params);
  };
  for (const problem of summary.statements?.problems ?? []) {
    notes.push({ icon: 'alert-circle-outline', text: problemText(problem) });
  }
  for (const { fileName, failure } of summary.failedFiles) {
    const message = importFailureMessage(failure, money);
    notes.push({ icon: 'close-circle-outline', text: `${fileName}: ${t(message.key, message.params)}` });
  }

  const handleReview = () => {
    Haptics.selectionAsync().catch(() => {});
    onClose();
    // Transactions is pushed on the root stack, so a modal route on top (Settings) has to go first.
    if (router.canDismiss()) router.dismissAll();
    router.push('/transactions');
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
              <SelectableText style={[styles.title, { color: colors.text }]}>{title}</SelectableText>
              <SelectableText style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</SelectableText>
              {hasNewRows && dateRange && (
                <SelectableText style={[styles.dateRange, { color: colors.accent }]}>{dateRange}</SelectableText>
              )}
            </View>

            {hasNewRows && (
              <View style={styles.statRow}>
                <View style={[styles.statTile, { backgroundColor: chipBg }]}>
                  <SelectableText style={[styles.statLabel, { color: colors.textSecondary }]}>{t('category.income')}</SelectableText>
                  <SelectableText style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                    {format.money(summary.incomeTotal, currencySymbol, { maximumFractionDigits: 0 })}
                  </SelectableText>
                </View>
                <View style={[styles.statTile, { backgroundColor: chipBg }]}>
                  <SelectableText style={[styles.statLabel, { color: colors.textSecondary }]}>{t('import.spending')}</SelectableText>
                  <SelectableText style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                    {format.money(summary.expenseTotal, currencySymbol, { maximumFractionDigits: 0 })}
                  </SelectableText>
                </View>
              </View>
            )}

            {notes.length > 0 && (
              <ScrollView style={styles.notesScroll} contentContainerStyle={styles.notes} bounces={false}>
                {notes.map((note, index) => (
                  <View key={index} style={styles.noteRow}>
                    <Ionicons name={note.icon} size={16} color={colors.textSecondary} style={styles.noteIcon} />
                    <SelectableText style={[styles.noteText, { color: colors.textSecondary }]}>{note.text}</SelectableText>
                  </View>
                ))}
              </ScrollView>
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
  // A year of statements can bring a long list; the sheet stays on screen.
  notesScroll: { maxHeight: 220, flexGrow: 0 },
  notes: { gap: 8, marginBottom: 4, paddingHorizontal: 4 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteIcon: { marginTop: 2 },
  noteText: { flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  footer: { flexDirection: 'row', gap: 12, marginTop: 16 },
  footerBtn: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  footerBtnText: { fontSize: 16, fontWeight: '700' },
});
