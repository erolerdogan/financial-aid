import { useTheme } from '@/contexts/ThemeContext';
import { type FeeImpact } from '@/utils/freedom';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type ValueMode = 'NOMINAL' | 'REAL';

const MODES: { key: ValueMode; label: string }[] = [
  { key: 'NOMINAL', label: 'Future prices' },
  { key: 'REAL', label: "Today's prices" },
];

interface ImpactSectionProps {
  mode: ValueMode;
  onModeChange: (mode: ValueMode) => void;
  inflationPct: number;
  /** Final balances in the selected mode. */
  fee: FeeImpact;
  feePct: number;
  currencySymbol: string;
  /** The inputs are invalid, so the numbers are from the last valid plan. */
  stale?: boolean;
}

const percent = (value: number): string => `${Number((value * 100).toFixed(2))}%`;

export function ImpactSection({
  mode,
  onModeChange,
  inflationPct,
  fee,
  feePct,
  currencySymbol,
  stale = false,
}: ImpactSectionProps) {
  const { colors } = useTheme();

  const fmt = (value: number) =>
    `${currencySymbol}${Math.round(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const cost = Math.round(fee.cost);

  const renderRow = (label: string, value: string, strong = false) => (
    <View style={styles.row} accessible accessibilityLabel={`${label}, estimated, ${value}`}>
      <Text style={[styles.rowLabel, { color: strong ? colors.text : colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.rowValue, { color: colors.text }, strong && styles.rowValueStrong]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.textSecondary }]}>PRICES AND FEES (EST.)</Text>

      <View style={[styles.segmentedContainer, { backgroundColor: colors.track }]} accessibilityRole="radiogroup">
        {MODES.map((item) => {
          const selected = item.key === mode;
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.8}
              style={[styles.segmentBtn, selected && [styles.segmentBtnActive, { backgroundColor: colors.raised }]]}
              onPress={() => onModeChange(item.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Amounts in ${item.label.toLowerCase()}`}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: colors.textSecondary },
                  selected && [styles.segmentTextActive, { color: colors.text }],
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.note, { color: colors.textSecondary }]}>
        {mode === 'REAL'
          ? `Every amount on this screen shows what it buys today, after ${percent(inflationPct)} inflation a year.`
          : 'Every amount on this screen reads as it will in the future. Prices will be higher by then.'}
      </Text>

      <View style={[styles.fees, { borderTopColor: colors.border }, stale && styles.stale]}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          FEES · FINAL BALANCE{mode === 'REAL' ? " (TODAY'S PRICES)" : ''}
        </Text>
        {renderRow('With 0% fee', fmt(fee.withoutFee))}
        {renderRow(`With ${percent(feePct)} fee`, fmt(fee.withFee))}
        {renderRow('Cost of fees', cost > 0 ? `-${fmt(cost)}` : fmt(0), true)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  segmentedContainer: { flexDirection: 'row', borderRadius: 10, padding: 2 },
  segmentBtn: { flex: 1, paddingVertical: 7, paddingHorizontal: 4, alignItems: 'center', borderRadius: 8 },
  segmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: { fontSize: 13, fontWeight: '500' },
  segmentTextActive: { fontWeight: '700' },
  note: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  fees: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 14, gap: 8 },
  stale: { opacity: 0.5 },
  subtitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 14 },
  rowValue: { flexShrink: 1, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  rowValueStrong: { fontWeight: '800' },
});
