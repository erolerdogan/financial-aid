import { SelectableText } from '@/components/SelectableText';
import { FEATURES } from '@/constants/features';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePaywall } from '@/hooks/usePaywall';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

const SHEET_CLOSE_MS = 300;

// Rendered inside each screen that can be on top when a write is blocked, like `ImportSummaryHost`:
// a sheet mounted at the root cannot present over a native modal screen (Settings).
export function ReadOnlySheetHost() {
  const { readOnlyNotice, hideReadOnly } = useEntitlement();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { openPaywall } = usePaywall();
  const isFocused = useIsFocused();

  if (!isFocused || !readOnlyNotice) return null;

  const { kind, onRemove } = readOnlyNotice;
  const message =
    kind === 'budget'
      ? t('pro.readOnly.budget', { limit: FEATURES.limits.maxBudgets })
      : kind === 'debt'
      ? t('pro.readOnly.debt', { limit: FEATURES.limits.maxDebts })
      : t('pro.readOnly.profile');

  const handleSeePro = () => {
    hideReadOnly();
    // After the sheet has gone: a screen cannot present while a modal is still closing.
    setTimeout(() => openPaywall(kind === 'budget' ? 'budgets' : kind === 'debt' ? 'debts' : 'readOnly'), SHEET_CLOSE_MS);
  };

  const handleRemove = () => {
    hideReadOnly();
    onRemove?.();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={hideReadOnly}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={hideReadOnly}>
        <TouchableWithoutFeedback>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <View style={[styles.icon, { backgroundColor: colors.tintBackground }]}>
              <Ionicons name="lock-closed" size={22} color={colors.accent} />
            </View>
            <SelectableText style={[styles.title, { color: colors.text }]} accessibilityRole="header">
              {t('pro.readOnly.title')}
            </SelectableText>
            <SelectableText style={[styles.message, { color: colors.textSecondary }]}>{message}</SelectableText>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
              activeOpacity={0.85}
              onPress={handleSeePro}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>{t('pro.seePro')}</Text>
            </TouchableOpacity>
            {onRemove && (
              <TouchableOpacity style={styles.plainBtn} activeOpacity={0.7} onPress={handleRemove} accessibilityRole="button">
                <Text style={[styles.plainText, styles.removeText]}>{t('pro.readOnly.removeBudget')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.plainBtn} activeOpacity={0.7} onPress={hideReadOnly} accessibilityRole="button">
              <Text style={[styles.plainText, { color: colors.textSecondary }]}>{t('common.notNow')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

/** For controls inside a modal, where the sheet cannot present: says why they are off. */
export function ReadOnlyNote() {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <View style={[styles.note, { backgroundColor: colors.surface }]}>
      <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
      <SelectableText style={[styles.noteText, { color: colors.textSecondary }]}>{t('pro.readOnly.note')}</SelectableText>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    alignItems: 'center',
  },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 20 },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  primaryBtn: {
    alignSelf: 'stretch',
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  plainBtn: { alignSelf: 'stretch', minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  plainText: { fontSize: 15, fontWeight: '600' },
  removeText: { color: '#FF3B30' },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
