import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SummaryCardsProps {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
  };
  totalTransactions: number;
  categoryCount: number;
  onPressCard: (type: 'INCOME' | 'EXPENSE') => void;
}

export function SummaryCards({
  summary,
  totalTransactions,
  categoryCount,
  onPressCard,
}: SummaryCardsProps) {
  const { colors } = useTheme();
  const { currencySymbol } = useProfile();
  const { t, format } = useI18n();

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.8}
          onPress={() => onPressCard('INCOME')}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('home.totalIncome')}</Text>
          <Text style={[styles.amount, { color: '#34C759' }]}>
            {format.money(summary.totalIncome, currencySymbol, 2)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={0.8}
          onPress={() => onPressCard('EXPENSE')}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('home.totalExpenses')}</Text>
          <Text style={[styles.amount, { color: '#FF3B30' }]}>
            {format.money(summary.totalExpenses, currencySymbol, 2)}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.netCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SelectableText style={[styles.netCardLabel, { color: colors.textSecondary }]}>{t('home.netCashFlow')}</SelectableText>
        <SelectableText
          style={[
            styles.netAmountHorizontal,
            { color: summary.netSavings >= 0 ? '#34C759' : '#FF3B30' },
          ]}
        >
          {format.money(summary.netSavings, currencySymbol, 2)}
        </SelectableText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  card: {
    flex: 1,
    borderRadius: 16.5,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  netCard: {
    borderRadius: 16.5,
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4, letterSpacing: 0.3 },
  amount: { fontSize: 20, fontWeight: '700' },
  netCardLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  netAmountHorizontal: { fontSize: 20, fontWeight: '700' },
});