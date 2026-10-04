import { useTheme } from '@/contexts/ThemeContext';
import { type YearRow } from '@/utils/freedom';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface YearlyTableProps {
  rows: YearRow[];
  currencySymbol: string;
  /** Amounts are in today's money (after inflation). */
  real?: boolean;
}

const formatAmount = (value: number, currencySymbol: string): string => {
  const rounded = Math.round(value);
  const text = `${currencySymbol}${Math.abs(rounded).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return rounded < 0 ? `-${text}` : text;
};

interface YearlyRowProps {
  row: YearRow;
  currencySymbol: string;
  isLast: boolean;
  textColor: string;
  borderColor: string;
}

const YearlyRow = React.memo(function YearlyRow({
  row,
  currencySymbol,
  isLast,
  textColor,
  borderColor,
}: YearlyRowProps) {
  const cell = [styles.cell, { color: textColor }];
  return (
    <View
      style={[styles.row, { borderTopColor: borderColor }]}
      accessible
      accessibilityLabel={`Year ${row.year}. Start ${formatAmount(row.start, currencySymbol)}, contributions ${formatAmount(
        row.contributions,
        currencySymbol
      )}, profit ${formatAmount(row.profit, currencySymbol)}, end ${formatAmount(row.end, currencySymbol)}`}
    >
      <Text style={[cell, styles.yearCell]} numberOfLines={1}>
        {row.year}
      </Text>
      <Text style={cell} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {formatAmount(row.start, currencySymbol)}
      </Text>
      <Text style={cell} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {formatAmount(row.contributions, currencySymbol)}
      </Text>
      <Text style={cell} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {formatAmount(row.profit, currencySymbol)}
      </Text>
      <Text style={[cell, isLast && styles.finalCell]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {formatAmount(row.end, currencySymbol)}
      </Text>
    </View>
  );
});

export const YearlyTable = React.memo(function YearlyTable({ rows, currencySymbol, real = false }: YearlyTableProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    Haptics.selectionAsync().catch(() => {});
    setExpanded((value) => !value);
  };

  const headerCell = [styles.cell, styles.headerCell, { color: colors.textSecondary }];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable
        onPress={toggle}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityLabel={real ? "Yearly breakdown, in today's money" : 'Yearly breakdown'}
        accessibilityState={{ expanded }}
        hitSlop={4}
      >
        <Text style={[styles.title, { color: colors.text }]}>{real ? "Yearly breakdown (est., today's prices)" : 'Yearly breakdown (est.)'}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          <View style={styles.headerRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={[headerCell, styles.yearCell]}>YEAR</Text>
            <Text style={headerCell}>START</Text>
            <Text style={headerCell} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              CONTRIB.
            </Text>
            <Text style={headerCell}>PROFIT</Text>
            <Text style={headerCell}>END</Text>
          </View>
          {rows.map((row, index) => (
            <YearlyRow
              key={row.year}
              row={row}
              currencySymbol={currencySymbol}
              isLast={index === rows.length - 1}
              textColor={colors.text}
              borderColor={colors.border}
            />
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 18, paddingHorizontal: 16, borderWidth: StyleSheet.hairlineWidth },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  title: { fontSize: 15, fontWeight: '600' },
  body: { paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cell: { flex: 1, fontSize: 12, textAlign: 'right', fontVariant: ['tabular-nums'] },
  headerCell: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  yearCell: { flex: 0, width: 30, textAlign: 'left' },
  finalCell: { fontWeight: '800' },
});
