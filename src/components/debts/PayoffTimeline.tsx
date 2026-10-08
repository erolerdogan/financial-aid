import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface PayoffTimelineRow {
  id: number;
  name: string;
  color: string;
  /** Estimated payoff month (`YYYY-MM`); null when the debt is never cleared. */
  month: string | null;
  /** Already paid off today. */
  paid: boolean;
}

interface PayoffTimelineProps {
  /** In payoff order. */
  rows: PayoffTimelineRow[];
}

export function PayoffTimeline({ rows }: PayoffTimelineProps) {
  const { colors } = useTheme();
  const { t, format } = useI18n();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <SelectableText style={[styles.title, { color: colors.textSecondary }]}>{t('debt.plan.order.title')}</SelectableText>
      {rows.map((row, index) => {
        const when = row.paid ? t('debt.paidOff') : row.month ? format.monthYear(row.month, 'short') : t('debt.plan.order.never');
        return (
          <View
            key={row.id}
            style={[styles.row, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}
            accessible
            accessibilityLabel={`${row.name}, ${when}`}
          >
            <View style={[styles.marker, { backgroundColor: row.paid ? `${row.color}22` : colors.surface }]}>
              {row.paid ? (
                <Ionicons name="checkmark" size={16} color={row.color} />
              ) : (
                <Text style={[styles.markerText, { color: colors.textSecondary }]}>{format.number(index + 1)}</Text>
              )}
            </View>
            <View style={[styles.dot, { backgroundColor: row.color }]} />
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {row.name}
            </Text>
            <Text
              style={[styles.when, { color: row.paid || row.month ? colors.text : colors.textSecondary }]}
              numberOfLines={2}
            >
              {when}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, borderWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 8 },
  marker: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  markerText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { flex: 1, fontSize: 15, fontWeight: '600' },
  when: { flexShrink: 1, maxWidth: '50%', textAlign: 'right', fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
