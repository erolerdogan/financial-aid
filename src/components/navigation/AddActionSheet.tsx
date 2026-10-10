import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { TranslationKey } from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type AddAction = 'expense' | 'income' | 'import';

interface AddActionSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after the sheet has started closing; the caller waits for it before presenting anything. */
  onPick: (action: AddAction) => void;
}

const ACTIONS: { action: AddAction; label: TranslationKey; sub: TranslationKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { action: 'expense', label: 'add.expense', sub: 'add.expenseSub', icon: 'remove-circle-outline' },
  { action: 'income', label: 'add.income', sub: 'add.incomeSub', icon: 'add-circle-outline' },
  { action: 'import', label: 'add.import', sub: 'add.importSub', icon: 'document-text-outline' },
];

/** What the center button of the tab bar offers. */
export function AddActionSheet({ visible, onClose, onPick }: AddActionSheetProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { isDemoMode } = useProfile();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} accessible={false} onPress={onClose}>
        <TouchableWithoutFeedback accessible={false}>
          <View
            style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
            onAccessibilityEscape={onClose}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <SelectableText style={[styles.title, { color: colors.text }]} accessibilityRole="header">
              {t('add.title')}
            </SelectableText>

            {ACTIONS.map(({ action, label, sub, icon }, index) => (
              <React.Fragment key={action}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <TouchableOpacity
                  style={[styles.row, isDemoMode && styles.rowDisabled]}
                  activeOpacity={0.7}
                  disabled={isDemoMode}
                  onPress={() => onPick(action)}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isDemoMode }}
                >
                  <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
                    <Ionicons name={icon} size={20} color={colors.accent} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>{t(label)}</Text>
                    <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{t(sub)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </React.Fragment>
            ))}

            {isDemoMode && (
              <SelectableText style={[styles.note, { color: colors.textSecondary }]}>{t('add.demoNote')}</SelectableText>
            )}
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
    paddingTop: 12,
  },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 12, alignSelf: 'center' },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 60 },
  rowDisabled: { opacity: 0.4 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
  note: { fontSize: 12, lineHeight: 16, marginTop: 8 },
});
