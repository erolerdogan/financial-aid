import { DebtProgressBar } from '@/components/debts/DebtProgressBar';
import { HeaderActions } from '@/components/HeaderActions';
import { DebtDetailModal } from '@/components/modals/DebtDetailModal';
import { DebtFormModal } from '@/components/modals/DebtFormModal';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { DebtSummary, getDebtSummaries, syncDebtPayments } from '@/db/database';
import { formatPayoffMonth, getDebtTypeIcon } from '@/utils/debt';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function DebtsScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { activeProfile, dataVersion, currencySymbol } = useProfile();
  const profileId = activeProfile?.id ?? 1;

  const [debts, setDebts] = useState<DebtSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [formDebt, setFormDebt] = useState<DebtSummary | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailDebt, setDetailDebt] = useState<DebtSummary | null>(null);

  const load = useCallback(async () => {
    if (!db) return;
    try {
      await syncDebtPayments(db, profileId);
      const rows = await getDebtSummaries(db, profileId);
      setDebts(rows);
      setDetailDebt((prev) => (prev ? rows.find((r) => r.id === prev.id) ?? null : null));
    } catch (error) {
      console.error('Failed to load debts:', error);
    } finally {
      setLoading(false);
    }
  }, [db, profileId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, dataVersion])
  );

  const fmt = (value: number) =>
    `${currencySymbol}${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const totalOriginal = debts.reduce((sum, d) => sum + d.originalAmount, 0);
  const totalPaid = debts.reduce((sum, d) => sum + d.paidPrincipal, 0);
  const totalBalance = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalInterest = debts.reduce((sum, d) => sum + d.paidInterest, 0);
  const overallPercent = totalOriginal > 0 ? (totalPaid / totalOriginal) * 100 : 0;
  const activeCount = debts.filter((d) => !d.isPaidOff).length;

  const openCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFormDebt(null);
    setFormVisible(true);
  };

  const openDetail = (debt: DebtSummary) => {
    Haptics.selectionAsync().catch(() => {});
    setDetailDebt(debt);
    setDetailVisible(true);
  };

  const handleEditFromDetail = () => {
    setDetailVisible(false);
    setFormDebt(detailDebt);
    setTimeout(() => setFormVisible(true), 350);
  };

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Debts</Text>
        <HeaderActions>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.accent }]}
            onPress={openCreate}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </HeaderActions>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : debts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.tintBackground }]}>
            <Ionicons name="trending-down-outline" size={32} color={colors.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Track your debts</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Add a loan, see your progress and an estimated debt-free date. Payments from your statements are linked
            automatically.
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.emptyBtn, { backgroundColor: colors.accent }]}
            onPress={openCreate}
          >
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.emptyBtnText}>Add Your First Debt</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>TOTAL REMAINING</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{fmt(totalBalance)}</Text>
            <View style={styles.summaryBar}>
              <DebtProgressBar percent={overallPercent} color={colors.accent} height={12} />
            </View>
            <View style={styles.summaryFooter}>
              <Text style={[styles.summaryFooterText, { color: colors.textSecondary }]}>
                {overallPercent.toFixed(0)}% paid • {activeCount} active
              </Text>
              <Text style={[styles.summaryFooterText, { color: colors.textSecondary }]}>
                {fmt(totalInterest)} interest (est.)
              </Text>
            </View>
          </View>

          {debts.map((debt) => (
            <TouchableOpacity
              key={debt.id}
              activeOpacity={0.8}
              style={[styles.debtCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => openDetail(debt)}
            >
              <View style={styles.debtTop}>
                <View style={[styles.debtIcon, { backgroundColor: `${debt.color}22` }]}>
                  <Ionicons name={getDebtTypeIcon(debt.type)} size={18} color={debt.color} />
                </View>
                <View style={styles.debtTitleWrap}>
                  <Text style={[styles.debtName, { color: colors.text }]} numberOfLines={1}>
                    {debt.name}
                  </Text>
                  <Text style={[styles.debtSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {debt.isPaidOff
                      ? 'Paid off'
                      : debt.payoffMonth
                      ? `Debt-free ~ ${formatPayoffMonth(debt.payoffMonth)}`
                      : 'Set a monthly payment for an estimate'}
                  </Text>
                </View>
                <View style={styles.debtAmountWrap}>
                  <Text style={[styles.debtBalance, { color: colors.text }]}>{fmt(debt.balance)}</Text>
                  <Text style={[styles.debtOf, { color: colors.textSecondary }]}>
                    of {fmt(debt.originalAmount)}
                  </Text>
                </View>
              </View>

              <View style={styles.debtBar}>
                <DebtProgressBar percent={debt.percentPaid} color={debt.color} height={8} />
              </View>
              <View style={styles.debtFooter}>
                <Text style={[styles.debtFooterText, { color: colors.textSecondary }]}>
                  {debt.percentPaid.toFixed(0)}% paid
                </Text>
                <Text style={[styles.debtFooterText, { color: colors.textSecondary }]}>
                  {debt.paymentCount} payment{debt.paymentCount === 1 ? '' : 's'}
                  {debt.apr > 0 ? ` • ${debt.apr}% APR` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <DebtDetailModal
        visible={detailVisible}
        debt={detailDebt}
        onClose={() => setDetailVisible(false)}
        onEdit={handleEditFromDetail}
        onChanged={load}
      />

      <DebtFormModal
        visible={formVisible}
        debt={formDebt}
        onClose={() => setFormVisible(false)}
        onSaved={load}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  addBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  summaryCard: { borderRadius: 18, padding: 18, borderWidth: StyleSheet.hairlineWidth },
  summaryLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  summaryValue: { fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginTop: 2 },
  summaryBar: { marginTop: 14 },
  summaryFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  summaryFooterText: { fontSize: 12, fontWeight: '600' },
  debtCard: { borderRadius: 16, padding: 14, borderWidth: StyleSheet.hairlineWidth },
  debtTop: { flexDirection: 'row', alignItems: 'center' },
  debtIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  debtTitleWrap: { flex: 1, marginRight: 8 },
  debtName: { fontSize: 16, fontWeight: '700' },
  debtSub: { fontSize: 12, marginTop: 2 },
  debtAmountWrap: { alignItems: 'flex-end' },
  debtBalance: { fontSize: 16, fontWeight: '800' },
  debtOf: { fontSize: 11, marginTop: 2 },
  debtBar: { marginTop: 12 },
  debtFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  debtFooterText: { fontSize: 11, fontWeight: '600' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySub: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 14,
    marginTop: 8,
  },
  emptyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});