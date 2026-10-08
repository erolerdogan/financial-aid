import { SelectableText } from '@/components/SelectableText';
import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { type FreedomSummary } from '@/utils/freedom';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface ResultCardsProps {
  summary: FreedomSummary;
  years: number;
  currencySymbol: string;
  /** Amounts are in today's money (after inflation). */
  real?: boolean;
  /** The inputs are invalid, so the numbers are from the last valid plan. */
  stale?: boolean;
}

export function ResultCards({ summary, years, currencySymbol, real = false, stale = false }: ResultCardsProps) {
  const { colors } = useTheme();
  const { t, format } = useI18n();

  const fmt = (value: number) => {
    const rounded = Math.round(value);
    const text = format.money(Math.abs(rounded), currencySymbol);
    return rounded < 0 ? `-${text}` : text;
  };

  // A fee above the return makes the balance end below what was paid in.
  const breakdown =
    Math.round(summary.profit) >= 0
      ? t('freedom.result.growthAdds', { invested: fmt(summary.totalInvested), profit: fmt(summary.profit) })
      : t('freedom.result.costsTake', { invested: fmt(summary.totalInvested), cost: fmt(-summary.profit) });
  const after = t(real ? 'freedom.result.afterReal' : 'freedom.result.after', {
    years: t('common.years', { count: years }),
  });

  return (
    <View style={stale && styles.stale}>
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
        accessible
        accessibilityLabel={t('freedom.result.a11y', { balance: fmt(summary.finalBalance), after, breakdown })}
      >
        <SelectableText style={[styles.label, styles.heroLabel, { color: colors.onGradient }]}>{t('freedom.result.title')}</SelectableText>
        <SelectableText style={[styles.heroValue, { color: colors.onGradient }]} numberOfLines={1} adjustsFontSizeToFit>
          {fmt(summary.finalBalance)}
        </SelectableText>
        <SelectableText style={[styles.heroSub, { color: colors.onGradient }]}>
          {after}
        </SelectableText>
        <SelectableText style={[styles.breakdown, { color: colors.onGradient }]}>{breakdown}</SelectableText>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  stale: { opacity: 0.5 },
  heroCard: { borderRadius: 18, padding: 18 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroLabel: { opacity: 0.85 },
  heroValue: { fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginTop: 2 },
  heroSub: { fontSize: 13, opacity: 0.85, marginTop: 2 },
  breakdown: { fontSize: 14, fontWeight: '600', lineHeight: 19, marginTop: 12 },
});
