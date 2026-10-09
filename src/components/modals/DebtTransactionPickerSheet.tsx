import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getUnlinkedExpenses } from '@/db/database';
import {
  debtNameFor,
  filterPickerRows,
  keywordForTransaction,
  pickerRowTitle,
  type PickerRow,
  relatedIds,
} from '@/utils/debtPicker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

export interface DebtPick {
  /** One keyword per lender the user tapped. */
  keywords: string[];
  /** The ticked transactions. */
  selectedIds: number[];
  /** Transactions a keyword matches that the user left out. */
  excludedIds: number[];
  /** Name of the first transaction tapped, as a name for the debt. */
  name: string;
}

interface DebtTransactionPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (pick: DebtPick) => void;
}

/** Every transaction one keyword links; `name` comes from the row that was tapped. */
interface PickGroup {
  keyword: string;
  ids: number[];
  name: string;
}

const ROW_HEIGHT = 56;

/** Expenses not linked to a debt yet. Tapping one selects every payment to the same lender. */
export function DebtTransactionPickerSheet({ visible, onClose, onConfirm }: DebtTransactionPickerSheetProps) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t, format } = useI18n();
  const { activeProfile, currencySymbol, currencyDecimals } = useProfile();
  const profileId = activeProfile?.id ?? 1;

  const [rows, setRows] = useState<PickerRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<PickGroup[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Every opening starts empty and loads the list again.
  const [wasVisible, setWasVisible] = useState(false);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) {
      setRows(null);
      setQuery('');
      setGroups([]);
      setSelected(new Set());
    }
  }

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getUnlinkedExpenses(db, profileId)
      .then((loaded) => {
        if (!cancelled) setRows(loaded);
      })
      .catch((error) => {
        console.error('Failed to load transactions for the debt form:', error);
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, db, profileId]);

  const shown = useMemo(() => filterPickerRows(rows ?? [], query), [rows, query]);

  const handlePress = (row: PickerRow) => {
    if (selected.has(row.id)) {
      Haptics.selectionAsync().catch(() => {});
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
      return;
    }

    // A row left out earlier comes back alone; a new lender brings all its payments.
    let ids = [row.id];
    if (!groups.some((group) => group.ids.includes(row.id))) {
      const keyword = keywordForTransaction(row);
      if (!keyword) {
        Alert.alert(t('debt.pick.noKeywordTitle'), t('debt.pick.noKeyword'));
        return;
      }
      ids = relatedIds(rows ?? [], keyword);
      setGroups((prev) => [...prev, { keyword, ids, name: debtNameFor(row) }]);
    }
    Haptics.selectionAsync().catch(() => {});
    setSelected((prev) => new Set([...prev, ...ids]));
  };

  const handleConfirm = () => {
    const used = groups.filter((group) => group.ids.some((id) => selected.has(id)));
    if (used.length === 0) return;
    Haptics.selectionAsync().catch(() => {});
    onConfirm({
      keywords: used.map((group) => group.keyword),
      selectedIds: [...selected],
      excludedIds: used.flatMap((group) => group.ids).filter((id) => !selected.has(id)),
      name: used[0].name,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} accessible={false} onPress={onClose}>
          <TouchableWithoutFeedback accessible={false}>
            <View style={[styles.sheet, { backgroundColor: colors.card }]} onAccessibilityEscape={onClose}>
              <View style={styles.header}>
                <View style={[styles.handle, { backgroundColor: colors.border }]} />
                <SelectableText style={[styles.title, { color: colors.text }]} accessibilityRole="header">
                  {t('debt.pick.title')}
                </SelectableText>
                <SelectableText style={[styles.help, { color: colors.textSecondary }]}>
                  {t('debt.pick.help')}
                </SelectableText>
              </View>

              <View style={[styles.searchBox, { backgroundColor: colors.field }]}>
                <Ionicons name="search" size={16} color={colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('debt.pick.search')}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                  accessibilityLabel={t('debt.pick.search')}
                />
              </View>

              {rows === null ? (
                <View style={[styles.list, styles.center]}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              ) : (
                <FlatList
                  style={styles.list}
                  data={shown}
                  extraData={selected}
                  keyExtractor={(row) => String(row.id)}
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={10}
                  getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
                  ListEmptyComponent={
                    <Text style={[styles.empty, { color: colors.textSecondary }]}>
                      {rows.length === 0 ? t('debt.pick.empty') : t('debt.pick.noResults')}
                    </Text>
                  }
                  renderItem={({ item: row }) => {
                    const isSelected = selected.has(row.id);
                    return (
                      <TouchableOpacity
                        style={[
                          styles.row,
                          { borderBottomColor: colors.border },
                          isSelected && { backgroundColor: colors.tintBackground },
                        ]}
                        activeOpacity={0.7}
                        onPress={() => handlePress(row)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected }}
                      >
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={isSelected ? colors.accent : colors.textSecondary}
                        />
                        <View style={styles.rowText}>
                          <Text style={[styles.merchant, { color: colors.text }]} numberOfLines={1}>
                            {pickerRowTitle(row)}
                          </Text>
                          <Text style={[styles.date, { color: colors.textSecondary }]}>{format.day(row.date)}</Text>
                        </View>
                        <Text style={[styles.amount, { color: colors.text }]}>
                          {format.money(Math.abs(row.amount), currencySymbol, currencyDecimals)}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleConfirm}
                disabled={selected.size === 0}
                style={[styles.confirm, { backgroundColor: colors.accent }, selected.size === 0 && styles.disabled]}
                accessibilityRole="button"
                accessibilityState={{ disabled: selected.size === 0 }}
              >
                <Text style={styles.confirmText}>{t('debt.pick.use', { count: selected.size })}</Text>
              </TouchableOpacity>
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
    maxHeight: '85%',
  },
  header: { alignItems: 'center', marginBottom: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 12, alignSelf: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  help: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 6 },
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
  list: { height: ROW_HEIGHT * 6 },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: ROW_HEIGHT,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1 },
  merchant: { fontSize: 15, fontWeight: '600' },
  date: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700' },
  empty: { fontSize: 14, lineHeight: 20, textAlign: 'center', paddingVertical: 24, paddingHorizontal: 12 },
  confirm: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  confirmText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.4 },
});
