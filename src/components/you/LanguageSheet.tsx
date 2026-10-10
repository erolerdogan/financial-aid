import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LANGUAGES, LanguageCode } from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

interface LanguageSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** The app language: one of the nine, or the device's. */
export function LanguageSheet({ visible, onClose }: LanguageSheetProps) {
  const { colors } = useTheme();
  const { t, storedLanguage, setLanguage } = useI18n();

  const options: { code: LanguageCode | null; label: string }[] = [
    { code: null, label: t('settings.languageSystem') },
    ...LANGUAGES,
  ];

  const handleSelect = (code: LanguageCode | null) => {
    Haptics.selectionAsync().catch(() => {});
    setLanguage(code);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} accessible={false} onPress={onClose}>
        <TouchableWithoutFeedback accessible={false}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]} onAccessibilityEscape={onClose}>
            <View style={styles.header}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              <SelectableText style={[styles.title, { color: colors.text }]}>{t('settings.selectLanguage')}</SelectableText>
            </View>
            <ScrollView style={styles.list}>
              {options.map((option) => {
                const selected = storedLanguage === option.code;
                return (
                  <TouchableOpacity
                    key={option.code ?? 'system'}
                    style={[
                      styles.item,
                      { borderBottomColor: colors.border },
                      selected && { backgroundColor: colors.tintBackground },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => handleSelect(option.code)}
                  >
                    <Text style={[styles.itemText, { color: selected ? colors.accent : colors.text }, selected && styles.itemTextSelected]}>
                      {option.label}
                    </Text>
                    {selected && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
  header: { alignItems: 'center', marginBottom: 16 },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 12, alignSelf: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  list: { maxHeight: 420 },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemText: { fontSize: 16, fontWeight: '500' },
  itemTextSelected: { fontWeight: '700' },
});
