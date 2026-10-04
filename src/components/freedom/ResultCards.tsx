import { useTheme } from '@/contexts/ThemeContext';
import { type FreedomSummary } from '@/utils/freedom';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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

  const fmt = (value: number) => {
    const rounded = Math.round(value);
    const text = `${currencySymbol}${Math.abs(rounded).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    return rounded < 0 ? `-${text}` : text;
  };

  // A fee above the return makes the balance end below what was paid in.
  const breakdown =
    Math.round(summary.profit) >= 0
      ? `You pay in ${fmt(summary.totalInvested)}, growth adds ${fmt(summary.profit)}.`
      : `You pay in ${fmt(summary.totalInvested)}, costs take ${fmt(-summary.profit)}.`;

  return (
    <View style={stale && styles.stale}>
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
        accessible
        accessibilityLabel={`Final balance, estimated, ${fmt(summary.finalBalance)} after ${years} ${
          years === 1 ? 'year' : 'years'
        }${real ? ", in today's money" : ''}. ${breakdown}`}
      >
        <Text style={[styles.label, styles.heroLabel, { color: colors.onGradient }]}>FINAL BALANCE (EST.)</Text>
        <Text style={[styles.heroValue, { color: colors.onGradient }]} numberOfLines={1} adjustsFontSizeToFit>
          {fmt(summary.finalBalance)}
        </Text>
        <Text style={[styles.heroSub, { color: colors.onGradient }]}>
          after {years} {years === 1 ? 'year' : 'years'}
          {real ? " · in today's money" : ''}
        </Text>
        <Text style={[styles.breakdown, { color: colors.onGradient }]}>{breakdown}</Text>
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
