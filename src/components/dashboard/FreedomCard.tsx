import { DebtProgressBar } from '@/components/debts/DebtProgressBar';
import { useI18n } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FreedomPlan, getSavedFreedomPlan } from '@/db/database';
import { clampYears, incomeToBalance, projectGrowth, summarize } from '@/utils/freedom';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function FreedomCard() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();
  const { t, format } = useI18n();
  const { activeProfile, dataVersion, currencySymbol } = useProfile();
  const profileId = activeProfile?.id ?? 1;

  // Tagged with its profile, so a switch never shows the previous profile's plan.
  const [loaded, setLoaded] = useState<{ profileId: number; plan: FreedomPlan | null } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!db) return;
        try {
          const plan = await getSavedFreedomPlan(db, profileId);
          if (active) setLoaded({ profileId, plan });
        } catch (error) {
          console.error('Failed to load freedom card:', error);
        }
      })();
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion is listed on purpose: reload when stored data changes
    }, [db, profileId, dataVersion])
  );

  const plan = loaded?.profileId === profileId ? loaded.plan : null;
  const finalBalance = useMemo(() => (plan ? summarize(projectGrowth(plan), plan).finalBalance : 0), [plan]);

  if (!plan) return null;

  const fmt = (value: number) => format.money(Math.round(value), currencySymbol);

  const years = clampYears(plan.years);
  const endYear = new Date().getFullYear() + years;
  const target = plan.goalType === 'INCOME' ? incomeToBalance(plan.goalIncome) : Math.max(0, plan.goalBalance);
  const hasGoal = target > 0;
  const onTrack = finalBalance >= target;
  // Never rounds up to 100% while the goal is still short.
  const percent = onTrack ? 100 : Math.min(99, Math.round((finalBalance / target) * 100));

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    router.navigate({ pathname: '/debts', params: { segment: 'freedom' } });
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={
        hasGoal
          ? t('home.freedom.a11yGoal', { year: endYear, balance: fmt(finalBalance), percent, target: fmt(target) })
          : t('home.freedom.a11y', { year: endYear, balance: fmt(finalBalance) })
      }
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>{t('freedom.name')}</Text>
        <View style={styles.headerRight}>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {t('common.years', { count: years })}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
        </View>
      </View>

      <Text style={[styles.balance, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {fmt(finalBalance)}
      </Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>{t('home.freedom.estBalance', { year: endYear })}</Text>

      {hasGoal ? (
        <>
          <View style={styles.bar}>
            <DebtProgressBar percent={percent} color={colors.accent} height={8} />
          </View>
          <Text style={[styles.footer, { color: colors.textSecondary }]}>
            {t('home.freedom.goalProgress', { percent, target: fmt(target) })}
          </Text>
        </>
      ) : null}

      <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
        {t('freedom.disclaimer')}
      </Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 12 },
  balance: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 8 },
  bar: { marginTop: 12 },
  footer: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  disclaimer: { fontSize: 11, marginTop: 10 },
});
