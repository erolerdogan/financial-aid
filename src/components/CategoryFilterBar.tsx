import { getCategoryColor } from '@/constants/colors';
import { useI18n } from '@/contexts/LanguageContext';
import { useBlockTabSwipe } from '@/contexts/TabSwipeContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CategoryFilterBarProps {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

export function CategoryFilterBar({ categories, selected, onSelect }: CategoryFilterBarProps) {
  const { colors } = useTheme();
  const { t, categoryName } = useI18n();
  const options = ['All', ...categories];
  const blockTabSwipe = useBlockTabSwipe();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onTouchStart={blockTabSwipe}
      contentContainerStyle={styles.container}
    >
      {options.map((cat) => {
        const isActive = selected === cat;
        const tint = cat === 'All' ? colors.accent : getCategoryColor(cat);

        return (
          <TouchableOpacity
            key={cat}
            activeOpacity={0.7}
            onPress={() => {
              if (isActive) return;
              Haptics.selectionAsync().catch(() => {});
              onSelect(cat);
            }}
            style={[
              styles.chip,
              { backgroundColor: colors.field, borderColor: colors.border },
              isActive && { backgroundColor: tint, borderColor: tint },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: isActive ? '#FFFFFF' : tint }]} />
            <Text style={[styles.chipText, { color: isActive ? '#FFFFFF' : colors.text }]}>
              {cat === 'All' ? t('common.all') : categoryName(cat)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 13, fontWeight: '600' },
});