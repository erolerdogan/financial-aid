import { SelectableText } from '@/components/SelectableText';
import { CURRENCY_CODES, currencyInfo } from '@/constants/currencies';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { currencyLabel } from '@/i18n/currencyNames';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

interface CurrencyPickerSheetProps {
  visible: boolean;
  /** Code of the currency in use. */
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
  /** A pick is being worked on: the rows do not react. */
  busy?: boolean;
  /** Shown under the list, e.g. the credit for the exchange rates. */
  footer?: React.ReactNode;
}

const ROW_HEIGHT = 52;

/** Every currency the app offers, with a search on code and name. */
export function CurrencyPickerSheet({ visible, selected, onSelect, onClose, busy = false, footer }: CurrencyPickerSheetProps) {
  const { colors } = useTheme();
  const { t, language, currencyName } = useI18n();
  const [query, setQuery] = useState('');

  const close = () => {
    setQuery('');
    onClose();
  };

  // The English name is searched too: someone using the app in another language may know only that one.
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    // A code the app does not offer (from an older backup) is still listed while it is in use.
    const codes = CURRENCY_CODES.includes(selected) ? CURRENCY_CODES : [selected, ...CURRENCY_CODES];
    if (!needle) return codes;
    return codes.filter(
      (code) =>
        code.toLowerCase().includes(needle) ||
        currencyLabel(code, language).toLowerCase().includes(needle) ||
        currencyLabel(code, 'en').toLowerCase().includes(needle)
    );
  }, [query, language, selected]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} accessible={false} onPress={close}>
          <TouchableWithoutFeedback accessible={false}>
            <View style={[styles.sheet, { backgroundColor: colors.card }]} onAccessibilityEscape={close}>
              <View style={styles.header}>
                <View style={[styles.handle, { backgroundColor: colors.border }]} />
                <SelectableText style={[styles.title, { color: colors.text }]} accessibilityRole="header">
                  {t('settings.selectCurrency')}
                </SelectableText>
              </View>

              <View style={[styles.searchBox, { backgroundColor: colors.field }]}>
                <Ionicons name="search" size={16} color={colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('settings.searchCurrency')}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                  accessibilityLabel={t('settings.searchCurrency')}
                />
                {busy && <ActivityIndicator size="small" color={colors.accent} />}
              </View>

              <FlatList
                style={styles.list}
                data={rows}
                keyExtractor={(code) => code}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={12}
                getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
                ListEmptyComponent={
                  <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('settings.noCurrencyFound')}</Text>
                }
                renderItem={({ item: code }) => {
                  const isSelected = code === selected;
                  const name = currencyName(code);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.row,
                        { borderBottomColor: colors.border },
                        isSelected && { backgroundColor: colors.tintBackground },
                      ]}
                      disabled={busy}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        onSelect(code);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${name}, ${code}`}
                      accessibilityState={{ selected: isSelected, disabled: busy }}
                    >
                      <Text style={[styles.code, { color: isSelected ? colors.accent : colors.text }]}>{code}</Text>
                      <Text
                        style={[styles.name, { color: colors.text }, isSelected && { fontWeight: '700', color: colors.accent }]}
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                      <Text style={[styles.symbol, { color: colors.textSecondary }]}>{currencyInfo(code).symbol.trim()}</Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                    </TouchableOpacity>
                  );
                }}
              />

              {footer}
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
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    maxHeight: '80%',
  },
  header: { alignItems: 'center', marginBottom: 16 },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 12, alignSelf: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  list: { height: ROW_HEIGHT * 7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: ROW_HEIGHT,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  code: { width: 44, fontSize: 15, fontWeight: '700' },
  name: { flex: 1, fontSize: 16, fontWeight: '500' },
  symbol: { fontSize: 15, fontWeight: '600' },
  empty: { fontSize: 15, textAlign: 'center', paddingVertical: 24 },
});
