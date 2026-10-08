import { SelectableText } from '@/components/SelectableText';
import { TransactionRow } from '@/components/TransactionRow';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Transaction } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface RecentActivityCardProps {
  transactions: Transaction[];
  onSelectTransaction: (transaction: Transaction) => void;
  onSeeAll: () => void;
}

export function RecentActivityCard({ transactions, onSelectTransaction, onSeeAll }: RecentActivityCardProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  if (transactions.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
        <SelectableText style={[styles.title, { color: colors.text }]}>{t('home.recent.title')}</SelectableText>
        <TouchableOpacity
          style={styles.seeAll}
          onPress={onSeeAll}
          activeOpacity={0.7}
          hitSlop={10}
          accessibilityRole="link"
        >
          <Text style={[styles.seeAllText, { color: colors.accent }]}>{t('home.recent.seeAll')}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {transactions.map((transaction, index) => (
        <TransactionRow
          key={transaction.id}
          transaction={transaction}
          isFirst={false}
          isLast={index === transactions.length - 1}
          onPress={onSelectTransaction}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 16, fontWeight: '600' },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 14, fontWeight: '600' },
});
