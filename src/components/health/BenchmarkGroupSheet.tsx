import { SelectableText } from '@/components/SelectableText';
import {
  BENCHMARK_GROUPS,
  getRangesForHousehold,
  type BenchmarkGroupId,
  type Household,
} from '@/constants/benchmarks';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

interface BenchmarkGroupSheetProps {
  /** Category being changed; null hides the sheet. */
  category: string | null;
  selected: BenchmarkGroupId | null;
  household: Household | null;
  onSelect: (group: BenchmarkGroupId) => void;
  onClose: () => void;
}

export function BenchmarkGroupSheet({ category, selected, household, onSelect, onClose }: BenchmarkGroupSheetProps) {
  const { colors } = useTheme();
  const { t, categoryName } = useI18n();
  const ranges = getRangesForHousehold(household);

  return (
    <Modal visible={category !== null} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableWithoutFeedback>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <SelectableText style={[styles.title, { color: colors.text }]}>{t('health.groupSheet.title')}</SelectableText>
            <SelectableText style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('health.groupSheet.for', { category: category ? categoryName(category) : '' })}
            </SelectableText>
            <ScrollView style={styles.list}>
              {BENCHMARK_GROUPS.map((group) => {
                const isSelected = group.id === selected;
                const range = ranges[group.id];
                return (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.item,
                      { borderBottomColor: colors.border },
                      isSelected && { backgroundColor: colors.tintBackground },
                    ]}
                    onPress={() => onSelect(group.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={styles.itemText}>
                      <Text
                        style={[
                          styles.itemTitle,
                          { color: isSelected ? colors.accent : colors.text },
                          isSelected && styles.itemTitleSelected,
                        ]}
                      >
                        {t(group.label)}
                      </Text>
                      {range ? (
                        <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
                          {t('health.groupSheet.range', { min: range.min, max: range.max })}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
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
    maxHeight: '80%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 12, alignSelf: 'center' },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 8 },
  list: { flexGrow: 0 },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    gap: 8,
  },
  itemText: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: '500' },
  itemTitleSelected: { fontWeight: '700' },
  itemSub: { fontSize: 12, marginTop: 2 },
});
