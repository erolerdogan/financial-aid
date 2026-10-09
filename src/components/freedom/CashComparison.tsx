import { percent } from '@/components/freedom/ImpactSection';
import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { type CashComparison as CashComparisonResult } from '@/utils/freedom';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface CashComparisonProps {
  /** Final balances in the selected mode. */
  cash: CashComparisonResult;
  /** The cash balance in today's money, whatever the mode. */
  cashToday: number;
  inflationPct: number;
  /** Amounts are in today's money (after inflation). */
  real?: boolean;
  currencySymbol: string;
  /** The inputs are invalid, so the numbers are from the last valid plan. */
  stale?: boolean;
}

/** The plan next to the same payments left as cash (0% return, no fee). */
export function CashComparison({
  cash,
  cashToday,
  inflationPct,
  real = false,
  currencySymbol,
  stale = false,
}: CashComparisonProps) {
  const { colors } = useTheme();
  const { t, format } = useI18n();

  const fmt = (value: number) => format.money(Math.round(value), currencySymbol);

  // A fee above the return makes the plan end below the cash.
  const loss = Math.round(cash.gain) < 0;

  const renderRow = (label: string, value: string, strong = false) => (
    <View style={styles.row} accessible accessibilityLabel={t('freedom.a11yEstimated', { label, value })}>
      <SelectableText style={[styles.rowLabel, { color: strong ? colors.text : colors.textSecondary }]} numberOfLines={1}>
        {label}
      </SelectableText>
      <SelectableText
        style={[styles.rowValue, { color: colors.text }, strong && styles.rowValueStrong]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </SelectableText>
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, stale && styles.stale]}>
      <SelectableText style={[styles.title, { color: colors.textSecondary }]}>
        {t(real ? 'freedom.cash.titleReal' : 'freedom.cash.title')}
      </SelectableText>
      <View style={styles.rows}>
        {renderRow(t('freedom.cash.invested'), fmt(cash.invested))}
        {renderRow(t('freedom.cash.cash'), fmt(cash.cash))}
        <View style={[styles.total, { borderTopColor: colors.border }]}>
          {renderRow(t(loss ? 'freedom.cash.loss' : 'freedom.cash.gain'), fmt(Math.abs(cash.gain)), true)}
        </View>
      </View>
      {inflationPct > 0 && (
        <SelectableText style={[styles.note, { color: colors.textSecondary }]}>
          {real
            ? t('freedom.cash.noteReal', { percent: percent(inflationPct) })
            : t('freedom.cash.noteNominal', { percent: percent(inflationPct), value: fmt(cashToday) })}
        </SelectableText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  stale: { opacity: 0.5 },
  title: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  rows: { gap: 8 },
  total: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 14 },
  rowValue: { flexShrink: 1, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  rowValueStrong: { fontWeight: '800' },
  note: { fontSize: 12, lineHeight: 17, marginTop: 10 },
});
