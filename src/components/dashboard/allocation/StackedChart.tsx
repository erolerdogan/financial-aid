import { getCategoryColor } from '@/constants/colors';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AllocationChartViewProps, sharePercent } from './types';

export function StackedChart({ items, total, expandedCategory, onCategoryPress }: AllocationChartViewProps) {
  const { colors } = useTheme();
  const { format, categoryName } = useI18n();

  const shown = items.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  // Share of the categories that are not in `items`; left as empty track.
  const rest = Math.max(0, total - shown);

  return (
    <View style={[styles.bar, { backgroundColor: colors.track }]}>
      {items.map((item) => {
        if (!(item.totalAmount > 0)) return null;
        const percent = `${format.number(sharePercent(item.totalAmount, total), { maximumFractionDigits: 0 })}%`;
        const isSelected = expandedCategory === item.category;
        const isDimmed = expandedCategory !== null && !isSelected;

        return (
          <TouchableOpacity
            key={item.category}
            style={[
              styles.segment,
              {
                flexGrow: item.totalAmount,
                backgroundColor: getCategoryColor(item.category),
                borderRightColor: colors.card,
                opacity: isDimmed ? 0.3 : 1,
              },
            ]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${categoryName(item.category)}, ${percent}`}
            accessibilityState={{ expanded: isSelected }}
            onPress={() => onCategoryPress(item.category)}
          />
        );
      })}
      {rest > 0 && <View style={{ flexGrow: rest, flexBasis: 0 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: 32,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
  },
  segment: { flexBasis: 0, minWidth: 3, borderRightWidth: 2 },
});
