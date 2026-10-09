import { DebtProgressBar } from '@/components/debts/DebtProgressBar';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { DebtSummary } from '@/db/database';
import { buildDebtOutlook, loadDebtsWithPlan } from '@/services/debtPlanService';
import type { DebtPlan } from '@/utils/debtSimulator';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function DebtsCard() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();
  const { t, format } = useI18n();
  const { activeProfile, dataVersion, currencySymbol } = useProfile();
  const profileId = activeProfile?.id ?? 1;
  const { can } = useEntitlement();

  const [debts, setDebts] = useState<DebtSummary[]>([]);
  const [savedPlan, setSavedPlan] = useState<DebtPlan | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!db) return;
        try {
          const loaded = await loadDebtsWithPlan(db, profileId);
          if (active) {
            setDebts(loaded.debts);
            setSavedPlan(loaded.savedPlan);
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

  const fmt = (value: number) => format.money(value, currencySymbol, { maximumFractionDigits: 0 });

  if (debts.length === 0) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.card, styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.navigate({ pathname: '/debts', params: { segment: 'debts' } })}
        accessibilityRole="button"
      >
        <View style={[styles.iconCircle, { backgroundColor: colors.tintBackground }]}>
          <Ionicons name="trending-down-outline" size={18} color={colors.accent} />
        </View>
        <View style={styles.emptyTextWrap}>
          <Text style={[styles.title, { color: colors.text }]}>{t('home.debts.emptyTitle')}</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {t('home.debts.emptySub')}
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
  // The saved payoff plan with Pro, otherwise what the current payments give.
  const debtFreeMonth = activeCount > 0 ? buildDebtOutlook(debts, savedPlan, can('debtSimulator')).debtFreeMonth : null;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.navigate({ pathname: '/debts', params: { segment: 'debts' } })}
      accessibilityRole="button"
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>{t('home.debts.title')}</Text>
        <View style={styles.headerRight}>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {t('home.debts.active', { count: activeCount })}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
        </View>
      </View>

      <Text style={[styles.balance, { color: colors.text }]}>{fmt(totalBalance)}</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>{t('home.debts.remaining')}</Text>

      <View style={styles.bar}>
        <DebtProgressBar percent={percent} color={colors.accent} height={8} />
      </View>
      <View style={styles.footerRow}>
        <Text style={[styles.footer, { color: colors.textSecondary }]}>{t('home.debts.paidOff', { percent: percent.toFixed(0) })}</Text>
        {debtFreeMonth && (
          <Text style={[styles.footer, { color: colors.textSecondary }]}>
            {t('debt.debtFree', { month: format.monthYear(debtFreeMonth, 'short') })}
          </Text>
        )}
      </View>
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
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12 },
  footer: { fontSize: 12, fontWeight: '600', marginTop: 6 },
});