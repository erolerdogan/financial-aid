import { SignInButtons } from '@/components/account/SignInButtons';
import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

interface SignInSheetProps {
  visible: boolean;
  onClose: () => void;
  onSignedIn: () => void;
}

// Rendered inside the screen that asks, like `ReadOnlySheetHost`: a sheet mounted at the root cannot
// present over a native modal screen (the paywall, Settings).
/** Asks for an account before a purchase. Props come from `useRequireAccount`. */
export function SignInSheet({ visible, onClose, onSignedIn }: SignInSheetProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} accessible={false} onPress={onClose}>
          <TouchableWithoutFeedback accessible={false}>
            <View style={[styles.sheet, { backgroundColor: colors.card }]} onAccessibilityEscape={onClose}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                <SelectableText style={[styles.title, { color: colors.text }]} accessibilityRole="header">
                  {t('account.sheet.title')}
                </SelectableText>
                <SelectableText style={[styles.message, { color: colors.textSecondary }]}>
                  {t('account.sheet.subtitle')}
                </SelectableText>
                {/* Mounted per opening, so a typed address or an error does not come back. */}
                {visible && <SignInButtons onSignedIn={onSignedIn} />}
                <TouchableOpacity style={styles.plainBtn} activeOpacity={0.7} onPress={onClose} accessibilityRole="button">
                  <Text style={[styles.plainText, { color: colors.textSecondary }]}>{t('common.notNow')}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 12, alignSelf: 'center' },
  content: { alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 6, marginBottom: 20 },
  plainBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  plainText: { fontSize: 15, fontWeight: '600' },
});
