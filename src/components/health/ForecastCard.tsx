import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { HealthForecast } from '@/utils/healthForecast';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface ForecastCardProps {
  forecast: HealthForecast;
}

/** Next month as a typical month of this year, with what to change. Rendered inside a card of `HealthScreen`. */
export function ForecastCard({ forecast }: ForecastCardProps) {
  const { colors } = useTheme();
  const { t, format, categoryName } = useI18n();
  const { currencySymbol } = useProfile();

  const money = (value: number): string => format.money(Math.round(value), currencySymbol);

  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: t('report.income'), value: money(forecast.income) },
    { label: t('health.pillar.fixed'), value: money(forecast.fixed) },
    { label: t('report.flexible'), value: money(forecast.flexible) },
    { label: t('health.forecast.leftOver'), value: money(forecast.leftOver), strong: true },
  ];

  const basis = [t('health.forecast.basis', { from: format.monthYear(forecast.from), to: format.monthYear(forecast.to) })];
  if (forecast.monthsDropped > 0) basis.push(t('health.forecast.unusual', { count: forecast.monthsDropped }));
  if (forecast.oneOffs > 0) basis.push(t('health.forecast.oneOff', { count: forecast.oneOffs }));

  const suggestions = forecast.categories.map((item) =>
    t('health.forecast.category', {
      category: categoryName(item.category),
      amount: money(item.typical),
      cut: money(item.cut),
    })
  );
  if (forecast.improvement) {
    suggestions.unshift(t(forecast.improvement.message.key, forecast.improvement.message.params));
  }

  return (
    <View>
      <SelectableText style={[styles.title, { color: colors.text }]}>{t('health.forecast.title')}</SelectableText>
      <SelectableText style={[styles.month, { color: colors.textSecondary }]}>{format.monthYear(forecast.month)}</SelectableText>

      {rows.map((row) => (
        <View
          key={row.label}
          style={[styles.row, { borderBottomColor: colors.border }]}
          accessible
          accessibilityLabel={`${row.label}: ${row.value}`}
        >
          <SelectableText style={[styles.label, { color: row.strong ? colors.text : colors.textSecondary }]}>
            {row.label}
          </SelectableText>
          <SelectableText style={[row.strong ? styles.valueStrong : styles.value, { color: colors.text }]}>
            {row.value}
          </SelectableText>
        </View>
      ))}

      <SelectableText style={[styles.note, { color: colors.textSecondary }]}>{basis.join(' ')}</SelectableText>

      <View style={[styles.suggestBox, { backgroundColor: colors.tintBackground }]}>
        <SelectableText style={[styles.suggestLabel, { color: colors.accent }]}>
          {t('health.forecast.suggestions')}
        </SelectableText>
        {suggestions.length === 0 ? (
          <SelectableText style={[styles.suggestText, { color: colors.text }]}>{t('health.allGood')}</SelectableText>
        ) : (
          suggestions.map((text) => (
            <SelectableText key={text} style={[styles.suggestText, { color: colors.text }]}>
              {text}
            </SelectableText>
          ))
        )}
      </View>

      <SelectableText style={[styles.disclaimer, { color: colors.textSecondary }]}>{t('freedom.disclaimer')}</SelectableText>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700' },
  month: { fontSize: 13, fontWeight: '600', marginTop: 2, marginBottom: 6 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    minHeight: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 14, flexShrink: 1 },
  value: { fontSize: 15, fontWeight: '600' },
  valueStrong: { fontSize: 17, fontWeight: '800' },
  note: { fontSize: 12, lineHeight: 17, marginTop: 10 },
  suggestBox: { borderRadius: 12, padding: 12, marginTop: 14, gap: 6 },
  suggestLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  suggestText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  disclaimer: { fontSize: 11, marginTop: 12, textAlign: 'center' },
});
