import { ScoreRing } from '@/components/health/ScoreRing';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DebtFreeHeroProps {
  /** Estimated debt-free month (`YYYY-MM`); null when the debts are never cleared. */
  month: string | null;
  /** Nothing is owed any more. */
  allPaid: boolean;
  /** The month comes from the saved plan, not from the current payments alone. */
  fromPlan: boolean;
  totalBalance: number;
  /** 0-100, share of the borrowed amounts that is paid back. */
  percentPaid: number;
  interestPaid: number;
  activeCount: number;
  currencySymbol: string;
  onPress: () => void;
}

const RING_SIZE = 64;

// Plain Text, not SelectableText: the whole card is a button.
export function DebtFreeHero({
  month,
  allPaid,
  fromPlan,
  totalBalance,
  percentPaid,
  interestPaid,
  activeCount,
  currencySymbol,
  onPress,
}: DebtFreeHeroProps) {
  const { colors } = useTheme();
  const { t, format } = useI18n();

  const fmt = (value: number) => format.money(value, currencySymbol, { maximumFractionDigits: 0 });
  const ink = colors.onGradient;

  const headline = allPaid ? t('debt.plan.heroDone') : month ? format.monthYear(month) : t('debt.plan.heroNever');
  const sub = allPaid
    ? t('debt.percentPaid', { percent: percentPaid.toFixed(0) })
    : month
    ? t(fromPlan ? 'debt.plan.withPlan' : 'debt.plan.withCurrent')
    : t('debt.plan.heroNeverSub');
  const remaining = t('debt.plan.heroRemaining', { amount: fmt(totalBalance) });
  const action = t(fromPlan ? 'debt.plan.view' : 'debt.plan.make');

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('debt.plan.heroA11y', { month: headline, remaining, action })}
    >
      <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.top}>
          <View style={styles.topText}>
            <Text style={[styles.label, { color: ink }]}>{t('debt.plan.heroTitle')}</Text>
            <Text style={[styles.value, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {headline}
            </Text>
            <Text style={[styles.sub, { color: ink }]}>{sub}</Text>
          </View>
          <ScoreRing
            score={percentPaid}
            size={RING_SIZE}
            strokeWidth={6}
            color={ink}
            trackColor={`${ink}33`}
            animated
          >
            <Text style={[styles.ringText, { color: ink }]} maxFontSizeMultiplier={1.3}>
              {`${format.number(Math.round(percentPaid))}%`}
            </Text>
          </ScoreRing>
        </View>

        <View style={styles.stats}>
          <Text style={[styles.stat, { color: ink }]}>{remaining}</Text>
          <Text style={[styles.statMuted, { color: ink }]}>
            {t('home.debts.active', { count: activeCount })} • {t('debt.interestEst', { amount: fmt(interestPaid) })}
          </Text>
        </View>

        <View style={[styles.action, { backgroundColor: `${ink}22` }]}>
          <Text style={[styles.actionText, { color: ink }]}>{action}</Text>
          <Ionicons name="chevron-forward" size={16} color={ink} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 18 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topText: { flex: 1 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, opacity: 0.85 },
  value: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8, marginTop: 2 },
  sub: { fontSize: 13, opacity: 0.85, marginTop: 2 },
  ringText: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stats: { marginTop: 14, gap: 2 },
  stat: { fontSize: 15, fontWeight: '700' },
  statMuted: { fontSize: 12, fontWeight: '600', opacity: 0.85 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
    borderRadius: 12,
    marginTop: 14,
  },
  actionText: { fontSize: 15, fontWeight: '700' },
});
