import { getCategoryColor } from '@/constants/colors';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { layoutTreemap } from '@/utils/treemap';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AllocationChartViewProps, sharePercent } from './types';

const HEIGHT = 170;
const GAP = 2;

// Dark text on light tiles (yellow, light blue), white on the rest.
const textOn = (hex: string): string => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return '#FFFFFF';
  const value = parseInt(match[1], 16);
  const luminance = (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255;
  return luminance > 0.62 ? '#1C1C1E' : '#FFFFFF';
};

export function TreemapChart({ items, total, expandedCategory, onCategoryPress }: AllocationChartViewProps) {
  const { colors } = useTheme();
  const { format, categoryName } = useI18n();
  const [width, setWidth] = useState(0);

  const rects = layoutTreemap(
    items.map((item) => item.totalAmount || 0),
    width,
    HEIGHT
  );

  return (
    <View style={styles.container} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {items.map((item, index) => {
        const rect = rects[index];
        if (!rect || rect.width <= GAP || rect.height <= GAP) return null;

        const percent = `${format.number(sharePercent(item.totalAmount, total), { maximumFractionDigits: 0 })}%`;
        const isSelected = expandedCategory === item.category;
        const isDimmed = expandedCategory !== null && !isSelected;
        const color = getCategoryColor(item.category);
        const textColor = isDimmed ? colors.textSecondary : textOn(color);
        const showName = rect.width >= 72 && rect.height >= 40;
        const showPercent = rect.width >= 36 && rect.height >= 22;

        return (
          <TouchableOpacity
            key={item.category}
            style={[
              styles.tile,
              {
                left: rect.x + GAP / 2,
                top: rect.y + GAP / 2,
                width: rect.width - GAP,
                height: rect.height - GAP,
                backgroundColor: isDimmed ? colors.track : color,
              },
            ]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${categoryName(item.category)}, ${percent}`}
            accessibilityState={{ expanded: isSelected }}
            onPress={() => onCategoryPress(item.category)}
          >
            {showName && (
              <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>
                {categoryName(item.category)}
              </Text>
            )}
            {showPercent && (
              <Text style={[styles.percent, { color: textColor }]} numberOfLines={1}>
                {percent}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: HEIGHT, marginBottom: 12 },
  tile: {
    position: 'absolute',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  name: { fontSize: 11, fontWeight: '600' },
  percent: { fontSize: 12, fontWeight: '800' },
});
