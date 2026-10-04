import { DebtProgressBar } from '@/components/debts/DebtProgressBar';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { DebtSummary, getDebtSummaries, syncDebtPayments } from '@/db/database';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function DebtsCard() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();
  const { activeProfile, dataVersion, currencySymbol } = useProfile();
  const profileId = activeProfile?.id ?? 1;

  const [debts, setDebts] = useState<DebtSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!db) return;
        try {
          await syncDebtPayments(db, profileId);
          const rows = await getDebtSummaries(db, profileId);
          if (active) {
            setDebts(rows);
            setLoaded(true);
          }
        } catch (error) {
          console.error('Failed to load debts card:', error);
        }
      })();
      return () => {
        active = false;
      };
    }, [db, profileId, dataVersion])
  );

  if (!loaded) return null;

  const fmt = (value: number) =>
    `${currencySymbol}${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  if (debts.length === 0) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.card, styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.navigate({ pathname: '/debts', params: { segment: 'debts' } })}
      >
        <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
          <Ionicons name="trending-down-outline" size={18} color={colors.accent} />
        </View>
        <View style={styles.emptyTextWrap}>
          <Text style={[styles.title, { color: colors.text }]}>Track your debts</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            See progress and your debt-free date
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  }

  const totalOriginal = debts.reduce((sum, d) => sum + d.originalAmount, 0);
  const totalPaid = debts.reduce((sum, d) => sum + d.paidPrincipal, 0);
  const totalBalance = debts.reduce((sum, d) => sum + d.balance, 0);
  const percent = totalOriginal > 0 ? (totalPaid / totalOriginal) * 100 : 0;
  const activeCount = debts.filter((d) => !d.isPaidOff).length;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.navigate({ pathname: '/debts', params: { segment: 'debts' } })}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Debts</Text>
        <View style={styles.headerRight}>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {activeCount} active
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
        </View>
      </View>

      <Text style={[styles.balance, { color: colors.text }]}>{fmt(totalBalance)}</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>remaining</Text>

      <View style={styles.bar}>
        <DebtProgressBar percent={percent} color={colors.accent} height={8} />
      </View>
      <Text style={[styles.footer, { color: colors.textSecondary }]}>{percent.toFixed(0)}% paid off</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyTextWrap: { flex: 1 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 12 },
  balance: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 8 },
  bar: { marginTop: 12 },
  footer: { fontSize: 12, fontWeight: '600', marginTop: 6 },
});