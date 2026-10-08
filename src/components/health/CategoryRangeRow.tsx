import { statusColor, statusLabelKey, trimNumber } from '@/components/health/healthUi';
import { getCategoryColor } from '@/constants/colors';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { CategoryStatus } from '@/utils/budgetHealth';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CategoryRangeRowProps {
  item: CategoryStatus;
  onPress: (item: CategoryStatus) => void;
  onLongPress: (item: CategoryStatus) => void;
}

const DOT = 12;

/** A bar from 0% of income to a bit past the range: shaded typical range, a tick for "your normal", a dot for this month. */
export function CategoryRangeRow({ item, onPress, onLongPress }: CategoryRangeRowProps) {
  const { colors } = useTheme();
  const { t, format, categoryName } = useI18n();
  const { currencySymbol } = useProfile();

  const color = statusColor(item.status, colors);
  const statusLabel = t(statusLabelKey(item.status, item.higherIsBetter));
  const name = categoryName(item.category);
  const amount = format.money(Math.round(item.amount), currencySymbol);

  const scaleMax = Math.max(10, (item.range?.max ?? 0) * 1.6, (item.pct ?? 0) * 1.15, (item.normalPct ?? 0) * 1.15);
  const position = (pct: number): number => Math.min(100, Math.max(0, (pct / scaleMax) * 100));

  const details: string[] = [];
  if (item.pct !== null) details.push(t('health.category.pct', { value: format.number(trimNumber(item.pct)) }));
  if (item.range) {
    details.push(
      t(item.overridden ? 'health.category.ownRange' : 'health.category.range', {
        min: format.number(trimNumber(item.range.min)),
        max: format.number(trimNumber(item.range.max)),
      })
    );
  }
  if (item.normal !== null && item.normal > 0) {
    details.push(t('health.category.normal', { amount: format.money(Math.round(item.normal), currencySymbol) }));
  }

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      activeOpacity={0.7}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`${t('health.category.a11y', { category: name, amount, status: statusLabel })}. ${details.join(', ')}`}
    >
      <View style={styles.header}>
        <View style={styles.nameWrap}>
          <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(item.category) }]} />
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {name}
          </Text>
        </View>
        <View style={styles.amountWrap}>
          <Text style={[styles.amount, { color: colors.text }]}>{amount}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
        </View>
      </View>

      <View style={styles.barArea}>
        <View style={[styles.track, { backgroundColor: colors.track }]} />
        {item.range ? (
          <View
            style={[
              styles.zone,
              {
                left: `${position(item.range.min)}%`,
                width: `${Math.max(1, position(item.range.max) - position(item.range.min))}%`,
                backgroundColor: `${colors.accent}40`,
              },
            ]}
          />
        ) : null}
        {item.normalPct !== null && item.normalPct > 0 ? (
          <View style={[styles.tick, { left: `${position(item.normalPct)}%`, backgroundColor: colors.text }]} />
        ) : null}
        {item.pct !== null ? (
          <View style={[styles.dotWrap, { left: `${position(item.pct)}%` }]}>
            <View style={[styles.dot, { backgroundColor: color, borderColor: colors.card }]} />
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.details, { color: colors.textSecondary }]}>{details.join(' · ')}</Text>
        <Text style={[styles.status, { color }]}>{statusLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  nameWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  categoryDot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  amountWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  amount: { fontSize: 15, fontWeight: '700' },
  barArea: { height: 20, marginTop: 8, justifyContent: 'center' },
  track: { height: 8, borderRadius: 4 },
  zone: { position: 'absolute', height: 8, borderRadius: 2 },
  tick: { position: 'absolute', width: 2, height: 16, marginLeft: -1, borderRadius: 1, opacity: 0.55 },
  // Zero-width anchor so the dot is centred on its percentage.
  dotWrap: { position: 'absolute', width: 0, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2, marginLeft: -DOT / 2 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6, marginTop: 6 },
  details: { fontSize: 12, lineHeight: 16, flexShrink: 1 },
  status: { fontSize: 12, fontWeight: '700' },
});
