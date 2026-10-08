import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { Formatters } from '@/i18n/format';
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

const formatAmount = (value: number, currencySymbol: string, format: Formatters): string => {
  const rounded = Math.round(value);
  const text = format.money(Math.abs(rounded), currencySymbol);
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
  const { t, format } = useI18n();
  const amount = (value: number) => formatAmount(value, currencySymbol, format);
  const cell = [styles.cell, { color: textColor }];
  return (
    <View
      style={[styles.row, { borderTopColor: borderColor }]}
      accessible
      accessibilityLabel={t('freedom.table.a11yRow', {
        year: row.year,
        start: amount(row.start),
        contributions: amount(row.contributions),
        profit: amount(row.profit),
        end: amount(row.end),
      })}
    >
      <SelectableText style={[cell, styles.yearCell]} numberOfLines={1}>
        {row.year}
      </SelectableText>
      <SelectableText style={cell} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {amount(row.start)}
      </SelectableText>
      <SelectableText style={cell} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {amount(row.contributions)}
      </SelectableText>
      <SelectableText style={cell} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {amount(row.profit)}
      </SelectableText>
      <SelectableText style={[cell, isLast && styles.finalCell]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {amount(row.end)}
      </SelectableText>
    </View>
  );
});

export const YearlyTable = React.memo(function YearlyTable({ rows, currencySymbol, real = false }: YearlyTableProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
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
        accessibilityLabel={real ? t('freedom.table.a11yReal') : t('freedom.table.a11y')}
        accessibilityState={{ expanded }}
        hitSlop={4}
      >
        <Text style={[styles.title, { color: colors.text }]}>{real ? t('freedom.table.titleReal') : t('freedom.table.title')}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          <View style={styles.headerRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <SelectableText style={[headerCell, styles.yearCell]}>{t('freedom.table.year')}</SelectableText>
            <SelectableText style={headerCell}>{t('freedom.table.start')}</SelectableText>
            <SelectableText style={headerCell} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {t('freedom.table.contrib')}
            </SelectableText>
            <SelectableText style={headerCell}>{t('freedom.table.profit')}</SelectableText>
            <SelectableText style={headerCell}>{t('freedom.table.end')}</SelectableText>
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
