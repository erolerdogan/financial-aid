import { getCategoryColor } from '@/constants/colors';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AllocationChartViewProps, sharePercent } from './types';

const BAR_AREA_HEIGHT = 120;
// Above this many columns the percent labels no longer fit.
const MAX_LABELLED_COLUMNS = 8;

export function ColumnsChart({ items, total, expandedCategory, onCategoryPress }: AllocationChartViewProps) {
  const { colors } = useTheme();
  const { format, categoryName } = useI18n();

  const largest = items.reduce((max, item) => Math.max(max, item.totalAmount || 0), 0);
  const showLabels = items.length <= MAX_LABELLED_COLUMNS;

  return (
    <View style={styles.row}>
      {items.map((item) => {
        const percent = `${format.number(sharePercent(item.totalAmount, total), { maximumFractionDigits: 0 })}%`;
        const isSelected = expandedCategory === item.category;
        const isDimmed = expandedCategory !== null && !isSelected;
        const height = largest > 0 ? Math.max(3, (item.totalAmount / largest) * BAR_AREA_HEIGHT) : 3;

        return (
          <TouchableOpacity
            key={item.category}
            style={styles.column}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${categoryName(item.category)}, ${percent}`}
            accessibilityState={{ expanded: isSelected }}
            onPress={() => onCategoryPress(item.category)}
          >
            {showLabels && (
              <Text
                style={[styles.percent, { color: isSelected ? colors.text : colors.textSecondary }]}
                numberOfLines={1}
              >
                {percent}
              </Text>
            )}
            <View
              style={[
                styles.bar,
                { height, backgroundColor: isDimmed ? colors.track : getCategoryColor(item.category) },
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: BAR_AREA_HEIGHT + 20,
    marginBottom: 12,
  },
  column: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  percent: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  bar: { width: '100%', maxWidth: 44, borderRadius: 6 },
});
