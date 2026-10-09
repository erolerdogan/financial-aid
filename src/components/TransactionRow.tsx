import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Transaction } from '@/db/database';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface TransactionRowProps {
  transaction: Transaction;
  isFirst: boolean;
  isLast: boolean;
  onPress: (transaction: Transaction) => void;
}

/**
 * One row of a grouped transaction list (Transactions screen, Recent activity on Home).
 * Memoised: a long list re-renders on every search keystroke and every loaded page.
 */
export const TransactionRow = React.memo(function TransactionRow({
  transaction,
  isFirst,
  isLast,
  onPress,
}: TransactionRowProps) {
  const { colors } = useTheme();
  const { format, categoryName } = useI18n();
  const { currencySymbol } = useProfile();

  const isIncome = transaction.amount > 0;
  const title =
    transaction.merchant && transaction.merchant !== 'Unknown' ? transaction.merchant : transaction.rawDescription;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(transaction)}
      style={[
        styles.row,
        { backgroundColor: colors.card, borderBottomColor: colors.border },
        isFirst && styles.rowFirst,
        isLast && styles.rowLast,
        isLast && { borderBottomWidth: 0 },
      ]}
      accessibilityRole="button"
    >
      <View style={styles.rowTextWrap}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {categoryName(transaction.category)}
        </Text>
      </View>
      <Text style={[styles.rowAmount, { color: isIncome ? '#34C759' : colors.text }]} maxFontSizeMultiplier={1.5}>
        {isIncome ? '+' : '-'}
        {format.money(Math.abs(transaction.amount), currencySymbol, 2)}
      </Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  rowLast: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  rowTextWrap: { flex: 1, marginRight: 12 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSubtitle: { fontSize: 13, marginTop: 2 },
  rowAmount: { fontSize: 16, fontWeight: '700' },
});
